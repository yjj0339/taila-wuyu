// ============ 工具：随机数 / 噪声 / 数学 ============
'use strict';

// 可播种 RNG (mulberry32)
G.makeRNG = function(seed){
  let a = seed >>> 0;
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
};

G.clamp = (v, lo, hi) => v < lo ? lo : (v > hi ? hi : v);
G.lerp = (a, b, t) => a + (b - a) * t;

// 1D 值噪声（带平滑插值）
G.noise1D = function(rng, n){
  const pts = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) pts[i] = rng();
  return function(x){
    const i = Math.floor(x), t = x - i;
    const u = t * t * (3 - 2 * t);
    return G.lerp(pts[Math.max(0, Math.min(n, i))], pts[Math.max(0, Math.min(n, i + 1))], u);
  };
};

// 2D 值噪声
G.noise2D = function(rng, w, h){
  const grid = new Float32Array((w + 1) * (h + 1));
  for (let i = 0; i < grid.length; i++) grid[i] = rng();
  const at = (x, y) => grid[Math.max(0, Math.min(w, x)) * (h + 1) + Math.max(0, Math.min(h, y))];
  return function(x, y){
    const xi = Math.floor(x), yi = Math.floor(y);
    let tx = x - xi, ty = y - yi;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const a = G.lerp(at(xi, yi), at(xi + 1, yi), tx);
    const b = G.lerp(at(xi, yi + 1), at(xi + 1, yi + 1), tx);
    return G.lerp(a, b, ty);
  };
};

// 分形叠加噪声
G.fbm2D = function(n2, x, y, oct){
  let v = 0, amp = .5, f = 1;
  for (let i = 0; i < oct; i++){ v += n2(x * f, y * f) * amp; amp *= .5; f *= 2; }
  return v;
};

// AABB 相交
G.aabb = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

G.dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

// 格式化时刻（tod 0 = 日出 6:00，0.5 = 日落 18:00）
G.timeStr = function(tod){
  let h = Math.floor((6 + tod * 24) % 24), m = Math.floor(((6 + tod * 24) % 1) * 60);
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
};
