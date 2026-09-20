// ============ 实体：物理 / 掉落物 / 敌人 / Boss / 弹幕 / 粒子 ============
'use strict';
(function(){
  const T = G.T, CFG = G.CFG;

  // ---------- 共享 tile 碰撞（单位: tile） ----------
  const solidT = (tx, ty) => G.TILES[G.getTile(tx, ty)].solid;
  G.physicsMove = function(e, dt, opt){
    opt = opt || {};
    const eps = 0.001;
    e.wasOnGround = e.onGround;
    // ---- X 轴 ----
    if (e.vx !== 0){
      let nx = e.x + e.vx * dt;
      const y0 = Math.floor(e.y + eps), y1 = Math.floor(e.y + e.h - eps);
      if (e.vx > 0){
        const tx = Math.floor(nx + e.w - eps);
        for (let ty = y0; ty <= y1; ty++){
          if (solidT(tx, ty)){
            if (opt.stepUp && (e.onGround || e.wasOnGround) && !solidT(tx, ty - 1) && !solidT(Math.floor(e.x + e.w - eps), ty - 1)
                && !solidT(Math.floor(e.x + eps), ty - 1)){
              e.y -= 1; e.x = nx;
            } else { nx = tx - e.w - eps; e.vx = 0; e.hitWall = true; }
            break;
          }
        }
      } else {
        const tx = Math.floor(nx + eps);
        for (let ty = y0; ty <= y1; ty++){
          if (solidT(tx, ty)){
            if (opt.stepUp && (e.onGround || e.wasOnGround) && !solidT(tx, ty - 1) && !solidT(Math.floor(e.x + eps), ty - 1)
                && !solidT(Math.floor(e.x + e.w - eps), ty - 1)){
              e.y -= 1; e.x = nx;
            } else { nx = tx + 1 + eps; e.vx = 0; e.hitWall = true; }
            break;
          }
        }
      }
      e.x = nx;
    }
    // ---- Y 轴 ----
    e.onGround = false;
    let ny = e.y + e.vy * dt;
    const x0 = Math.floor(e.x + eps), x1 = Math.floor(e.x + e.w - eps);
    if (e.vy > 0){
      const ty = Math.floor(ny + e.h - eps);
      for (let tx = x0; tx <= x1; tx++){
        const id = G.getTile(tx, ty);
        const isPlat = G.TILES[id].plat;
        const feet = e.y + e.h;
        if (solidT(tx, ty) || (isPlat && feet <= ty + 0.05 && !opt.dropDown && !e.forceDrop)){
          ny = ty - e.h - eps; e.vy = 0; e.onGround = true; break;
        }
      }
    } else if (e.vy < 0){
      const ty = Math.floor(ny + eps);
      for (let tx = x0; tx <= x1; tx++){
        if (solidT(tx, ty)){ ny = ty + 1 + eps; e.vy = 0; break; }
      }
    }
    e.y = ny;
  };

  // 检查实体是否接触伤害 tile（岩浆/仙人掌）
  G.touchHazard = function(e){
    const x0 = Math.floor(e.x + .05), x1 = Math.floor(e.x + e.w - .05);
    const y0 = Math.floor(e.y + .05), y1 = Math.floor(e.y + e.h - .05);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++){
      const dmg = G.TILES[G.getTile(tx, ty)].dmg;
      if (dmg) return dmg;
    }
    return 0;
  };

  // ---------- 粒子 ----------
  G.spawnParticles = function(x, y, col, n, spd, life, grav){
    const P = G.game.particles;
    for (let i = 0; i < n; i++){
      if (P.length > 600) P.shift();
      const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random() * 0.7) * (spd || 4);
      P.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2,
        life: (life || 0.5) * (0.6 + Math.random() * 0.8), maxLife: life || 0.5,
        col, size: 1.5 + Math.random() * 2, grav: grav === undefined ? 18 : grav });
    }
  };
  G.dmgText = function(x, y, txt, col){
    G.game.dmgTexts.push({ x, y, txt, col: col || '#fff', life: 0.9 });
    if (G.game.dmgTexts.length > 40) G.game.dmgTexts.shift();
  };

  // ---------- 掉落物 ----------
  G.spawnDrop = function(itemId, n, x, y, vx, vy){
    G.game.entities.push({ kind: 'drop', item: itemId, n, x: x - .3, y: y - .3, w: .6, h: .6,
      vx: vx === undefined ? (Math.random() - .5) * 3 : vx, vy: vy === undefined ? -4 - Math.random() * 2 : vy,
      life: 300, bob: Math.random() * 7 });
  };
  function updateDrop(e, dt){
    e.life -= dt;
    if (e.life <= 0){ e.dead = true; return; }
    e.vy = Math.min(e.vy + CFG.GRAV * .6 * dt, CFG.MAX_FALL * .5);
    e.vx *= (e.onGround ? .86 : .99);
    G.physicsMove(e, dt, {});
    const p = G.game.player;
    const dx = (p.x + p.w / 2) - (e.x + e.w / 2), dy = (p.y + p.h / 2) - (e.y + e.h / 2);
    const d2 = dx * dx + dy * dy;
    if (d2 < 12.25){ // 磁吸 3.5t
      const d = Math.sqrt(d2) || 1;
      e.vx += dx / d * 40 * dt; e.vy += dy / d * 40 * dt;
    }
    if (d2 < 1.2 && !p.dead){
      const def = G.ITEMS[e.item];
      if (def && def.type === 'heal_drop'){
        if (p.hp < p.maxHp){
          p.hp = Math.min(p.maxHp, p.hp + def.heal);
          e.dead = true;
          G.dmgText(p.x + p.w / 2, p.y, '+' + def.heal, '#7ae07a');
          G.audio.play('drink');
        }
        return;
      }
      const left = G.inv.add(e.item, e.n);
      if (left === 0){ e.dead = true; G.audio.play('pickup'); }
      else e.n = left;
    }
  }

  // ---------- 敌人生成 ----------
  G.spawnDropLoot = function(table, x, y){
    for (const [item, lo, hi, chance] of table){
      if (Math.random() > chance) continue;
      const n = lo + Math.floor(Math.random() * (hi - lo + 1));
      if (n > 0) G.spawnDrop(item, n, x, y);
    }
  };

  function makeEnemy(key, x, y){
    const def = G.ENEMIES[key];
    return { kind: 'enemy', key, def, hp: def.hp, maxHp: def.hp,
      x: x - def.w / 2, y: y - def.h / 2, w: def.w, h: def.h,
      vx: 0, vy: 0, onGround: false, dir: 1, hitCd: 0, jumpCd: Math.random() * 2,
      state: 0, st: 0, anim: Math.random() * 10, hurtT: 0, dead: false };
  }

  G.spawnEnemyNear = function(){
    const g = G.game, p = g.player;
    const surfaceY = G.world.spawn.y;
    const inCave = p.y > surfaceY + 18;
    const inHell = p.y > 348;
    let cap, pool;
    if (inHell){ cap = 4; pool = ['fire_imp', 'fire_imp', 'cave_bat']; }
    else if (inCave){ cap = 7; pool = g.timeTod < .52 || p.y > 210 ? ['cave_bat', 'cave_bat', 'skeleton'] : ['cave_bat', 'skeleton']; }
    else if (g.timeTod >= .52){ cap = 9; pool = ['zombie', 'zombie', 'zombie', 'demon_eye', 'demon_eye']; }
    else { cap = 5; pool = ['green_slime', 'green_slime', 'blue_slime']; }
    const enemies = g.entities.filter(e => e.kind === 'enemy' && !e.isBoss);
    if (enemies.length >= cap) return;

    for (let attempt = 0; attempt < 12; attempt++){
      const ang = Math.random() * Math.PI * 2;
      const dist = 24 + Math.random() * 20;
      const x = p.x + Math.cos(ang) * dist;
      const y = p.y + Math.sin(ang) * dist * 0.6;
      if (x < 8 || x > CFG.W - 8 || y < 4 || y > CFG.H - 6) continue;
      const key = pool[Math.floor(Math.random() * pool.length)];
      const def = G.ENEMIES[key];
      const tx = Math.floor(x), ty = Math.floor(y);
      if (G.getTile(tx, ty) !== T.AIR || G.getTile(tx, ty - 1) !== T.AIR) continue;
      if (def.fly){ if (G.getTile(tx, ty + 1) !== T.AIR) continue; }
      else {
        // 地面怪需要脚下 1~3 格内有地面
        let ground = false;
        for (let d = 0; d <= 3; d++) if (solidT(tx, ty + 1 + d)){ ground = true; break; }
        if (!ground) continue;
      }
      if (G.light.at(tx, ty) === 0 && inCave) continue; // 全黑处不刷
      g.entities.push(makeEnemy(key, tx + .5, ty + .5));
      return;
    }
  };

  // ---------- 敌人 AI ----------
  function aimAt(e, tx, ty, speed){
    const dx = tx - (e.x + e.w / 2), dy = ty - (e.y + e.h / 2);
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    e.vx = dx / d * speed; e.vy = dy / d * speed;
  }

  function updateEnemy(e, dt){
    const g = G.game, p = g.player;
    const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
    const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
    e.anim += dt; e.hitCd -= dt; e.hurtT -= dt;
    const ai = e.def.ai;

    if (ai === 'hop'){
      e.vx *= .8;
      if (e.onGround){
        e.vx = 0;
        e.jumpCd -= dt;
        if (e.jumpCd <= 0 && Math.abs(pcx - ecx) < 26){
          e.dir = pcx > ecx ? 1 : -1;
          e.vx = e.dir * (2.5 + Math.random() * 1.5);
          e.vy = -7 - Math.random() * 2.5;
          e.jumpCd = 1 + Math.random() * 1.2;
        }
      }
      e.vy = Math.min(e.vy + CFG.GRAV * dt, CFG.MAX_FALL);
      G.physicsMove(e, dt, { stepUp: false });
    }
    else if (ai === 'walk'){
      e.dir = pcx > ecx ? 1 : -1;
      e.vx = e.dir * e.def.speed;
      e.vy = Math.min(e.vy + CFG.GRAV * dt, CFG.MAX_FALL);
      G.physicsMove(e, dt, { stepUp: true });
      // 前方被挡则跳
      if (e.hitWall && e.onGround){ e.vy = -9.5; e.hitWall = false; }
      // 脚下悬空减速防集体跳崖（保留自然坠落）
    }
    else if (ai === 'fly'){
      e.st += dt;
      const bob = Math.sin(e.st * 3) * 1.5;
      aimAt(e, pcx, pcy + bob, e.def.speed);
      G.physicsMove(e, dt, {});
      if (e.hitWall){ e.vx *= -1; e.hitWall = false; }
    }
    else if (ai === 'eye'){
      e.st += dt;
      if (e.state === 0){ // 盘旋接近
        aimAt(e, pcx + Math.sin(e.anim * 2) * 4, pcy - 6 + Math.cos(e.anim * 1.7) * 2, e.def.speed * .7);
        if (e.st > 2.2){ e.state = 1; e.st = 0; aimAt(e, pcx, pcy, e.def.speed * 2.4); G.audio.play('dash'); }
      } else { // 冲刺
        e.vx *= (1 - 1.4 * dt); e.vy *= (1 - 1.4 * dt);
        if (e.st > 1.1){ e.state = 0; e.st = 0; }
      }
      G.physicsMove(e, dt, {});
      if (e.hitWall){ e.state = 0; e.st = 0; e.hitWall = false; }
    }
    else if (ai === 'imp'){
      e.st += dt;
      const wantD = 9;
      const dx = pcx - ecx, dy = pcy - ecy;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const dir = d > wantD + 3 ? 1 : (d < wantD - 3 ? -1 : 0);
      e.vx = dx / d * e.def.speed * dir;
      e.vy = G.lerp(e.vy, dy / d * 3 + Math.sin(e.anim * 2.5) * 2, dt * 2);
      G.physicsMove(e, dt, {});
      if (e.hitWall) e.hitWall = false;
      if (e.st > 2.4 && d < 22){ // 发射火球
        e.st = 0;
        const dd = Math.sqrt(dx * dx + dy * dy) || 1;
        g.entities.push({ kind: 'proj', proj: 'fireball', x: ecx, y: ecy, w: .5, h: .5,
          vx: dx / dd * 13, vy: dy / dd * 13, life: 3, dmg: e.def.dmg });
        G.audio.play('fire');
      }
    }
    else if (ai === 'bossEye') updateBossEye(e, dt, pcx, pcy);
    else if (ai === 'bossKing') updateBossKing(e, dt, pcx, pcy);

    // 接触伤害
    if (e.hitCd <= 0 && !p.dead && G.aabb(e, p)){
      G.hurtPlayer(e.def.dmg, ecx);
      e.hitCd = 0.8;
    }
    // 危险 tile（小怪踩岩浆）
    const hz = G.touchHazard(e);
    if (hz && e.kind === 'enemy' && !e.isBoss){ G.hurtEnemy(e, hz * dt, 0, true); }
  }

  function updateBossEye(e, dt, pcx, pcy){
    const g = G.game, p = g.player;
    e.st += dt;
    const phase2 = e.hp < e.maxHp * .5;
    if (phase2 && e.state !== 9){ e.state = 9; e.st = 0; G.audio.play('roar'); G.toast('克苏鲁之眼狂暴了！', true); }
    if (e.state === 9){ // 二阶段：连续冲刺
      if (e.st > (e.dashN || 0) * .95){
        e.dashN = (e.dashN || 0) + 1;
        aimAt(e, pcx, pcy, 19);
        G.audio.play('dash');
        e.st = 0;
        if (e.dashN > 4){ e.dashN = 1; }
      }
      e.vx *= (1 - .8 * dt); e.vy *= (1 - .8 * dt);
    } else if (e.state === 0){ // 绕圈
      const ang = e.anim * 1.2;
      const tx = pcx + Math.cos(ang) * 12, ty = pcy - 7 + Math.sin(ang) * 5;
      aimAt(e, tx, ty, 13);
      if (e.st > 2.8){ e.state = 1; e.st = 0; e.dashes = 0; }
    } else { // 三连冲
      if (e.st > .75){
        e.st = 0; e.dashes = (e.dashes || 0) + 1;
        if (e.dashes > 3){ e.state = 0; e.st = 0; }
        else { aimAt(e, pcx, pcy, phase2 ? 21 : 17); G.audio.play('dash'); }
      }
      e.vx *= (1 - .7 * dt); e.vy *= (1 - .7 * dt);
    }
    G.physicsMove(e, dt, {});
    if (e.hitWall) e.hitWall = false;
    if (!p.dead && G.aabb(e, p) && e.hitCd <= 0){
      G.hurtPlayer(phase2 ? G.BOSSES.eye.dmg2 : G.BOSSES.eye.dmg, e.x + e.w / 2);
      e.hitCd = .7;
    }
  }

  function updateBossKing(e, dt, pcx, pcy){
    if (e.onGround){
      e.vx = 0;
      e.jumpCd -= dt;
      if (e.jumpCd <= 0){
        e.dir = pcx > e.x ? 1 : -1;
        const rage = 1 - e.hp / e.maxHp;
        e.vx = e.dir * (5 + rage * 5);
        e.vy = -(11 + rage * 5);
        e.jumpCd = Math.max(.7, 2 - rage);
        // 落地召唤由落地检测触发
        e.spawnOnLand = true;
      }
    }
    e.vy = Math.min(e.vy + CFG.GRAV * dt, CFG.MAX_FALL);
    const wasAir = !e.onGround;
    G.physicsMove(e, dt, { stepUp: true });
    if (e.onGround && wasAir && e.spawnOnLand){
      e.spawnOnLand = false;
      G.audio.play('slam');
      G.spawnParticles(e.x + e.w / 2, e.y + e.h, '#4aa8e8', 18, 7, .6);
      for (let i = 0; i < 2; i++){
        const s = makeEnemy(Math.random() < .5 ? 'green_slime' : 'blue_slime',
          e.x + e.w / 2 + (i ? 3 : -3), e.y + 1);
        G.game.entities.push(s);
      }
    }
    const p = G.game.player;
    if (!p.dead && G.aabb(e, p) && e.hitCd <= 0){
      G.hurtPlayer(G.BOSSES.king.dmg, e.x + e.w / 2);
      e.hitCd = .8;
    }
  }

  G.hurtEnemy = function(e, dmg, kx, silent){
    if (e.hurtT > 0) return;
    e.hurtT = 0.12;
    const def = e.def || {};
    const defv = def.def || 0;
    const real = Math.max(1, Math.round(dmg - defv * .5));
    e.hp -= real;
    if (!silent){
      e.vx += kx; e.vy -= 2.5;
      G.dmgText(e.x + e.w / 2, e.y, real, '#ffd24a');
      G.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, e.isBoss ? '#d94a4a' : (def.color || '#a44'), 6, 5, .4);
      G.audio.play('hit');
    } else {
      if (Math.random() < .1) G.spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#ff7a3c', 3, 3, .4);
    }
    if (e.hp <= 0 && !e.dead){
      e.dead = true;
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      G.spawnParticles(cx, cy, e.isBoss ? '#ff6a4a' : (def.color || '#a55'), e.isBoss ? 60 : 16, e.isBoss ? 10 : 6, .8);
      if (e.isBoss){
        G.spawnDropLoot(G.BOSSES[e.bossKey].drops, cx, cy);
        if (e.bossKey === 'eye') G.game.eyeSlain = true;
        G.game.boss = null;
        G.toast('🎉 击败了 ' + G.BOSSES[e.bossKey].name + '！', true);
        G.audio.play('fanfare');
      } else {
        G.spawnDropLoot(def.drops || [], cx, cy);
        G.audio.play('edie');
      }
    }
  };

  function updateProj(e, dt){
    const g = G.game;
    e.life -= dt;
    if (e.life <= 0){ e.dead = true; return; }
    if (e.proj === 'arrow'){
      e.vy += CFG.GRAV * .55 * dt;
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.ang = Math.atan2(e.vy, e.vx);
      const tx = Math.floor(e.x), ty = Math.floor(e.y);
      if (G.TILES[G.getTile(tx, ty)].solid){ e.dead = true; G.spawnParticles(e.x, e.y, '#b0925a', 3, 3, .3); return; }
      for (const en of g.entities){
        if (en.kind !== 'enemy' || en.dead) continue;
        if (e.x > en.x && e.x < en.x + en.w && e.y > en.y && e.y < en.y + en.h){
          G.hurtEnemy(en, e.dmg, e.vx * .12);
          e.dead = true; break;
        }
      }
    } else if (e.proj === 'fireball'){
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (Math.random() < .5) G.spawnParticles(e.x, e.y, '#ff8c3c', 1, 1.5, .25, 0);
      if (G.TILES[G.getTile(Math.floor(e.x), Math.floor(e.y))].solid){
        e.dead = true; G.spawnParticles(e.x, e.y, '#ff8c3c', 8, 4, .4);
        return;
      }
      const p = g.player;
      if (!p.dead && e.x > p.x && e.x < p.x + p.w && e.y > p.y && e.y < p.y + p.h){
        G.hurtPlayer(e.dmg, e.x);
        e.dead = true;
      }
    }
  }

  function updateEntities(dt){
    const g = G.game, p = g.player;
    for (const e of g.entities){
      if (e.kind === 'drop') updateDrop(e, dt);
      else if (e.kind === 'enemy') updateEnemy(e, dt);
      else if (e.kind === 'proj') updateProj(e, dt);
      // 远处清理
      if ((e.kind === 'enemy' && !e.isBoss && Math.abs(e.x - p.x) > 90) || Math.abs(e.x - p.x) > 200 || e.y > CFG.H + 10){
        e.dead = true;
      }
    }
    g.entities = g.entities.filter(e => !e.dead);
    // 粒子
    for (const pt of g.particles){
      pt.life -= dt;
      pt.vy += pt.grav * dt;
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    }
    g.particles = g.particles.filter(pt => pt.life > 0);
    for (const d of g.dmgTexts){ d.life -= dt; d.y -= dt * 2.2; }
    g.dmgTexts = g.dmgTexts.filter(d => d.life > 0);
  }
  G.updateEntities = updateEntities;

  // ---------- Boss 召唤 ----------
  G.summonBoss = function(key){
    const g = G.game, p = g.player;
    if (g.boss){ G.toast('已经有 Boss 在战斗中了！'); return false; }
    const def = G.BOSSES[key];
    const b = { kind: 'enemy', key: def.name, def, bossKey: key, isBoss: true,
      hp: def.hp, maxHp: def.hp, w: def.w, h: def.h,
      x: p.x + (Math.random() < .5 ? -14 : 14), y: p.y - 12,
      vx: 0, vy: 0, onGround: false, dir: 1, hitCd: 1, st: 0, state: 0, anim: 0, hurtT: 0, dead: false };
    g.entities.push(b);
    g.boss = b;
    G.toast('⚠ ' + def.name + ' 出现了！', true);
    G.audio.play('roar');
    return true;
  };
})();
