// ============ 存档：RLE 压缩到 localStorage ============
'use strict';
(function(){
  const KEY = 'taila_save_v1';

  function rleEncode(arr){
    let out = '';
    let i = 0;
    const n = arr.length;
    while (i < n){
      const v = arr[i];
      let run = 1;
      while (i + run < n && arr[i + run] === v && run < 65535) run++;
      out += String.fromCharCode(run & 255, (run >> 8) & 255, v);
      i += run;
    }
    return out; // latin1 字符串，由 JSON 序列化转义
  }
  function rleDecode(str, len){
    const arr = new Uint8Array(len);
    let p = 0;
    for (let i = 0; i < str.length; i += 3){
      const run = str.charCodeAt(i) | (str.charCodeAt(i + 1) << 8);
      const v = str.charCodeAt(i + 2);
      arr.fill(v, p, p + run);
      p += run;
    }
    return arr;
  }

  G.hasSave = function(){
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  };

  G.saveGame = function(){
    if (!G.game || !G.world) return;
    try {
      const g = G.game, p = g.player;
      const data = {
        v: 1, seed: G.world.seed,
        tiles: rleEncode(G.world.tiles),
        walls: rleEncode(G.world.walls),
        spawn: G.world.spawn,
        player: { x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp },
        inv: G.inv.serialize(),
        sel: G.inv.sel,
        time: { tod: g.timeTod, day: g.day, dayT: g.dayT },
        flags: {
          eyeSlain: !!g.eyeSlain, survivedNight: !!g.survivedNight,
          crystalUsed: g.crystalUsed || 0,
          placedOnce: g.placedOnce ? Array.from(g.placedOnce) : [],
        },
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e){
      console.warn('保存失败', e);
      G.toast('⚠ 保存失败：' + (e.message || e));
      return false;
    }
  };

  G.loadGame = function(){
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const d = JSON.parse(raw);
      const wd = G.generateWorld(d.seed);
      wd.tiles = rleDecode(d.tiles, wd.w * wd.h);
      wd.walls = rleDecode(d.walls, wd.w * wd.h);
      wd.spawn = d.spawn;
      return d;
    } catch (e){
      console.warn('读档失败', e);
      return null;
    }
  };
})();
