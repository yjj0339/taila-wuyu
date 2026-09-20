// ============ 主循环与游戏流程 ============
'use strict';
(function(){
  const CFG = G.CFG;
  let last = 0, acc = 0, spawnT = 0, saveT = 0, hudT = 0;
  let rafId = 0;

  // ---------- 开始游戏 ----------
  G.startNewGame = function(){
    const seed = (Math.random() * 2 ** 31) | 0;
    boot(seed, null);
    G.toast('欢迎来到泰拉大陆！先去砍树吧 →', true);
    setTimeout(() => G.toast('用铜斧（选中后）点击树干砍伐'), 2600);
  };
  G.continueGame = function(){
    const d = G.loadGame();
    if (!d){ G.toast('读档失败，开始新游戏'); G.startNewGame(); return; }
    boot(d.seed, d);
    G.toast('欢迎回来！', true);
  };

  function boot(seed, saveData){
    G.generateWorld(seed);
    G.game = {
      player: G.makePlayer(),
      entities: [], particles: [], dmgTexts: [],
      boss: null, now: 0,
      timeTod: 0.06, day: 1, dayT: 0,   // 从早晨开始
      paused: false, over: false,
      eyeSlain: false, survivedNight: false, crystalUsed: 0,
      placedOnce: new Set(),
      wasNight: false,
    };
    // 目标系统通过 game state 访问背包
    G.game.countItem = id => G.inv.countItem(id);
    G.game.hasItem = id => G.inv.hasItem(id);
    G.inv.load(null);
    G.inv.giveStarter();
    G.inv.sel = 0;

    if (saveData){
      const g = G.game, p = g.player;
      p.x = saveData.player.x; p.y = saveData.player.y;
      p.hp = saveData.player.hp; p.maxHp = saveData.player.maxHp;
      G.inv.load(saveData.inv);
      G.inv.sel = saveData.sel || 0;
      g.timeTod = saveData.time.tod; g.day = saveData.time.day; g.dayT = saveData.time.dayT;
      g.eyeSlain = saveData.flags.eyeSlain;
      g.survivedNight = saveData.flags.survivedNight;
      g.crystalUsed = saveData.flags.crystalUsed;
      g.placedOnce = new Set(saveData.flags.placedOnce);
    } else if (new URLSearchParams(location.search).get('give')){
      // 测试钩子：?give=iron_pick,iron_sword,...
      for (const id of new URLSearchParams(location.search).get('give').split(',')) G.inv.add(id.trim(), 99);
    }

    // 相机就位
    G.cam.x = G.game.player.x; G.cam.y = G.game.player.y;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('pauseMenu').classList.remove('open');
    document.getElementById('deathScreen').classList.remove('open');
    G.ui.dirtyInv = G.ui.dirtyHotbar = true;
    G.ui.lastHearts = '';
    G.game.paused = false;

    if (!rafId){ last = performance.now(); rafId = requestAnimationFrame(loop); }
  }

  G.respawn = function(){
    const p = G.game.player;
    p.dead = false;
    p.hp = p.maxHp;
    p.x = G.world.spawn.x; p.y = G.world.spawn.y;
    p.vx = p.vy = 0; p.invulnT = 2; p.fallFrom = 0;
    // 清除出生点附近敌人
    for (const e of G.game.entities){
      if (e.kind === 'enemy' && !e.isBoss && Math.abs(e.x - p.x) < 30) e.dead = true;
    }
  };

  // ---------- 时间 ----------
  function updateTime(dt){
    const g = G.game;
    g.dayT += dt;
    if (g.timeTod < .52){ // 白天
      g.timeTod = g.dayT / CFG.DAY_LEN * .52;
      g.wasNight = false;
    } else { // 夜晚
      if (!g.wasNight){ g.wasNight = true; G.toast('🌙 夜幕降临…小心怪物！', true); }
      g.timeTod = .52 + (g.dayT - CFG.DAY_LEN) / CFG.NIGHT_LEN * .48;
      if (g.timeTod >= 1){
        g.timeTod = 0; g.dayT = 0; g.day++;
        if (!g.player.dead) g.survivedNight = true;
        G.toast('☀ 第 ' + g.day + ' 天开始了', true);
      }
    }
  }

  // ---------- 目标 ----------
  const objDone = new Set();
  function checkObjectives(){
    const g = G.game;
    for (const o of G.OBJECTIVES){
      if (objDone.has(o.id)) continue;
      if (o.check(g)){
        objDone.add(o.id);
        if (o.id !== 'more') G.toast('🎯 目标完成：' + o.text, true);
        G.audio.play('fanfare');
      }
    }
  }

  // ---------- 主循环 ----------
  function loop(now){
    rafId = requestAnimationFrame(loop);
    const g = G.game;
    if (!g) return;
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;

    if (!g.paused && !g.over){
      g.now += dt;
      acc += dt;
      const STEP = 1 / 60;
      let steps = 0;
      while (acc >= STEP && steps < 4){
        acc -= STEP; steps++;
        updateTime(STEP);
        G.updatePlayer(STEP);
        G.updateEntities(STEP);
      }
      // 刷怪
      spawnT -= dt;
      if (spawnT <= 0){ spawnT = 1.4; G.spawnEnemyNear(); }
      // 相机
      const p = g.player;
      G.cam.x = G.lerp(G.cam.x, p.x + p.w / 2, 1 - Math.pow(0.001, dt));
      G.cam.y = G.lerp(G.cam.y, p.y + p.h / 2 - 1, 1 - Math.pow(0.001, dt));
      G.cam.x = G.clamp(G.cam.x, 0, CFG.W);
      G.cam.y = G.clamp(G.cam.y, 0, CFG.H);
      // 光照（视口范围）
      const vw = Math.ceil(G.render.W / G.render.zoom / CFG.TILE) + 2;
      const vh = Math.ceil(G.render.H / G.render.zoom / CFG.TILE) + 2;
      G.light.update(Math.floor(G.cam.x - vw / 2), Math.floor(G.cam.y - vh / 2), vw, vh);
      // 自动保存
      saveT += dt;
      if (saveT > CFG.AUTOSAVE){ saveT = 0; G.saveGame(); }
      checkObjectives();
    }

    G.render.draw();
    hudT += dt;
    if (hudT > 0.12){ hudT = 0; G.ui.updateHUD(); }
  }

  // ---------- 启动 ----------
  window.addEventListener('load', () => {
    G.render.resize();
    try { G.drawMenuGround(); } catch (e) { /* 菜单装饰失败不阻塞 */ }
    if (G.hasSave()) document.getElementById('btnContinue').style.display = '';
    // 测试钩子
    const q = new URLSearchParams(location.search);
    if (q.get('time') === 'night'){ /* boot 后生效，见下 */ }
    if (q.get('__test') !== null){
      G.startNewGame();
      if (q.get('time') === 'night'){ G.game.timeTod = .6; G.game.dayT = CFG.DAY_LEN; }
      if (q.get('give')) for (const id of q.get('give').split(',')) G.inv.add(id.trim(), 99);
      if (q.get('pos')){
        const [x, y] = q.get('pos').split(',').map(Number);
        G.game.player.x = x; G.game.player.y = y;
      }
      G.toast('__test 模式');
    }
    window.__hook = { get G(){ return G; }, get game(){ return G.game; } };
    // 首次交互解锁音频
    const unlock = () => { G.audio.play('click'); window.removeEventListener('pointerdown', unlock); };
    window.addEventListener('pointerdown', unlock);
  });

  // 离开页面自动保存
  window.addEventListener('beforeunload', () => { if (G.game && !G.game.over) G.saveGame(); });
})();
