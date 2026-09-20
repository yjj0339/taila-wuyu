// ============ 音效：WebAudio 合成 ============
'use strict';
(function(){
  let ac = null, master = null, enabled = true;
  let noiseBuf = null;

  function init(){
    if (ac) return true;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { return false; }
    return true;
  }

  function tone(freq, dur, type, vol, slide, delay){
    const t0 = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + .02);
  }
  function noise(dur, vol, freq, delay){
    const t0 = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 900;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0); s.stop(t0 + dur + .02);
  }

  const FX = {
    dig:     () => noise(.08, .25, 700),
    break:   () => { noise(.18, .4, 1400); tone(180, .12, 'square', .12, .6); },
    place:   () => { tone(320, .07, 'square', .18, 1.3); noise(.05, .15, 1200); },
    jump:    () => tone(260, .14, 'square', .12, 1.8),
    hurt:    () => { tone(220, .18, 'sawtooth', .25, .55); noise(.1, .2, 800); },
    hit:     () => { tone(160, .09, 'square', .2, .7); noise(.06, .2, 2000); },
    edie:    () => { tone(300, .2, 'square', .15, .4); noise(.15, .25, 900); },
    pickup:  () => tone(660, .09, 'sine', .2, 1.6),
    craft:   () => { tone(440, .1, 'square', .15, 1.2); tone(660, .12, 'square', .15, 1.2, .09); },
    drink:   () => { tone(500, .1, 'sine', .18, 1.4); tone(700, .12, 'sine', .18, 1.4, .1); },
    crystal: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, .25, 'sine', .18, 1, i * .09)); },
    door:    () => noise(.1, .2, 500),
    swoosh:  () => noise(.12, .16, 2600),
    bow:     () => { tone(700, .1, 'sawtooth', .1, .4); noise(.06, .12, 3000); },
    dash:    () => noise(.2, .18, 500),
    fire:    () => noise(.25, .2, 1600),
    roar:    () => { tone(90, .8, 'sawtooth', .4, .6); tone(120, .7, 'square', .2, .5, .05); noise(.6, .25, 300); },
    slam:    () => { tone(80, .3, 'square', .35, .5); noise(.25, .4, 400); },
    fanfare: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, .3, 'square', .16, 1, i * .12)); },
    click:   () => tone(880, .05, 'sine', .1),
  };

  G.audio = {
    play(name){
      if (!enabled || !FX[name]) return;
      if (!init()) return;
      if (ac.state === 'suspended') ac.resume();
      try { FX[name](); } catch (e) { /* 忽略音频错误 */ }
    },
    toggle(){
      enabled = !enabled;
      return enabled;
    },
    get enabled(){ return enabled; },
  };
})();
