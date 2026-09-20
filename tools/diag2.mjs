// 诊断砍树
import { createRequire } from 'node:module';
const require = createRequire('E:/ZCODE/ink-jiangnan/package.json');
const { chromium } = require('playwright');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:8124/?__test=1&t=' + Date.now());
await page.waitForFunction(() => window.__hook && window.__hook.game);
await page.waitForTimeout(1200); // 等相机稳定

const tree = await page.evaluate(() => {
  const G = window.__hook.G, p = window.__hook.game.player, R = G.render;
  for (let r = 2; r < 30; r++) for (let dx = -r; dx <= r; dx++){
    const tx = Math.floor(p.x) + dx;
    if (tx < 5 || tx > G.CFG.W - 5) continue;
    const s = G.world.surface[tx];
    for (let up = 1; up <= 9; up++){
      if (G.getTile(tx, s - up) === 4){
        return { tx, ty: s - up, surf: s,
          sx: (tx + .5 - G.cam.x) * R.zoom * 32 + R.W / 2,
          sy: (s - up + .5 - G.cam.y) * R.zoom * 32 + R.H / 2 };
      }
    }
  }
  return null;
});
console.log('tree:', JSON.stringify(tree));
if (tree){
  // 选铜斧
  await page.keyboard.press('2');
  await page.mouse.move(tree.sx, tree.sy);
  await page.waitForTimeout(150);
  const aim = await page.evaluate(() => {
    const i = window.__hook.G.input;
    return { x: i.aimTileX, y: i.aimTileY, held: window.__hook.G.inv.held() };
  });
  console.log('aim/held:', JSON.stringify(aim));
  await page.mouse.down();
  await page.waitForTimeout(700);
  const mid = await page.evaluate(() => {
    const G = window.__hook.G, p = window.__hook.game.player;
    return { prog: +p.mineProg.toFixed(1), mineX: p.mineX, mineY: p.mineY, use: G.input.use,
      tile: G.getTile(586, 0) === undefined ? null : 'ok' };
  });
  console.log('mid:', JSON.stringify(mid));
  await page.waitForTimeout(700);
  await page.mouse.up();
  await page.waitForTimeout(2500); // 等掉落物落地+磁吸拾取
  const after = await page.evaluate(() => {
    const G = window.__hook.G;
    return { inv: G.inv.slots.filter(Boolean).map(s => s.id + 'x' + s.n).join(','),
      drops: G.game.entities.filter(e => e.kind === 'drop').map(d => d.item + 'x' + d.n).join(','), };
  });
  console.log('after:', JSON.stringify(after));
}
await browser.close();
