// ============ 程序化像素贴图 v2：泰拉瑞亚式融合贴图 ============
// 核心思想：同材质相邻方块无缝融合（mask 位标识四邻），只有暴露边画轮廓；
// 内部纹理多色阶、无网格感；草包裹泥土；矿石为大颗晶体团。
'use strict';
(function(){
  const TS = 16;

  const cache = new Map();
  // 融合分组：同组值相邻即融合。0 = 不融合（单体贴图）
  const FUSE = {};
  FUSE[G.T.DIRT] = 1;  FUSE[G.T.GRASS] = 1;
  FUSE[G.T.STONE] = 2;
  FUSE[G.T.COPPER] = 2; FUSE[G.T.IRON] = 2; FUSE[G.T.SILVER] = 2;
  FUSE[G.T.GOLD] = 2;   FUSE[G.T.GEM] = 2;
  FUSE[G.T.SAND] = 3;
  FUSE[G.T.SNOW] = 4;   FUSE[G.T.ICE] = 4;
  FUSE[G.T.ASH] = 5;    FUSE[G.T.HELLSTONE] = 5;
  FUSE[G.T.WOOD] = 6;
  FUSE[G.T.TREE] = 7;   FUSE[G.T.PINE] = 7;
  FUSE[G.T.LEAF] = 8;
  FUSE[G.T.PINELEAF] = 9;
  G.texFuse = FUSE;

  function makeCanvas(w, h){
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  // 每个 (tile,mask,变体) 独立稳定的随机源
  function seedRng(n){
    let a = (n ^ 0x9E3779B9) >>> 0;
    const f = function(){
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = (lo, hi) => lo + f() * (hi - lo);
    f.int = (lo, hi) => Math.floor(lo + f() * (hi - lo + 1));
    f.pick = arr => arr[Math.floor(f() * arr.length)];
    return f;
  }

  // ---- 暴露边轮廓：统一 1px 半透明暗线，顶部额外亮线 ----
  function edges(ctx, mask, opt){
    opt = opt || {};
    if (!(mask & 1)){ // 顶暴露
      ctx.fillStyle = opt.top || 'rgba(255,255,255,.20)';
      ctx.fillRect(0, 0, TS, 1);
    }
    if (!(mask & 4)){
      ctx.fillStyle = opt.bottom || 'rgba(0,0,0,.34)';
      ctx.fillRect(0, TS - 1, TS, 1);
    }
    if (!(mask & 8)){
      ctx.fillStyle = opt.side || 'rgba(0,0,0,.22)';
      ctx.fillRect(0, 0, 1, TS);
    }
    if (!(mask & 2)){
      ctx.fillStyle = opt.side || 'rgba(0,0,0,.22)';
      ctx.fillRect(TS - 1, 0, 1, TS);
    }
  }

  // ---- 泥土质感：多色阶土团 ----
  function soilTex(ctx, mask, r){
    ctx.fillStyle = '#96683f'; ctx.fillRect(0, 0, TS, TS);
    for (let i = 0; i < 9; i++){ // 大土团
      const x = r.int(0, 13), y = r.int(0, 13);
      ctx.fillStyle = r() < .5 ? '#7f5633' : '#a5794e';
      ctx.fillRect(x, y, r.int(2, 4), r.int(2, 3));
    }
    for (let i = 0; i < 10; i++){ // 小砾石
      ctx.fillStyle = r() < .5 ? '#6e4a2c' : '#b0885c';
      ctx.fillRect(r.int(0, 15), r.int(0, 15), 1, 1);
    }
    // 小根须
    ctx.fillStyle = '#5f3f26';
    for (let i = 0; i < 3; i++){
      const x = r.int(2, 13), y = r.int(2, 12);
      ctx.fillRect(x, y, 1, r.int(2, 3));
    }
    edges(ctx, mask, { top: 'rgba(255,235,200,.25)' });
  }

  // ---- 石头质感：灰棕岩 + 裂纹 ----
  function stoneTex(ctx, mask, r, base){
    const p = base || { base: '#847d76', dark: '#6a645d', light: '#96908a', crack: '#57524c' };
    ctx.fillStyle = p.base; ctx.fillRect(0, 0, TS, TS);
    for (let i = 0; i < 6; i++){ // 岩块团
      const x = r.int(0, 12), y = r.int(0, 12);
      ctx.fillStyle = r() < .55 ? p.dark : p.light;
      ctx.fillRect(x, y, r.int(2, 5), r.int(2, 4));
    }
    // 裂纹折线
    ctx.fillStyle = p.crack;
    for (let i = 0; i < 2; i++){
      let x = r.int(2, 6), y = r.int(2, 12);
      for (let s = 0; s < r.int(4, 7); s++){
        ctx.fillRect(x, y, 1, 1);
        x += r() < .6 ? 1 : 0; y += r() < .5 ? (r() < .5 ? 1 : -1) : 0;
        x = Math.max(0, Math.min(15, x)); y = Math.max(0, Math.min(15, y));
      }
    }
    edges(ctx, mask, { top: 'rgba(255,255,255,.14)' });
  }

  // ---- 草层：包裹式（顶厚侧薄）----
  function grassWrap(ctx, mask, r){
    if (!(mask & 1)){ // 顶部草带 4px，锯齿下垂
      ctx.fillStyle = '#3f8f31';
      ctx.fillRect(0, 0, TS, 3);
      ctx.fillStyle = '#4fae3c';
      ctx.fillRect(0, 0, TS, 2);
      ctx.fillStyle = '#63c94e';
      ctx.fillRect(0, 0, TS, 1);
      for (let x = 0; x < TS; x += 2){ // 锯齿垂草
        if (r() < .55){ ctx.fillStyle = r() < .5 ? '#3f8f31' : '#4fae3c'; ctx.fillRect(x, 3, 1, 1); }
        if (r() < .2){ ctx.fillStyle = '#63c94e'; ctx.fillRect(x + 1, 3, 1, 1); }
      }
    }
    if (!(mask & 8)){ ctx.fillStyle = '#3f8f31'; ctx.fillRect(0, 0, 2, TS); } // 左草边
    if (!(mask & 2)){ ctx.fillStyle = '#3f8f31'; ctx.fillRect(14, 0, 2, TS); } // 右草边
  }

  // ---- 矿石晶体团（嵌在石里的大颗晶体）----
  function oreTex(ctx, mask, r, colMain, colLight, colDark){
    stoneTex(ctx, mask, r);
    for (let k = 0; k < 3; k++){
      const x = r.int(2, 10), y = r.int(2, 10), s = r.int(2, 3);
      ctx.fillStyle = colDark; ctx.fillRect(x, y, s + 1, s + 1);
      ctx.fillStyle = colMain; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = colLight; ctx.fillRect(x, y, 1, 1);
      if (r() < .6){ ctx.fillStyle = colMain; ctx.fillRect(x + s + 1, y + r.int(0, s), 1, 1); }
    }
  }

  // ---- 沙子 ----
  function sandTex(ctx, mask, r){
    ctx.fillStyle = '#e3ca8c'; ctx.fillRect(0, 0, TS, TS);
    for (let i = 0; i < 8; i++){
      ctx.fillStyle = r() < .5 ? '#d1b573' : '#f0dda2';
      ctx.fillRect(r.int(0, 13), r.int(0, 13), r.int(2, 3), 1);
    }
    for (let i = 0; i < 8; i++){
      ctx.fillStyle = '#b89a5e';
      ctx.fillRect(r.int(0, 15), r.int(0, 15), 1, 1);
    }
    edges(ctx, mask, { top: 'rgba(255,246,210,.4)' });
  }

  // ---- 雪 ----
  function snowTex(ctx, mask, r){
    ctx.fillStyle = '#eef4f8'; ctx.fillRect(0, 0, TS, TS);
    for (let i = 0; i < 7; i++){
      ctx.fillStyle = r() < .5 ? '#dbe7f0' : '#ffffff';
      ctx.fillRect(r.int(0, 13), r.int(0, 13), r.int(2, 4), 1);
    }
    edges(ctx, mask, { top: 'rgba(255,255,255,.75)', bottom: 'rgba(120,150,175,.35)', side: 'rgba(150,175,195,.3)' });
  }
  function iceTex(ctx, mask, r){
    ctx.fillStyle = '#a5d4ee'; ctx.fillRect(0, 0, TS, TS);
    for (let i = 0; i < 5; i++){
      ctx.fillStyle = r() < .5 ? '#8cc2e2' : '#c4e6f6';
      ctx.fillRect(r.int(0, 12), r.int(0, 12), r.int(2, 4), r.int(1, 2));
    }
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillRect(2, 2, 5, 1); ctx.fillRect(3, 3, 3, 1);
    edges(ctx, mask, { top: 'rgba(255,255,255,.45)' });
  }

  // ---- 灰烬 / 狱岩 ----
  function ashTex(ctx, mask, r){
    ctx.fillStyle = '#4c444d'; ctx.fillRect(0, 0, TS, TS);
    for (let i = 0; i < 7; i++){
      ctx.fillStyle = r() < .5 ? '#3d363f' : '#5c535d';
      ctx.fillRect(r.int(0, 13), r.int(0, 13), r.int(2, 4), r.int(1, 3));
    }
    edges(ctx, mask, { top: 'rgba(255,200,160,.12)' });
  }
  function hellTex(ctx, mask, r){
    ashTex(ctx, mask, r);
    for (let k = 0; k < 3; k++){
      const x = r.int(2, 11), y = r.int(2, 11);
      ctx.fillStyle = '#8a2c14'; ctx.fillRect(x, y, 3, 3);
      ctx.fillStyle = '#e85a24'; ctx.fillRect(x + 1, y + 1, 2, 2);
      ctx.fillStyle = '#ffb03c'; ctx.fillRect(x + 1, y + 1, 1, 1);
    }
  }

  // ---- 放置的木材：横木板 ----
  function plankTex(ctx, mask, r){
    ctx.fillStyle = '#9a7040'; ctx.fillRect(0, 0, TS, TS);
    ctx.fillStyle = '#86612f'; // 板缝
    ctx.fillRect(0, 4, TS, 1); ctx.fillRect(0, 10, TS, 1);
    ctx.fillStyle = '#ad8452';
    ctx.fillRect(0, 0, TS, 1); ctx.fillRect(0, 5, TS, 1); ctx.fillRect(0, 11, TS, 1);
    ctx.fillStyle = '#6e4e24'; // 木纹
    ctx.fillRect(r.int(2, 5), 1, 1, 3); ctx.fillRect(r.int(8, 12), 6, 1, 4); ctx.fillRect(r.int(3, 7), 12, 1, 3);
    ctx.fillStyle = '#5a3f1c'; // 钉
    if (!(mask & 8)) ctx.fillRect(1, 2, 1, 1);
    if (!(mask & 2)) ctx.fillRect(14, 7, 1, 1);
    edges(ctx, mask, { top: 'rgba(255,230,180,.3)' });
  }

  // ---- 树干：竖树皮 ----
  function barkTex(ctx, mask, r, pine){
    ctx.fillStyle = pine ? '#6b4a26' : '#7d5830'; ctx.fillRect(0, 0, TS, TS);
    ctx.fillStyle = pine ? '#573a19' : '#664523'; // 竖沟纹
    for (let x = 1; x < TS; x += 3) ctx.fillRect(x + r.int(0, 1), 0, 1, TS);
    ctx.fillStyle = pine ? '#7d5a32' : '#8f6739'; // 竖亮纹
    for (let x = 2; x < TS; x += 4) ctx.fillRect(x + r.int(0, 1), 0, 1, TS);
    if (r() < .5){ ctx.fillStyle = '#4a3115'; ctx.fillRect(r.int(3, 11), r.int(3, 11), 2, 2); } // 节疤
    if (!(mask & 1)){ // 树顶切断年轮
      ctx.fillStyle = '#a5794e'; ctx.fillRect(0, 0, TS, 2);
      ctx.fillStyle = '#8a6132'; ctx.fillRect(3, 0, 6, 1); ctx.fillRect(11, 1, 4, 1);
    }
    edges(ctx, mask, { top: 'rgba(255,220,170,.2)', side: 'rgba(30,15,5,.45)' });
  }

  // ---- 树叶：团簇 ----
  function leafTex(ctx, mask, r, pine){
    const base = pine ? '#2c6b3c' : '#3d8a2e';
    const dark = pine ? '#1e5029' : '#2c6b21';
    const lite = pine ? '#3d8a52' : '#57ab42';
    const hi = pine ? '#55a868' : '#74c95a';
    ctx.fillStyle = base; ctx.fillRect(0, 0, TS, TS);
    for (let i = 0; i < 7; i++){
      ctx.fillStyle = r() < .5 ? dark : lite;
      ctx.fillRect(r.int(0, 12), r.int(0, 12), r.int(2, 4), r.int(2, 3));
    }
    for (let i = 0; i < 5; i++){ // 高光叶
      ctx.fillStyle = hi;
      ctx.fillRect(r.int(0, 14), r.int(0, 13), 2, 1);
    }
    edges(ctx, mask, { top: 'rgba(255,255,200,.18)', side: 'rgba(10,30,8,.4)', bottom: 'rgba(10,30,8,.4)' });
  }

  // ---------- 家具与特殊 ----------
  const painters = {
    [G.T.WORKBENCH]: (ctx, mask, r) => {
      ctx.fillStyle = '#9a7040'; ctx.fillRect(0, 0, TS, 4);       // 桌面
      ctx.fillStyle = '#6e4e24'; ctx.fillRect(0, 4, TS, 1);
      ctx.fillStyle = '#7d5830'; ctx.fillRect(1, 5, 3, 11); ctx.fillRect(12, 5, 3, 11); // 桌腿
      ctx.fillStyle = '#5a3f1c'; ctx.fillRect(1, 14, 3, 2); ctx.fillRect(12, 14, 3, 2);
      ctx.fillStyle = '#c9c9d3'; ctx.fillRect(4, 1, 3, 1);        // 桌上小工具
      ctx.fillStyle = '#8a6132'; ctx.fillRect(9, 1, 4, 2);
      edges(ctx, 15, {});
    },
    [G.T.FURNACE]: (ctx, mask, r) => {
      ctx.fillStyle = '#6f6a68'; ctx.fillRect(0, 0, TS, TS);      // 石炉体
      ctx.fillStyle = '#57534f'; ctx.fillRect(0, 0, TS, 2);
      ctx.fillStyle = '#7d7875'; ctx.fillRect(1, 1, 14, 2);
      ctx.fillStyle = '#2e2b28'; ctx.fillRect(3, 5, 10, 10);      // 炉口
      ctx.fillStyle = '#e8641c'; ctx.fillRect(4, 8, 8, 6);        // 火
      ctx.fillStyle = '#ffb03c'; ctx.fillRect(5, 10, 6, 3);
      ctx.fillStyle = '#ffe08a'; ctx.fillRect(6, 12, 4, 1);
      edges(ctx, 15, { top: 'rgba(255,255,255,.2)' });
    },
    [G.T.ANVIL]: (ctx, mask, r) => {
      ctx.fillStyle = '#3f3f46'; ctx.fillRect(2, 11, 12, 4);      // 底座
      ctx.fillStyle = '#52525b'; ctx.fillRect(5, 8, 6, 3);        // 颈
      ctx.fillStyle = '#64646e'; ctx.fillRect(1, 4, 14, 4);       // 砧身
      ctx.fillStyle = '#7c7c88'; ctx.fillRect(1, 4, 14, 1);
      ctx.fillStyle = '#46464e'; ctx.fillRect(1, 7, 14, 1);
      edges(ctx, 15, {});
    },
    [G.T.TORCH]: (ctx, mask, r) => {
      ctx.fillStyle = '#7d5830'; ctx.fillRect(7, 8, 2, 8);        // 木杆
      ctx.fillStyle = '#93703f'; ctx.fillRect(7, 8, 1, 8);
      ctx.fillStyle = '#ff8c2e'; ctx.fillRect(6, 3, 4, 5);        // 火焰
      ctx.fillStyle = '#ffb03c'; ctx.fillRect(6, 2, 4, 3);
      ctx.fillStyle = '#ffe08a'; ctx.fillRect(7, 3, 2, 2);
    },
    [G.T.PLAT]: (ctx, mask, r) => {
      ctx.fillStyle = '#9a7040'; ctx.fillRect(0, 0, TS, 4);
      ctx.fillStyle = '#ad8452'; ctx.fillRect(0, 0, TS, 1);
      ctx.fillStyle = '#6e4e24'; ctx.fillRect(0, 4, TS, 1);
      ctx.fillStyle = '#5a3f1c'; ctx.fillRect(3, 5, 2, 3); ctx.fillRect(11, 5, 2, 3);
    },
    [G.T.DOOR_C]: (ctx, mask, r) => {
      ctx.fillStyle = '#8f6739'; ctx.fillRect(0, 0, TS, TS);
      ctx.fillStyle = '#7d5830'; ctx.fillRect(2, 0, 1, TS); ctx.fillRect(13, 0, 1, TS); ctx.fillRect(0, 7, TS, 1);
      ctx.fillStyle = '#a5794e'; ctx.fillRect(0, 0, TS, 1);
      ctx.fillStyle = '#e8c34c'; ctx.fillRect(11, 7, 2, 2);       // 门环
      edges(ctx, 15, { top: 'rgba(255,230,180,.3)' });
    },
    [G.T.DOOR_O]: (ctx, mask, r) => {
      ctx.fillStyle = '#8f6739'; ctx.fillRect(0, 0, 4, TS);
      ctx.fillStyle = '#6e4e24'; ctx.fillRect(0, 0, 1, TS);
      ctx.fillStyle = '#e8c34c'; ctx.fillRect(2, 8, 2, 2);
    },
    [G.T.GLASS]: (ctx, mask, r) => {
      ctx.fillStyle = 'rgba(200,235,248,.38)'; ctx.fillRect(0, 0, TS, TS);
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(2, 2, 6, 1); ctx.fillRect(2, 3, 3, 1);
      edges(ctx, 15, { top: 'rgba(255,255,255,.6)', bottom: 'rgba(90,130,150,.5)', side: 'rgba(120,160,180,.5)' });
    },
    [G.T.LAVA]: (ctx, mask, r) => {
      ctx.fillStyle = '#e8641c'; ctx.fillRect(0, 0, TS, TS);
      ctx.fillStyle = '#c74e10';
      for (let i = 0; i < 4; i++) ctx.fillRect(r.int(0, 12), r.int(2, 14), r.int(2, 4), 2);
      ctx.fillStyle = '#ffb03c';
      for (let i = 0; i < 3; i++) ctx.fillRect(r.int(0, 12), r.int(0, 12), 3, 1);
      ctx.fillStyle = '#ff8c2e'; ctx.fillRect(0, 0, TS, 2);
    },
    [G.T.CHEST]: (ctx, mask, r) => {
      ctx.fillStyle = '#7d5222'; ctx.fillRect(1, 4, 14, 11);
      ctx.fillStyle = '#93652f'; ctx.fillRect(1, 4, 14, 5);
      ctx.fillStyle = '#e8c34c'; ctx.fillRect(1, 8, 14, 2);       // 金箍
      ctx.fillStyle = '#fbe68a'; ctx.fillRect(1, 8, 14, 1);
      ctx.fillStyle = '#e8c34c'; ctx.fillRect(7, 6, 2, 6);        // 竖箍+锁
      ctx.fillStyle = '#fff2c0'; ctx.fillRect(7, 9, 2, 1);
      edges(ctx, 15, {});
    },
    [G.T.CRYSTAL]: (ctx, mask, r) => {
      ctx.fillStyle = '#e83a5e'; ctx.fillRect(5, 4, 6, 7); ctx.fillRect(3, 6, 10, 4); ctx.fillRect(6, 11, 4, 2);
      ctx.fillStyle = '#ff8aa4'; ctx.fillRect(5, 4, 2, 2);
      ctx.fillStyle = '#ffd0da'; ctx.fillRect(5, 4, 1, 1);
      edges(ctx, 0, {});
    },
    [G.T.MUSH]: (ctx, mask, r) => {
      ctx.fillStyle = '#e8f2fa'; ctx.fillRect(7, 8, 2, 7);        // 杆
      ctx.fillStyle = '#5a9ad8'; ctx.fillRect(4, 4, 8, 4);        // 帽
      ctx.fillStyle = '#7ab8e8'; ctx.fillRect(3, 6, 10, 2);
      ctx.fillStyle = '#cfe9f8'; ctx.fillRect(5, 5, 2, 1); ctx.fillRect(9, 4, 2, 2);
      edges(ctx, 0, {});
    },
    [G.T.FLOWER]: (ctx, mask, r) => {
      ctx.fillStyle = '#3d8a2e'; ctx.fillRect(7, 9, 2, 6); ctx.fillRect(5, 11, 2, 1); ctx.fillRect(9, 12, 2, 1);
      const col = r() < .5 ? '#ff8ac2' : (r() < .5 ? '#ffd05a' : '#7ab8ff');
      ctx.fillStyle = col; ctx.fillRect(5, 4, 6, 4); ctx.fillRect(6, 3, 4, 6);
      ctx.fillStyle = '#fff'; ctx.fillRect(7, 5, 2, 2);
      edges(ctx, 0, {});
    },
    [G.T.TGRASS]: (ctx, mask, r) => {
      for (let x = 2; x < 15; x += 3){
        const h = r.int(4, 8);
        ctx.fillStyle = r() < .5 ? '#4fae3c' : '#3f8f31';
        ctx.fillRect(x, 16 - h, 1, h);
        if (r() < .4) ctx.fillRect(x + 1, 16 - h + 1, 1, h - 2);
      }
    },
    [G.T.CACTUS]: (ctx, mask, r) => {
      ctx.fillStyle = '#2f7d3a'; ctx.fillRect(4, 0, 8, TS);
      ctx.fillStyle = '#3f9a4a'; ctx.fillRect(5, 0, 4, TS);
      ctx.fillStyle = '#57b862'; ctx.fillRect(6, 0, 1, TS);
      ctx.fillStyle = '#e8f2c9';
      ctx.fillRect(3, 3, 1, 1); ctx.fillRect(12, 7, 1, 1); ctx.fillRect(3, 12, 1, 1);
      edges(ctx, mask, { side: 'rgba(10,40,15,.5)' });
    },
    [G.T.BEDROCK]: (ctx, mask, r) => {
      ctx.fillStyle = '#33333a'; ctx.fillRect(0, 0, TS, TS);
      ctx.fillStyle = '#28282e';
      ctx.fillRect(0, 5, TS, 1); ctx.fillRect(0, 11, TS, 1); ctx.fillRect(5, 0, 1, TS); ctx.fillRect(11, 0, 1, TS);
    },
  };

  function paint(id, mask, variant){
    const c = makeCanvas(TS, TS), ctx = c.getContext('2d');
    const r = seedRng(id * 977 + mask * 31 + variant * 7 + 5);
    const T = G.T;
    switch (id){
      case T.DIRT: soilTex(ctx, mask, r); break;
      case T.GRASS: soilTex(ctx, mask & ~1, r); grassWrap(ctx, mask, r); break;
      case T.STONE: stoneTex(ctx, mask, r); break;
      case T.COPPER: oreTex(ctx, mask, r, '#d98d4f', '#f2b977', '#8a5a2c'); break;
      case T.IRON: oreTex(ctx, mask, r, '#c9b6a5', '#e8ddd0', '#8a7666'); break;
      case T.SILVER: oreTex(ctx, mask, r, '#dfe3e9', '#ffffff', '#8f95a2'); break;
      case T.GOLD: oreTex(ctx, mask, r, '#e8c34c', '#fbe68a', '#9a7a1a'); break;
      case T.GEM: oreTex(ctx, mask, r, '#e05a8a', '#ffb0cc', '#7a1a4a'); break;
      case T.SAND: sandTex(ctx, mask, r); break;
      case T.SNOW: snowTex(ctx, mask, r); break;
      case T.ICE: iceTex(ctx, mask, r); break;
      case T.ASH: ashTex(ctx, mask, r); break;
      case T.HELLSTONE: hellTex(ctx, mask, r); break;
      case T.WOOD: plankTex(ctx, mask, r); break;
      case T.TREE: barkTex(ctx, mask, r, false); break;
      case T.PINE: barkTex(ctx, mask, r, true); break;
      case T.LEAF: leafTex(ctx, mask, r, false); break;
      case T.PINELEAF: leafTex(ctx, mask, r, true); break;
      default: {
        const p = painters[id];
        if (p) p(ctx, mask, r);
        else { ctx.fillStyle = '#c0f'; ctx.fillRect(0, 0, TS, TS); }
      }
    }
    return c;
  }

  // variant: 0/1 由坐标 hash 决定
  function getTile(id, mask, variant){
    mask = (mask || 0) & 15;
    const key = (id << 6) | (mask << 1) | (variant ? 1 : 0);
    if (cache.has(key)) return cache.get(key);
    const c = paint(id, mask, variant ? 1 : 0);
    cache.set(key, c);
    return c;
  }
  // 裂纹
  function getCrack(stage){
    const key = 'crack' + stage;
    if (cache.has(key)) return cache.get(key);
    const c = makeCanvas(TS, TS), ctx = c.getContext('2d');
    const cr = seedRng(777 + stage);
    ctx.fillStyle = 'rgba(15,8,4,.6)';
    for (let b = 0; b < stage + 1; b++){ // 从中心放射的裂纹
      let x = 8, y = 8;
      const n = 4 + stage * 2;
      for (let i = 0; i < n; i++){
        ctx.fillRect(x, y, 1, 1);
        x = Math.max(0, Math.min(15, x + cr.int(-1, 1)));
        y = Math.max(0, Math.min(15, y + cr.int(-1, 1)));
      }
    }
    cache.set(key, c);
    return c;
  }

  // ---------- 物品图标 ----------
  function iconBase(){
    const c = makeCanvas(32, 32);
    return c;
  }
  function drawOreIcon(ctx, main, light, dark){
    // 晶体矿石团
    ctx.fillStyle = '#847d76'; ctx.fillRect(4, 8, 24, 20);
    ctx.fillStyle = '#6a645d'; ctx.fillRect(4, 24, 24, 4); ctx.fillRect(4, 8, 24, 2);
    const ore = [[8, 12, 6], [17, 10, 5], [12, 18, 7], [20, 18, 5]];
    for (const [x, y, s] of ore){
      ctx.fillStyle = dark; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = main; ctx.fillRect(x, y, s - 1, s - 1);
      ctx.fillStyle = light; ctx.fillRect(x, y, 2, 2);
    }
  }
  function toolIcon(headCol, headHi, headDark, kind){
    const c = iconBase(), ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    if (kind === 'pick'){
      // 柄
      ctx.fillStyle = '#8a6132'; ctx.fillRect(6, 25, 21, 3);
      ctx.fillStyle = '#a5794e'; ctx.fillRect(6, 25, 21, 1);
      // 镐头（弧形两端尖）
      ctx.fillStyle = headCol;
      ctx.fillRect(4, 6, 24, 4);
      ctx.fillRect(2, 8, 5, 7); ctx.fillRect(25, 8, 5, 7);
      ctx.fillStyle = headHi; ctx.fillRect(4, 6, 24, 1);
      ctx.fillStyle = headDark; ctx.fillRect(4, 9, 24, 1);
    } else if (kind === 'axe'){
      ctx.fillStyle = '#8a6132'; ctx.fillRect(8, 5, 3, 24);
      ctx.fillStyle = '#a5794e'; ctx.fillRect(8, 5, 1, 24);
      ctx.fillStyle = headCol; ctx.fillRect(10, 3, 12, 11); ctx.fillRect(19, 5, 6, 9);
      ctx.fillStyle = headHi; ctx.fillRect(10, 3, 12, 2);
      ctx.fillStyle = headDark; ctx.fillRect(10, 12, 12, 2);
    } else if (kind === 'sword'){
      ctx.fillStyle = '#6e4e24'; ctx.fillRect(4, 25, 6, 5);      // 柄
      ctx.fillStyle = '#c9a24a'; ctx.fillRect(8, 22, 9, 3);      // 护手
      ctx.fillStyle = '#a5822e'; ctx.fillRect(8, 24, 9, 1);
      ctx.fillStyle = headCol; ctx.fillRect(11, 5, 5, 18);       // 刃
      ctx.fillRect(13, 2, 4, 4);
      ctx.fillStyle = headHi; ctx.fillRect(11, 5, 2, 18);
      ctx.fillStyle = headDark; ctx.fillRect(15, 5, 1, 18);
    } else if (kind === 'bow'){
      ctx.strokeStyle = headCol; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(11, 16, 12, -1.25, 1.25); ctx.stroke();
      ctx.strokeStyle = headDark; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(11, 16, 13.5, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(15.5, 4.5); ctx.lineTo(15.5, 27.5); ctx.stroke();
    }
    return c;
  }
  function barIcon(col, hi, dark){
    return () => {
      const c = iconBase(), x = c.getContext('2d');
      x.fillStyle = col; x.fillRect(5, 13, 22, 9);
      x.fillStyle = col; x.fillRect(8, 10, 16, 3);
      x.fillStyle = hi; x.fillRect(8, 10, 16, 2); x.fillRect(5, 13, 22, 2);
      x.fillStyle = dark; x.fillRect(5, 20, 22, 2);
      return c;
    };
  }
  const iconPainters = {
    dirt: () => tileIcon(G.T.DIRT),
    stone: () => tileIcon(G.T.STONE),
    wood: () => tileIcon(G.T.WOOD),
    sand: () => tileIcon(G.T.SAND),
    snow: () => tileIcon(G.T.SNOW),
    ice: () => tileIcon(G.T.ICE),
    glass: () => tileIcon(G.T.GLASS),
    ash: () => tileIcon(G.T.ASH),
    torch: () => tileIcon(G.T.TORCH),
    plat: () => tileIcon(G.T.PLAT),
    door: () => tileIcon(G.T.DOOR_C),
    workbench: () => tileIcon(G.T.WORKBENCH),
    furnace: () => tileIcon(G.T.FURNACE),
    anvil: () => tileIcon(G.T.ANVIL),
    copper_ore: () => { const c = iconBase(), x = c.getContext('2d'); drawOreIcon(x, '#d98d4f', '#f2b977', '#8a5a2c'); return c; },
    iron_ore: () => { const c = iconBase(), x = c.getContext('2d'); drawOreIcon(x, '#c9b6a5', '#e8ddd0', '#8a7666'); return c; },
    silver_ore: () => { const c = iconBase(), x = c.getContext('2d'); drawOreIcon(x, '#dfe3e9', '#ffffff', '#8f95a2'); return c; },
    gold_ore: () => { const c = iconBase(), x = c.getContext('2d'); drawOreIcon(x, '#e8c34c', '#fbe68a', '#9a7a1a'); return c; },
    hellstone: () => { const c = iconBase(), x = c.getContext('2d'); drawOreIcon(x, '#e85a24', '#ffb03c', '#8a2c14'); return c; },
    gem: () => { const c = iconBase(), x = c.getContext('2d');
      // 三颗宝石
      const gem = (gx, gy, s, col, hi) => {
        x.fillStyle = col;
        x.fillRect(gx + 1, gy, s - 2, s); x.fillRect(gx, gy + 1, s, s - 2);
        x.fillStyle = hi; x.fillRect(gx + 1, gy + 1, 2, 2);
      };
      gem(6, 5, 10, '#5aa8e0', '#b0dcff'); gem(17, 8, 9, '#67d05a', '#c0f0b0'); gem(9, 17, 10, '#e05a8a', '#ffb0cc');
      return c; },
    copper_bar: barIcon('#d98d4f', '#f2b977', '#8a5a2c'),
    iron_bar: barIcon('#c9b6a5', '#e8ddd0', '#8a7666'),
    silver_bar: barIcon('#dfe3e9', '#ffffff', '#8f95a2'),
    gold_bar: barIcon('#e8c34c', '#fbe68a', '#9a7a1a'),
    hell_bar: barIcon('#ff7a3c', '#ffb03c', '#8a2c14'),
    gel: () => { const c = iconBase(), x = c.getContext('2d');
      x.fillStyle = 'rgba(70,150,230,.55)'; x.fillRect(6, 12, 20, 14);
      x.fillStyle = 'rgba(70,150,230,.8)'; x.fillRect(9, 8, 14, 5);
      x.fillStyle = 'rgba(210,235,255,.9)'; x.fillRect(8, 14, 5, 4); x.fillRect(15, 10, 3, 2);
      return c; },
    lens: () => { const c = iconBase(), x = c.getContext('2d');
      x.fillStyle = '#e8e2d0'; x.beginPath(); x.arc(16, 17, 10, 0, 7); x.fill();
      x.fillStyle = '#c9c0a8'; x.fillRect(10, 6, 12, 3);
      x.fillStyle = '#5aa8e0'; x.beginPath(); x.arc(16, 17, 5.5, 0, 7); x.fill();
      x.fillStyle = '#2a4a6a'; x.beginPath(); x.arc(16, 17, 2.5, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.fillRect(13, 13, 2, 2);
      return c; },
    mushroom: () => tileIcon(G.T.MUSH),
    life_crystal: () => { const c = iconBase(), x = c.getContext('2d'); heart(x, 16, 15, 12, '#e83a5e', '#ff8aa4'); return c; },
    heart: () => { const c = iconBase(), x = c.getContext('2d'); heart(x, 16, 16, 13, '#e83a5e', '#ff8aa4'); return c; },
    copper_pick: () => toolIcon('#d98d4f', '#f2b977', '#8a5a2c', 'pick'),
    iron_pick: () => toolIcon('#b8b8c2', '#dcdce6', '#7a7a86', 'pick'),
    silver_pick: () => toolIcon('#dfe3e9', '#ffffff', '#8f95a2', 'pick'),
    gold_pick: () => toolIcon('#e8c34c', '#fbe68a', '#9a7a1a', 'pick'),
    hell_pick: () => toolIcon('#ff7a3c', '#ffb03c', '#8a2c14', 'pick'),
    copper_axe: () => toolIcon('#d98d4f', '#f2b977', '#8a5a2c', 'axe'),
    copper_sword: () => toolIcon('#d98d4f', '#f2b977', '#8a5a2c', 'sword'),
    iron_sword: () => toolIcon('#c9c9d3', '#ececf4', '#8a8a96', 'sword'),
    silver_sword: () => toolIcon('#dfe3e9', '#ffffff', '#8f95a2', 'sword'),
    gold_sword: () => toolIcon('#e8c34c', '#fbe68a', '#9a7a1a', 'sword'),
    lava_sword: () => toolIcon('#ff5a2a', '#ffcf6a', '#8a1a0a', 'sword'),
    wood_bow: () => toolIcon('#9a7040', '#b08a54', '#6e4e24', 'bow'),
    silver_bow: () => toolIcon('#c9ced6', '#f0f4fa', '#8f95a2', 'bow'),
    gold_bow: () => toolIcon('#d9b23c', '#f5dc7a', '#9a7a1a', 'bow'),
    arrow: () => { const c = iconBase(), x = c.getContext('2d');
      x.fillStyle = '#8a6132'; x.fillRect(5, 25, 19, 2);
      x.fillStyle = '#c9c9d3'; x.beginPath(); x.moveTo(24, 22); x.lineTo(30, 26); x.lineTo(24, 30); x.fill();
      x.fillStyle = '#e8e2d0'; x.fillRect(3, 22, 4, 8); x.fillStyle = '#b0a890'; x.fillRect(5, 24, 2, 4);
      return c; },
    slime_crown: () => { const c = iconBase(), x = c.getContext('2d');
      x.fillStyle = '#4aa8e8'; x.fillRect(7, 15, 18, 11); x.fillRect(10, 12, 12, 3);
      x.fillStyle = 'rgba(210,240,255,.85)'; x.fillRect(9, 17, 4, 3);
      x.fillStyle = '#e8c34c'; x.fillRect(8, 4, 16, 8);
      x.fillStyle = '#fbe68a'; x.fillRect(8, 4, 16, 2);
      x.fillStyle = '#e8c34c'; x.fillRect(8, 0, 3, 5); x.fillRect(14, 0, 3, 4); x.fillRect(21, 0, 3, 5);
      return c; },
    suspicious_eye: () => { const c = iconBase(), x = c.getContext('2d');
      x.fillStyle = '#f0ece0'; x.beginPath(); x.arc(15, 17, 11, 0, 7); x.fill();
      x.fillStyle = '#d8d0bc'; x.fillRect(9, 6, 12, 3);
      x.fillStyle = '#c93a3a'; x.beginPath(); x.arc(15, 17, 6, 0, 7); x.fill();
      x.fillStyle = '#2a2a2a'; x.beginPath(); x.arc(15, 17, 3, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.fillRect(12, 13, 2, 2);
      x.strokeStyle = '#c94a4a'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(24, 10); x.lineTo(29, 5); x.stroke();
      return c; },
  };
  function tileIcon(id){
    const c = iconBase(), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(getTile(id, 0, 0), 0, 0, TS, TS, 3, 3, 26, 26);
    return c;
  }
  function heart(x, cx, cy, s, col, hi){
    x.fillStyle = col;
    x.fillRect(cx - s, cy - s * .7, s * 2, s); x.fillRect(cx - s * .6, cy - s * 1.2, s * 1.2, s * .6);
    x.fillRect(cx - s * .25, cy - s * .25, s * .5, s * .9); x.fillRect(cx - s * .65, cy - .2 * s, s * 1.3, s * .5);
    x.fillStyle = hi; x.fillRect(cx - s * .75, cy - s * .55, s * .45, s * .4);
  }
  function getIcon(itemId){
    const key = 'i_' + itemId;
    if (cache.has(key)) return cache.get(key);
    const it = G.ITEMS[itemId];
    let c;
    if (iconPainters[itemId]) c = iconPainters[itemId]();
    else if (it && it.tile !== undefined) c = tileIcon(it.tile);
    else { c = iconBase(); const x = c.getContext('2d'); x.fillStyle = '#c0c'; x.fillRect(8, 8, 16, 16); }
    cache.set(key, c);
    return c;
  }

  G.tex = { getTile, getCrack, getIcon, heart, FUSE };
})();
