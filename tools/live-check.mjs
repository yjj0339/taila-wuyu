// 线上部署验收：核心流程 + 双端截图
import { createRequire } from 'node:module';
const require = createRequire('E:/ZCODE/ink-jiangnan/package.json');
const { chromium } = require('playwright');

const URL = 'https://yjj0339.github.io/taila-wuyu/?__test=1&t=' + Date.now();
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction(() => window.__hook && window.__hook.game, { timeout: 30000 });
await page.waitForTimeout(1500);
console.log('PASS online-load');

// 白天画面截图（等日光正常时段）
await page.evaluate(() => { window.__hook.game.timeTod = 0.25; window.__hook.game.dayT = 200; });
await page.waitForTimeout(600);
await page.screenshot({ path: 'shots/live-desktop.png' });
console.log('PASS desktop-screenshot');

// 核心操作：移动+挖掘+砍树
await page.keyboard.down('d'); await page.waitForTimeout(800); await page.keyboard.up('d');
const dug = await page.evaluate(() => {
  const G = window.__hook.G, p = window.__hook.game.player, R = G.render;
  G.cam.x = p.x + p.w / 2; G.cam.y = p.y + p.h / 2 - 1; // 相机对齐，避免 lerp 滞后导致点击偏移
  for (let dx = 1; dx <= 3; dx++) for (let dy = 0; dy <= 4; dy++){
    const tx = Math.floor(p.x) + dx, ty = Math.floor(p.y) + dy;
    const id = G.getTile(tx, ty);
    if (id === 1 || id === 2 || id === 3)
      return { sx: (tx + .5 - G.cam.x) * R.zoom * 32 + R.W / 2, sy: (ty + .5 - G.cam.y) * R.zoom * 32 + R.H / 2 };
  }
  return null;
});
await page.waitForTimeout(100);
await page.keyboard.press('1');
await page.mouse.move(dug.sx, dug.sy);
await page.mouse.down(); await page.waitForTimeout(900); await page.mouse.up();
const inv = await page.evaluate(() => window.__hook.G.inv.slots.filter(Boolean).map(s => s.id).join(','));
console.log(inv.includes('dirt') || inv.includes('stone') ? 'PASS online-dig' : 'FAIL online-dig: ' + inv);

// 手机设备仿真截图（Pixel 5）
{
  const { devices } = require('playwright');
  const ctx2 = await browser.newContext({ ...devices['Pixel 5'] });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', e => errors.push('MOBILE PAGEERROR: ' + e.message));
  await p2.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await p2.waitForFunction(() => window.__hook && window.__hook.game, { timeout: 30000 });
  await p2.waitForTimeout(1200);
  const touch = await p2.evaluate(() => document.body.classList.contains('touch'));
  if (!touch) errors.push('MOBILE: touch UI not shown');
  await p2.screenshot({ path: 'shots/live-mobile.png' });
  await ctx2.close();
  console.log('PASS mobile-screenshot (Pixel 5)');
}

await browser.close();
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL LIVE CHECKS PASSED');
process.exit(errors.length ? 1 : 0);
