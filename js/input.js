// ============ 输入：键盘 / 鼠标 / 触屏 ============
'use strict';
(function(){
  const inp = { left: false, right: false, jump: false, down: false, use: false,
    aimWX: 0, aimWY: 0, aimTileX: -1, aimTileY: -1 };
  G.input = inp;
  G.ui = G.ui || {};
  const TILE = G.CFG.TILE;

  const isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (isTouch) document.body.classList.add('touch');

  // ---------- 键盘 ----------
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') inp.left = true;
    else if (k === 'd' || k === 'arrowright') inp.right = true;
    else if (k === 'w' || k === 'arrowup' || k === ' ') { inp.jump = true; e.preventDefault(); }
    else if (k === 's' || k === 'arrowdown') inp.down = true;
    else if (k === 'e') G.ui.toggleInv && G.ui.toggleInv();
    else if (k === 'escape') G.ui.togglePause && G.ui.togglePause();
    else if (k >= '0' && k <= '9'){
      const idx = k === '0' ? 9 : +k - 1;
      G.inv.sel = idx;
      G.ui.dirtyHotbar = true;
    }
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft') inp.left = false;
    else if (k === 'd' || k === 'arrowright') inp.right = false;
    else if (k === 'w' || k === 'arrowup' || k === ' ') inp.jump = false;
    else if (k === 's' || k === 'arrowdown') inp.down = false;
  });

  // ---------- 鼠标 ----------
  const cv = document.getElementById('cv');
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse'){
      if (e.button === 0){ inp.use = true; updateAim(e); }
    } else {
      inp.use = true; updateAim(e);
    }
  });
  window.addEventListener('pointerup', () => { inp.use = false; });
  window.addEventListener('pointercancel', () => { inp.use = false; });
  window.addEventListener('pointermove', e => { updateAim(e); });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    G.inv.sel = (G.inv.sel + (e.deltaY > 0 ? 1 : -1) + 10) % 10;
    G.ui.dirtyHotbar = true;
  }, { passive: false });

  function updateAim(e){
    const R = G.render;
    if (!R.W) return;
    const wx = G.cam.x + (e.clientX - R.W / 2) / (R.zoom * TILE);
    const wy = G.cam.y + (e.clientY - R.H / 2) / (R.zoom * TILE);
    inp.aimWX = wx; inp.aimWY = wy;
    inp.aimTileX = Math.floor(wx);
    inp.aimTileY = Math.floor(wy);
  }

  // ---------- 触屏摇杆 ----------
  const joy = document.getElementById('joy'), knob = document.getElementById('joyKnob');
  let joyId = null;
  function joyMove(e){
    const r = joy.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > 1){ dx /= d; dy /= d; }
    knob.style.left = (50 + dx * 36) + '%';
    knob.style.top = (50 + dy * 36) + '%';
    inp.left = dx < -.3;
    inp.right = dx > .3;
    inp.jump = dy < -.42;
    inp.down = dy > .5;
  }
  joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); joyMove(e); e.stopPropagation(); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) joyMove(e); });
  const joyEnd = e => {
    if (e.pointerId !== joyId) return;
    joyId = null;
    knob.style.left = '50%'; knob.style.top = '50%';
    inp.left = inp.right = inp.jump = inp.down = false;
  };
  joy.addEventListener('pointerup', joyEnd);
  joy.addEventListener('pointercancel', joyEnd);

  const btnJump = document.getElementById('btnJump');
  btnJump.addEventListener('pointerdown', e => { inp.jump = true; e.stopPropagation(); });
  btnJump.addEventListener('pointerup', () => { inp.jump = false; });
  btnJump.addEventListener('pointercancel', () => { inp.jump = false; });
  const btnDown = document.getElementById('btnDown');
  btnDown.addEventListener('pointerdown', e => { inp.down = true; e.stopPropagation(); });
  btnDown.addEventListener('pointerup', () => { inp.down = false; });
  btnDown.addEventListener('pointercancel', () => { inp.down = false; });

  // 触屏点画布也瞄准
  if (isTouch){
    cv.addEventListener('pointerdown', e => updateAim(e), true);
    cv.addEventListener('pointermove', e => { if (e.pressure > 0 || e.pointerType === 'touch') updateAim(e); });
  }

  // ---------- 使用距离检查 ----------
  G.aimInRange = function(){
    const p = G.game.player;
    const dx = inp.aimWX - (p.x + p.w / 2), dy = inp.aimWY - (p.y + p.h / 2);
    return dx * dx + dy * dy < 6.8 * 6.8;
  };
})();
