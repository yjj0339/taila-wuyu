// ============ 背包 / 物品库存 ============
'use strict';
(function(){
  const HOTBAR = 10, PACK = 40, TOTAL = HOTBAR + PACK;

  const inv = {
    slots: new Array(TOTAL).fill(null), // {id, n}
    sel: 0,                              // 热键栏选中 0..9
  };
  G.inv = inv;

  inv.held = () => inv.slots[inv.sel];

  inv.add = function(id, n){
    const def = G.ITEMS[id];
    if (!def) return n;
    const max = def.max || 999;
    // 先叠加
    for (let i = 0; i < TOTAL && n > 0; i++){
      const s = inv.slots[i];
      if (s && s.id === id && s.n < max){
        const take = Math.min(max - s.n, n);
        s.n += take; n -= take;
      }
    }
    // 再开新格（热键栏优先）
    for (let i = 0; i < TOTAL && n > 0; i++){
      if (!inv.slots[i]){
        const take = Math.min(max, n);
        inv.slots[i] = { id, n: take };
        n -= take;
      }
    }
    G.ui.dirtyInv = true;
    return n; // 剩余放不下的
  };

  inv.countItem = id => inv.slots.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);
  inv.hasItem = id => inv.slots.some(s => s && s.id === id);

  inv.find = function(id){
    for (let i = 0; i < TOTAL; i++){
      const s = inv.slots[i];
      if (s && s.id === id) return { idx: i, n: s.n };
    }
    return null;
  };

  inv.removeAt = function(idx, n){
    const s = inv.slots[idx];
    if (!s) return;
    s.n -= n;
    if (s.n <= 0) inv.slots[idx] = null;
    G.ui.dirtyInv = true;
  };

  inv.consumeHeld = function(n){ inv.removeAt(inv.sel, n); };

  inv.swap = function(a, b){
    const t = inv.slots[a];
    inv.slots[a] = inv.slots[b];
    inv.slots[b] = t;
    G.ui.dirtyInv = true;
  };

  inv.splitHalf = function(idx){
    const s = inv.slots[idx];
    if (!s || s.n < 2) return;
    const half = Math.floor(s.n / 2);
    s.n -= half;
    for (let i = 0; i < TOTAL; i++){
      if (!inv.slots[i]){ inv.slots[i] = { id: s.id, n: half }; break; }
    }
    G.ui.dirtyInv = true;
  };

  // ---------- 合成 ----------
  // 检测附近工作台/熔炉/铁砧
  inv.nearStations = function(){
    const p = G.game.player;
    const px = Math.floor(p.x + p.w / 2), py = Math.floor(p.y + p.h / 2);
    const st = { workbench: false, furnace: false, anvil: false };
    for (let dy = -4; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++){
      const id = G.getTile(px + dx, py + dy);
      if (id === G.T.WORKBENCH) st.workbench = true;
      else if (id === G.T.FURNACE) st.furnace = true;
      else if (id === G.T.ANVIL) st.anvil = true;
    }
    return st;
  };

  inv.canCraft = function(r, st){
    if (r.st === 'workbench' && !st.workbench) return false;
    if (r.st === 'furnace' && !st.furnace) return false;
    if (r.st === 'anvil' && !st.anvil) return false;
    for (const id in r.need) if (inv.countItem(id) < r.need[id]) return false;
    return true;
  };

  inv.craft = function(r){
    const st = inv.nearStations();
    if (!inv.canCraft(r, st)) return false;
    for (const id in r.need){
      let need = r.need[id];
      for (let i = TOTAL - 1; i >= 0 && need > 0; i--){
        const s = inv.slots[i];
        if (s && s.id === id){
          const take = Math.min(s.n, need);
          s.n -= take; need -= take;
          if (s.n <= 0) inv.slots[i] = null;
        }
      }
    }
    const left = inv.add(r.out, r.n);
    if (left > 0) G.spawnDrop(r.out, left, G.game.player.x, G.game.player.y - 1);
    G.audio.play('craft');
    G.toast('制作了 ' + G.ITEMS[r.out].name + (r.n > 1 ? ' ×' + r.n : ''));
    G.ui.dirtyInv = true;
    return true;
  };

  // ---------- 目标系统辅助 ----------
  G.placedOnceAdd = function(tileId){
    if (!G.game.placedOnce) G.game.placedOnce = new Set();
    G.game.placedOnce.add(tileId);
  };
  G.onTileChanged = function(){ G.light.data = G.light.data; /* 光照每帧重算，无需处理 */ };

  // ---------- 初始装备 ----------
  inv.giveStarter = function(){
    inv.add('copper_pick', 1);
    inv.add('copper_axe', 1);
    inv.add('copper_sword', 1);
    inv.add('torch', 15);
    inv.add('mushroom', 3);
  };

  inv.serialize = () => inv.slots.map(s => s ? [s.id, s.n] : 0);
  inv.load = arr => {
    inv.slots = new Array(TOTAL).fill(null);
    (arr || []).forEach((s, i) => { if (s && G.ITEMS[s[0]]) inv.slots[i] = { id: s[0], n: s[1] }; });
    G.ui.dirtyInv = true;
  };
})();
