// ============ 渲染：天空 / 视差 / 世界 / 实体 / 光照遮罩 ============
'use strict';
(function(){
  const T = G.T, CFG = G.CFG, TILE = CFG.TILE;
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const lightCv = document.createElement('canvas');
  const lightCtx = lightCv.getContext('2d');

  const R = { cv, ctx, W: 0, H: 0, zoom: 26, dpr: 1 };
  G.render = R;
  G.cam = { x: 0, y: 0 };

  // ---- 视口尺寸 ----
  R.resize = function(){
    R.dpr = Math.min(window.devicePixelRatio || 1, 2);
    R.W = window.innerWidth; R.H = window.innerHeight;
    cv.width = Math.round(R.W * R.dpr);
    cv.height = Math.round(R.H * R.dpr);
    const tilePx = G.clamp(Math.min(R.W / 26, R.H / 15), 20, 52); // 屏幕上每格的像素
    R.zoom = tilePx / CFG.TILE;
  };
  window.addEventListener('resize', () => R.resize());

  // ---- 预生成背景元素 ----
  const bgRng = G.makeRNG(999);
  const stars = []; for (let i = 0; i < 130; i++) stars.push({ x: bgRng(), y: bgRng() * .7, s: .5 + bgRng() * 1.6, tw: bgRng() * 7 });
  const clouds = []; for (let i = 0; i < 9; i++) clouds.push({ x: bgRng(), y: .04 + bgRng() * .3, s: .6 + bgRng() * 1.3, spd: .004 + bgRng() * .01 });

  // 天空关键帧 [tod, 顶色, 底色]
  const SKY = [
    [0.00, '#3a5a8c', '#ffb36a'], [0.06, '#6aa8dc', '#cfe8f7'], [0.45, '#5aa0d8', '#bfe3f5'],
    [0.50, '#7a6aa8', '#ff9a5a'], [0.56, '#1a2440', '#3a3060'], [0.60, '#0e1730', '#202a4a'],
    [0.90, '#0e1730', '#202a4a'], [0.96, '#584a78', '#ff9a6a'], [1.00, '#3a5a8c', '#ffb36a'],
  ];
  function hex2rgb(h){ return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function skyLerp(a, b, t){
    const c1 = hex2rgb(a), c2 = hex2rgb(b);
    return `rgb(${Math.round(G.lerp(c1[0], c2[0], t))},${Math.round(G.lerp(c1[1], c2[1], t))},${Math.round(G.lerp(c1[2], c2[2], t))})`;
  }
  function skyColors(tod){
    for (let i = 0; i < SKY.length - 1; i++){
      if (tod >= SKY[i][0] && tod <= SKY[i + 1][0]){
        const t = (tod - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0] + 1e-9);
        return [skyLerp(SKY[i][1], SKY[i + 1][1], t), skyLerp(SKY[i][2], SKY[i + 1][2], t)];
      }
    }
    return [SKY[2][1], SKY[2][2]];
  }
  R.nightFactor = function(){ // 0 白天 1 深夜
    const tod = G.game ? G.game.timeTod : 0;
    if (tod < .5) return 0;
    if (tod < .58) return (tod - .5) / .08;
    if (tod < .92) return 1;
    return 1 - (tod - .92) / .08;
  };

  function drawSky(){
    const [c1, c2] = skyColors(G.game.timeTod);
    const grd = ctx.createLinearGradient(0, 0, 0, R.H);
    grd.addColorStop(0, c1); grd.addColorStop(1, c2);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, R.W, R.H);
    const nf = R.nightFactor();

    // 星星
    if (nf > 0.05){
      const t = G.game.now;
      for (const s of stars){
        const a = nf * (0.4 + 0.6 * Math.abs(Math.sin(t * .8 + s.tw)));
        ctx.fillStyle = `rgba(255,255,240,${a.toFixed(2)})`;
        ctx.fillRect(s.x * R.W, s.y * R.H, s.s, s.s);
      }
    }
    // 太阳 / 月亮
    const tod = G.game.timeTod;
    const arc = (p) => { // p 0..1 天空弧线
      const x = G.lerp(R.W * .12, R.W * .88, p);
      const y = R.H * .52 - Math.sin(p * Math.PI) * R.H * .4;
      return [x, y];
    };
    if (tod < .55){
      const [sx, sy] = arc(Math.min(1, tod / .52));
      ctx.fillStyle = 'rgba(255,220,130,.35)';
      ctx.beginPath(); ctx.arc(sx, sy, 34, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffdf7a';
      ctx.beginPath(); ctx.arc(sx, sy, 20, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff2c0';
      ctx.beginPath(); ctx.arc(sx - 4, sy - 5, 12, 0, 7); ctx.fill();
    }
    if (tod > .5 || tod > .95){
      const mp = tod >= .5 ? (tod - .52) / .48 : (tod + .48) / .48;
      if (mp >= 0 && mp <= 1){
        const [mx, my] = arc(mp);
        ctx.fillStyle = 'rgba(220,230,255,.2)';
        ctx.beginPath(); ctx.arc(mx, my, 26, 0, 7); ctx.fill();
        ctx.fillStyle = '#e8eef8';
        ctx.beginPath(); ctx.arc(mx, my, 16, 0, 7); ctx.fill();
        ctx.fillStyle = skyColors(tod)[0];
        ctx.beginPath(); ctx.arc(mx - 7, my - 4, 13, 0, 7); ctx.fill();
      }
    }
    // 云
    ctx.fillStyle = `rgba(255,255,255,${(.85 - nf * .55).toFixed(2)})`;
    for (const c of clouds){
      const cx = ((c.x + G.game.now * c.spd) % 1.15 - .075) * R.W;
      const cy = c.y * R.H, s = c.s * R.H * .035;
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 2.4, s, 0, 0, 7);
      ctx.ellipse(cx - s * 1.6, cy + s * .3, s * 1.3, s * .7, 0, 0, 7);
      ctx.ellipse(cx + s * 1.7, cy + s * .25, s * 1.4, s * .75, 0, 0, 7);
      ctx.fill();
    }
    // 远山（两层视差）
    const horizon = R.H * .58;
    drawRidges(horizon, .12, `rgba(90,130,170,${(.5 - nf * .35).toFixed(2)})`, 60, 0.9);
    drawRidges(horizon, .22, `rgba(70,105,90,${(.6 - nf * .4).toFixed(2)})`, 90, 2.3);
  }
  function drawRidges(horizon, para, col, amp, seedX){
    const camPx = G.cam.x * R.zoom * para;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, R.H);
    for (let sx = 0; sx <= R.W; sx += 16){
      const wx = (sx + camPx) * .004;
      const h = Math.sin(wx * 1.7 + seedX) * .5 + Math.sin(wx * 3.3 + seedX * 2) * .3 + Math.sin(wx * .6 + seedX * 3) * .7;
      ctx.lineTo(sx, horizon - amp * .5 - h * amp * .5);
    }
    ctx.lineTo(R.W, R.H);
    ctx.closePath();
    ctx.fill();
  }

  // ---- 墙贴图（暗化 tile）----
  const wallCache = new Map();
  function wallTex(wallId){
    if (wallCache.has(wallId)) return wallCache.get(wallId);
    const map = { [G.WALL.DIRT]: T.DIRT, [G.WALL.STONE]: T.STONE, [G.WALL.SNOW]: T.SNOW, [G.WALL.SAND]: T.SAND, [G.WALL.ASH]: T.ASH };
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const c2 = c.getContext('2d');
    c2.drawImage(G.tex.getTile(map[wallId] || T.DIRT, 0), 0, 0);
    c2.fillStyle = 'rgba(8,6,14,.62)';
    c2.fillRect(0, 0, 16, 16);
    wallCache.set(wallId, c);
    return c;
  }

  const variant = (tx, ty) => (Math.abs(tx * 73856093 ^ ty * 19349663) % 3);

  // ---- 世界 ----
  function drawWorld(x0, y0, x1, y1){
    for (let ty = y0; ty <= y1; ty++){
      for (let tx = x0; tx <= x1; tx++){
        const wall = G.getWall(tx, ty);
        const id = G.getTile(tx, ty);
        const px = tx * TILE, py = ty * TILE;
        if (wall && !G.TILES[id].solid) ctx.drawImage(wallTex(wall), px, py, TILE, TILE);
        if (id === T.AIR) continue;
        const useTop = (id === T.GRASS) ||
          ((id === T.DIRT || id === T.SNOW) && !G.TILES[G.getTile(tx, ty - 1)].solid);
        if (useTop) ctx.drawImage(G.tex.getTop(id, variant(tx, ty)), px, py, TILE, TILE);
        else ctx.drawImage(G.tex.getTile(id, variant(tx, ty)), px, py, TILE, TILE);
      }
    }
  }

  // ---- 玩家 ----
  function drawPlayer(p){
    const px = (p.x + p.w / 2) * TILE, py = p.y * TILE;
    if (p.invulnT > 0 && Math.floor(p.invulnT * 14) % 2 === 0) return;
    ctx.save();
    ctx.translate(px, py);
    ctx.scale(p.dir, 1);
    const walk = Math.abs(p.vx) > .5 && p.onGround ? Math.sin(p.anim * 11) : 0;
    const air = !p.onGround;
    // 腿
    ctx.fillStyle = '#3a4a7a';
    if (air){
      ctx.fillRect(-6, 52, 7, 20); ctx.fillRect(2, 48, 7, 22);
    } else {
      ctx.fillRect(-7 + walk * 5, 52, 7, 22 - Math.abs(walk) * 3);
      ctx.fillRect(1 - walk * 5, 52, 7, 22 - Math.abs(walk) * 3);
    }
    // 身体
    ctx.fillStyle = '#4a7ab5';
    ctx.fillRect(-8, 30, 17, 24);
    ctx.fillStyle = '#5a8ac5';
    ctx.fillRect(-8, 30, 17, 6);
    // 头
    ctx.fillStyle = '#eab98a';
    ctx.fillRect(-8, 4, 18, 26);
    ctx.fillStyle = '#7a4a22'; // 头发
    ctx.fillRect(-9, 0, 20, 8); ctx.fillRect(-9, 0, 5, 16);
    ctx.fillStyle = '#2a2a2a'; // 眼
    ctx.fillRect(4, 14, 3, 4);
    ctx.fillStyle = '#c98a5a'; // 嘴
    ctx.fillRect(6, 23, 4, 2);
    // 后手
    ctx.fillStyle = '#eab98a';
    ctx.fillRect(-10 + walk * 4, 32, 6, 16);
    ctx.restore();

    // 前手 + 持物挥舞
    const held = G.inv.held();
    const def = held ? G.ITEMS[held.id] : null;
    const swingA = p.swing > 0 ? G.lerp(-2.4, 1.1, 1 - p.swing) : (Math.abs(p.vx) > .5 ? Math.sin(p.anim * 11) * .5 : .15);
    ctx.save();
    ctx.translate(px + p.dir * 5 * (TILE / 32), py + 34 * (TILE / 32) * (TILE / 32) * 0 + 34);
    ctx.scale(p.dir, 1);
    ctx.rotate(p.dir === 1 ? swingA : -swingA);
    ctx.fillStyle = '#eab98a';
    ctx.fillRect(-3, -3, 6, 17);
    if (def && (def.type === 'tool' || def.type === 'weapon' || def.type === 'bow') && p.swing > 0 || (def && def.type === 'bow')){
      const icon = G.tex.getIcon(held.id);
      ctx.save();
      ctx.translate(0, 10);
      ctx.rotate(-.7);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(icon, -4, -34, 26, 26);
      ctx.restore();
    }
    ctx.restore();
  }

  // ---- 敌人 ----
  function drawEnemy(e){
    const px = e.x * TILE, py = e.y * TILE, w = e.w * TILE, h = e.h * TILE;
    const flash = e.hurtT > 0;
    ctx.save();
    if (e.def.ai === 'hop'){ // 史莱姆
      const sq = e.onGround ? 1 + Math.sin(e.anim * 6) * .06 : .82;
      const col = e.def.color;
      ctx.fillStyle = flash ? '#fff' : col;
      ctx.globalAlpha = .82;
      const bw = w * (2 - sq) * .5 + w * .5, bh = h * sq;
      roundRect(px + (w - bw) / 2, py + h - bh, bw, bh, 6);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fillRect(px + w * .25, py + h - bh + 6, w * .18, 5);
      ctx.fillStyle = '#222';
      const ey = py + h - bh + bh * .35;
      ctx.fillRect(px + w * .3, ey, 4, 7);
      ctx.fillRect(px + w * .62, ey, 4, 7);
      if (e.isBoss){ // 史莱姆王冠
        ctx.fillStyle = '#e8c34c';
        ctx.fillRect(px + w * .3, py + h - bh - 10, w * .4, 8);
        ctx.fillRect(px + w * .32, py + h - bh - 16, 6, 7);
        ctx.fillRect(px + w * .5, py + h - bh - 18, 6, 9);
        ctx.fillRect(px + w * .62, py + h - bh - 16, 6, 7);
      }
    }
    else if (e.def.ai === 'walk' && e.key === 'zombie'){
      drawHumanoid(px, py, w, h, flash ? '#fff' : '#8aa860', '#5a6a3a', '#4a4a3a', Math.sin(e.anim * 8) * (Math.abs(e.vx) > .2 ? 1 : 0));
    }
    else if (e.key === 'skeleton'){
      drawHumanoid(px, py, w, h, flash ? '#fff' : '#e8e8dc', '#c9c9bc', '#a8a89a', Math.sin(e.anim * 9) * (Math.abs(e.vx) > .2 ? 1 : 0));
    }
    else if (e.key === 'demon_eye' || e.def.ai === 'bossEye'){
      const r = w * .5;
      const cx2 = px + r, cy2 = py + r;
      if (e.def.ai === 'bossEye'){
        // 血丝尾巴
        ctx.strokeStyle = '#a83a3a'; ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++){
          const a = e.anim * 2 + i * 1.7;
          ctx.beginPath();
          ctx.moveTo(cx2 + Math.cos(a) * r * .7, cy2 + Math.sin(a) * r * .7);
          ctx.lineTo(cx2 + Math.cos(a) * (r + 14), cy2 + Math.sin(a) * (r + 14));
          ctx.stroke();
        }
      }
      ctx.fillStyle = flash ? '#fff' : '#f0ece0';
      ctx.beginPath(); ctx.arc(cx2, cy2, r, 0, 7); ctx.fill();
      const p = G.game.player;
      const da = Math.atan2(p.y - e.y, p.x - e.x);
      const pxo = Math.cos(da) * r * .3, pyo = Math.sin(da) * r * .3;
      if (e.state === 9){ // 二阶段大嘴
        ctx.fillStyle = '#8a1a1a';
        ctx.beginPath(); ctx.arc(cx2, cy2, r * .75, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 5; i++){
          const a = i / 4 * Math.PI - Math.PI;
          ctx.beginPath();
          ctx.moveTo(cx2 + Math.cos(a) * r * .72, cy2 + Math.sin(a) * r * .72);
          ctx.lineTo(cx2 + Math.cos(a + .3) * r * .72, cy2 + Math.sin(a + .3) * r * .72);
          ctx.lineTo(cx2 + Math.cos(a + .15) * r * .35, cy2 + Math.sin(a + .15) * r * .35);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#c93a3a';
        ctx.beginPath(); ctx.arc(cx2 + pxo, cy2 + pyo, r * .48, 0, 7); ctx.fill();
        ctx.fillStyle = '#2a2a2a';
        ctx.beginPath(); ctx.arc(cx2 + pxo * 1.3, cy2 + pyo * 1.3, r * .22, 0, 7); ctx.fill();
      }
    }
    else if (e.key === 'cave_bat'){
      const flap = Math.sin(e.anim * 18) * 8;
      ctx.fillStyle = flash ? '#fff' : '#6a5a7a';
      ctx.beginPath(); ctx.ellipse(px + w / 2, py + h / 2, w * .32, h * .3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = flash ? '#fff' : '#584a68';
      ctx.beginPath();
      ctx.moveTo(px + w * .3, py + h * .45);
      ctx.lineTo(px - w * .25, py + h * .45 + flap);
      ctx.lineTo(px + w * .3, py + h * .75);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px + w * .7, py + h * .45);
      ctx.lineTo(px + w * 1.25, py + h * .45 + flap);
      ctx.lineTo(px + w * .7, py + h * .75);
      ctx.fill();
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(px + w * .38, py + h * .38, 3, 3);
      ctx.fillRect(px + w * .58, py + h * .38, 3, 3);
    }
    else if (e.key === 'fire_imp'){
      ctx.fillStyle = flash ? '#fff' : '#c94a2a';
      ctx.fillRect(px + w * .2, py + h * .2, w * .6, h * .55);
      ctx.fillStyle = '#e8642e';
      ctx.fillRect(px + w * .1, py + h * .05, w * .8, h * .25);
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(px + w * .32, py + h * .28, 5, 5);
      ctx.fillRect(px + w * .58, py + h * .28, 5, 5);
      ctx.fillStyle = '#a83a1a';
      const tail = Math.sin(e.anim * 5) * 4;
      ctx.fillRect(px + w * .78, py + h * .6 + tail, w * .35, 6);
    }
    ctx.restore();
  }
  function drawHumanoid(px, py, w, h, skin, shirt, pants, walk){
    const u = w / 14;
    ctx.fillStyle = pants;
    ctx.fillRect(px + 3 * u, py + h * .58 + (walk > 0 ? -2 : 0), 4 * u, h * .42);
    ctx.fillRect(px + 7.5 * u, py + h * .58 + (walk < 0 ? -2 : 0), 4 * u, h * .42);
    ctx.fillStyle = shirt;
    ctx.fillRect(px + 2 * u, py + h * .3, 10 * u, h * .32);
    ctx.fillStyle = skin;
    ctx.fillRect(px + 2.5 * u, py + h * .05, 9 * u, h * .27);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(px + 8 * u, py + h * .14, 2 * u, 2.4 * u);
  }
  function roundRect(x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.fill();
  }

  // ---- 主渲染 ----
  R.draw = function(){
    const g = G.game, p = g.player;
    ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    drawSky();

    const zoom = R.zoom;
    const vw = R.W / zoom / TILE + 2, vh = R.H / zoom / TILE + 2;
    const cx = G.cam.x - vw / 2, cy = G.cam.y - vh / 2;
    ctx.setTransform(zoom * R.dpr, 0, 0, zoom * R.dpr, -cx * TILE * zoom * R.dpr, -cy * TILE * zoom * R.dpr);
    ctx.imageSmoothingEnabled = false;

    const x0 = Math.max(0, Math.floor(cx)), y0 = Math.max(0, Math.floor(cy));
    const x1 = Math.min(CFG.W - 1, Math.ceil(cx + vw)), y1 = Math.min(CFG.H - 1, Math.ceil(cy + vh));

    drawWorld(x0, y0, x1, y1);

    // 挖掘裂纹
    if (p.mineProg > 0 && p.mineX >= 0){
      const stage = Math.min(3, Math.floor(p.mineProg / G.TILES[G.getTile(p.mineX, p.mineY)].hp * 4));
      ctx.drawImage(G.tex.getCrack(stage + 1), p.mineX * TILE, p.mineY * TILE, TILE, TILE);
    }
    // 选中框
    const inp = G.input;
    if (inp.aimTileX >= 0 && !G.ui.blockUse){
      ctx.strokeStyle = 'rgba(255,255,255,.6)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(inp.aimTileX * TILE + 1, inp.aimTileY * TILE + 1, TILE - 2, TILE - 2);
    }

    // 掉落物
    for (const e of g.entities){
      if (e.kind !== 'drop') continue;
      const bob = Math.sin(g.now * 3 + e.bob) * 2;
      ctx.drawImage(G.tex.getIcon(e.item), e.x * TILE, e.y * TILE + bob, TILE * .62, TILE * .62);
    }
    // 弹幕
    for (const e of g.entities){
      if (e.kind !== 'proj') continue;
      if (e.proj === 'arrow'){
        ctx.save();
        ctx.translate(e.x * TILE, e.y * TILE);
        ctx.rotate(e.ang || 0);
        ctx.fillStyle = '#8a6132'; ctx.fillRect(-10, -1, 16, 2.5);
        ctx.fillStyle = '#c9c9d3'; ctx.fillRect(6, -2.5, 6, 5);
        ctx.fillStyle = '#e8e2d0'; ctx.fillRect(-13, -3, 4, 6);
        ctx.restore();
      } else {
        ctx.fillStyle = '#ff8c3c';
        ctx.beginPath(); ctx.arc(e.x * TILE, e.y * TILE, TILE * .28, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffd24a';
        ctx.beginPath(); ctx.arc(e.x * TILE, e.y * TILE, TILE * .15, 0, 7); ctx.fill();
      }
    }
    // 敌人
    for (const e of g.entities){
      if (e.kind === 'enemy' && (!e.isBoss || G.onScreen(e))) drawEnemy(e);
    }
    if (!p.dead) drawPlayer(p);

    // 粒子
    for (const pt of g.particles){
      ctx.globalAlpha = Math.min(1, pt.life / pt.maxLife * 1.5);
      ctx.fillStyle = pt.col;
      ctx.fillRect(pt.x * TILE - pt.size, pt.y * TILE - pt.size, pt.size * 2, pt.size * 2);
    }
    ctx.globalAlpha = 1;

    // ---- 光照遮罩 ----
    const L = G.light;
    if (L.data){
      if (lightCv.width !== L.w || lightCv.height !== L.h){ lightCv.width = L.w; lightCv.height = L.h; }
      const img = lightCtx.createImageData(L.w, L.h);
      const d = img.data;
      for (let i = 0; i < L.data.length; i++){
        const lv = L.data[i] / 15;
        const a = Math.pow(1 - lv, 1.45) * 249;
        d[i * 4] = 6; d[i * 4 + 1] = 4; d[i * 4 + 2] = 14;
        d[i * 4 + 3] = a;
      }
      lightCtx.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(lightCv, L.x0 * TILE, L.y0 * TILE, L.w * TILE, L.h * TILE);
      ctx.imageSmoothingEnabled = false;
    }
    // 火把暖光
    ctx.globalCompositeOperation = 'lighter';
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++){
      const id = G.getTile(tx, ty);
      if (id === T.TORCH){
        const fl = .28 + Math.sin(g.now * 9 + tx * 7 + ty) * .05;
        const gx = (tx + .5) * TILE, gy = (ty + .35) * TILE;
        const rg = ctx.createRadialGradient(gx, gy, 4, gx, gy, TILE * 2.6);
        rg.addColorStop(0, `rgba(255,170,70,${fl})`);
        rg.addColorStop(1, 'rgba(255,140,50,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(gx - TILE * 2.6, gy - TILE * 2.6, TILE * 5.2, TILE * 5.2);
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // 伤害数字
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(TILE * .55)}px system-ui`;
    for (const d of g.dmgTexts){
      ctx.globalAlpha = Math.min(1, d.life * 2.5);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(40,20,10,.8)';
      ctx.strokeText(d.txt, d.x * TILE, d.y * TILE);
      ctx.fillStyle = d.col;
      ctx.fillText(d.txt, d.x * TILE, d.y * TILE);
    }
    ctx.globalAlpha = 1;
  };

  G.onScreen = function(e){
    const vw = R.W / R.zoom / TILE, vh = R.H / R.zoom / TILE;
    return e.x + e.w > G.cam.x - vw / 2 - 2 && e.x < G.cam.x + vw / 2 + 2 &&
           e.y + e.h > G.cam.y - vh / 2 - 2 && e.y < G.cam.y + vh / 2 + 2;
  };

  // 标题画面装饰地面
  G.drawMenuGround = function(){
    const c = document.getElementById('menuGround');
    const w = c.clientWidth || innerWidth;
    c.width = w; c.height = 120;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    for (let tx = 0; tx < w / 24 + 1; tx++){
      const h = 3 + Math.round(Math.sin(tx * .7) * 1.2);
      for (let ty = 0; ty < h; ty++){
        x.drawImage(G.tex.getTile(ty === 0 ? T.GRASS : T.DIRT, (tx * 7 + ty) % 3), tx * 24, 120 - (ty + 1) * 24, 24, 24);
      }
    }
  };
})();
