// ============ 世界生成与 tile 存取 ============
'use strict';
(function(){
  const T = G.T, CFG = G.CFG;

  G.world = null;

  G.getTile = function(x, y){
    if (x < 2 || x >= CFG.W - 2 || y >= CFG.H) return T.BEDROCK;
    if (y < 0) return T.AIR;
    return G.world.tiles[y * CFG.W + x];
  };
  G.setTile = function(x, y, id){
    if (x < 2 || x >= CFG.W - 2 || y < 0 || y >= CFG.H) return;
    G.world.tiles[y * CFG.W + x] = id;
  };
  G.getWall = function(x, y){
    if (x < 0 || x >= CFG.W || y < 0 || y >= CFG.H) return 0;
    return G.world.walls[y * CFG.W + x];
  };
  G.isSolid = function(x, y){ return G.TILES[G.getTile(x, y)].solid; };
  G.isPlat = function(x, y){ return !!G.TILES[G.getTile(x, y)].plat; };

  // 该格是否完整（挖掘/放置用：树干、火把等依附方块会被破坏）
  G.breakSupports = function(x, y){
    const id = G.getTile(x, y);
    // 树/仙人掌连锁：向上毁掉整段
    if (id === T.TREE || id === T.PINE || id === T.CACTUS){
      let count = 0, yy = y;
      while (true){
        const above = G.getTile(x, yy - 1);
        if (above === T.TREE || above === T.PINE || above === T.CACTUS){ yy--; count++; }
        else break;
      }
      // 树冠
      const topId = G.getTile(x, yy);
      const leafId = topId === T.PINE ? T.PINELEAF : T.LEAF;
      let leaves = 0;
      for (let dy = -4; dy <= 0; dy++) for (let dx = -3; dx <= 3; dx++){
        if (G.getTile(x + dx, yy + dy) === leafId){ G.setTile(x + dx, yy + dy, T.AIR); leaves++; }
      }
      for (let i = yy; i <= y; i++){ G.setTile(x, i, T.AIR); count++; }
      return { count, leaves, dropPer: G.TILES[id].drop };
    }
    return null;
  };

  G.generateWorld = function(seed){
    const W = CFG.W, H = CFG.H;
    const rng = G.makeRNG(seed);
    const tiles = new Uint8Array(W * H);
    const walls = new Uint8Array(W * H);
    const surface = new Int16Array(W);
    const wd = { w: W, h: H, tiles, walls, surface, seed, spawn: { x: W >> 1, y: 100 } };
    G.world = wd;

    const nA = G.noise1D(rng, 48);   // 大起伏
    const nB = G.noise1D(rng, 180);  // 细节
    const n2d = G.noise2D(rng, 160, 160);
    const lavaN = G.noise2D(rng, 80, 80);

    const snowEnd = Math.floor(W * 0.17);
    const desertStart = Math.floor(W * 0.83);
    const biomeOf = x => x < snowEnd ? 'snow' : (x > desertStart ? 'desert' : 'forest');

    // --- 地表高度 ---
    for (let x = 0; x < W; x++){
      const big = (nA(x / W * 24) - .5) * 34;
      const small = (nB(x / W * 70) - .5) * 10;
      surface[x] = Math.round(108 + big + small);
    }
    // 平滑
    for (let p = 0; p < 2; p++)
      for (let x = 1; x < W - 1; x++)
        surface[x] = Math.round((surface[x-1] + surface[x] * 2 + surface[x+1]) / 4);

    // --- 基本地层 ---
    for (let x = 0; x < W; x++){
      const bio = biomeOf(x);
      const s = surface[x];
      const dirtDepth = 10 + Math.floor(nB(x * .11) * 9);
      for (let y = s; y < H; y++){
        const depth = y - s;
        let id;
        if (y >= H - 2) id = T.BEDROCK;
        else if (y > 348){ id = depth < 2 ? T.ASH : T.ASH; if (depth < 1) id = T.ASH; }
        else if (depth < dirtDepth){
          id = bio === 'snow' ? T.SNOW : (bio === 'desert' ? T.SAND : T.DIRT);
        } else id = T.STONE;
        tiles[y * W + x] = id;
        // 背景墙（地下全是墙 → 洞穴有"里壁"）
        let wall;
        if (y > 348) wall = G.WALL.ASH;
        else if (depth <= dirtDepth + 2) wall = bio === 'snow' ? G.WALL.SNOW : (bio === 'desert' ? G.WALL.SAND : G.WALL.DIRT);
        else wall = G.WALL.STONE;
        walls[y * W + x] = wall;
      }
      // 表面块 → 草
      if (bio === 'forest') tiles[s * W + x] = T.GRASS;
    }

    const set = (x, y, id) => { if (x >= 2 && x < W - 2 && y >= 0 && y < H - 2) tiles[y * W + x] = id; };
    const get = (x, y) => (x < 2 || x >= W - 2 || y < 0 || y >= H - 2) ? T.BEDROCK : tiles[y * W + x];

    // --- 洞穴 ---
    for (let x = 4; x < W - 4; x++){
      const s = surface[x];
      for (let y = s + 6; y < H - 3; y++){
        const depth = y - s;
        const shrink = depth < 14 ? 0.72 : (y > 348 ? 0.60 : 0.635);
        const v = G.fbm2D(n2d, x * .043, y * .056, 3);
        if (v > shrink) set(x, y, T.AIR);
      }
    }

    // --- 蠕虫隧道（连通地表与洞穴）---
    for (let i = 0; i < 14; i++){
      let wx = rng.int(40, W - 40), wy = surface[wx] + 2;
      let ang = Math.PI / 2 + rng.range(-.5, .5);
      const len = rng.int(70, 170), r = rng.range(1.4, 2.4);
      for (let s2 = 0; s2 < len; s2++){
        ang += rng.range(-.45, .45);
        if (wy < surface[Math.max(2, Math.min(W - 3, Math.round(wx)))] + 3) ang = Math.PI / 2;
        wx += Math.cos(ang) * 1.5; wy += Math.sin(ang) * 1.2;
        if (wx < 10 || wx > W - 10 || wy > H - 8) break;
        const ri = Math.ceil(r);
        for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++)
          if (dx * dx + dy * dy <= r * r) set(Math.round(wx) + dx, Math.round(wy) + dy, T.AIR);
      }
    }
    // 深处横向隧道
    for (let i = 0; i < 8; i++){
      let wx = rng.int(60, W - 60), wy = rng.int(200, 330);
      let ang = rng() < .5 ? 0 : Math.PI;
      for (let s2 = 0; s2 < rng.int(50, 130); s2++){
        ang += rng.range(-.3, .3);
        wx += Math.cos(ang) * 1.4; wy += Math.sin(ang) * .8;
        if (wx < 10 || wx > W - 10 || wy > H - 8 || wy < 140) break;
        for (let dy = -1; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
          if (Math.abs(dx) + Math.abs(dy) <= 2) set(Math.round(wx) + dx, Math.round(wy) + dy, T.AIR);
      }
    }

    // --- 岩浆（地狱）---
    for (let x = 4; x < W - 4; x++)
      for (let y = 358; y < H - 2; y++)
        if (get(x, y) === T.AIR && lavaN(x * .09, y * .09) > .52) set(x, y, T.LAVA);
    // 地狱底封层
    for (let x = 4; x < W - 4; x++){ set(x, H - 3, T.ASH); set(x, H - 4, T.ASH); }

    // --- 矿脉 ---
    function oreBlobs(ore, count, yLo, yHi, sizeLo, sizeHi){
      for (let i = 0; i < count; i++){
        const cx = rng.int(6, W - 6), cy = rng.int(yLo, yHi);
        const n = rng.int(sizeLo, sizeHi);
        let px = cx, py = cy;
        for (let k = 0; k < n; k++){
          const r = rng() < .3 ? 2 : 1;
          for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++){
            if (dx * dx + dy * dy > r * r + .5) continue;
            const cur = get(px + dx, py + dy);
            if (cur === T.STONE || cur === T.ASH) set(px + dx, py + dy, ore);
          }
          px += rng.int(-1, 1); py += rng.int(-1, 1);
        }
      }
    }
    oreBlobs(T.COPPER, 240, 100, 230, 4, 10);
    oreBlobs(T.IRON, 190, 120, 260, 4, 9);
    oreBlobs(T.SILVER, 130, 165, 300, 3, 8);
    oreBlobs(T.GOLD, 100, 200, 335, 3, 7);
    oreBlobs(T.GEM, 70, 220, 345, 2, 5);
    oreBlobs(T.HELLSTONE, 90, 350, H - 5, 3, 6);

    // --- 树与装饰 ---
    for (let x = 6; x < W - 6; x++){
      const s = surface[x], top = get(x, s), bio = biomeOf(x);
      if (bio === 'desert'){
        if (top === T.SAND && rng() < .04){
          const h2 = rng.int(2, 4);
          for (let i = 1; i <= h2; i++) if (get(x, s - i) === T.AIR) set(x, s - i, T.CACTUS);
        }
        continue;
      }
      const isGrass = top === T.GRASS || (bio === 'snow' && top === T.SNOW);
      if (!isGrass || rng() > (bio === 'snow' ? .06 : .1)) continue;
      // 检查上方空间
      if (get(x, s - 1) !== T.AIR || get(x, s - 2) !== T.AIR) continue;
      const trunkId = bio === 'snow' ? T.PINE : T.TREE;
      const leafId = bio === 'snow' ? T.PINELEAF : T.LEAF;
      const h = rng.int(5, 9);
      for (let i = 1; i <= h; i++) if (get(x, s - i) === T.AIR) set(x, s - i, trunkId);
      if (bio === 'snow'){
        let wdt = 3;
        for (let dy = -1; dy >= -h - 1; dy--){
          for (let dx = -wdt; dx <= wdt; dx++)
            if (Math.abs(dx) <= wdt && get(x + dx, s + dy + 2) === T.AIR) set(x + dx, s + dy + 2, leafId);
          wdt = Math.max(0, wdt - 1);
          if (wdt === 0) break;
        }
      } else {
        const cy = s - h - 1;
        for (let dy = -2; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++){
          if (dx * dx + dy * dy * 1.6 <= 6.5 && get(x + dx, cy + dy) === T.AIR) set(x + dx, cy + dy, leafId);
        }
      }
      x += 2;
    }
    // 花草
    for (let x = 4; x < W - 4; x++){
      const s = surface[x];
      if (get(x, s) === T.GRASS && get(x, s - 1) === T.AIR){
        const r = rng();
        if (r < .14) set(x, s - 1, T.TGRASS);
        else if (r < .2) set(x, s - 1, T.FLOWER);
      }
    }
    // 洞穴蘑菇
    for (let x = 6; x < W - 6; x++)
      for (let y = 140; y < 340; y++)
        if (get(x, y) === T.AIR && G.TILES[get(x, y + 1)].solid && rng() < .012) set(x, y, T.MUSH);

    // --- 宝箱与生命水晶 ---
    function surfaceSpot(yLo, yHi, tries){
      for (let i = 0; i < tries; i++){
        const x = rng.int(10, W - 10), y = rng.int(yLo, yHi);
        if (get(x, y) === T.AIR && G.TILES[get(x, y + 1)].solid && get(x + 1, y) === T.AIR && G.TILES[get(x + 1, y + 1)].solid)
          return { x, y };
      }
      return null;
    }
    let chests = 0;
    while (chests < 48){
      const p = surfaceSpot(140, 335, 30);
      if (p && get(p.x, p.y) !== T.CHEST && get(p.x - 1, p.y) !== T.CHEST){ set(p.x, p.y, T.CHEST); chests++; }
      else if (!p) break;
    }
    let crystals = 0, guard = 0;
    while (crystals < 34 && guard++ < 4000){
      const p = surfaceSpot(150, 340, 20);
      if (p){ set(p.x, p.y, T.CRYSTAL); crystals++; }
    }

    // --- 出生点平整 ---
    const sx = W >> 1;
    let best = sx;
    for (let x = sx - 30; x < sx + 30; x++){
      if (Math.abs(surface[x + 2] - surface[x - 2]) <= 1){ best = x; break; }
    }
    const sy = surface[best];
    for (let dx = -5; dx <= 5; dx++){
      for (let dy = -5; dy <= 0; dy++) set(best + dx, sy + dy, T.AIR);
      set(best + dx, sy, T.GRASS);
      set(best + dx, sy + 1, T.DIRT);
      surface[best + dx] = sy;
    }
    wd.spawn = { x: best + .5, y: sy - 3 };
    return wd;
  };

  // 深度描述（HUD）
  G.depthLabel = function(y){
    const s = G.world && G.world.spawn ? G.world.spawn.y : 110;
    const d = Math.round((y - s) * 2);
    if (y < s - 8) return '高空 ' + Math.max(0, -d) + ' 米';
    if (Math.abs(d) <= 16) return '地表';
    if (d < 0) return '地上 ' + (-d) + ' 米';
    if (y > 348) return '地狱 ' + d + ' 米';
    return '地下 ' + d + ' 米';
  };
})();
