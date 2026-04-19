export function createAudio({ buttonId, url }){
  const btn = document.getElementById(buttonId);
  let audio = new Audio(url);
  audio.loop = true;
  audio.volume = 0.45;
  const baseVolume = audio.volume;

  let duckT = 0;
  let duckFactor = 1.0;

  let unlocked = false;
  let on = false;

  function lsGet(key, def){
    try{ const v = localStorage.getItem(key); return v==null?def:JSON.parse(v); }catch(e){ return def; }
  }
  function lsSet(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
  }

  // Remember user preference (but do NOT auto-play without a gesture).
  const prefOn = !!lsGet("va_music_on", false);
  on = false;
  if (btn) btn.textContent = prefOn ? "🎵 Музыка: ON" : "🎵 Музыка: OFF";

  async function unlock(){
    if (unlocked) return true;
    try{
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      unlocked = true;
      return true;
    }catch(e){
      return false;
    }
  }

  async function setOn(nextOn){
    await unlock();
    if (nextOn){
      try{
        await audio.play();
        on = true;
        if (btn) btn.textContent = "🎵 Музыка: ON";
        lsSet("va_music_on", true);
      }catch(e){}
    } else {
      try{ audio.pause(); }catch(e){}
      on = false;
      if (btn) btn.textContent = "🎵 Музыка: OFF";
      lsSet("va_music_on", false);
    }
  }

  async function toggle(){
    await setOn(!on);
  }

  // Call this on a user gesture (click/tap) to honor saved preference.
  async function autoStart(){
    const want = !!lsGet("va_music_on", false);
    if (want && !on) await setOn(true);
  }

  btn?.addEventListener?.("click", (e)=>{ e.preventDefault(); toggle(); });

  function duckMusic(factor=0.6, dur=0.9){
    duckFactor = clamp01(factor);
    duckT = Math.max(duckT, dur);
    audio.volume = baseVolume * duckFactor;
  }

  function tick(dt){
    if (duckT > 0){
      duckT = Math.max(0, duckT - dt);
      if (duckT === 0){
        audio.volume = baseVolume;
        duckFactor = 1.0;
      }
    }
  }

  function clamp01(v){ return Math.max(0, Math.min(1, v)); }

  return { unlock, toggle, autoStart, duckMusic, tick, get on(){return on;} };
}
