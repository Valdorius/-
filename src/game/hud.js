export function createHUD(){
  const hpFill = document.getElementById("hpFill");
  const xpFill = document.getElementById("xpFill");
  const lvEl = document.getElementById("lv");
  const waveEl = document.getElementById("wave");
  const killsEl = document.getElementById("kills");
  const weaponNameEl = document.getElementById("weaponName");
  const hintEl = document.getElementById("hint");



  
  // Persistent best score (localStorage)
  function lsGet(key, def=null){
    try{ const v = localStorage.getItem(key); return v==null?def:JSON.parse(v); }catch(e){ return def; }
  }
  function lsSet(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
  }

// Pause overlay
  const pauseEl = document.createElement('div');
  pauseEl.id = 'pauseOverlay';
  pauseEl.style.cssText = [
    'position:fixed','inset:0','display:none',
    'align-items:center','justify-content:center',
    'background:rgba(0,0,0,0.55)',
    'backdrop-filter: blur(4px)',
    'z-index:9998','font-family:system-ui,Segoe UI,Arial'
  ].join(';');

  const pauseCard = document.createElement('div');
  pauseCard.style.cssText = [
    'min-width:320px','max-width:560px',
    'padding:18px 18px 14px 18px',
    'border-radius:16px',
    'background:rgba(20,24,34,0.95)',
    'border:1px solid rgba(255,255,255,0.12)',
    'box-shadow:0 18px 60px rgba(0,0,0,0.55)',
    'color:#fff','text-align:center'
  ].join(';');

  const pauseTitle = document.createElement('div');
  pauseTitle.textContent = 'Пауза';
  pauseTitle.style.cssText = 'font-size:26px;font-weight:800;margin-bottom:10px;';

  const pauseHint = document.createElement('div');
  pauseHint.textContent = 'Нажми P или кликни/тапни, чтобы продолжить';
  pauseHint.style.cssText = 'font-size:13px;opacity:0.8;margin-bottom:12px;';

  pauseCard.append(pauseTitle, pauseHint);
  pauseEl.appendChild(pauseCard);
  document.body.appendChild(pauseEl);

  function showPause(){ pauseEl.style.display='flex'; }
  function hidePause(){ pauseEl.style.display='none'; }

  // Death overlay (simple, reliable)
  const deathEl = document.createElement('div');
  deathEl.id = 'deathOverlay';
  deathEl.style.cssText = [
    'position:fixed', 'inset:0', 'display:none',
    'align-items:center', 'justify-content:center',
    'background:rgba(0,0,0,0.72)',
    'backdrop-filter: blur(6px)',
    'z-index:9999', 'font-family:system-ui,Segoe UI,Arial'
  ].join(';');

  const deathCard = document.createElement('div');
  deathCard.style.cssText = [
    'min-width: 320px',
    'max-width: 560px',
    'padding: 18px 18px 14px 18px',
    'border-radius: 16px',
    'background: rgba(20,24,34,0.95)',
    'border: 1px solid rgba(255,255,255,0.12)',
    'box-shadow: 0 18px 60px rgba(0,0,0,0.55)'
  ].join(';');

  const deathTitle = document.createElement('div');
  deathTitle.textContent = 'Ты погиб';
  deathTitle.style.cssText = 'font-size:28px;font-weight:800;margin-bottom:6px;color:#fff;letter-spacing:0.5px;';

  const deathSub = document.createElement('div');
  deathSub.textContent = '';
  deathSub.style.cssText = 'font-size:14px;opacity:0.9;margin-bottom:14px;color:#d7d9df;';

  const deathHint = document.createElement('div');
  deathHint.textContent = 'Нажми Enter или кнопку ниже, чтобы начать заново.';
  deathHint.style.cssText = 'font-size:12px;opacity:0.75;margin-bottom:14px;color:#c9ccd6;';

  const deathBtn = document.createElement('button');
  deathBtn.textContent = 'Начать заново';
  deathBtn.style.cssText = [
    'width:100%',
    'padding: 12px 14px',
    'border-radius: 12px',
    'border: 1px solid rgba(255,255,255,0.18)',
    'background: rgba(255,255,255,0.08)',
    'color:#fff',
    'font-size: 16px',
    'font-weight:700',
    'cursor:pointer'
  ].join(';');

  const deathSmall = document.createElement('div');
  deathSmall.textContent = 'Подсказка: для следующего забега попробуй быстрее снимать призывателей/ауры.';
  deathSmall.style.cssText = 'font-size:12px;opacity:0.65;margin-top:12px;color:#c9ccd6;';

  deathCard.append(deathTitle, deathSub, deathHint, deathBtn, deathSmall);
  deathEl.appendChild(deathCard);
  document.body.appendChild(deathEl);

  let deathActive = false;
  let deathOnRestart = null;

  function showDeath(stats, onRestart){
    deathActive = true;
    deathOnRestart = onRestart || null;
    const wave = stats?.wave ?? '?';
    const kills = stats?.kills ?? '?';
    const lvl = stats?.level ?? '?';

    // best score
    const best = lsGet("va_best", { wave:0, kills:0, level:0 });
    const wNum = Number(wave); const kNum = Number(kills); const lNum = Number(lvl);
    let improved = false;
    if (!Number.isNaN(wNum) && (wNum > (best.wave||0))) { best.wave = wNum; improved = true; }
    if (!Number.isNaN(kNum) && (kNum > (best.kills||0))) { best.kills = kNum; improved = true; }
    if (!Number.isNaN(lNum) && (lNum > (best.level||0))) { best.level = lNum; improved = true; }
    if (improved) lsSet("va_best", best);

    const bestTxt = (best.wave||best.kills) ? ` · Лучшее: волна ${best.wave||0}, убийств ${best.kills||0}` : "";
    deathSub.textContent = `Волна ${wave} · Убийств ${kills} · Уровень ${lvl}${bestTxt}`;
    deathEl.style.display = 'flex';
    hintEl.style.display = 'none';
  }

  function hideDeath(){
    deathActive = false;
    deathOnRestart = null;
    deathEl.style.display = 'none';
  }

  function doRestart(){
    try{ deathOnRestart && deathOnRestart(); }catch(e){}
  }

  deathBtn.addEventListener('click', (e)=>{ e.preventDefault(); doRestart(); });

  window.addEventListener('keydown', (e)=>{
    if (!deathActive) return;
    if (e.key === 'Enter'){
      e.preventDefault();
      doRestart();
    }
  }, { capture: true });

  const audioHudEl = document.getElementById("audiohud");

  const modalEl = document.getElementById("modal");
  const modalTitleEl = document.getElementById("modalTitle");
  const modalSubEl = document.getElementById("modalSub");
  const modalCardsEl = document.getElementById("modalCards");
  const modalHintEl = document.getElementById("modalHint");

  /** @type {{el:HTMLElement, t:number, ttl:number}[]} */
  const pings = [];

  let modalOpen = false;
  let modalOnPick = null;
  let modalSelected = 0;
  /** @type {HTMLElement[]} */
  let modalCardEls = [];
  let modalOptions = [];

  function setBars({ hp, hpMax, xp, xpNext, level, wave, kills }){
    hpFill.style.width = (hpMax<=0?0: (100*hp/hpMax)).toFixed(2)+"%";
    xpFill.style.width = (xpNext<=0?0: (100*xp/xpNext)).toFixed(2)+"%";
    lvEl.textContent = String(level);
    waveEl.textContent = String(wave);
    killsEl.textContent = String(kills);
  }

  function setWeaponName(name){ weaponNameEl.textContent = name; }
  function setHintVisible(v){ hintEl.style.display = v ? "block":"none"; }

  function onResize(){}

  // angleRad: relative to player view (0 = forward, + right)
  function addPing(angleRad, strength=1, kind="ranged"){
    if (!audioHudEl) return;

    const el = document.createElement("div");
    el.className = "ping " + (kind||"ranged") + (strength>1.1 ? " big" : "");
    audioHudEl.appendChild(el);

    const ttl = 0.9 + Math.min(0.8, strength*0.35);
    const item = { el, t:0, ttl, angle: angleRad };
    pings.push(item);
    // initial place
    placePing(item);
  }

  function placePing(p){
    const w = window.innerWidth || 1;
    // map angle (-pi..pi) -> screen x (0..w)
    let a = p.angle;
    while (a > Math.PI) a -= Math.PI*2;
    while (a < -Math.PI) a += Math.PI*2;
    const nx = (a / Math.PI); // -1..1
    const x = (w*0.5) + nx*(w*0.40); // keep near center
    p.el.style.left = Math.max(10, Math.min(w-10, x)) + "px";
  }

  let bossMsgT = 0;
  let bossMsg = "";
  function flashBossPhase(phase){
    bossMsgT = 2.0;
    bossMsg = (phase===2) ? "БОСС: ФАЗА 2 — КОНТРОЛЬ" : (phase===3 ? "БОСС: ФАЗА 3 — ЯДРО" : "БОСС: ФАЗА 1");
  }



  function tick(dt){
    if (bossMsgT > 0){
      bossMsgT = Math.max(0, bossMsgT - dt);
      hintEl.textContent = bossMsg;
      hintEl.style.display = 'block';
      hintEl.style.opacity = String(0.35 + 0.65*Math.min(1, bossMsgT/2.0));
      if (bossMsgT <= 0){ hintEl.style.opacity = ''; }
    }

    if (pings.length){
      for (let i=pings.length-1;i>=0;i--){
        const p = pings[i];
        p.t += dt;
        placePing(p);
        const a = Math.max(0, Math.min(1, 1 - p.t/p.ttl));
        p.el.style.opacity = String(a);
        p.el.style.transform = "translate(-50%,-50%) scale("+(0.8+0.6*a)+")";
        if (p.t >= p.ttl){
          p.el.remove();
          pings.splice(i,1);
        }
      }
    }
  }

  function openChoice({ title, subtitle="", hint="", options=[], onPick }){
    if (!modalEl) return;
    modalTitleEl.textContent = title || "Выбор";
    modalSubEl.textContent = subtitle || "";
    const kbHint = hint || "Выбор: [1] [2] [3] или ← → + Enter";
    modalHintEl.style.display = kbHint ? "block" : "none";
    modalHintEl.textContent = kbHint || "";

    modalCardsEl.innerHTML = "";
    modalCardsEl.style.display = "grid";
    modalCardsEl.style.gridTemplateColumns = "repeat(3,1fr)";
    modalCardsEl.style.gap = "12px";

    modalOnPick = onPick || null;
    modalOpen = true;
    modalSelected = 0;
    modalCardEls = [];
    modalOptions = options || [];

    for (let i=0;i<options.length;i++){
      const opt = options[i];
      const card = document.createElement("div");
      card.className = "card";
      card.dataset.idx = String(i);
      card.innerHTML = "<b>"+escapeHtml(opt.title||("Option "+(i+1)))+"</b><div class='muted'>"+escapeHtml(opt.desc||"")+"</div>";
      card.addEventListener("click", ()=>{
        if (!modalOpen) return;
        closeChoice();
        if (modalOnPick) modalOnPick(i, opt);
      });
      modalCardsEl.appendChild(card);
      modalCardEls.push(card);
    }

    updateModalSelected();
    modalEl.style.display = "flex";
  }

  function closeChoice(){
    modalOpen = false;
    modalOnPick = null;
    modalOptions = [];
    modalCardEls = [];
    if (modalEl) modalEl.style.display = "none";
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }


  function updateModalSelected(){
    for (let i=0;i<modalCardEls.length;i++){
      const el = modalCardEls[i];
      if (!el) continue;
      if (i === modalSelected) el.classList.add("selected");
      else el.classList.remove("selected");
    }
  }

  function pickModal(idx){
    if (!modalOpen) return;
    const i = Math.max(0, Math.min(modalCardEls.length-1, idx|0));
    const opt = modalOptions[i];
    closeChoice();
    if (modalOnPick) modalOnPick(i, opt);
  }

  // Keyboard control for perk/loot choices:
  // 1/2/3 pick, arrows switch, Enter confirms.
  document.addEventListener("keydown", (e)=>{
    if (!modalOpen) return;
    const k = e.key;
    if (k === "1" || k === "2" || k === "3"){
      e.preventDefault();
      pickModal(parseInt(k,10)-1);
      return;
    }
    if (k === "ArrowLeft" || k === "a" || k === "A"){
      e.preventDefault();
      modalSelected = (modalSelected + modalCardEls.length - 1) % (modalCardEls.length||1);
      updateModalSelected();
      return;
    }
    if (k === "ArrowRight" || k === "d" || k === "D"){
      e.preventDefault();
      modalSelected = (modalSelected + 1) % (modalCardEls.length||1);
      updateModalSelected();
      return;
    }
    if (k === "Enter"){
      e.preventDefault();
      pickModal(modalSelected);
      return;
    }
  }, { capture:true });

  return {
    showPause,
    hidePause,

    showDeath,
    hideDeath,
flashBossPhase,
setBars,
    setWeaponName,
    setHintVisible,
    onResize,

    // new
    addPing,
    tick,
    openChoice,
    closeChoice,
    get modalOpen(){ return modalOpen; }
  };
}