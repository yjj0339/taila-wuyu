// ============ 玩家：物理 / 挖掘 / 放置 / 战斗 ============
'use strict';
(function(){
  const T = G.T, CFG = G.CFG;

  G.makePlayer = function(){
    return {
      kind: 'player', x: G.world.spawn.x, y: G.world.spawn.y, w: 1.35, h: 2.65,
      vx: 0, vy: 0, onGround: false, dir: 1,
      hp: CFG.START_HP, maxHp: CFG.START_HP,
      dead: false, respawnT: 0,
      invulnT: 0, regenT: 0, hurtT: 0,
      useT: 0, useCd: 0, swing: 0,        // 挥舞动画 0..1
      mineX: -1, mineY: -1, mineProg: 0,  // 当前挖掘目标与进度
      fallFrom: 0, jumping: false, jumpHeld: false,
      anim: 0, forceDrop: false, lavaT: 0,
    };
  };

  G.hurtPlayer = function(dmg, fromX){
    const p = G.game.player;
    if (p.dead || p.invulnT > 0) return;
    const real = Math.max(1, Math.round(dmg * (0.85 + Math.random() * 0.3)));
    p.hp -= real;
    p.invulnT = 0.8; p.regenT = 0;
    const dir = (p.x + p.w / 2) < fromX ? -1 : 1;
    p.vx = dir * 7; p.vy = -6;
    G.dmgText(p.x + p.w / 2, p.y, real, '#ff6a5a');
    G.spawnParticles(p.x + p.w / 2, p.y + p.h / 2, '#d94a4a', 8, 5, .5);
    G.audio.play('hurt');
    if (p.hp <= 0){
      p.hp = 0; p.dead = true;
      G.spawnParticles(p.x + p.w / 2, p.y + p.h / 2, '#d94a4a', 30, 8, 1);
      G.toast('💀 你被击败了…', true);
      setTimeout(() => { if (G.game) G.showDeath(); }, 700);
    }
  };

  function updatePlayer(dt){
    const p = G.game.player, inp = G.input;
    if (p.dead) return;
    p.anim += dt;
    p.invulnT -= dt; p.hurtT -= dt; p.useCd -= dt;

    // ----- 水平移动 -----
    let mv = 0;
    if (inp.left) mv -= 1;
    if (inp.right) mv += 1;
    if (mv !== 0){
      const acc = p.onGround ? CFG.MOVE_ACC : CFG.AIR_ACC;
      p.vx += mv * acc * dt;
      p.vx = G.clamp(p.vx, -CFG.MOVE, CFG.MOVE);
      p.dir = mv;
    } else if (p.onGround){
      const f = CFG.FRICTION * dt;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    } else {
      p.vx *= (1 - 0.4 * dt);
    }

    // ----- 跳跃 -----
    const wantJump = inp.jump;
    if (wantJump && p.onGround && !p.jumpHeld){
      p.vy = -CFG.JUMP_V; p.jumping = true;
      G.audio.play('jump');
    }
    p.jumpHeld = wantJump;
    if (!wantJump && p.vy < -4) p.vy = -4; // 可变跳高
    p.forceDrop = inp.down;

    // ----- 重力与移动 -----
    p.vy = Math.min(p.vy + CFG.GRAV * dt, CFG.MAX_FALL);
    const prevVy = p.vy;
    G.physicsMove(p, dt, { stepUp: true, dropDown: p.forceDrop });

    // ----- 摔落伤害 -----
    if (!p.onGround){
      if (p.vy > 0 && p.fallFrom === 0) p.fallFrom = p.y;
      if (p.vy <= 0) p.fallFrom = 0;
    } else {
      if (p.fallFrom > 0){
        const fall = p.y - p.fallFrom;
        if (fall > 13) G.hurtPlayer(Math.round((fall - 13) * 7), p.x);
      }
      p.fallFrom = 0;
    }

    // ----- 岩浆 / 仙人掌 -----
    const hz = G.touchHazard(p);
    if (hz){
      p.lavaT -= dt;
      if (p.lavaT <= 0){ G.hurtPlayer(hz, p.x - p.dir); p.lavaT = 0.5; p.invulnT = 0.3; }
      if (p.vy < 0) p.vy *= .9; // 岩浆阻滞
    }

    // ----- 自然回血 -----
    p.regenT += dt;
    if (p.regenT > CFG.REGEN_DELAY && p.hp < p.maxHp){
      p.hp = Math.min(p.maxHp, p.hp + dt * 2.2);
    }

    // ----- 使用物品（挖掘/攻击/放置/消耗）-----
    if (inp.use && p.useCd <= 0 && G.game.paused === false && !G.ui.blockUse){
      G.useHeld(dt);
    }
    if (!inp.use){ p.mineProg = 0; p.mineX = -1; }
    if (p.swing > 0) p.swing = Math.max(0, p.swing - dt / 0.28);

    // 世界边界
    p.x = G.clamp(p.x, 3, CFG.W - 3 - p.w);
    if (p.y > CFG.H - 2) G.hurtPlayer(999, p.x);
  }

  G.updatePlayer = updatePlayer;

  // 目标格是否有相邻支撑（放置规则）
  function hasNeighbor(tx, ty){
    return G.isSolid(tx - 1, ty) || G.isSolid(tx + 1, ty) || G.isSolid(tx, ty - 1) || G.isSolid(tx, ty + 1) ||
      G.getWall(tx, ty) !== 0;
  }
  function entityOverlap(tx, ty){
    const box = { x: tx, y: ty, w: 1, h: 1 };
    if (G.aabb(box, G.game.player)) return true;
    for (const e of G.game.entities){
      if (e.kind === 'enemy' && G.aabb(box, e)) return true;
    }
    return false;
  }

  // ---------- 挖掘 ----------
  function tryMine(tx, ty, tool, dt){
    const id = G.getTile(tx, ty);
    const def = G.TILES[id];
    if (id === T.AIR || id === T.BEDROCK || id === T.LAVA) return false;
    if (def.tool === 'pick'){
      if (!tool || tool.tool !== 'pick'){ G.toast('需要镐来挖掘'); return true; }
      if (def.lvl > tool.lvl){ G.toast(def.name + ' 需要更好的镐'); return true; }
    } else if (def.tool === 'axe'){
      if (!tool || tool.tool !== 'axe'){ G.toast('需要斧头来砍伐'); return true; }
    }
    const p = G.game.player;
    if (p.mineX !== tx || p.mineY !== ty){ p.mineX = tx; p.mineY = ty; p.mineProg = 0; }
    const power = (def.tool === 'axe') ? (tool && tool.tool === 'axe' ? tool.power : 20) :
                  (def.tool === 'any' ? 60 : (tool ? tool.power : 15));
    p.mineProg += power * dt;
    p.swing = 1;
    if (Math.random() < .3){
      G.spawnParticles(tx + .5, ty + .5, def.drop === 'stone' ? '#9a9aa2' : '#a5793f', 2, 3, .3);
      G.audio.play('dig');
    }
    if (p.mineProg >= def.hp){
      // 破坏
      if (id === T.DOOR_C || id === T.DOOR_O){
        let top = ty;
        if (G.getTile(tx, ty - 1) === T.DOOR_C || G.getTile(tx, ty - 1) === T.DOOR_O) top = ty - 1;
        G.setTile(tx, top, T.AIR); G.setTile(tx, top + 1, T.AIR);
        G.spawnDrop('door', 1, tx + .5, ty + .5);
      } else if (id === T.TREE || id === T.PINE || id === T.CACTUS){
        const res = G.breakSupports(tx, ty);
        if (res && res.dropPer) G.spawnDrop(res.dropPer, res.count * 2 + 1, tx + .5, ty - 1);
        G.spawnParticles(tx + .5, ty + 1, '#7d5a30', 14, 5, .6);
      } else {
        G.setTile(tx, ty, T.AIR);
        // 悬空装饰破坏
        const above = G.getTile(tx, ty - 1);
        if (above === T.TORCH || above === T.MUSH || above === T.FLOWER || above === T.TGRASS || above === T.CRYSTAL){
          const d = G.TILES[above].drop;
          G.setTile(tx, ty - 1, T.AIR);
          if (d) G.spawnDrop(d, 1, tx + .5, ty - 1.5);
        }
        if (def.loot){ G.openChest(tx, ty); }
        else if (def.drop) G.spawnDrop(def.drop, 1, tx + .5, ty + .5);
      }
      G.spawnParticles(tx + .5, ty + .5, '#8a7a64', 8, 4, .45);
      G.audio.play('break');
      p.mineProg = 0; p.mineX = -1;
      G.onTileChanged();
    }
    return true;
  }

  G.openChest = function(tx, ty){
    const rng = Math.random;
    G.setTile(tx, ty, T.AIR);
    const table = [
      ['torch', 6, 12], ['arrow', 10, 22], ['iron_bar', 1, 3], ['silver_ore', 3, 8],
      ['gold_ore', 2, 5], ['gem', 1, 2], ['mushroom', 2, 4], ['gel', 3, 8], ['plat', 6, 14],
    ];
    const picks = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < picks; i++){
      const [item, lo, hi] = table[Math.floor(rng() * table.length)];
      G.spawnDrop(item, lo + Math.floor(rng() * (hi - lo + 1)), tx + .5, ty + .5);
    }
    if (rng() < .12) G.spawnDrop('life_crystal', 1, tx + .5, ty + .5);
    G.spawnParticles(tx + .5, ty + .5, '#e8c34c', 16, 6, .7);
    G.toast('发现宝箱战利品！');
  };

  // ---------- 放置 ----------
  function tryPlace(tx, ty, item){
    const p = G.game.player;
    if (G.getTile(tx, ty) !== T.AIR) return false;
    // 与玩家/敌人重叠检查（非固体装饰除外）
    const tId = G.ITEMS[item].tile;
    if (G.TILES[tId].solid && entityOverlap(tx, ty)) return false;
    // 依附规则
    if (!hasNeighbor(tx, ty)) return false;
    // 门需要 2 格空间
    if (tId === T.DOOR_C){
      if (G.getTile(tx, ty + 1) !== T.AIR) return false;
      if (entityOverlap(tx, ty + 1)) return false;
    }
    // 需站在地面上的装饰
    if ((tId === T.WORKBENCH || tId === T.FURNACE || tId === T.ANVIL) && !G.isSolid(tx, ty + 1)) return false;
    if ((tId === T.TORCH || tId === T.MUSH) && !(G.isSolid(tx, ty + 1) || G.getWall(tx, ty) !== 0)) return false;

    if (tId === T.DOOR_C){
      G.setTile(tx, ty, T.DOOR_C); G.setTile(tx, ty + 1, T.DOOR_C);
    } else G.setTile(tx, ty, tId);
    G.inv.consumeHeld(1);
    p.swing = 1;
    G.audio.play('place');
    G.placedOnceAdd(tId);
    G.onTileChanged();
    return true;
  }

  G.toggleDoor = function(tx, ty){
    const id = G.getTile(tx, ty);
    if (id !== T.DOOR_C && id !== T.DOOR_O) return;
    let top = ty;
    if (G.getTile(tx, ty - 1) === T.DOOR_C || G.getTile(tx, ty - 1) === T.DOOR_O) top = ty - 1;
    const bot = top + 1;
    if (id === T.DOOR_C){
      G.setTile(tx, top, T.DOOR_O); G.setTile(tx, bot, T.DOOR_O);
      G.audio.play('door');
    } else {
      // 关门前确认没有东西卡在门里
      const box = (yy) => { const b = { x: tx, y: yy, w: 1, h: 1 }; return G.aabb(b, G.game.player) ||
        G.game.entities.some(e => e.kind === 'enemy' && G.aabb(b, e)); };
      if (box(top) || box(bot)){ G.toast('门口被挡住了'); return; }
      G.setTile(tx, top, T.DOOR_C); G.setTile(tx, bot, T.DOOR_C);
      G.audio.play('door');
    }
    G.onTileChanged();
  };

  // ---------- 主使用入口 ----------
  G.useHeld = function(dt){
    const g = G.game, p = g.player;
    const slot = G.inv.held();
    const tx = G.input.aimTileX, ty = G.input.aimTileY;
    if (!slot){ return; }
    const def = G.ITEMS[slot.id];
    p.useCd = 0.16;
    if (!def){ return; }

    // 门交互优先（非工具点门 = 开关）
    if (tx >= 0 && def.type !== 'tool'){
      const tid0 = G.getTile(tx, ty);
      if (tid0 === T.DOOR_C || tid0 === T.DOOR_O){ G.toggleDoor(tx, ty); return; }
    }
    // 挖掘/放置需要目标在可及范围内
    if ((def.type === 'block' || def.type === 'tool') && !G.aimInRange()) return;

    if (def.type === 'weapon'){
      p.useCd = def.cd; p.swing = 1; p.dir = (G.input.aimWX > p.x + p.w / 2) ? 1 : -1;
      G.audio.play('swoosh');
      G.meleeSwing(def);
    }
    else if (def.type === 'bow'){
      const ammoSlot = G.inv.find('arrow');
      if (!ammoSlot){ G.toast('没有箭了！'); return; }
      p.useCd = def.cd; p.swing = 1; p.dir = (G.input.aimWX > p.x + p.w / 2) ? 1 : -1;
      G.inv.removeAt(ammoSlot.idx, 1);
      const sx = p.x + p.w / 2, sy = p.y + 1;
      const dx = G.input.aimWX - sx, dy = G.input.aimWY - sy;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const spd = 26;
      g.entities.push({ kind: 'proj', proj: 'arrow', x: sx, y: sy, w: .3, h: .3,
        vx: dx / d * spd, vy: dy / d * spd - 2, life: 3.5, dmg: def.dmg + G.ITEMS.arrow.dmg });
      G.audio.play('bow');
    }
    else if (def.type === 'block'){
      if (tx >= 0) tryPlace(tx, ty, slot.id);
    }
    else if (def.type === 'tool'){
      p.useCd = 0; // 挖掘持续进行无冷却
      if (tx >= 0) tryMine(tx, ty, def, dt || 1 / 60);
    }
    else if (def.type === 'consume'){
      p.useCd = 0.5;
      if (def.heal){
        if (p.hp >= p.maxHp){ G.toast('生命值已满'); return; }
        p.hp = Math.min(p.maxHp, p.hp + def.heal);
        G.spawnParticles(p.x + p.w / 2, p.y, '#7ae07a', 10, 4, .6, 4);
      } else if (def.maxHP){
        if (p.maxHp >= CFG.MAX_HP){ G.toast('生命水晶已达到上限（400）'); return; }
        p.maxHp += def.maxHP; p.hp += def.maxHP;
        g.crystalUsed = (g.crystalUsed || 0) + 1;
        G.toast('❤ 生命上限提升至 ' + p.maxHp + '！', true);
        G.audio.play('crystal');
      }
      G.inv.consumeHeld(1);
      G.audio.play('drink');
    }
    else if (def.type === 'summon'){
      p.useCd = 0.8;
      if (def.boss === 'eye' && g.timeTod < .52){ G.toast('可疑眼球只能在夜晚使用…'); return; }
      if (G.summonBoss(def.boss)) G.inv.consumeHeld(1);
    }
  };

  // 近战扇形判定
  G.meleeSwing = function(def){
    const g = G.game, p = g.player;
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    for (const e of g.entities){
      if (e.kind !== 'enemy' || e.dead) continue;
      const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
      const dx = ex - cx, dy = ey - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > def.range + Math.max(e.w, e.h) * .5) continue;
      const angTo = Math.atan2(dy, dx);
      const face = p.dir === 1 ? 0 : Math.PI;
      let diff = Math.abs(((angTo - face + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff > def.arc / 2 + .5) continue;
      G.hurtEnemy(e, def.dmg + (Math.random() < .1 ? Math.round(def.dmg * .5) : 0), p.dir * def.knock);
    }
    if (def.fire){ // 熔岩之刃喷火星
      G.spawnParticles(cx + p.dir * 1.5, cy, '#ff8c3c', 6, 5, .4);
    }
  };
})();
