// 诊断挖掘链路
import { createRequire } from 'node:module';
const require = createRequire('E:/ZCODE/ink-jiangnan/package.json');
const { chromium } = require('playwright');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:8124/?__test=1&t=' + Date.now());
await page.waitForFunction(() => window.__hook && window.__hook.game);
await page.waitForTimeout(500);

// 取玩家脚下一个泥土块的屏幕坐标
const spot = await page.evaluate(() => {
  const G = window.__hook.G, p = window.__hook.game.player, R = G.render;
  for (let dx = 1; dx <= 3; dx++) for (let dy = 0; dy <= 4; dy++){
    const tx = Math.floor(p.x) + dx, ty = Math.floor(p.y) + dy;
    const id = G.getTile(tx, ty);
    if (id === 1 || id === 2 || id === 3){
      return { tx, ty, id,
        sx: (tx + .5 - G.cam.x) * R.zoom * 32 + R.W / 2,
        sy: (ty + .5 - G.cam.y) * R.zoom * 32 + R.H / 2 };
    }
  }
  return null;
});
console.log('spot:', JSON.stringify(spot));

await page.mouse.move(spot.sx, spot.sy);
await page.waitForTimeout(100);
const aim1 = await page.evaluate(() => {
  const i = window.__hook.G.input;
  return { aimTileX: i.aimTileX, aimTileY: i.aimTileY, wx: +i.aimWX.toFixed(1), wy: +i.aimWY.toFixed(1) };
});
console.log('aim after move:', JSON.stringify(aim1));

await page.mouse.down();
await page.waitForTimeout(200);
const st = await page.evaluate(() => {
  const G = window.__hook.G, p = window.__hook.game.player, i = G.input;
  return { use: i.use, sel: G.inv.sel, held: G.inv.held(), mineX: p.mineX, mineY: p.mineY, prog: +p.mineProg.toFixed(1) };
});
console.log('state after down 200ms:', JSON.stringify(st));
await page.waitForTimeout(1200);
const st2 = await page.evaluate(() => {
  const G = window.__hook.G, p = window.__hook.game.player;
  return { mineX: p.mineX, mineY: p.mineY, prog: +p.mineProg.toFixed(1),
    tile: G.getTile(p.mineX, p.mineY), inv: G.inv.slots.filter(Boolean).map(s => s.id + 'x' + s.n).join(',') };
});
console.log('state after 1.4s:', JSON.stringify(st2));
await page.mouse.up();
await browser.close();
