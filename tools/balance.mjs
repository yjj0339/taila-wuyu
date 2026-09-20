// 平衡/进度链验证：合成流程全走通
import { createRequire } from 'node:module';
const require = createRequire('E:/ZCODE/ink-jiangnan/package.json');
const { chromium } = require('playwright');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto('http://localhost:8124/?__test=1&t=' + Date.now());
await page.waitForFunction(() => window.__hook && window.__hook.game);
await page.waitForTimeout(400);

const result = await page.evaluate(() => {
  const G = window.__hook.G, g = window.__hook.game, p = g.player;
  const log = [];
  const ok = (name, cond) => log.push((cond ? 'PASS ' : 'FAIL ') + name);

  // 放置工作台在玩家旁
  const bx = Math.floor(p.x) + 2, by = Math.floor(p.y) + 1;
  G.setTile(bx, by, G.T.WORKBENCH);
  G.setTile(bx + 1, by, G.T.STONE); // 工作台需要相邻支撑？不需要，放固体垫一下

  // 徒手配方可用性（手边有工作台）
  let st = G.inv.nearStations();
  ok('nearStations sees workbench', st.workbench);

  // 全配方链
  G.inv.add('wood', 60);
  G.inv.add('stone', 40);
  G.inv.add('gel', 5);
  const R = G.RECIPES;
  const find = name => R.find(r => r.out === name);

  // 1. 工作台（徒手）
  ok('craft workbench', G.inv.craft(find('workbench')));
  // 2. 熔炉（工作台）
  ok('craft furnace @wb', G.inv.craft(find('furnace')));
  // 3. 火把
  ok('craft torch', G.inv.craft(find('torch')));
  // 4. 木弓+箭
  ok('craft wood_bow', G.inv.craft(find('wood_bow')));
  ok('craft arrow', G.inv.craft(find('arrow')));
  // 5. 放熔炉，炼铁
  G.setTile(bx, by - 1, G.T.FURNACE);
  st = G.inv.nearStations();
  ok('nearStations sees furnace', st.furnace);
  G.inv.add('iron_ore', 30);
  ok('smelt iron_bar', G.inv.craft(find('iron_bar')));
  ok('smelt iron_bar x5', (() => { for (let i = 0; i < 4; i++) G.inv.craft(find('iron_bar')); return G.inv.countItem('iron_bar') >= 5; })());
  // 6. 铁砧：先做铁砧（配方在 anvil 站——死锁检查！anvil 配方 st=anvil 但铁砧本身需要 anvil？）
  //    看 config：RECIPES 里 anvil 的 st 是 'anvil' —— 这会死锁！检查：
  const anvilR = find('anvil');
  ok('anvil recipe station should be workbench', anvilR.st !== 'anvil');
  return { log, ironBars: G.inv.countItem('iron_bar'), wood: G.inv.countItem('wood') };
});
console.log(result.log.join('\n'));
console.log('iron_bars:', result.ironBars, 'wood left:', result.wood);

// 补充：铁砧→铁装链
const r2 = await page.evaluate(() => {
  const G = window.__hook.G, g = window.__hook.game, p = g.player;
  const log = [];
  const ok = (name, cond) => log.push((cond ? 'PASS ' : 'FAIL ') + name);
  const find = name => G.RECIPES.find(r => r.out === name);
  G.inv.add('iron_bar', 20);
  G.setTile(Math.floor(p.x) + 2, Math.floor(p.y) + 1, G.T.WORKBENCH);
  G.setTile(Math.floor(p.x) + 4, Math.floor(p.y) + 1, G.T.ANVIL);
  const st = G.inv.nearStations();
  ok('nearStations sees anvil', st.anvil);
  ok('craft anvil @wb', G.inv.craft(find('anvil')));
  ok('craft iron_pick', G.inv.craft(find('iron_pick')));
  ok('craft iron_sword', G.inv.craft(find('iron_sword')));
  // 镐等级验证：金矿需 lvl2（铁镐 lvl2 ✓ 铜镐 lvl1 ✗）
  const goldTile = G.TILES[G.T.GOLD];
  ok('iron_pick can mine gold', goldTile.lvl <= G.ITEMS.iron_pick.lvl);
  ok('copper_pick cannot mine gold', goldTile.lvl > G.ITEMS.copper_pick.lvl);
  ok('gold_pick can mine hellstone', G.TILES[G.T.HELLSTONE].lvl <= G.ITEMS.gold_pick.lvl);
  return log;
});
console.log(r2.join('\n'));
await browser.close();
