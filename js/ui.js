// ============ UI：HUD / 背包 / 合成 / 菜单 ============
'use strict';
(function(){
  const T = G.T;
  const $ = id => document.getElementById(id);
  const ui = { dirtyInv: true, dirtyHotbar: true, blockUse: false, held: null, heldFrom: -1, objOpen: true, lastHearts: '' };
  G.ui = ui;

  // ---------- toast ----------
  let toastN = 0;
  G.toast = function(msg, big){
    const box = $('toasts');
    if (box.children.length > 3) box.removeChild(box.firstChild);
    const d = document.createElement('div');
    d.className = 'toast' + (big ? ' big' : '');
    d.textContent = msg;
    box.appendChild(d);
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 450); }, big ? 3200 : 2200);
  };

  // ---------- 心形 ----------
  function drawHeartMini(c, fill){
    const x = c.getContext('2d');
    c.width = 22; c.height = 20;
    x.clearRect(0, 0, 22, 20);
    if (fill <= 0){
      x.fillStyle = 'rgba(70,45,40,.4)';
      x.beginPath(); x.arc(11, 10, 7, 0, 7); x.fill();
      return;
    }
    G.tex.heart(x, 11, 9, 8, '#e83a4a', '#ff8a9a');
    if (fill < 1){
      x.globalCompositeOperation = 'destination-in';
      x.fillRect(0, 0, 22 * fill, 20);
    }
  }
  function renderHearts(){
    const p = G.game.player;
    const total = Math.ceil(p.maxHp / 20);
    const fillHearts = p.hp / 20;
    const key = total + '|' + Math.round(fillHearts * 4);
    if (key === ui.lastHearts) return;
    ui.lastHearts = key;
    const box = $('hearts');
    box.innerHTML = '';
    for (let i = 0; i < total; i++){
      const c = document.createElement('canvas');
      drawHeartMini(c, G.clamp(fillHearts - i, 0, 1));
      box.appendChild(c);
    }
  }

  // ---------- 槽位渲染 ----------
  function paintSlot(el, slot, idx, isHot){
    el.innerHTML = '';
    el.classList.toggle('sel', isHot && idx === G.inv.sel);
    if (slot){
      const c = document.createElement('canvas');
      c.width = 40; c.height = 40;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.drawImage(G.tex.getIcon(slot.id), 2, 2, 36, 36);
      el.appendChild(c);
      if (slot.n > 1){
        const n = document.createElement('span');
        n.className = 'cnt'; n.textContent = slot.n;
        el.appendChild(n);
      }
      el.title = G.ITEMS[slot.id].name;
    }
    if (isHot){
      const k = document.createElement('span');
      k.className = 'key'; k.textContent = (idx + 1) % 10;
      el.appendChild(k);
    }
  }

  const hotbarEl = $('hotbar');
  const hotSlots = [];
  for (let i = 0; i < 10; i++){
    const d = document.createElement('div');
    d.className = 'slot';
    d.addEventListener('pointerdown', e => { e.stopPropagation(); G.inv.sel = i; ui.dirtyHotbar = true; });
    hotbarEl.appendChild(d);
    hotSlots.push(d);
  }
  ui.renderHotbar = function(){
    for (let i = 0; i < 10; i++) paintSlot(hotSlots[i], G.inv.slots[i], i, true);
    ui.dirtyHotbar = false;
  };

  // ---------- 背包面板 ----------
  const invGrid = $('invGrid');
  const invSlots = [];
  for (let i = 0; i < 50; i++){
    const d = document.createElement('div');
    d.className = 'slot';
    d.addEventListener('pointerdown', e => { e.stopPropagation(); slotClick(i, e); });
    invGrid.appendChild(d);
    invSlots.push(d);
  }
  function slotClick(idx, e){
    const s = G.inv.slots[idx];
    if (ui.held){ // 手持 → 放下/交换/叠加
      const dst = G.inv.slots[idx];
      if (dst && dst.id === ui.held.id){
        const max = G.ITEMS[dst.id].max || 999;
        const take = Math.min(max - dst.n, ui.held.n);
        dst.n += take; ui.held.n -= take;
        if (ui.held.n <= 0) ui.clearHeld();
      } else {
        G.inv.slots[idx] = ui.held;
        ui.held = dst || null;
        if (!ui.held) ui.clearHeld();
        else ui.showHeld();
      }
    } else if (s){
      if (e.button === 2){ G.inv.splitHalf(idx); }
      else { ui.held = s; ui.heldFrom = idx; G.inv.slots[idx] = null; ui.showHeld(); }
    }
    ui.dirtyInv = ui.dirtyHotbar = true;
  }
  ui.showHeld = function(){
    const el = $('heldItem');
    el.style.display = 'block';
    const x = el.querySelector('canvas').getContext('2d');
    x.clearRect(0, 0, 40, 40);
    x.imageSmoothingEnabled = false;
    x.drawImage(G.tex.getIcon(ui.held.id), 2, 2, 36, 36);
    el.querySelector('.cnt').textContent = ui.held.n > 1 ? ui.held.n : '';
  };
  ui.clearHeld = function(){
    ui.held = null; ui.heldFrom = -1;
    $('heldItem').style.display = 'none';
  };
  window.addEventListener('pointermove', e => {
    if (ui.held){
      const el = $('heldItem');
      el.style.left = (e.clientX - 20) + 'px';
      el.style.top = (e.clientY - 20) + 'px';
    }
  });
  ui.renderInv = function(){
    for (let i = 0; i < 50; i++) paintSlot(invSlots[i], G.inv.slots[i], i, i < 10);
    // 合成
    const st = G.inv.nearStations();
    $('tagHand').classList.toggle('on', true);
    $('tagWb').classList.toggle('on', st.workbench);
    $('tagFu').classList.toggle('on', st.furnace);
    $('tagAn').classList.toggle('on', st.anvil);
    const list = $('craftList');
    list.innerHTML = '';
    for (const r of G.RECIPES){
      if (r.st !== 'hand' && !st[r.st]) continue;
      const ok = G.inv.canCraft(r, st);
      const row = document.createElement('div');
      row.className = 'recipe' + (ok ? '' : ' no');
      const out = document.createElement('div');
      out.className = 'out';
      const c = document.createElement('canvas');
      c.width = 30; c.height = 30;
      const cx2 = c.getContext('2d');
      cx2.imageSmoothingEnabled = false;
      cx2.drawImage(G.tex.getIcon(r.out), 0, 0, 30, 30);
      out.appendChild(c);
      out.appendChild(Object.assign(document.createElement('span'), { textContent: G.ITEMS[r.out].name + (r.n > 1 ? ' ×' + r.n : '') }));
      row.appendChild(out);
      const need = document.createElement('div');
      need.className = 'need';
      for (const id in r.need){
        const have = G.inv.countItem(id);
        const sp = document.createElement('span');
        sp.textContent = G.ITEMS[id].name + ' ' + have + '/' + r.need[id];
        if (have < r.need[id]) sp.className = 'lack';
        need.appendChild(sp);
      }
      row.appendChild(need);
      const btn = document.createElement('button');
      btn.className = 'btn small mk';
      btn.textContent = '制作';
      btn.disabled = !ok;
      btn.addEventListener('pointerdown', e => { e.stopPropagation(); G.inv.craft(r); ui.dirtyInv = true; });
      row.appendChild(btn);
      list.appendChild(row);
    }
    ui.dirtyInv = false;
  };

  ui.toggleInv = function(){
    const p = $('invPanel');
    const open = !p.classList.contains('open');
    p.classList.toggle('open', open);
    ui.blockUse = open;
    if (!open && ui.held){ G.inv.slots[ui.heldFrom] = ui.held; ui.clearHeld(); }
    if (open){ ui.dirtyInv = true; G.audio.play('click'); }
  };
  $('btnBag').addEventListener('pointerdown', e => { e.stopPropagation(); ui.toggleInv(); });
  $('invClose').addEventListener('pointerdown', e => { e.stopPropagation(); ui.toggleInv(); });

  // ---------- 目标 ----------
  ui.renderObjectives = function(){
    const list = $('objList');
    list.innerHTML = '';
    const s = G.game;
    for (const o of G.OBJECTIVES){
      const li = document.createElement('li');
      const done = o.check(s);
      li.textContent = (done ? '✓ ' : '· ') + o.text;
      if (done) li.className = 'done';
      else if (!ui.curMarked){ li.className = 'cur'; ui.curMarked = true; }
      list.appendChild(li);
    }
    ui.curMarked = false;
  };
  $('objToggle').addEventListener('click', () => {
    const l = $('objList');
    l.style.display = l.style.display === 'none' ? '' : 'none';
    $('objToggle').textContent = l.style.display === 'none' ? '展开' : '收起';
  });

  // ---------- HUD 周期更新 ----------
  ui.updateHUD = function(){
    if (!G.game) return;
    renderHearts();
    const p = G.game.player;
    const tod = G.game.timeTod;
    $('statLine').textContent =
      (tod < .52 ? '☀ 白天 ' : '🌙 夜晚 ') + G.timeStr(tod) + '　' + G.depthLabel(p.y) +
      (G.game.boss ? '　⚠ Boss 战斗中' : '');
    if (G.game.boss){
      $('bossBar').style.display = 'block';
      $('bossBar').querySelector('.name').textContent = G.BOSSES[G.game.boss.bossKey].name;
      $('bossBar').querySelector('.fill').style.width =
        Math.max(0, G.game.boss.hp / G.game.boss.maxHp * 100) + '%';
    } else $('bossBar').style.display = 'none';
    if (ui.dirtyHotbar) ui.renderHotbar();
    if ($('invPanel').classList.contains('open') && ui.dirtyInv) ui.renderInv();
    if (G.game.now - (ui.lastObj || 0) > 0.5){ ui.lastObj = G.game.now; ui.renderObjectives(); }
  };

  // ---------- 死亡 / 暂停 ----------
  G.showDeath = function(){
    $('deathScreen').classList.add('open');
    const tips = ['史莱姆看起来可爱，但碰一下也很痛。', '夜晚记得躲进有门和火把的庇护所。',
      '地下更深处的矿石更珍贵，但也更危险。', '火把是你的好朋友——多带一些。'];
    $('deathMsg').textContent = tips[Math.floor(Math.random() * tips.length)];
  };
  $('btnRespawn').addEventListener('click', () => {
    $('deathScreen').classList.remove('open');
    G.respawn();
  });

  ui.togglePause = function(){
    if (!G.game || G.game.over) return;
    G.game.paused = !G.game.paused;
    $('pauseMenu').classList.toggle('open', G.game.paused);
  };
  $('pauseBtn').addEventListener('pointerdown', e => { e.stopPropagation(); ui.togglePause(); });
  $('btnResume').addEventListener('click', () => ui.togglePause());
  $('btnSave').addEventListener('click', () => { G.saveGame(); G.toast('已保存'); });
  $('btnSound').addEventListener('click', e => {
    const on = G.audio.toggle();
    e.target.textContent = on ? '🔊 音效：开' : '🔇 音效：关';
  });
  $('btnHelp2').addEventListener('click', () => $('helpPanel').classList.add('open'));
  $('btnQuit').addEventListener('click', () => {
    G.saveGame();
    $('pauseMenu').classList.remove('open');
    G.game.over = true;
    $('menu').style.display = 'flex';
    $('btnContinue').style.display = G.hasSave() ? '' : 'none';
  });
  $('btnHelp').addEventListener('click', () => $('helpPanel').classList.add('open'));
  $('btnHelpClose').addEventListener('click', () => $('helpPanel').classList.remove('open'));

  // ---------- 菜单 ----------
  $('btnNew').addEventListener('click', () => G.startNewGame());
  $('btnContinue').addEventListener('click', () => G.continueGame());
})();
