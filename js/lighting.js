// ============ 光照：BFS 传播 + 平滑遮罩 ============
'use strict';
(function(){
  const T = G.T;
  const MARGIN = 12;
  const L = { x0: 0, y0: 0, w: 0, h: 0, data: null };
  G.light = L;

  let queue = null;

  L.skyLevel = function(tod){ // tod: 0..1 (0=日出)
    // 白天 0~0.52, 夜晚 0.52~1
    let s;
    if (tod < .5) s = 15;
    else if (tod < .56) s = Math.round(G.lerp(15, 3, (tod - .5) / .06));   // 黄昏
    else if (tod < .94) s = 3;
    else s = Math.round(G.lerp(3, 15, (tod - .94) / .06));                  // 黎明
    return s;
  };

  L.update = function(cx0, cy0, cw, ch){
    const w = cw + MARGIN * 2, h = ch + MARGIN * 2;
    const x0 = cx0 - MARGIN, y0 = cy0 - MARGIN;
    L.x0 = x0; L.y0 = y0; L.w = w; L.h = h;
    if (!L.data || L.data.length !== w * h) L.data = new Uint8Array(w * h);
    if (!queue || queue.length < w * h * 4) queue = new Int32Array(w * h * 4);
    const data = L.data;
    data.fill(0);

    const sky = L.skyLevel(G.game ? G.game.timeTod : 0);
    let qh = 0, qt = 0;
    const solid = (x, y) => G.TILES[G.getTile(x, y)].solid;

    // 1) 天空光：每列从顶向下，直到首个固体
    for (let dx = 0; dx < w; dx++){
      const x = x0 + dx;
      for (let dy = 0; dy < h; dy++){
        const y = y0 + dy;
        if (solid(x, y)) break;
        const i = dy * w + dx;
        data[i] = sky;
        queue[qt++] = i;
      }
    }
    // 2) 发光方块
    for (let dy = 0; dy < h; dy++){
      const y = y0 + dy;
      for (let dx = 0; dx < w; dx++){
        const x = x0 + dx;
        const lv = G.TILES[G.getTile(x, y)].light;
        if (lv > 0){
          const i = dy * w + dx;
          if (lv > data[i]){ data[i] = lv; queue[qt++] = i; }
        }
      }
    }
    // 3) BFS 衰减传播
    while (qh < qt){
      const i = queue[qh++];
      const lv = data[i];
      if (lv <= 1) continue;
      const dx = i % w, dy = (i / w) | 0;
      for (let d = 0; d < 4; d++){
        const nx = dx + (d === 0 ? 1 : d === 1 ? -1 : 0);
        const ny = dy + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        const cost = solid(x0 + nx, y0 + ny) ? 3 : 1;
        const nl = lv - cost;
        if (nl > data[ni]){ data[ni] = nl; queue[qt++] = ni; }
      }
    }
  };

  // 采样某世界 tile 坐标的光照（0..15）
  L.at = function(tx, ty){
    if (!L.data) return 15;
    const dx = tx - L.x0, dy = ty - L.y0;
    if (dx < 0 || dy < 0 || dx >= L.w || dy >= L.h) return 15;
    return L.data[dy * L.w + dx];
  };
})();
