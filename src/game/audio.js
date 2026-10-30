/**
 * Audio Engine: Background Music Controller + Procedural Web Audio SFX Synthesizer.
 * Provides high-quality synthesized sound effects for weapons, magic, hits, enemies,
 * and the colossal Sky Titan with zero external audio assets required.
 */
export function createAudio({ buttonId, url }) {
  const btn = document.getElementById(buttonId);
  let audio = new Audio(url);
  audio.loop = true;
  audio.volume = 0.45;
  const baseVolume = audio.volume;

  let duckT = 0;
  let duckFactor = 1.0;

  let unlocked = false;
  let on = false;

  function lsGet(key, def) {
    try { const v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  // Remember user preference (but do NOT auto-play without a gesture).
  const prefOn = !!lsGet("va_music_on", false);
  on = false;
  if (btn) btn.textContent = prefOn ? "🎵 Музыка: ON" : "🎵 Музыка: OFF";

  async function unlock() {
    if (unlocked) return true;
    try {
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      unlocked = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  async function setOn(nextOn) {
    await unlock();
    initCtx();
    if (nextOn) {
      try {
        await audio.play();
        on = true;
        if (btn) btn.textContent = "🎵 Музыка: ON";
        lsSet("va_music_on", true);
      } catch (e) {}
    } else {
      try { audio.pause(); } catch (e) {}
      on = false;
      if (btn) btn.textContent = "🎵 Музыка: OFF";
      lsSet("va_music_on", false);
    }
  }

  async function toggle() {
    await setOn(!on);
  }

  // Call this on a user gesture (click/tap) to honor saved preference.
  async function autoStart() {
    initCtx();
    const want = !!lsGet("va_music_on", false);
    if (want && !on) await setOn(true);
  }

  btn?.addEventListener?.("click", (e) => { e.preventDefault(); toggle(); });

  function duckMusic(factor = 0.6, dur = 0.9) {
    duckFactor = clamp01(factor);
    duckT = Math.max(duckT, dur);
    audio.volume = baseVolume * duckFactor;
  }

  function tick(dt) {
    if (duckT > 0) {
      duckT = Math.max(0, duckT - dt);
      if (duckT === 0) {
        audio.volume = baseVolume;
        duckFactor = 1.0;
      }
    }
  }

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  // ==========================================
  // PROCEDURAL WEB AUDIO SFX SYNTHESIZER
  // ==========================================
  let sfxCtx = null;
  let sfxMaster = null;
  let noiseBuf = null;

  function initCtx() {
    if (!sfxCtx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        sfxCtx = new AudioCtx();
        sfxMaster = sfxCtx.createGain();
        sfxMaster.gain.value = 0.60;
        sfxMaster.connect(sfxCtx.destination);
      }
    }
    if (sfxCtx && sfxCtx.state === "suspended") {
      sfxCtx.resume().catch(() => {});
    }
    return sfxCtx;
  }

  // Generate 2 seconds of white noise buffer once for filter shaping
  function getNoiseBuffer(c) {
    if (!noiseBuf) {
      const len = c.sampleRate * 2;
      noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    return noiseBuf;
  }

  if (typeof window !== "undefined") {
    const onUserInteraction = () => {
      initCtx();
      autoStart();
    };
    window.addEventListener("pointerdown", onUserInteraction, { passive: true });
    window.addEventListener("keydown", onUserInteraction, { passive: true });
  }

  // --- Weapon Swings & Swooshes ---
  function playSwing(speed = 1.0) {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    const dur = 0.16 / speed;

    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer(c);

    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 2.4;
    filter.frequency.setValueAtTime(850 * speed, t);
    filter.frequency.exponentialRampToValueAtTime(240, t + dur);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.42, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxMaster);

    src.start(t);
    src.stop(t + dur);
  }

  function playHeavySwing() {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    const dur = 0.28;

    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer(c);

    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(450, t);
    filter.frequency.exponentialRampToValueAtTime(110, t + dur);

    const sub = c.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(110, t);
    sub.frequency.exponentialRampToValueAtTime(38, t + dur);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.55, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filter);
    filter.connect(gain);
    sub.connect(gain);
    gain.connect(sfxMaster);

    src.start(t);
    sub.start(t);
    src.stop(t + dur);
    sub.stop(t + dur);
  }

  // --- Impacts & Hits ---
  function playHit() {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    const dur = 0.10;

    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + dur);

    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer(c);
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 650;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.50, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxMaster);

    osc.start(t);
    src.start(t);
    osc.stop(t + dur);
    src.stop(t + dur);
  }

  function playHeavyHit() {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    const dur = 0.22;

    const sub = c.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(110, t);
    sub.frequency.exponentialRampToValueAtTime(30, t + dur);

    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer(c);
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(140, t + dur);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.70, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    sub.connect(gain);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxMaster);

    sub.start(t);
    src.start(t);
    sub.stop(t + dur);
    src.stop(t + dur);
  }

  function playBlock() {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    const dur = 0.22;

    const o1 = c.createOscillator();
    o1.type = "sine";
    o1.frequency.setValueAtTime(1300, t);
    o1.frequency.exponentialRampToValueAtTime(800, t + dur);

    const o2 = c.createOscillator();
    o2.type = "square";
    o2.frequency.setValueAtTime(1950, t);
    o2.frequency.exponentialRampToValueAtTime(1100, t + dur);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    o1.connect(gain);
    o2.connect(gain);
    gain.connect(sfxMaster);

    o1.start(t);
    o2.start(t);
    o1.stop(t + dur);
    o2.stop(t + dur);
  }

  // --- Projectiles & Weapons ---
  function playBowRelease() {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    const dur = 0.14;

    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(460, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + dur);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.42, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain);
    gain.connect(sfxMaster);

    osc.start(t);
    osc.stop(t + dur);
  }

  function playDaggerThrow() {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    const dur = 0.10;

    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer(c);
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 3.5;
    filter.frequency.setValueAtTime(2600, t);
    filter.frequency.exponentialRampToValueAtTime(900, t + dur);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.38, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxMaster);

    src.start(t);
    src.stop(t + dur);
  }

  function playExplosion(intensity = 1.0) {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    const dur = 0.65 * Math.min(1.5, intensity);

    const sub = c.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(75, t);
    sub.frequency.exponentialRampToValueAtTime(22, t + dur);

    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer(c);
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(500 * intensity, t);
    filter.frequency.exponentialRampToValueAtTime(45, t + dur);

    const gain = c.createGain();
    gain.gain.setValueAtTime(Math.min(1.0, 0.65 * intensity), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    sub.connect(gain);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxMaster);

    sub.start(t);
    src.start(t);
    sub.stop(t + dur);
    src.stop(t + dur);
  }

  // --- Mage Spells & Energy ---
  function playMagicCast() {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    const dur = 0.22;

    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(840, t + dur * 0.7);
    osc.frequency.exponentialRampToValueAtTime(620, t + dur);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain);
    gain.connect(sfxMaster);

    osc.start(t);
    osc.stop(t + dur);
  }

  function playVoidDetonation() {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    const dur = 0.75;

    const sub = c.createOscillator();
    sub.type = "triangle";
    sub.frequency.setValueAtTime(260, t);
    sub.frequency.exponentialRampToValueAtTime(35, t + dur);

    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer(c);
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 2.0;
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(60, t + dur);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.60, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    sub.connect(gain);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxMaster);

    sub.start(t);
    src.start(t);
    sub.stop(t + dur);
    src.stop(t + dur);
  }

  let lastLaserTime = 0;
  function playLaserHum() {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    if (t - lastLaserTime < 0.09) return;
    lastLaserTime = t;
    const dur = 0.08;

    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220 + Math.random() * 40, t);

    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 650;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(sfxMaster);

    osc.start(t);
    osc.stop(t + dur);
  }

  // --- Enemies & Player Reactions ---
  function playEnemyHit() {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    const dur = 0.08;

    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140 + Math.random() * 40, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + dur);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain);
    gain.connect(sfxMaster);

    osc.start(t);
    osc.stop(t + dur);
  }

  function playEnemyDeath() {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    const dur = 0.24;

    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + dur);

    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer(c);
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 350;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.40, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxMaster);

    osc.start(t);
    src.start(t);
    osc.stop(t + dur);
    src.stop(t + dur);
  }

  function playPlayerHurt() {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    const dur = 0.18;

    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + dur);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain);
    gain.connect(sfxMaster);

    osc.start(t);
    osc.stop(t + dur);
  }

  // --- UI & Progression ---
  function playLevelUp() {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const nt = t + idx * 0.08;
      const osc = c.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, nt);

      const gain = c.createGain();
      gain.gain.setValueAtTime(0.001, nt);
      gain.gain.linearRampToValueAtTime(0.35, nt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, nt + 0.28);

      osc.connect(gain);
      gain.connect(sfxMaster);
      osc.start(nt);
      osc.stop(nt + 0.28);
    });
  }

  function playUIClick() {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.04);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(sfxMaster);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  // --- Colossal Sky Titan Sounds ---
  function playTitanRoar() {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    const dur = 2.2;

    const sub = c.createOscillator();
    sub.type = "sawtooth";
    sub.frequency.setValueAtTime(58, t);
    sub.frequency.exponentialRampToValueAtTime(32, t + dur);

    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(180, t);
    filter.frequency.linearRampToValueAtTime(340, t + 0.8);
    filter.frequency.exponentialRampToValueAtTime(90, t + dur);

    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer(c);
    const nFilter = c.createBiquadFilter();
    nFilter.type = "bandpass";
    nFilter.Q.value = 1.2;
    nFilter.frequency.setValueAtTime(140, t);
    nFilter.frequency.linearRampToValueAtTime(260, t + 0.8);
    nFilter.frequency.exponentialRampToValueAtTime(70, t + dur);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.70, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    sub.connect(filter);
    filter.connect(gain);
    src.connect(nFilter);
    nFilter.connect(gain);
    gain.connect(sfxMaster);

    sub.start(t);
    src.start(t);
    sub.stop(t + dur);
    src.stop(t + dur);
  }

  function playTitanSlam() {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    const dur = 1.6;

    const sub = c.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(85, t);
    sub.frequency.exponentialRampToValueAtTime(18, t + dur);

    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer(c);
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(50, t + dur);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.95, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    sub.connect(gain);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxMaster);

    sub.start(t);
    src.start(t);
    sub.stop(t + dur);
    src.stop(t + dur);
  }

  let lastSizzleTime = 0;
  function playFireSizzle() {
    const c = initCtx();
    if (!c) return;
    const t = c.currentTime;
    if (t - lastSizzleTime < 0.25) return;
    lastSizzleTime = t;
    const dur = 0.35;

    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer(c);
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 3.0;
    filter.frequency.setValueAtTime(1200 + Math.random() * 400, t);

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxMaster);

    src.start(t);
    src.stop(t + dur);
  }

  return {
    unlock,
    toggle,
    autoStart,
    duckMusic,
    tick,
    get on() { return on; },

    // SFX Methods
    playSwing,
    playHeavySwing,
    playHit,
    playHeavyHit,
    playBlock,
    playBowRelease,
    playDaggerThrow,
    playExplosion,
    playMagicCast,
    playVoidDetonation,
    playLaserHum,
    playEnemyHit,
    playEnemyDeath,
    playPlayerHurt,
    playLevelUp,
    playUIClick,
    playTitanRoar,
    playTitanSlam,
    playFireSizzle
  };
}
