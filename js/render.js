// ============ 渲染 v2：融合世界 / 精细角色 / 泰拉瑞亚式天空 ============
'use strict';
(function(){
  const T = G.T, CFG = G.CFG, TILE = CFG.TILE;
  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const lightCv = document.createElement('canvas');
  const lightCtx = lightCv.getContext('2d');

  const R = { cv, ctx, W: 0, H: 0, zoom: 1.2, dpr: 1 };
  G.render = R;
  G.cam = { x: 0, y: 0 };

  R.resize = function(){
    R.dpr = Math.min(window.devicePixelRatio || 1, 2);
    R.W = window.innerWidth; R.H = window.innerHeight;
    cv.width = Math.round(R.W * R.dpr);
    cv.height = Math.round(R.H * R.dpr);
    const tilePx = G.clamp(Math.min(R.W / 26, R.H / 15), 20, 52);
    R.zoom = tilePx / TILE;
  };
  window.addEventListener('resize', () => R.resize());

  // ---- 背景元素 ----
  const bgRng = G.makeRNG(999);
  const stars = []; for (let i = 0; i < 140; i++) stars.push({ x: bgRng(), y: bgRng() * .75, s: .5 + bgRng() * 1.6, tw: bgRng() * 7 });
  const clouds = []; for (let i = 0; i < 10; i++) clouds.push({ x: bgRng(), y: .03 + bgRng() * .3, s: .6 + bgRng() * 1.4, spd: .004 + bgRng() * .01, near: bgRng() < .4 });

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
  R.nightFactor = function(){
    const tod = G.game ? G.game.timeTod : 0;
    if (tod < .5) return 0;
    if (tod < .58) return (tod - .5) / .08;
    if (tod < .92) return 1;
    return 1 - (tod - .92) / .08;
  };

  // 泰拉瑞亚式棉花云：多圆组合 + 平底 + 底部阴影
  function drawCloud(cx, cy, s, alpha){
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.fillStyle = `rgba(226,236,246,${(alpha * .8).toFixed(2)})`; // 底层阴影
    ctx.beginPath();
    ctx.ellipse(-46, 6, 34, 16, 0, 0, 7);
    ctx.ellipse(0, 9, 52, 15, 0, 0, 7);
    ctx.ellipse(46, 6, 34, 16, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(-40, -4, 30, 17, 0, 0, 7);
    ctx.ellipse(0, -10, 40, 22, 0, 0, 7);
    ctx.ellipse(40, -4, 30, 17, 0, 0, 7);
    ctx.ellipse(0, 2, 60, 16, 0, 0, 7);
    ctx.fill();
    ctx.restore();
  }

  function drawSky(){
    const [c1, c2] = skyColors(G.game.timeTod);
    const grd = ctx.createLinearGradient(0, 0, 0, R.H);
    grd.addColorStop(0, c1); grd.addColorStop(1, c2);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, R.W, R.H);
    const nf = R.nightFactor();
    const tod = G.game.timeTod;

    // 星星
    if (nf > 0.05){
      const t = G.game.now;
      for (const s of stars){
        const a = nf * (0.35 + 0.65 * Math.abs(Math.sin(t * .8 + s.tw)));
        ctx.fillStyle = `rgba(255,255,240,${a.toFixed(2)})`;
        ctx.fillRect(s.x * R.W, s.y * R.H, s.s, s.s);
      }
    }
    // 日月弧线
    const arc = (p) => [G.lerp(R.W * .1, R.W * .9, p), R.H * .55 - Math.sin(p * Math.PI) * R.H * .42];
    if (tod < .55){
      const p = Math.min(1, tod / .52);
      const [sx, sy] = arc(p);
      let g = ctx.createRadialGradient(sx, sy, 8, sx, sy, 90);
      g.addColorStop(0, 'rgba(255,236,160,.5)'); g.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - 90, sy - 90, 180, 180);
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(sx, sy, 19, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff6d8';
      ctx.beginPath(); ctx.arc(sx - 4, sy - 5, 12, 0, 7); ctx.fill();
      // 光芒短线
      ctx.strokeStyle = 'rgba(255,236,160,.5)'; ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++){
        const a = i / 8 * Math.PI * 2 + G.game.now * .05;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * 24, sy + Math.sin(a) * 24);
        ctx.lineTo(sx + Math.cos(a) * 31, sy + Math.sin(a) * 31);
        ctx.stroke();
      }
    }
    if (tod >= .5){
      const mp = tod >= .5 ? (tod - .52) / .48 : (tod + .48) / .48;
      if (mp >= 0 && mp <= 1){
        const [mx, my] = arc(mp);
        let g = ctx.createRadialGradient(mx, my, 6, mx, my, 70);
        g.addColorStop(0, 'rgba(210,225,255,.35)'); g.addColorStop(1, 'rgba(210,225,255,0)');
        ctx.fillStyle = g; ctx.fillRect(mx - 70, my - 70, 140, 140);
        ctx.fillStyle = '#e8eef8';
        ctx.beginPath(); ctx.arc(mx, my, 16, 0, 7); ctx.fill();
        ctx.fillStyle = '#c9d4e6';
        ctx.beginPath(); ctx.arc(mx - 5, my + 3, 3, 0, 7); ctx.arc(mx + 6, my - 4, 2, 0, 7); ctx.arc(mx + 2, my + 7, 1.6, 0, 7); ctx.fill();
      }
    }
    // 云（双层视差）
    for (const c of clouds){
      const spd = c.spd * (c.near ? 1.8 : 1);
      const cx = ((c.x + G.game.now * spd) % 1.25 - .125) * R.W;
      const cy = c.y * R.H;
      const alpha = c.near ? .92 - nf * .55 : .6 - nf * .4;
      drawCloud(cx, cy, c.s * R.H * .0022 + .35, Math.max(0, alpha));
    }
    // 远景：淡蓝远山 → 森林剪影带（泰拉瑞亚地表背景感）
    const horizon = R.H * .58;
    drawHills(horizon, .1, `rgba(120,155,185,${(.42 - nf * .3).toFixed(2)})`, 70, 0.9);
    drawForest(horizon, .2, nf, 2.3);
    drawHills(horizon, .3, `rgba(60,95,80,${(.5 - nf * .35).toFixed(2)})`, 40, 4.1);
  }
  function drawHills(horizon, para, col, amp, seedX){
    const camPx = G.cam.x * R.zoom * para * 8;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, R.H);
    for (let sx = 0; sx <= R.W + 16; sx += 16){
      const wx = (sx + camPx) * .004;
      const h = Math.sin(wx * 1.7 + seedX) * .5 + Math.sin(wx * 3.3 + seedX * 2) * .3 + Math.sin(wx * .6 + seedX * 3) * .7;
      ctx.lineTo(sx, horizon - amp * .4 - h * amp * .5);
    }
    ctx.lineTo(R.W + 16, R.H);
    ctx.closePath();
    ctx.fill();
  }
  // 森林剪影：重复圆冠树影
  function drawForest(horizon, para, nf, seedX){
    const camPx = G.cam.x * R.zoom * para * 8;
    const step = 46;
    const off = -(camPx % step);
    ctx.fillStyle = `rgba(52,92,74,${(.55 - nf * .38).toFixed(2)})`;
    ctx.fillRect(0, horizon - 26, R.W, R.H - horizon + 26);
    for (let sx = off - step; sx < R.W + step; sx += step){
      const seed = Math.abs(Math.floor((sx - off + camPx) / step + seedX));
      const rr = 18 + (seed * 7 % 12);
      const yy = horizon - 24 + (seed * 13 % 8);
      ctx.beginPath();
      ctx.arc(sx, yy, rr, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(sx - 2, yy - rr * .4, 4, 26 + rr * .4);
    }
  }

  // ---- 背景墙（暗化 tile）----
  const wallCache = new Map();
  function wallTex(wallId){
    if (wallCache.has(wallId)) return wallCache.get(wallId);
    const map = { [G.WALL.DIRT]: T.DIRT, [G.WALL.STONE]: T.STONE, [G.WALL.SNOW]: T.SNOW, [G.WALL.SAND]: T.SAND, [G.WALL.ASH]: T.ASH };
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const c2 = c.getContext('2d');
    c2.drawImage(G.tex.getTile(map[wallId] || T.DIRT, 0, 0), 0, 0);
    c2.fillStyle = 'rgba(10,7,16,.68)';
    c2.fillRect(0, 0, 16, 16);
    wallCache.set(wallId, c);
    return c;
  }

  // ---- 世界：融合贴图 ----
  function drawWorld(x0, y0, x1, y1){
    const FUSE = G.tex.FUSE;
    for (let ty = y0; ty <= y1; ty++){
      for (let tx = x0; tx <= x1; tx++){
        const id = G.getTile(tx, ty);
        const px = tx * TILE, py = ty * TILE;
        const wall = G.getWall(tx, ty);
        if (wall && !G.TILES[id].solid && id !== T.AIR) { /* 半透明物后面也要墙 */ }
        if (wall && !G.TILES[id].solid) ctx.drawImage(wallTex(wall), px, py, TILE, TILE);
        if (id === T.AIR) continue;
        const grp = FUSE[id] || 0;
        let mask = 0;
        if (grp){
          const same = (xx, yy) => (FUSE[G.getTile(xx, yy)] || 0) === grp;
          if (same(tx, ty - 1)) mask |= 1;
          if (same(tx + 1, ty)) mask |= 2;
          if (same(tx, ty + 1)) mask |= 4;
          if (same(tx - 1, ty)) mask |= 8;
        }
        const variant = ((tx * 3 + ty * 7) >> 1) & 1;
        ctx.drawImage(G.tex.getTile(id, mask, variant), px, py, TILE, TILE);
      }
    }
  }

  // ================= 玩家（泰拉瑞亚式像素小人） =================
  function drawPlayer(p){
    if (p.invulnT > 0 && Math.floor(p.invulnT * 14) % 2 === 0) return;
    const S = TILE; // 每 tile 像素
    const u = 2.65 * S / 26; // 人物 = 26 逻辑像素高
    const cx = (p.x + p.w / 2) * S, top = p.y * S;
    const dir = p.dir;
    const walking = Math.abs(p.vx) > .5 && p.onGround;
    const phase = p.anim * 11;
    const leg = walking ? Math.sin(phase) : 0;
    const bob = walking ? -Math.abs(Math.sin(phase)) * u : 0;
    ctx.save();
    ctx.translate(cx, top + bob);
    ctx.scale(dir, 1);

    const SKIN = '#eab98a', SKIN_D = '#d19a6b';
    const HAIR = '#7a4a22', HAIR_H = '#96602e';
    const SHIRT = '#3f6fae', SHIRT_H = '#5488c9';
    const PANTS = '#35406e', SHOE = '#6e4e24';

    // ---- 后臂（藏在躯干侧后，走路时摆出）----
    const armBack = walking ? -leg * 2 * u : 0;
    ctx.fillStyle = SHIRT;
    ctx.fillRect(-5.7 * u, 9.5 * u, 2.8 * u, 4.2 * u);
    ctx.fillStyle = SKIN_D;
    ctx.fillRect(-5.7 * u, 13.5 * u + armBack * .3, 2.8 * u, 3 * u);

    // ---- 腿 ----
    if (!p.onGround){ // 跳跃姿势：前后分
      ctx.fillStyle = PANTS;
      ctx.fillRect(-4.6 * u, 17.5 * u, 4 * u, 6 * u);
      ctx.fillRect(1 * u, 17.5 * u, 4 * u, 7.2 * u);
      ctx.fillStyle = SHOE;
      ctx.fillRect(-4.6 * u, 23.5 * u, 4.4 * u, 2 * u);
      ctx.fillRect(1 * u, 24.7 * u, 4.4 * u, 1.6 * u);
    } else {
      const swing = walking ? leg * 2.6 : 0;
      // 后腿
      ctx.fillStyle = '#2b3560';
      ctx.fillRect(-4.4 * u + swing * u, 17.5 * u, 3.8 * u, 6.4 * u - Math.abs(swing) * u);
      ctx.fillStyle = '#523a1c';
      ctx.fillRect(-4.6 * u + swing * u, 23.9 * u - Math.abs(swing) * u, 4.2 * u, 2.1 * u);
      // 前腿
      ctx.fillStyle = PANTS;
      ctx.fillRect(.6 * u - swing * u, 17.5 * u, 3.8 * u, 6.4 * u - Math.abs(swing) * u);
      ctx.fillStyle = SHOE;
      ctx.fillRect(.4 * u - swing * u, 23.9 * u - Math.abs(swing) * u, 4.2 * u, 2.1 * u);
    }

    // ---- 躯干 ----
    ctx.fillStyle = SHIRT;
    ctx.fillRect(-5 * u, 9 * u, 10 * u, 8.7 * u);
    ctx.fillStyle = SHIRT_H;
    ctx.fillRect(-5 * u, 9 * u, 10 * u, 2 * u);
    ctx.fillStyle = '#2d5290';
    ctx.fillRect(-5 * u, 16.2 * u, 10 * u, 1.5 * u); // 下摆阴影
    ctx.fillStyle = '#6e4e24';
    ctx.fillRect(-5 * u, 16.6 * u, 10 * u, 1.1 * u); // 腰带

    // ---- 头 ----
    ctx.fillStyle = SKIN;
    ctx.fillRect(-4 * u, 2 * u, 9 * u, 7.2 * u);        // 脸
    ctx.fillStyle = HAIR;
    ctx.fillRect(-5.4 * u, 0, 10.6 * u, 2.6 * u);       // 发顶
    ctx.fillRect(-5.4 * u, 0, 2.2 * u, 7.5 * u);        // 后脑发
    ctx.fillRect(-5.4 * u, 6.8 * u, 3 * u, 1.6 * u);    // 发尾
    ctx.fillStyle = HAIR_H;
    ctx.fillRect(-5.4 * u, 0, 10.6 * u, .9 * u);
    ctx.fillStyle = '#2a2a2a';                          // 眼
    ctx.fillRect(2.4 * u, 4 * u, 1.4 * u, 1.8 * u);
    ctx.fillStyle = '#fff';
    ctx.fillRect(2.4 * u, 4 * u, .6 * u, .8 * u);
    ctx.fillStyle = SKIN_D;                             // 嘴/下颌阴影
    ctx.fillRect(2 * u, 7.4 * u, 2.8 * u, .7 * u);
    ctx.restore();

    // ---- 前臂 + 挥舞武器 ----
    const held = G.inv.held();
    const def = held ? G.ITEMS[held.id] : null;
    const showItem = def && (def.type === 'tool' || def.type === 'weapon' || def.type === 'bow');
    let armAng;
    if (p.swing > 0) armAng = G.lerp(-2.3, 1.2, 1 - p.swing);
    else if (def && def.type === 'bow') armAng = -.9;
    else armAng = walking ? leg * 2.4 * u / u * .35 : .15;
    ctx.save();
    ctx.translate(cx + dir * 1.5 * u, top + bob + 10 * u); // 肩点
    ctx.scale(dir, 1);
    ctx.rotate(armAng);
    // 手臂（袖+手）
    ctx.fillStyle = SHIRT;
    ctx.fillRect(-1.4 * u, -1.2 * u, 2.8 * u, 5.4 * u);
    ctx.fillStyle = SKIN;
    ctx.fillRect(-1.4 * u, 4.2 * u, 2.8 * u, 3.6 * u);
    // 武器挂在手末端，随臂旋转再补偿基础角度
    if (showItem && (p.swing > 0 || def.type === 'bow')){
      ctx.save();
      ctx.translate(0, 8.2 * u);
      ctx.rotate(-.75);
      ctx.imageSmoothingEnabled = false;
      const sz = 2.65 * S;
      ctx.drawImage(G.tex.getIcon(held.id), -sz * .18, -sz * .95, sz, sz);
      ctx.restore();
    }
    ctx.restore();
  }

  // ================= 怪物 =================
  function drawEnemy(e){
    const S = TILE;
    const px = e.x * S, py = e.y * S, w = e.w * S, h = e.h * S;
    const flash = e.hurtT > 0;
    ctx.save();
    if (e.def.ai === 'hop'){ // 史莱姆：果冻感
      const sq = e.onGround ? 1 + Math.sin(e.anim * 6) * .07 : .8;
      const bh = h * sq, bw = w * (1 + (1 - sq) * .5);
      const bx = px + (w - bw) / 2, by = py + h - bh;
      const col = e.def.color;
      const g = ctx.createLinearGradient(bx, by, bx, by + bh);
      g.addColorStop(0, flash ? '#fff' : 'rgba(255,255,255,.55)');
      g.addColorStop(.25, flash ? '#fff' : col);
      g.addColorStop(1, flash ? '#ddd' : shade(col, .55));
      ctx.fillStyle = g;
      roundRect(bx, by, bw, bh, bh * .3);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; // 体内核心影
      ctx.beginPath(); ctx.ellipse(bx + bw / 2, by + bh * .62, bw * .22, bh * .22, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.75)'; // 高光
      ctx.fillRect(bx + bw * .2, by + bh * .16, bw * .2, bh * .1);
      ctx.fillStyle = '#1a1a1a';
      const ey = by + bh * .38;
      ctx.fillRect(bx + bw * .3, ey, bw * .09, bh * .22);
      ctx.fillRect(bx + bw * .61, ey, bw * .09, bh * .22);
      if (e.isBoss){ // 王冠
        ctx.fillStyle = '#e8c34c';
        ctx.fillRect(px + w * .3, by - 9, w * .4, 7);
        ctx.fillRect(px + w * .32, by - 15, 5, 7); ctx.fillRect(px + w * .48, by - 17, 5, 9); ctx.fillRect(px + w * .62, by - 15, 5, 7);
        ctx.fillStyle = '#e05a8a'; ctx.fillRect(px + w * .485, by - 14, 3, 3);
      }
    }
    else if (e.key === 'zombie'){ // 双臂前伸的僵尸
      const walk = Math.sin(e.anim * 8) * (Math.abs(e.vx) > .2 ? 1 : 0);
      drawZombie(px, py, w, h, flash, walk, e);
    }
    else if (e.key === 'skeleton'){
      drawSkeleton(px, py, w, h, flash, Math.sin(e.anim * 9) * (Math.abs(e.vx) > .2 ? 1 : 0));
    }
    else if (e.key === 'demon_eye' || e.def.ai === 'bossEye'){
      drawEye(e, px, py, w, h, flash);
    }
    else if (e.key === 'cave_bat'){
      drawBat(e, px, py, w, h, flash);
    }
    else if (e.key === 'fire_imp'){
      drawImp(e, px, py, w, h, flash);
    }
    ctx.restore();
  }
  function shade(hex, f){
    const c = hex2rgb(hex);
    return `rgb(${Math.round(c[0]*f)},${Math.round(c[1]*f)},${Math.round(c[2]*f)})`;
  }
  function drawZombie(px, py, w, h, flash, walk, e){
    const u = w / 14;
    const skin = flash ? '#fff' : '#7d9c5a', skinD = flash ? '#eee' : '#6a8649';
    const cloth = flash ? '#eee' : '#5a6a4a';
    const face = e.x + e.w/2 < G.game.player.x + G.game.player.w/2 ? 1 : -1;
    ctx.save();
    ctx.translate(px + w/2, py);
    ctx.scale(face, 1);
    // 腿
    ctx.fillStyle = '#4a4238';
    ctx.fillRect(-5*u + walk*2*u, h*.58, 4*u, h*.42);
    ctx.fillRect(1.5*u - walk*2*u, h*.58, 4*u, h*.42);
    // 躯干破衣
    ctx.fillStyle = cloth;
    ctx.fillRect(-6*u, h*.28, 12*u, h*.34);
    ctx.fillStyle = skinD;
    ctx.fillRect(-2*u, h*.5, 2*u, 2*u); // 破洞露肤
    // 前伸双臂
    ctx.fillStyle = skin;
    ctx.fillRect(2*u, h*.3, 9*u, 3*u);
    // 头
    ctx.fillStyle = skin;
    ctx.fillRect(-4*u, h*.02, 9*u, h*.28);
    ctx.fillStyle = skinD;
    ctx.fillRect(-4*u, h*.02, 9*u, 1);
    ctx.fillStyle = '#c9d4b0'; // 死鱼眼
    ctx.fillRect(2*u, h*.1, 2.4*u, 2*u);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(3.4*u, h*.14, 1*u, 1.2*u);
    ctx.restore();
  }
  function drawSkeleton(px, py, w, h, flash, walk){
    const u = w / 14;
    const bone = flash ? '#fff' : '#e8e8dc', boneD = flash ? '#eee' : '#b8b8a8';
    ctx.save();
    ctx.translate(px + w/2, py);
    ctx.scale(walk > 0 ? 1 : (walk < 0 ? -1 : 1) || 1, 1);
    ctx.fillStyle = bone;
    ctx.fillRect(-4*u + walk*2*u, h*.58, 1.6*u, h*.42);   // 腿骨
    ctx.fillRect(2.5*u - walk*2*u, h*.58, 1.6*u, h*.42);
    ctx.fillRect(-5*u + walk*2*u, h*.96, 3.4*u, 1.4*u);   // 脚
    ctx.fillRect(1.8*u - walk*2*u, h*.96, 3.4*u, 1.4*u);
    ctx.fillRect(-2.6*u, h*.3, 5.6*u, h*.3);              // 脊柱胸
    for (let i = 0; i < 3; i++){                          // 肋骨
      ctx.fillRect(-4.6*u, h*(.33 + i*.08), 9.6*u, 1*u);
    }
    ctx.fillStyle = boneD;
    ctx.fillRect(-1*u, h*.28, 2*u, h*.32);
    // 头骨
    ctx.fillStyle = bone;
    ctx.fillRect(-4*u, h*.02, 8.6*u, h*.26);
    ctx.fillRect(-3*u, h*.26, 6.6*u, h*.05);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(0.4*u, h*.1, 1.8*u, 2*u);                // 眼洞
    ctx.fillRect(-2.8*u, h*.1, 1.6*u, 2*u);
    ctx.fillRect(1.4*u, h*.2, 1.2*u, 1*u);                // 鼻洞
    for (let i = 0; i < 4; i++) ctx.fillRect(-2.6*u + i*2*u, h*.27, .8*u, 1.4*u); // 牙缝
    ctx.restore();
  }
  function drawEye(e, px, py, w, h, flash){
    const r = w * .5, cx2 = px + r, cy2 = py + r;
    const p = G.game.player;
    const da = Math.atan2(p.y - e.y, p.x - e.x);
    if (e.def.ai === 'bossEye'){
      ctx.strokeStyle = '#a83a3a'; ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++){
        const a = e.anim * 1.5 + i * 1.3;
        ctx.beginPath();
        ctx.moveTo(cx2 + Math.cos(a) * r * .75, cy2 + Math.sin(a) * r * .75);
        ctx.lineTo(cx2 + Math.cos(a) * (r + 16), cy2 + Math.sin(a) * (r + 16));
        ctx.stroke();
        ctx.fillStyle = '#a83a3a';
        ctx.beginPath(); ctx.arc(cx2 + Math.cos(a) * (r + 16), cy2 + Math.sin(a) * (r + 16), 2.5, 0, 7); ctx.fill();
      }
    }
    ctx.fillStyle = flash ? '#fff' : '#f0ece0';
    ctx.beginPath(); ctx.arc(cx2, cy2, r, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(160,120,100,.3)'; // 眼白血管
    ctx.beginPath(); ctx.arc(cx2 + Math.cos(da + 2.5) * r * .6, cy2 + Math.sin(da + 2.5) * r * .6, r * .12, 0, 7); ctx.fill();
    if (e.state === 9){
      ctx.fillStyle = '#7a1414';
      ctx.beginPath(); ctx.arc(cx2, cy2, r * .78, 0, 7); ctx.fill();
      ctx.fillStyle = '#f0ece0';
      for (let i = 0; i < 6; i++){
        const a = i / 6 * Math.PI * 2 + e.anim;
        ctx.beginPath();
        ctx.moveTo(cx2 + Math.cos(a) * r * .78, cy2 + Math.sin(a) * r * .78);
        ctx.lineTo(cx2 + Math.cos(a + .35) * r * .78, cy2 + Math.sin(a + .35) * r * .78);
        ctx.lineTo(cx2 + Math.cos(a + .18) * r * .3, cy2 + Math.sin(a + .18) * r * .3);
        ctx.fill();
      }
    } else {
      const pxo = Math.cos(da) * r * .32, pyo = Math.sin(da) * r * .32;
      ctx.fillStyle = '#c93a3a';
      ctx.beginPath(); ctx.arc(cx2 + pxo, cy2 + pyo, r * .5, 0, 7); ctx.fill();
      ctx.fillStyle = '#2a2a2a';
      ctx.beginPath(); ctx.arc(cx2 + pxo * 1.35, cy2 + pyo * 1.35, r * .24, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.arc(cx2 - r * .35, cy2 - r * .4, r * .12, 0, 7); ctx.fill();
    }
  }
  function drawBat(e, px, py, w, h, flash){
    const flap = Math.sin(e.anim * 20) * h * .5;
    ctx.fillStyle = flash ? '#fff' : '#584a68';
    ctx.beginPath();
    ctx.moveTo(px + w * .32, py + h * .5);
    ctx.quadraticCurveTo(px - w * .3, py + h * .2 + flap, px - w * .35, py + h * .8 + flap);
    ctx.quadraticCurveTo(px + w * .05, py + h * .65, px + w * .32, py + h * .78);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px + w * .68, py + h * .5);
    ctx.quadraticCurveTo(px + w * 1.3, py + h * .2 + flap, px + w * 1.35, py + h * .8 + flap);
    ctx.quadraticCurveTo(px + w * .95, py + h * .65, px + w * .68, py + h * .78);
    ctx.fill();
    ctx.fillStyle = flash ? '#fff' : '#6a5a7a';
    ctx.beginPath(); ctx.ellipse(px + w / 2, py + h / 2, w * .26, h * .32, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#4a3e58'; // 耳
    ctx.beginPath(); ctx.moveTo(px + w*.36, py + h*.14); ctx.lineTo(px + w*.42, py - h*.06); ctx.lineTo(px + w*.5, py + h*.12); ctx.fill();
    ctx.beginPath(); ctx.moveTo(px + w*.64, py + h*.14); ctx.lineTo(px + w*.58, py - h*.06); ctx.lineTo(px + w*.5, py + h*.12); ctx.fill();
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(px + w * .38, py + h * .4, 2.5, 2.5);
    ctx.fillRect(px + w * .56, py + h * .4, 2.5, 2.5);
    ctx.fillStyle = '#fff';
    ctx.fillRect(px + w * .44, py + h * .68, 1.6, 1.6); ctx.fillRect(px + w * .54, py + h * .68, 1.6, 1.6);
  }
  function drawImp(e, px, py, w, h, flash){
    const bob = Math.sin(e.anim * 3) * 2;
    ctx.save();
    ctx.translate(0, bob);
    const face = e.x + e.w/2 < G.game.player.x + G.game.player.w/2 ? 1 : -1;
    ctx.save();
    ctx.translate(px + w/2, py);
    ctx.scale(face, 1);
    // 尾巴
    ctx.strokeStyle = flash ? '#fff' : '#a83a1a'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-w * .4, h * .7);
    ctx.quadraticCurveTo(-w * .9, h * .55 + Math.sin(e.anim * 5) * 4, -w * .8, h * .3);
    ctx.stroke();
    // 身体
    ctx.fillStyle = flash ? '#fff' : '#c94a2a';
    ctx.fillRect(-w * .3, h * .42, w * .6, h * .5);
    ctx.fillRect(-w * .38, h * .1, w * .76, h * .38);
    // 耳角
    ctx.fillStyle = flash ? '#fff' : '#e8642e';
    ctx.beginPath(); ctx.moveTo(-w*.36, h*.12); ctx.lineTo(-w*.5, -h*.06); ctx.lineTo(-w*.2, h*.06); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w*.36, h*.12); ctx.lineTo(w*.5, -h*.06); ctx.lineTo(w*.2, h*.06); ctx.fill();
    // 眼
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(w * .1, h * .2, w * .14, h * .08);
    ctx.fillRect(w * .34, h * .2, w * .14, h * .08);
    ctx.fillStyle = '#2a0a0a';
    ctx.fillRect(w * .15, h * .22, w * .05, h * .05);
    ctx.fillRect(w * .39, h * .22, w * .05, h * .05);
    // 手臂+火球
    ctx.fillStyle = flash ? '#fff' : '#c94a2a';
    ctx.fillRect(w * .28, h * .48, w * .3, h * .1);
    ctx.fillStyle = '#ff8c3c';
    ctx.beginPath(); ctx.arc(w * .62, h * .53, w * .09 + Math.sin(e.anim * 8) * 1.5, 0, 7); ctx.fill();
    ctx.restore();
    ctx.restore();
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

    if (p.mineProg > 0 && p.mineX >= 0){
      const target = G.TILES[G.getTile(p.mineX, p.mineY)];
      const stage = Math.min(3, Math.floor(p.mineProg / target.hp * 4));
      ctx.drawImage(G.tex.getCrack(stage + 1), p.mineX * TILE, p.mineY * TILE, TILE, TILE);
    }
    const inp = G.input;
    if (inp.aimTileX >= 0 && !G.ui.blockUse){
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(inp.aimTileX * TILE + 1, inp.aimTileY * TILE + 1, TILE - 2, TILE - 2);
    }

    for (const e of g.entities){
      if (e.kind !== 'drop') continue;
      const bob = Math.sin(g.now * 3 + e.bob) * 2;
      const sz = TILE * .68;
      ctx.drawImage(G.tex.getIcon(e.item), e.x * TILE + (TILE - sz) / 2, e.y * TILE + bob + (TILE - sz) / 2, sz, sz);
    }
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
    for (const e of g.entities){
      if (e.kind === 'enemy' && (!e.isBoss || G.onScreen(e))) drawEnemy(e);
    }
    if (!p.dead) drawPlayer(p);

    for (const pt of g.particles){
      ctx.globalAlpha = Math.min(1, pt.life / pt.maxLife * 1.5);
      ctx.fillStyle = pt.col;
      ctx.fillRect(pt.x * TILE - pt.size, pt.y * TILE - pt.size, pt.size * 2, pt.size * 2);
    }
    ctx.globalAlpha = 1;

    // 光照遮罩
    const L = G.light;
    if (L.data){
      if (lightCv.width !== L.w || lightCv.height !== L.h){ lightCv.width = L.w; lightCv.height = L.h; }
      const img = lightCtx.createImageData(L.w, L.h);
      const d = img.data;
      for (let i = 0; i < L.data.length; i++){
        const lv = L.data[i] / 15;
        const a = Math.pow(1 - lv, 1.45) * 249;
        d[i * 4] = 6; d[i * 4 + 1] = 5; d[i * 4 + 2] = 16;
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
        const fl = .3 + Math.sin(g.now * 9 + tx * 7 + ty) * .06;
        const gx = (tx + .5) * TILE, gy = (ty + .35) * TILE;
        const rg = ctx.createRadialGradient(gx, gy, 4, gx, gy, TILE * 2.8);
        rg.addColorStop(0, `rgba(255,170,70,${fl})`);
        rg.addColorStop(1, 'rgba(255,140,50,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(gx - TILE * 2.8, gy - TILE * 2.8, TILE * 5.6, TILE * 5.6);
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.round(TILE * .6)}px system-ui`;
    for (const d of g.dmgTexts){
      ctx.globalAlpha = Math.min(1, d.life * 2.5);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(30,15,8,.85)';
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

  G.drawMenuGround = function(){
    const c = document.getElementById('menuGround');
    const w = c.clientWidth || innerWidth;
    c.width = w; c.height = 130;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    for (let tx = 0; tx < w / 24 + 1; tx++){
      const h = 3 + Math.round(Math.sin(tx * .7) * 1.2);
      for (let ty = 0; ty < h; ty++){
        const mask = (ty === h - 1 ? 0 : 4);
        x.drawImage(G.tex.getTile(ty === 0 ? T.GRASS : T.DIRT, ty === 0 ? 0 : mask, (tx * 7 + ty) & 1), tx * 24, 130 - (ty + 1) * 24, 24, 24);
      }
    }
  };
})();
