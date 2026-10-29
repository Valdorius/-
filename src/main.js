import { createEngine } from "./core/engine.js?v=20261029_3";
import { createInput } from "./core/input.js?v=20261029_3";
import { clamp } from "./core/math.js?v=20261029_3";
import { createHUD } from "./game/hud.js?v=20261029_3";
import { createAudio } from "./game/audio.js?v=20261029_3";
import { createWorld } from "./game/world.js?v=20261029_3";
import { createPlayer } from "./game/player.js?v=20261029_3";
import { createWeapons } from "./game/weapons.js?v=20261029_3";
import { createEnemies } from "./game/enemies.js?v=20261029_3";
import { createProjectiles } from "./game/projectiles.js?v=20261029_3";
import { createEffects } from "./game/effects.js?v=20261029_3";
import { createProgression } from "./game/progression.js?v=20261029_3";

const canvas = document.getElementById("c");
const engine = createEngine(canvas);
const input = createInput(canvas);

const hud = createHUD();
const audio = createAudio({ buttonId:"musicBtn", url:"./assets/music.ogg" });

const world = createWorld(engine);
const fx = createEffects(engine);

const progression = {}; // shared ref for stats/perks (filled by createProgression)
const player = createPlayer({ engine, input, world, progression });
const weapons = createWeapons({ engine, input, player, world, fx, progression });
const proj = createProjectiles({ engine, world, fx });
weapons.bindProjectiles({ spawn: proj.spawn });
const enemies = createEnemies({ engine, world, player, fx, projectiles: proj, hud, progression });
const prog = createProgression({ player, hud, weapons, audio });
Object.assign(progression, prog);

if (enemies && typeof enemies.tick !== "function") {
  // пробуем совместимость со старыми именами
  if (typeof enemies.update === "function") enemies.tick = enemies.update;
  else if (typeof enemies.step === "function") enemies.tick = enemies.step;
  else {

    enemies.tick = function(){};
  }
}


hud.setHintVisible(true);

// Weapon pick UI
const pickEl = document.getElementById("pick");
const cardsEl = document.getElementById("cards");
function buildPick(){
  cardsEl.innerHTML = "";
  for (const w of weapons.list()){
    const d = weapons.def(w);
    const div = document.createElement("div");
    div.className="card";
    div.innerHTML = `<b>${d.name}</b><div class="muted">${d.hint}</div>`;
    div.addEventListener("click", ()=>{
      weapons.equip(w);
      pickEl.style.display = "none";
      hud.setWeaponName(d.name);
      hud.setHintVisible(false);
      input.requestPointerLock();
      audio.autoStart?.(); // start music on first user gesture if it was enabled before
    });
    cardsEl.appendChild(div);
  }
}
buildPick();

// Game loop
let acc = 0;
engine.onResize(() => {
  hud.onResize();
});

engine.start((dt, now)=>{
  // dt in seconds
  acc += dt;
  // Fixed-ish update steps for stability
  const step = 1/120;
  const maxSteps = 6;
  let steps = 0;
  while (acc > step && steps < maxSteps){
    update(step, now);
    acc -= step;
    steps++;
  }
  render(dt, now);
});


function relAngleToPlayer(worldDir){
  // worldDir: direction pointing FROM player TO source in XZ
  const f = player.forward ? player.forward() : null;
  if (!f) return 0;
  const fx = f.x, fz = f.z;
  const dx = worldDir.x, dz = worldDir.z;
  const dot = fx*dx + fz*dz;
  const cross = fx*dz - fz*dx;
  return Math.atan2(cross, dot);
}

let timeScale = 1.0;
let timeScaleT = 0;
let gameOver = false;
let paused = false;


// Resume from pause on click/tap (important for mobile and for when the browser starts unfocused)
function tryResumeFromPointer(){
  if (!paused || gameOver || !weapons.hasWeapon()) return;
  togglePause(false);
  try{ canvas.requestPointerLock?.(); }catch(e){}
}
canvas.addEventListener('pointerdown', (e)=>{
  // If paused, treat first pointer as "resume"
  tryResumeFromPointer();
}, { passive:true });

// Also allow clicking the pause overlay to resume
window.addEventListener('DOMContentLoaded', ()=>{
  const p = document.getElementById('pauseOverlay');
  if (p){
    p.addEventListener('pointerdown', ()=> tryResumeFromPointer(), { passive:true });
  }
});

function update(dt, now){
  input.tick();
  audio?.tick?.(dt);

  // time dilation (boss kill punch)
  if (timeScaleT > 0){
    timeScaleT = Math.max(0, timeScaleT - dt);
    if (timeScaleT === 0) timeScale = 1.0;
  }
  dt = dt * timeScale;

  if (!weapons.hasWeapon()){
    // still picking
    return;
  }

  if (gameOver){
    hud.tick(dt);
    hud.setBars({ hp: player.hp, hpMax: player.hpMax, xp: prog.xp, xpNext: prog.xpNext, level: prog.level, wave: enemies.wave, kills: prog.kills });
    return;
  }

  if (paused){
    hud.tick(dt);
    hud.setBars({ hp: player.hp, hpMax: player.hpMax, xp: prog.xp, xpNext: prog.xpNext, level: prog.level, wave: enemies.wave, kills: prog.kills });
    return;
  }

  // Short breather between waves (pauses gameplay, UI keeps animating)
  if (prog.freezeT > 0){
    prog.freezeT = Math.max(0, prog.freezeT - dt);
    hud.tick(dt);
    hud.setBars({
      hp: player.hp, hpMax: player.hpMax,
      xp: prog.xp, xpNext: prog.xpNext,
      level: prog.level,
      wave: enemies.wave,
      kills: prog.kills,
    });
    return;
  }

  // If a perk/loot modal is open, pause gameplay but keep UI anims
  if (hud.modalOpen){
    hud.tick(dt);
    // still update bars so you see regen/changes after pick
    hud.setBars({
      hp: player.hp, hpMax: player.hpMax,
      xp: prog.xp, xpNext: prog.xpNext,
      level: prog.level,
      wave: enemies.wave,
      kills: prog.kills,
    });
    return;
  }

  player.tick(dt);
  weapons.tick(dt, now);

  proj.tick(dt);
  enemies.tick(dt);
  // sword melee -> enemies
  weapons.meleeQuery(enemies);

  // Collisions: player projectiles -> enemies
  proj.resolveHits(enemies, (hit)=>{
    const dealt = enemies.damage(hit.enemyId, hit.damage, hit);

    // lifesteal is based on outgoing damage (roughly)
    prog.onDealDamage?.(hit.damage);

    // chain lightning (staff perk/relic)
const chain = (prog.stats?.chain ?? 0);
const chainChance = (prog.stats?.chainChance ?? 0.33);
const chainMax = (prog.stats?.chainMax ?? 1);

if (chain > 0 && Math.random() < chainChance){
  let from = hit.point;
  let lastId = hit.enemyId;
  for (let hop=0; hop<chainMax; hop++){
    let best = null;
    let bestD2 = 1e9;
    enemies.forEachInRadius(from, 5.0, (e)=>{
      if (e.id === lastId) return;
      const dx = e.pos.x - from.x;
      const dz = e.pos.z - from.z;
      const d2 = dx*dx + dz*dz;
      if (d2 < bestD2){
        bestD2 = d2;
        best = e;
      }
    });
    if (!best) break;
    enemies.damage(best.id, hit.damage * chain, { kind:"chain", point: best.pos, srcPos: player.position });
    fx.addArcFlash?.(best.pos);
    from = best.pos;
    lastId = best.id;
  }
}

    if (dealt.killed){
      prog.onKill(dealt.xp);

      // kill feedback
      try {
        const pos = hit.point ? hit.point : (hit.enemyPos || hit.srcPos || player.position);
        if (dealt.kind === "boss"){
          timeScale = 0.88;
          timeScaleT = 0.12;
          fx.addShockwave?.(pos, 1.6);
        } else if (dealt.kind === "ranged" || dealt.kind === "sniper" || dealt.kind === "summoner"){
          fx.addShatter?.(pos, 1.0);
        } else {
          fx.addShockwave?.(pos, 0.9);
        }
      } catch(e) {}

      // spear perk: killing a ranged-type enemy empowers next spear swing
      if ((dealt.kind === "ranged" || dealt.kind === "sniper" || dealt.kind === "summoner") && (prog.stats?.spearNextRadiusOnRangedKill)){
        prog.stats.spearNextRadiusMul = prog.stats.spearNextRadiusOnRangedKill;
        prog.stats.spearNextRadiusT = prog.stats.spearNextRadiusDur ?? 3.0;
      }

      if (dealt.bossLoot){
        prog.openBossLoot?.();
      }
    }
  });

  // Collisions: enemy projectiles -> player
  proj.resolveHitsPlayer(player, (hit)=>{
    // direction indicator points to source (opposite of projectile travel)
    const srcDir = { x: -hit.dir.x, z: -hit.dir.z };
    const ang = relAngleToPlayer({ x: srcDir.x, z: srcDir.z });
    hud.addPing?.(ang, 1.25, "hit");
    player.applyDamage(hit.damage);
  });


  // Death / Game over
  if (player.hp <= 0 && !gameOver){
    gameOver = true;
    try{ document.exitPointerLock && document.exitPointerLock(); }catch(e){}
    hud.showDeath({ wave: enemies.wave, kills: prog.kills, level: prog.level }, ()=>{ window.location.reload(); });
  }

  // Enemy melee -> player is handled inside enemies.tick using distance + swing window

// Staff relic: periodic nova around the player
if (prog.stats?.novaCd){
  prog.stats.novaT = (prog.stats.novaT || 0) + dt;
  if (prog.stats.novaT >= prog.stats.novaCd){
    prog.stats.novaT = 0;
    const center = player.position.clone();
    const base = 28 * (prog.stats.damageMul ?? 1) * (prog.stats.staffDamageMul ?? 1);
    const dmg = base * (prog.stats.novaMul ?? 0.40);
    enemies.forEachInRadius(center, 4.8, (e)=>{
      enemies.damage(e.id, dmg, { kind:"nova", point:e.pos, srcPos:center, burn: (prog.stats.staffBurn||null) });
    });
    fx.addArcFlash?.(center);
  }
}

    fx.tick(dt);
  prog.tick(dt);

  hud.tick(dt);

  // HUD
  hud.setBars({
    hp: player.hp, hpMax: player.hpMax,
    xp: prog.xp, xpNext: prog.xpNext,
    level: prog.level,
    wave: enemies.wave,
    kills: prog.kills,
  });
}

function render(dt, now){
  if (!weapons.hasWeapon()){
    engine.render(); // just show world
    return;
  }

  // Viewmodel animations are in weapons.tick(); world/enemies already updated
  engine.render();
}

// Pause toggle (P)
function togglePause(force){
  if (gameOver) return;
  if (typeof force === 'boolean') paused = force; else paused = !paused;

  if (paused){
    try{ document.exitPointerLock && document.exitPointerLock(); }catch(e){}
    hud.showPause();
  } else {
    hud.hidePause();
    // re-lock mouse (key press counts as a user gesture)
    try{ input.requestPointerLock(); }catch(e){}
  }
}

window.addEventListener('keydown',(e)=>{
  if (e.code === 'KeyP'){
    e.preventDefault();
    togglePause();
  }
});


// Auto-pause and input reset on focus loss (Alt+Tab etc.)
window.addEventListener('blur', ()=>{
  try{ input.clear && input.clear(); }catch(e){}
  if (!gameOver){
    togglePause(true);
  }
});

window.addEventListener('focus', ()=>{
  // keep paused until player presses P; avoid instant pointer lock surprises
  try{ input.clear && input.clear(); }catch(e){}
});
