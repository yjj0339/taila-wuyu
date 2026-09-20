// 冒烟测试：加载游戏、模拟操作、截图、收集报错
// 用法: node tools/smoke.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('E:/ZCODE/ink-jiangnan/package.json');
const { chromium } = require('playwright');

const BASE = 'http://localhost:8124';
mkdirSync('shots', { recursive: true });

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

const step = async (name, fn) => {
  try { await fn(); console.log('PASS', name); }
  catch (e) { console.log('FAIL', name, '-', e.message); errors.push(`STEP ${name}: ${e.message}`); }
};

// 1. 加载（测试模式）
await step('load', async () => {
  await page.goto(BASE + '/?__test=1&t=' + Date.now());
  await page.waitForFunction(() => window.__hook && window.__hook.game, { timeout: 15000 });
  await page.waitForTimeout(800);
});
await step('world-generated', async () => {
  const info = await page.evaluate(() => {
    const G = window.__hook.G, g = window.__hook.game;
    return { tiles: G.world.tiles.length, spawn: G.world.spawn, px: Math.round(g.player.x), py: Math.round(g.player.y), hp: g.player.hp };
  });
  if (info.tiles < 100000) throw new Error('world too small ' + info.tiles);
  console.log('  world:', JSON.stringify(info));
});
await page.screenshot({ path: 'shots/01-spawn.png' });

// 2. 移动与跳跃
await step('move-jump', async () => {
  await page.keyboard.down('d');
  await page.waitForTimeout(900);
  await page.keyboard.up('d');
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);
  const x = await page.evaluate(() => window.__hook.game.player.x);
  console.log('  player.x after move:', Math.round(x));
});
await page.screenshot({ path: 'shots/02-moved.png' });

// 3. 挖掘：把准星移到脚下前方泥土连挖
await step('dig', async () => {
  for (let i = 0; i < 5; i++){
    const spot = await page.evaluate(() => {
      const G = window.__hook.G, p = window.__hook.game.player;
      // 找玩家右下方第一个泥土/石头
      for (let dy = -1; dy <= 3; dy++) for (let dx = 1; dx <= 3; dx++){
        const tx = Math.floor(p.x) + dx, ty = Math.floor(p.y) + dy + 1;
        const id = G.getTile(tx, ty);
        if (id === 1 || id === 2 || id === 3){
          // 屏幕坐标
          const R = G.render;
          const sx = (tx + .5 - G.cam.x) * R.zoom * 32 + R.W / 2;
          const sy = (ty + .5 - G.cam.y) * R.zoom * 32 + R.H / 2;
          return { sx, sy, id };
        }
      }
      return null;
    });
    if (!spot){ console.log('  no diggable spot found'); break; }
    await page.mouse.move(spot.sx, spot.sy);
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
  }
  const wood = await page.evaluate(() => {
    const G = window.__hook.G;
    return G.inv.slots.filter(Boolean).map(s => s.id + 'x' + s.n).join(',');
  });
  console.log('  inventory:', wood || '(empty)');
});
await page.screenshot({ path: 'shots/03-dug.png' });

// 4. 砍树
await step('chop-tree', async () => {
  const tree = await page.evaluate(() => {
    const G = window.__hook.G, p = window.__hook.game.player;
    for (let r = 3; r < 40; r++) for (let dx = -r; dx <= r; dx++){
      const tx = Math.floor(p.x) + dx;
      const s = G.world.surface[tx];
      for (let up = 1; up <= 9; up++){
        const ty = s - up;
        if (G.getTile(tx, ty) === 4){ // TREE
          const R = G.render;
          return { sx: (tx + .5 - G.cam.x) * R.zoom * 32 + R.W / 2, sy: (ty + .5 - G.cam.y) * R.zoom * 32 + R.H / 2, tx, ty };
        }
      }
    }
    return null;
  });
  if (!tree){ console.log('  no tree nearby (ok if cleared)'); }
  else {
    // 先走到树旁
    await page.evaluate(() => { const G = window.__hook.G; G.game.player.x = window.__hook.game.player.x; });
    await page.mouse.move(tree.sx, tree.sy);
    // 选铜斧(第2格)
    await page.keyboard.press('2');
    for (let i = 0; i < 4; i++){
      await page.mouse.down(); await page.waitForTimeout(600); await page.mouse.up();
      const again = await page.evaluate(() => {
        const G = window.__hook.G, p = window.__hook.game.player;
        for (let dx = -2; dx <= 4; dx++) for (let up = 1; up <= 9; up++){
          if (G.getTile(Math.floor(p.x) + dx, G.world.surface[Math.floor(p.x) + dx] - up) === 4){
            const R = G.render, tx = Math.floor(p.x) + dx, ty = G.world.surface[Math.floor(p.x) + dx] - up;
            return { sx: (tx + .5 - G.cam.x) * R.zoom * 32 + R.W / 2, sy: (ty + .5 - G.cam.y) * R.zoom * 32 + R.H / 2 };
          }
        }
        return null;
      });
      if (!again) break;
      await page.mouse.move(again.sx, again.sy);
    }
  }
  const inv = await page.evaluate(() => {
    const G = window.__hook.G;
    return G.inv.slots.filter(Boolean).map(s => s.id + 'x' + s.n).join(',');
  });
  console.log('  inventory:', inv || '(empty)');
});
await page.screenshot({ path: 'shots/04-tree.png' });

// 5. 时间快进到夜晚 → 刷怪
await step('night-enemies', async () => {
  await page.evaluate(() => {
    const G = window.__hook.G, g = window.__hook.game;
    g.timeTod = .6; g.dayT = G.CFG.DAY_LEN + 50;
  });
  await page.waitForTimeout(3000);
  const n = await page.evaluate(() => window.__hook.game.entities.filter(e => e.kind === 'enemy').length);
  console.log('  enemies at night:', n);
});
await page.screenshot({ path: 'shots/05-night.png' });

// 6. 背包 UI
await step('inventory-ui', async () => {
  await page.keyboard.press('e');
  await page.waitForTimeout(300);
  const vis = await page.evaluate(() => document.getElementById('invPanel').classList.contains('open'));
  if (!vis) throw new Error('inventory did not open');
  const recipes = await page.evaluate(() => document.querySelectorAll('.recipe').length);
  console.log('  recipes shown:', recipes);
});
await page.screenshot({ path: 'shots/06-inv.png' });
await page.keyboard.press('e');

// 7. 召唤 Boss（给物品→夜晚召唤）
await step('boss-eye', async () => {
  await page.evaluate(() => {
    const G = window.__hook.G;
    G.inv.add('suspicious_eye', 1);
    G.inv.sel = 9; // 放到某格? add 会放到空格
  });
  await page.evaluate(() => {
    const G = window.__hook.G;
    const f = G.inv.find('suspicious_eye');
    if (f){ G.inv.sel = f.idx; G.summonBoss('eye'); }
  });
  await page.waitForTimeout(2500);
  const boss = await page.evaluate(() => {
    const g = window.__hook.game;
    return g.boss ? { hp: Math.round(g.boss.hp), x: Math.round(g.boss.x), y: Math.round(g.boss.y) } : null;
  });
  if (!boss) throw new Error('boss not spawned');
  console.log('  boss eye:', JSON.stringify(boss));
  // 直接施加足以击杀的伤害
  await page.evaluate(() => {
    const G = window.__hook.G, g = window.__hook.game;
    for (let i = 0; i < 40 && g.boss; i++){
      g.boss.hurtT = -1;
      G.hurtEnemy(g.boss, 60, 1);
    }
  });
  await page.waitForTimeout(800);
  const slain = await page.evaluate(() => window.__hook.game.eyeSlain);
  if (!slain) throw new Error('eye was not slain');
  console.log('  eyeSlain:', slain);
});
await page.screenshot({ path: 'shots/07-boss.png' });

// 8. 存档/读档
await step('save-load', async () => {
  const ok = await page.evaluate(() => window.__hook.G.saveGame());
  if (!ok) throw new Error('save returned false');
  const has = await page.evaluate(() => window.__hook.G.hasSave());
  if (!has) throw new Error('no save found');
  const size = await page.evaluate(() => localStorage.getItem('taila_save_v1').length);
  console.log('  save size:', Math.round(size / 1024) + 'KB');
});

// 9. 手机宽度视口
await step('mobile-viewport', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const touch = await page.evaluate(() => document.body.classList.contains('touch'));
  console.log('  touch class:', touch);
});
await page.screenshot({ path: 'shots/08-mobile.png' });
await page.setViewportSize({ width: 1280, height: 720 });

// 10. 长时间稳定性（模拟 20 秒游戏）
await step('stability', async () => {
  await page.evaluate(() => { window.__hook.game.paused = false; });
  await page.keyboard.down('a');
  await page.waitForTimeout(2000);
  await page.keyboard.up('a');
  await page.waitForTimeout(15000);
  const err2 = await page.evaluate(() => ({ hp: window.__hook.game.player.hp, ents: window.__hook.game.entities.length }));
  console.log('  after 20s:', JSON.stringify(err2));
});
await page.screenshot({ path: 'shots/09-stable.png' });

await browser.close();
console.log('----');
if (errors.length){ console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('ALL SMOKE TESTS PASSED');
