// ============ 程序化像素贴图 ============
'use strict';
(function(){
  const TS = 16; // 贴图逻辑分辨率（放大绘制保持像素感）
  const rng = G.makeRNG(20260920);
  const cache = new Map(); // key -> canvas

  function makeCanvas(w, h){
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  // 基础底色 + 噪声斑点 + 边缘暗化
  function baseTile(ctx, col, dark, spots, spotCol){
    ctx.fillStyle = col; ctx.fillRect(0, 0, TS, TS);
    for (let i = 0; i < 26; i++){
      const x = rng.int(0, TS-1), y = rng.int(0, TS-1);
      ctx.fillStyle = rng() < .5 ? dark : (spotCol || col);
      ctx.globalAlpha = .35 + rng() * .4;
      ctx.fillRect(x, y, rng() < .3 ? 2 : 1, 1);
    }
    ctx.globalAlpha = 1;
    // 左上亮、右下暗的轻微立体
    ctx.fillStyle = 'rgba(255,255,255,.10)';
    ctx.fillRect(0, 0, TS, 1); ctx.fillRect(0, 0, 1, TS);
    ctx.fillStyle = 'rgba(0,0,0,.13)';
    ctx.fillRect(0, TS-1, TS, 1); ctx.fillRect(TS-1, 0, 1, TS);
    void spots;
  }

  function oreTile(oreCol, oreHi){
    const c = makeCanvas(TS, TS), ctx = c.getContext('2d');
    baseTile(ctx, '#8a8078', '#6e655e');
    for (let k = 0; k < 5; k++){
      const x = rng.int(1, 12), y = rng.int(1, 12);
      ctx.fillStyle = oreCol;
      ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = oreHi;
      ctx.fillRect(x, y, 1, 1);
    }
    return c;
  }

  const painters = {
    [G.T.DIRT]: ctx => baseTile(ctx, '#9b6a3f', '#7e5230'),
    [G.T.GRASS]: ctx => { baseTile(ctx, '#9b6a3f', '#7e5230');
      ctx.fillStyle = '#57a83f'; ctx.fillRect(0, 0, TS, 3);
      ctx.fillStyle = '#6fc254'; ctx.fillRect(0, 0, TS, 1); },
    [G.T.STONE]: ctx => baseTile(ctx, '#8d8d95', '#6f6f78'),
    [G.T.SAND]: ctx => baseTile(ctx, '#e3c987', '#c9ad66'),
    [G.T.SNOW]: ctx => baseTile(ctx, '#eef4f8', '#d3e2ec'),
    [G.T.ICE]: ctx => { baseTile(ctx, '#a9d8ee', '#8cc4e2'); ctx.fillStyle='rgba(255,255,255,.5)'; ctx.fillRect(2,2,6,1); ctx.fillRect(3,3,3,1); },
    [G.T.ASH]: ctx => baseTile(ctx, '#5d565e', '#4a444c'),
    [G.T.HELLSTONE]: ctx => { baseTile(ctx, '#8d5b4a', '#6e4032');
      for (let k=0;k<6;k++){ ctx.fillStyle = k%2?'#ff7a3c':'#ffb03c'; ctx.globalAlpha=.85; ctx.fillRect(rng.int(1,13), rng.int(1,13), 2, 1); } ctx.globalAlpha=1; },
    [G.T.COPPER]: () => oreTile('#d98d4f', '#f2b977'),
    [G.T.IRON]: () => oreTile('#c9b6a5', '#e8ddd0'),
    [G.T.SILVER]: () => oreTile('#d9dde3', '#f4f7fa'),
    [G.T.GOLD]: () => oreTile('#e8c34c', '#fbe68a'),
    [G.T.GEM]: () => { const c = makeCanvas(TS,TS), ctx = c.getContext('2d'); baseTile(ctx, '#8d8d95', '#6f6f78');
      const gem = ['#e05a8a','#5aa8e0','#67d05a','#c95ae0'][rng.int(0,3)];
      ctx.fillStyle = gem; ctx.fillRect(4,5,3,3); ctx.fillRect(9,3,3,3); ctx.fillRect(7,10,3,3);
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(4,5,1,1); ctx.fillRect(9,3,1,1); ctx.fillRect(7,10,1,1);
      return c; },
    [G.T.WOOD]: ctx => { baseTile(ctx, '#a5793f', '#8a6132');
      ctx.fillStyle = '#7a5528'; for (let y=1;y<TS;y+=4) ctx.fillRect(0,y,TS,1);
      ctx.fillStyle = 'rgba(255,255,255,.12)'; for (let y=3;y<TS;y+=4) ctx.fillRect(0,y,TS,1); },
    [G.T.TREE]: ctx => { baseTile(ctx, '#7d5a30', '#63461f');
      ctx.fillStyle = '#5c3f1c'; ctx.fillRect(2,0,2,TS); ctx.fillRect(11,0,2,TS);
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(6,0,1,TS); },
    [G.T.PINE]: ctx => { baseTile(ctx, '#6e4c26', '#573a19');
      ctx.fillStyle = '#4a3115'; ctx.fillRect(2,0,2,TS); ctx.fillRect(11,0,2,TS); },
    [G.T.LEAF]: ctx => { baseTile(ctx, '#4f9a3a', '#3d7c2c');
      for (let i=0;i<8;i++){ ctx.fillStyle = rng()<.5?'#5fb04a':'#34692a'; ctx.fillRect(rng.int(0,14), rng.int(0,14), 2, 1); } },
    [G.T.PINELEAF]: ctx => { baseTile(ctx, '#2f7040', '#245631');
      for (let i=0;i<8;i++){ ctx.fillStyle = rng()<.5?'#3d8a50':'#1e4629'; ctx.fillRect(rng.int(0,14), rng.int(0,14), 2, 2); } },
    [G.T.WORKBENCH]: ctx => { baseTile(ctx, '#b08748', '#8f6c37');
      ctx.fillStyle = '#6e4f24'; ctx.fillRect(0,0,TS,3); ctx.fillRect(1,9,2,7); ctx.fillRect(13,9,2,7);
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(0,0,TS,1); },
    [G.T.FURNACE]: ctx => { baseTile(ctx, '#7d7d86', '#5f5f68');
      ctx.fillStyle = '#3f3f46'; ctx.fillRect(2,4,12,12);
      ctx.fillStyle = '#ff8c2e'; ctx.fillRect(4,8,8,7);
      ctx.fillStyle = '#ffd06e'; ctx.fillRect(5,10,6,4);
      ctx.fillStyle = '#8f8f98'; ctx.fillRect(0,0,TS,3); },
    [G.T.ANVIL]: ctx => { ctx.clearRect(0,0,TS,TS);
      ctx.fillStyle = '#55555e'; ctx.fillRect(1,3,14,4); ctx.fillRect(4,7,8,3); ctx.fillRect(2,10,12,4);
      ctx.fillStyle = '#787882'; ctx.fillRect(1,3,14,1);
      ctx.fillStyle = '#3a3a42'; ctx.fillRect(1,12,14,2); },
    [G.T.TORCH]: ctx => { ctx.clearRect(0,0,TS,TS);
      ctx.fillStyle = '#8a6132'; ctx.fillRect(7,7,2,8);
      ctx.fillStyle = '#ffb03c'; ctx.fillRect(6,3,4,4);
      ctx.fillStyle = '#ffe08a'; ctx.fillRect(7,4,2,2); },
    [G.T.PLAT]: ctx => { ctx.clearRect(0,0,TS,TS);
      ctx.fillStyle = '#b08748'; ctx.fillRect(0,0,TS,5);
      ctx.fillStyle = '#8f6c37'; ctx.fillRect(0,4,TS,2);
      ctx.fillStyle = '#6e4f24'; ctx.fillRect(3,6,2,4); ctx.fillRect(11,6,2,4);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(0,0,TS,1); },
    [G.T.DOOR_C]: ctx => { baseTile(ctx, '#a5793f', '#8a6132');
      ctx.fillStyle = '#6e4f24'; ctx.fillRect(0,0,1,TS); ctx.fillRect(15,0,1,TS); ctx.fillRect(0,0,TS,1);
      ctx.fillStyle = '#d9c289'; ctx.fillRect(11,7,2,2);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(7,1,1,14); },
    [G.T.DOOR_O]: ctx => { ctx.clearRect(0,0,TS,TS);
      ctx.fillStyle = '#8a6132'; ctx.fillRect(0,0,3,TS);
      ctx.fillStyle = '#6e4f24'; ctx.fillRect(0,0,1,TS); },
    [G.T.GLASS]: ctx => { ctx.clearRect(0,0,TS,TS);
      ctx.fillStyle = 'rgba(190,230,245,.45)'; ctx.fillRect(0,0,TS,TS);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(2,2,5,1); ctx.fillRect(2,3,2,1);
      ctx.strokeStyle = 'rgba(140,180,200,.7)'; ctx.strokeRect(.5,.5,15,15); },
    [G.T.LAVA]: ctx => { baseTile(ctx, '#e8641c', '#c74e10');
      ctx.fillStyle = '#ffb03c'; for (let i=0;i<5;i++) ctx.fillRect(rng.int(0,12), rng.int(0,14), 3, 1);
      ctx.fillStyle = '#ff7a2e'; ctx.fillRect(0,0,TS,2); },
    [G.T.CHEST]: ctx => { ctx.clearRect(0,0,TS,TS);
      ctx.fillStyle = '#8a5a28'; ctx.fillRect(1,4,14,11);
      ctx.fillStyle = '#e8c34c'; ctx.fillRect(1,4,14,3); ctx.fillRect(7,7,2,4);
      ctx.fillStyle = '#6e4419'; ctx.fillRect(1,14,14,1); ctx.fillRect(1,7,14,1); },
    [G.T.CRYSTAL]: ctx => { ctx.clearRect(0,0,TS,TS);
      ctx.fillStyle = '#ff5a7a'; ctx.fillRect(5,4,6,7); ctx.fillRect(3,6,10,4);
      ctx.fillStyle = '#ffa0b4'; ctx.fillRect(6,5,2,2); },
    [G.T.MUSH]: ctx => { ctx.clearRect(0,0,TS,TS);
      ctx.fillStyle = '#7ab8e8'; ctx.fillRect(4,3,8,4); ctx.fillRect(3,5,10,2);
      ctx.fillStyle = '#cfe9f8'; ctx.fillRect(5,4,2,1); ctx.fillRect(9,3,2,2);
      ctx.fillStyle = '#e8f2fa'; ctx.fillRect(7,7,2,6); },
    [G.T.FLOWER]: ctx => { ctx.clearRect(0,0,TS,TS);
      ctx.fillStyle = '#4f9a3a'; ctx.fillRect(7,8,2,7);
      ctx.fillStyle = rng()<.5?'#ff8ac2':'#ffd05a'; ctx.fillRect(5,3,6,5);
      ctx.fillStyle = '#fff'; ctx.fillRect(7,5,2,2); },
    [G.T.TGRASS]: ctx => { ctx.clearRect(0,0,TS,TS);
      ctx.fillStyle = '#57a83f'; for (let x=2;x<14;x+=3) ctx.fillRect(x, rng.int(6,9), 2, 12); },
    [G.T.CACTUS]: ctx => { ctx.clearRect(0,0,TS,TS);
      ctx.fillStyle = '#3f9a4a'; ctx.fillRect(5,0,6,TS);
      ctx.fillStyle = '#57b862'; ctx.fillRect(6,0,2,TS);
      ctx.fillStyle = '#e8f2c9'; ctx.fillRect(4,3,1,1); ctx.fillRect(11,7,1,1); ctx.fillRect(4,12,1,1); },
    [G.T.BEDROCK]: ctx => baseTile(ctx, '#3a3a40', '#2c2c31'),
  };

  function getTile(id, variant){
    const key = 't' + id + '_' + variant;
    if (cache.has(key)) return cache.get(key);
    const c = makeCanvas(TS, TS), ctx = c.getContext('2d');
    const p = painters[id];
    if (p) p(ctx, variant);
    else baseTile(ctx, '#c0f', '#80a');
    cache.set(key, c);
    return c;
  }
  // 顶面暴露时的变体（草皮等）
  function getTop(id, variant){
    if (id === G.T.DIRT || id === G.T.GRASS){
      const key = 'top' + variant;
      if (cache.has(key)) return cache.get(key);
      const c = makeCanvas(TS, TS), ctx = c.getContext('2d');
      ctx.drawImage(getTile(G.T.DIRT, variant), 0, 0);
      ctx.fillStyle = '#57a83f'; ctx.fillRect(0, 0, TS, 3);
      ctx.fillStyle = '#6fc254'; ctx.fillRect(0, 0, TS, 1);
      for (let x = 0; x < TS; x += 2){ if (rng() < .5){ ctx.fillStyle = '#57a83f'; ctx.fillRect(x, 3, 1, 1); } }
      cache.set(key, c);
      return c;
    }
    if (id === G.T.SNOW){ return getTile(id, variant); }
    return getTile(id, variant);
  }
  // 挖掘裂纹（4 阶段）
  function getCrack(stage){
    const key = 'crack' + stage;
    if (cache.has(key)) return cache.get(key);
    const c = makeCanvas(TS, TS), ctx = c.getContext('2d');
    const cr = G.makeRNG(777 + stage);
    ctx.fillStyle = 'rgba(20,10,5,.55)';
    const n = stage * 4;
    let x = 8, y = 8;
    for (let i = 0; i < n; i++){
      ctx.fillRect(x, y, 1, 1);
      x = G.clamp(x + cr.int(-1, 1) * 2, 0, 15); y = G.clamp(y + cr.int(-1, 1) * 2, 0, 15);
      ctx.fillRect(x, y, 2, 1);
    }
    cache.set(key, c);
    return c;
  }

  // ---------- 物品图标 ----------
  function iconFromTile(id){
    const c = makeCanvas(32, 32), ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(getTile(id, 0), 0, 0, TS, TS, 2, 2, 28, 28);
    return c;
  }
  function toolIcon(headCol, headHi, kind){
    const c = makeCanvas(32, 32), ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const handle = '#8a6132', handleHi = '#a5793f';
    if (kind === 'pick'){
      ctx.fillStyle = handle; ctx.fillRect(6, 24, 20, 3); ctx.fillRect(7, 21, 3, 5);
      ctx.fillStyle = headCol; ctx.fillRect(4, 6, 24, 4);
      ctx.fillRect(3, 8, 4, 6); ctx.fillRect(25, 8, 4, 6);
      ctx.fillStyle = headHi; ctx.fillRect(4, 6, 24, 1);
    } else if (kind === 'axe'){
      ctx.fillStyle = handle; ctx.fillRect(7, 6, 3, 23);
      ctx.fillStyle = headCol; ctx.fillRect(9, 4, 12, 10); ctx.fillRect(18, 6, 5, 8);
      ctx.fillStyle = headHi; ctx.fillRect(9, 4, 12, 2);
    } else if (kind === 'sword'){
      ctx.fillStyle = handle; ctx.fillRect(4, 24, 6, 6);
      ctx.fillStyle = '#c9a24a'; ctx.fillRect(8, 22, 8, 3);
      ctx.fillStyle = headCol; ctx.fillRect(10, 6, 4, 17); ctx.fillRect(14, 4, 4, 6);
      ctx.fillStyle = headHi; ctx.fillRect(10, 6, 2, 17);
    } else if (kind === 'bow'){
      ctx.strokeStyle = headCol; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(10, 16, 11, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(14, 6); ctx.lineTo(14, 26); ctx.stroke();
    }
    return c;
  }
  const iconPainters = {
    copper_ore: () => { const c = makeCanvas(32,32), x = c.getContext('2d'); x.drawImage(getTile(G.T.COPPER,0),0,0,16,16,2,2,28,28); return c; },
    iron_ore: () => { const c = makeCanvas(32,32), x = c.getContext('2d'); x.drawImage(getTile(G.T.IRON,0),0,0,16,16,2,2,28,28); return c; },
    silver_ore: () => { const c = makeCanvas(32,32), x = c.getContext('2d'); x.drawImage(getTile(G.T.SILVER,0),0,0,16,16,2,2,28,28); return c; },
    gold_ore: () => { const c = makeCanvas(32,32), x = c.getContext('2d'); x.drawImage(getTile(G.T.GOLD,0),0,0,16,16,2,2,28,28); return c; },
    hellstone: () => { const c = makeCanvas(32,32), x = c.getContext('2d'); x.drawImage(getTile(G.T.HELLSTONE,0),0,0,16,16,2,2,28,28); return c; },
    copper_bar: bar('#d98d4f'), iron_bar: bar('#c9b6a5'), silver_bar: bar('#dfe3e9'),
    gold_bar: bar('#e8c34c'), hell_bar: bar('#ff7a3c'),
    gem: () => { const c = makeCanvas(32,32), x = c.getContext('2d');
      x.fillStyle = '#e05a8a'; x.fillRect(10,8,12,10); x.fillRect(13,5,6,3); x.fillRect(13,18,6,3);
      x.fillStyle = '#f5a0c0'; x.fillRect(11,9,3,3); return c; },
    gel: () => { const c = makeCanvas(32,32), x = c.getContext('2d');
      x.fillStyle = 'rgba(90,170,240,.75)'; x.fillRect(7,10,18,14); x.fillRect(10,7,12,3);
      x.fillStyle = 'rgba(220,240,255,.8)'; x.fillRect(9,12,4,3); return c; },
    lens: () => { const c = makeCanvas(32,32), x = c.getContext('2d');
      x.fillStyle = '#e8e2d0'; x.fillRect(8,10,16,12); x.fillRect(10,7,12,3);
      x.fillStyle = '#5aa8e0'; x.fillRect(12,12,8,6); x.fillStyle = '#2a4a6a'; x.fillRect(15,14,3,3); return c; },
    mushroom: () => { const c = makeCanvas(32,32), x = c.getContext('2d'); x.drawImage(getTile(G.T.MUSH,0),0,0,16,16,2,2,28,28); return c; },
    life_crystal: () => { const c = makeCanvas(32,32), x = c.getContext('2d');
      heart(x, 16, 15, 11, '#ff4a6a', '#ff9ab0'); return c; },
    heart: () => { const c = makeCanvas(32,32), x = c.getContext('2d');
      heart(x, 16, 16, 12, '#ff4a6a', '#ff9ab0'); return c; },
    copper_pick: () => toolIcon('#d98d4f', '#f2b977', 'pick'),
    iron_pick: () => toolIcon('#b0b0ba', '#d8d8e2', 'pick'),
    silver_pick: () => toolIcon('#dfe3e9', '#ffffff', 'pick'),
    gold_pick: () => toolIcon('#e8c34c', '#fbe68a', 'pick'),
    hell_pick: () => toolIcon('#ff7a3c', '#ffb03c', 'pick'),
    copper_axe: () => toolIcon('#d98d4f', '#f2b977', 'axe'),
    copper_sword: () => toolIcon('#d98d4f', '#f2b977', 'sword'),
    iron_sword: () => toolIcon('#c9c9d3', '#ececf4', 'sword'),
    silver_sword: () => toolIcon('#dfe3e9', '#ffffff', 'sword'),
    gold_sword: () => toolIcon('#e8c34c', '#fbe68a', 'sword'),
    lava_sword: () => toolIcon('#ff5a2a', '#ffcf6a', 'sword'),
    wood_bow: () => toolIcon('#a5793f', '#c9a066', 'bow'),
    silver_bow: () => toolIcon('#c9ced6', '#f0f4fa', 'bow'),
    gold_bow: () => toolIcon('#d9b23c', '#f5dc7a', 'bow'),
    arrow: () => { const c = makeCanvas(32,32), x = c.getContext('2d');
      x.fillStyle = '#8a6132'; x.fillRect(6,24,20,2);
      x.fillStyle = '#c9c9d3'; x.fillRect(24,22,5,5);
      x.fillStyle = '#e8e2d0'; x.fillRect(4,22,4,6); return c; },
    slime_crown: () => { const c = makeCanvas(32,32), x = c.getContext('2d');
      x.fillStyle = '#4aa8e8'; x.fillRect(8,14,16,10); x.fillRect(10,10,12,4);
      x.fillStyle = '#e8c34c'; x.fillRect(9,4,14,6); x.fillRect(8,2,3,4); x.fillRect(14,1,3,5); x.fillRect(20,2,3,4);
      x.fillStyle = '#fbe68a'; x.fillRect(9,4,14,1); return c; },
    suspicious_eye: () => { const c = makeCanvas(32,32), x = c.getContext('2d');
      x.fillStyle = '#f0ece0'; x.beginPath(); x.arc(16,16,11,0,7); x.fill();
      x.fillStyle = '#c93a3a'; x.beginPath(); x.arc(16,16,6,0,7); x.fill();
      x.fillStyle = '#2a2a2a'; x.beginPath(); x.arc(16,16,3,0,7); x.fill();
      x.strokeStyle = '#c94a4a'; x.lineWidth=2; x.beginPath(); x.moveTo(24,8); x.lineTo(28,5); x.stroke(); return c; },
  };
  function bar(col){
    return () => { const c = makeCanvas(32,32), x = c.getContext('2d');
      x.fillStyle = col; x.fillRect(5,12,22,9); x.fillRect(8,9,16,3);
      x.fillStyle = 'rgba(255,255,255,.45)'; x.fillRect(8,9,16,2);
      x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(5,19,22,2); return c; };
  }
  function heart(x, cx, cy, s, col, hi){
    x.fillStyle = col;
    x.fillRect(cx-s, cy-s*.7, s*2, s); x.fillRect(cx-s*.6, cy-s*1.2, s*1.2, s*.6);
    x.fillRect(cx-s*.25, cy-s*.25, s*.5, s*.9); x.fillRect(cx-s*.65, cy-.2*s, s*1.3, s*.5);
    x.fillStyle = hi; x.fillRect(cx-s*.75, cy-s*.55, s*.45, s*.4);
  }
  function getIcon(itemId){
    const key = 'i_' + itemId;
    if (cache.has(key)) return cache.get(key);
    const it = G.ITEMS[itemId];
    let c;
    if (iconPainters[itemId]) c = iconPainters[itemId]();
    else if (it && it.tile !== undefined) c = iconFromTile(it.tile);
    else { c = makeCanvas(32,32); const x = c.getContext('2d'); x.fillStyle='#c0c'; x.fillRect(8,8,16,16); }
    cache.set(key, c);
    return c;
  }

  G.tex = { getTile, getTop, getCrack, getIcon, heart };
})();
