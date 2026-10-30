// enemies.js (stable API for main.js + weapons.js)
// Provides: tick(dt), group (THREE.Group), count (number), wave (number),
// forEachInRadius(pos,r,fn), firstHit(pos,dir,maxDist),
// applyDamage(id,dmg,meta) and damage(...) alias returning {killed,xp}

import * as THREE from "three";
import { attachVOXSkin } from "../models/vox_registry.js?v=20261030_10";
import { createPortals } from "./portals.js?v=20261030_10";

export function createEnemies(ctx) {
  const scene = ctx.scene || ctx.engine?.scene || ctx.engine?.getScene?.();
  const world = ctx.world;
  const player = ctx.player;
  const projectiles = ctx.projectiles;
  const fx = ctx.fx;
  const hud = ctx.hud;
  const progression = ctx.progression;

  // ---- config
  const BASE_HP = 50;
  const BASE_SPEED = 3.0;
  const BASE_DMG = 8;
  const RANGED_HP = 22;
  const RANGED_SPEED = 2.7;
  const RANGED_DMG = 14;
  const RANGED_RANGE = 11.5;
  const RANGED_KEEP = 8.0;
  const RANGED_COOLDOWN = 1.75;
  const RANGED_PROJECTILE_SPEED = 7.2;

  const BOSS_EVERY = 10; // longer 30-40 min runs
  const BOSS_HP = 780;
  const BOSS_SPEED = 2.25;
  const BOSS_DMG = 22;
  const BOSS_RADIUS = 1.05;

  const ATTACK_RANGE = 1.45;
  const ATTACK_COOLDOWN = 0.85;
  // melee swing timing (seconds)
  const ATTACK_WINDUP = 0.22;
  const ATTACK_SWING = 0.18;
  const ATTACK_RECOVER = 0.35;
  const ATTACK_ARC_DEG = 70; // cone in front

  const ENEMY_RADIUS = 0.55;

  // spawn tuning (hex arena is ~3x; keep enemies near-ish)
  const SPAWN_RING_MIN = 6.0;
  const SPAWN_RING_MAX = 12.0;

  
  // arena "pressure" metric: sums enemy threat to slightly ramp intensity/readability
  const THREAT = {
    melee: 1,
    basic: 1,
    ranged: 1.4,
    anchor: 2.4,
    resonator: 2.6,
    observer: 3.5,
    reaper: 4.0,
    sniper: 1.8,
    summoner: 2.0,
    shielder: 1.6,
    bomber: 1.8,
    sprinter: 1.2,
    brute: 2.2,
    boss: 7.0,
  };

  // ---------------- Boss telegraphs / hazards (local-only visuals + damage logic) ----------------
  const bossFX = {
    telegraphs: [], // {mesh,t, t0, kind, data}
  };

  function addGroundRing(pos, rInner, rOuter, color=0xff3b6a, life=1.0, grow=0.0){
    const geo = new THREE.RingGeometry(Math.max(0.01,rInner), Math.max(rInner+0.02,rOuter), 44);
    const mat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.45, depthWrite:false, side:THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI/2;
    m.position.set(pos.x, (pos.y||0)+0.03, pos.z);
    scene.add(m);
    bossFX.telegraphs.push({ mesh:m, t:life, t0:life, kind:"ring", data:{ grow } });
    return m;
  }

  function addGroundDisc(pos, r, color=0x00b7ff, life=1.0){
    const geo = new THREE.CircleGeometry(Math.max(0.05,r), 40);
    const mat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.18, depthWrite:false, side:THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI/2;
    m.position.set(pos.x, (pos.y||0)+0.02, pos.z);
    scene.add(m);
    bossFX.telegraphs.push({ mesh:m, t:life, t0:life, kind:"disc", data:{} });
    return m;
  }

  function tickBossFX(dt){
    for (let i=bossFX.telegraphs.length-1;i>=0;i--){
      const it = bossFX.telegraphs[i];
      it.t -= dt;
      const a = clamp(it.t/it.t0, 0, 1);
      if (it.mesh?.material){
        // fade out near end
        it.mesh.material.opacity = (it.kind==="disc"?0.18:0.45) * (0.25 + 0.75*a);
      }
      if (it.kind==="ring" && it.data?.grow){
        const g = (1 - a) * (it.data.grow||0);
        it.mesh.scale.setScalar(1 + g);
      }
      if (it.t <= 0){
        if (it.mesh?.parent) it.mesh.parent.remove(it.mesh);
        bossFX.telegraphs.splice(i,1);
      }
    }
  }



// positional + event enemies
  const ANCHOR_HP = 210;
  const ANCHOR_SPEED = 2.2;
  const ANCHOR_DMG = 4;
  const ANCHOR_AURA_R = 8.5;
  const RESO_HP = 150;
  const RESO_SPEED = 2.6;
  const RESO_DMG = 10;
  const RESO_AURA_R = 9.0;
  const OBS_HP = 160;
  const OBS_SPEED = 2.4;
  const OBS_AURA_R = 12.0;
  const OBS_LIFE = 25.0;
  const REAPER_HP = 240;
  const REAPER_SPEED = 4.4;
  const REAPER_DMG = 10;
  const REAPER_LIFE = 18.0;

// ---- state
  const group = new THREE.Group();
  if (scene) scene.add(group); // IMPORTANT: without this, mobs "exist" but are invisible
  const portalsCtrl = scene ? createPortals({ scene }) : null;

  let nextId = 1;
  let wave = 1;
  let waveType = "mixed";
  let spawnCooldown = 0.15;

  // Wave batching: each wave can arrive in multiple batches to extend run length.
  // Must exist from the start (before first weapon pick) to avoid ReferenceError.
  let waveBatchPlan = { batches: [], idx: 0 };


  // playstyle analyzer (simple exponential smoothing)
  const style = { melee:0, arrow:0, spell:0, aoe:0, samples:0, avgDist:0 };
  function noteKill(meta, enemyPos){
    try{
      const alpha = 0.12; // smoothing
      const k = meta?.kind || "unknown";
      const isAoe = !!meta?.splash;
      const dist = (meta?.srcPos && enemyPos) ? meta.srcPos.distanceTo(enemyPos) : null;

      // decay
      style.melee *= (1-alpha); style.arrow *= (1-alpha); style.spell *= (1-alpha);
      style.aoe   *= (1-alpha); style.samples *= (1-alpha);

      // add
      if (k === "melee") style.melee += alpha;
      else if (k === "arrow") style.arrow += alpha;
      else if (k === "spell") style.spell += alpha;
      if (isAoe) style.aoe += alpha;
      style.samples += alpha;

      if (dist != null){
        style.avgDist = style.avgDist*(1-alpha) + dist*alpha;
      }
    }catch(e){}
  }

  // event flags
  let activeObserver = false;
  let activeReaper = false;


  /** @type {Map<number, any>} */
  const enemies = new Map();

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  // Tint enemies by type for readability — single authoritative implementation below (near line 536)
// ===== Portal spawns (one wall) =====

// Portals are built by src/game/portals.js (see createPortals).

function randomSpawnFromPortal(portalsCtrl, world) {
  // Returns a position in XZ near the next portal opening.
  const fallback = randomSpawnPosFallback();
  if (!portalsCtrl || !portalsCtrl.nextSpawnPos) return fallback;

  // In early wave 1, mix in visible spawns so combat begins quickly and arena feels active
  if (wave === 1 && Math.random() < 0.5) {
    return fallback;
  }

  const out = portalsCtrl.nextSpawnPos(rand);
  if (!out || !out.pos) return fallback;

  const pos = out.pos;

  // clamp + push out of colliders
  if (world?.bounds) {
    pos.x = clamp(pos.x, world.bounds.minX + 1.2, world.bounds.maxX - 1.2);
    pos.z = clamp(pos.z, world.bounds.minZ + 1.2, world.bounds.maxZ - 1.2);
  }
  if (world?.resolveCircle) world.resolveCircle(pos, 0.55);
  return pos;
}

function randomSpawnPosFallback() {
  // Spawn around arena center (in clear sight of player)
  const ang = Math.random() * Math.PI * 2;
  const dist = rand(10.0, 18.0);
  const pos = new THREE.Vector3(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
  pos.x = clamp(pos.x, world.bounds.minX + 1.2, world.bounds.maxX - 1.2);
  pos.z = clamp(pos.z, world.bounds.minZ + 1.2, world.bounds.maxZ - 1.2);
  if (world?.resolveCircle) world.resolveCircle(pos, ENEMY_RADIUS, 3);
  return pos;
}


  function makeBotModel() {
    // Magical golem model with visible core + mace (voxel/low-poly)
    const root = new THREE.Group();

    const stoneA = new THREE.MeshStandardMaterial({ color: 0x1f8f4a, roughness: 0.95, metalness: 0.02 });
    const stoneB = new THREE.MeshStandardMaterial({ color: 0x14693a, roughness: 1.00, metalness: 0.02 });
    const stoneC = new THREE.MeshStandardMaterial({ color: 0x0f4b2a, roughness: 1.00, metalness: 0.02 });
    const metal  = new THREE.MeshStandardMaterial({ color: 0x6d6d6d, roughness: 0.55, metalness: 0.65 });
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x00ff8a, emissive: 0x00ff8a, emissiveIntensity: 1.1 });

    // --- torso / core ---
    // Main mass
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.95, 0.75), stoneA);
    torso.position.y = 1.05;
    root.add(torso);

    // Shoulder stones
    const shL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.55), stoneB);
    const shR = shL.clone();
    shL.position.set(-0.78, 1.33, 0.05);
    shR.position.set( 0.78, 1.33, 0.05);
    root.add(shL, shR);

    // “Rib” plates leaving a window for the core
    const plateTop = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.55), stoneB);
    plateTop.position.set(0, 1.34, 0.20);
    root.add(plateTop);

    const plateBot = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.22, 0.55), stoneB);
    plateBot.position.set(0, 0.95, 0.20);
    root.add(plateBot);

    const plateL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.52, 0.55), stoneB);
    const plateR = plateL.clone();
    plateL.position.set(-0.48, 1.14, 0.20);
    plateR.position.set( 0.48, 1.14, 0.20);
    root.add(plateL, plateR);

    // Core (visible “magic heart”)
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), coreMat);
    core.position.set(0, 1.14, 0.35);
    root.add(core);

    // Core frame
    const coreFrame = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 10, 18), metal);
    coreFrame.rotation.x = Math.PI * 0.5;
    coreFrame.position.copy(core.position);
    root.add(coreFrame);

    // Belt/waist
    const belt = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.18, 0.78), stoneC);
    belt.position.y = 0.58;
    root.add(belt);

    // --- head ---
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.62), stoneA);
    head.position.y = 1.72;
    root.add(head);

    // Brow plate
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.18, 0.64), stoneB);
    brow.position.set(0, 1.86, 0.02);
    root.add(brow);

    // Glowing eyes
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.08), coreMat);
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.18, 1.72, 0.35);
    eyeR.position.set( 0.18, 1.72, 0.35);
    root.add(eyeL, eyeR);

    // Horns/spikes
    const hornGeom = new THREE.ConeGeometry(0.10, 0.22, 6);
    const hornL = new THREE.Mesh(hornGeom, stoneC);
    const hornR = new THREE.Mesh(hornGeom, stoneC);
    hornL.position.set(-0.30, 1.96, 0.05);
    hornR.position.set( 0.30, 1.96, 0.05);
    hornL.rotation.z = 0.35;
    hornR.rotation.z = -0.35;
    root.add(hornL, hornR);

    // --- arms (as groups so animation rotates the whole limb) ---
    const armL = new THREE.Group();
    const armR = new THREE.Group();
    armL.position.set(-0.82, 1.25, 0.00);
    armR.position.set( 0.82, 1.25, 0.00);

    const upperArmGeom = new THREE.BoxGeometry(0.34, 0.48, 0.34);
    const foreArmGeom  = new THREE.BoxGeometry(0.32, 0.52, 0.32);

    const upperL = new THREE.Mesh(upperArmGeom, stoneA);
    const upperR = upperL.clone();
    upperL.position.set(0, -0.18, 0);
    upperR.position.set(0, -0.18, 0);

    const elbowL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.26), stoneC);
    const elbowR = elbowL.clone();
    elbowL.position.set(0, -0.46, 0);
    elbowR.position.set(0, -0.46, 0);

    const foreL = new THREE.Mesh(foreArmGeom, stoneB);
    const foreR = foreL.clone();
    foreL.position.set(0, -0.74, 0);
    foreR.position.set(0, -0.74, 0);

    const fistL = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.24, 0.30), stoneC);
    const fistR = fistL.clone();
    fistL.position.set(0, -1.06, 0.05);
    fistR.position.set(0, -1.06, 0.05);

    // Small glow shards on arms
    const shardL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), coreMat);
    const shardR = shardL.clone();
    shardL.position.set(-0.16, -0.62, 0.18);
    shardR.position.set( 0.16, -0.62, 0.18);

    armL.add(upperL, elbowL, foreL, fistL, shardL);
    armR.add(upperR, elbowR, foreR, fistR, shardR);
    root.add(armL, armR);

    // --- mace on right arm ---
    const mace = new THREE.Group();
    mace.name = "Mace";
    mace.position.set(0.12, -1.04, 0.28); // near the fist
    // handle
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.75, 8), metal);
    handle.rotation.x = Math.PI * 0.5;
    handle.position.set(0, 0, 0.22);
    mace.add(handle);
    // head
    const headBall = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), stoneC);
    headBall.position.set(0, 0, 0.62);
    mace.add(headBall);
    // spikes
    const spikeGeom = new THREE.ConeGeometry(0.06, 0.16, 6);
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Mesh(spikeGeom, stoneB);
      const a = (i / 8) * Math.PI * 2;
      sp.position.set(Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0.62);
      sp.rotation.x = Math.PI * 0.5;
      sp.rotation.y = a;
      mace.add(sp);
    }
    armR.add(mace);

    // --- legs (as groups for animation) ---
    const legL = new THREE.Group();
    const legR = new THREE.Group();
    legL.position.set(-0.34, 0.58, 0.00);
    legR.position.set( 0.34, 0.58, 0.00);

    const thighGeom = new THREE.BoxGeometry(0.42, 0.52, 0.42);
    const shinGeom  = new THREE.BoxGeometry(0.40, 0.52, 0.40);
    const footGeom  = new THREE.BoxGeometry(0.46, 0.18, 0.60);

    const thighL = new THREE.Mesh(thighGeom, stoneA);
    const thighR = thighL.clone();
    thighL.position.set(0, -0.24, 0);
    thighR.position.set(0, -0.24, 0);

    const kneeL = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.12, 0.30), stoneC);
    const kneeR = kneeL.clone();
    kneeL.position.set(0, -0.52, 0.06);
    kneeR.position.set(0, -0.52, 0.06);

    const shinL = new THREE.Mesh(shinGeom, stoneB);
    const shinR = shinL.clone();
    shinL.position.set(0, -0.80, 0);
    shinR.position.set(0, -0.80, 0);

    const footL = new THREE.Mesh(footGeom, stoneC);
    const footR = footL.clone();
    footL.position.set(0, -1.10, 0.10);
    footR.position.set(0, -1.10, 0.10);

    // tiny glow on shins
    const shinGlowL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), coreMat);
    const shinGlowR = shinGlowL.clone();
    shinGlowL.position.set(0.18, -0.80, 0.18);
    shinGlowR.position.set(-0.18, -0.80, 0.18);

    legL.add(thighL, kneeL, shinL, footL, shinGlowL);
    legR.add(thighR, kneeR, shinR, footR, shinGlowR);
    root.add(legL, legR);

    // Slight “brutal” proportions
    root.scale.set(1.08, 1.12, 1.08);

    return { root, head, armL, armR, legL, legR };

  }
  function makeRangedModel(){
    // Start from the same golem body, but swap the weapon for a staff/wand.
    const base = makeBotModel();
    const root = base.root;

    // Remove mace
    const mace = root.getObjectByName("Mace");
    if (mace && mace.parent) mace.parent.remove(mace);

    const armR = base.armR;

    // Materials (blue-ish)
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.95, metalness: 0.0 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x7b7f86, roughness: 0.5, metalness: 0.6 });
    const crystal = new THREE.MeshStandardMaterial({ color: 0x36b5ff, emissive: 0x36b5ff, emissiveIntensity: 1.2, roughness: 0.2, metalness: 0.0 });

    // Staff group near the fist
    const staff = new THREE.Group();
    staff.name = "Staff";
    staff.position.set(0.10, -1.00, 0.30);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.15, 8), wood);
    pole.rotation.x = Math.PI * 0.5;
    pole.position.set(0, 0, 0.55);
    staff.add(pole);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8), metal);
    cap.rotation.x = Math.PI * 0.5;
    cap.position.set(0, 0, 1.05);
    staff.add(cap);

    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), crystal);
    orb.position.set(0, 0.08, 1.12);
    staff.add(orb);

    // tiny fins for silhouette
    const finGeo = new THREE.BoxGeometry(0.04, 0.12, 0.18);
    for (let i=0;i<3;i++){
      const fin = new THREE.Mesh(finGeo, metal);
      fin.position.set((i-1)*0.08, 0, 1.02);
      fin.rotation.x = Math.PI*0.5;
      staff.add(fin);
    }

    armR.add(staff);

    // Add a small “satchel” on the back for ranged readability
    const satchelMat = new THREE.MeshStandardMaterial({ color: 0x2b3c58, roughness: 0.9, metalness: 0.0 });
    const satchel = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.28), satchelMat);
    satchel.position.set(0, 1.05, -0.48);
    root.add(satchel);

    return base;
  }


  
  function tintModel(root, kind){
    // Mutate materials to make variants visually readable
    let mul = 1.0;
    let add = null;
    if (kind === "boss")        { mul = 0.65; }
    else if (kind === "brute")  { mul = 0.72; }
    else if (kind === "sprinter"){ mul = 1.05; }
    else if (kind === "bomber") { mul = 0.85; add = new THREE.Color(0.55, 0.12, 0.10); }
    else if (kind === "sniper") { mul = 0.9;  add = new THREE.Color(0.25, 0.25, 0.65); }
    else if (kind === "shielder"){ mul = 0.9; add = new THREE.Color(0.15, 0.35, 0.18); }
    else if (kind === "summoner"){ mul = 0.88; add = new THREE.Color(0.45, 0.15, 0.55); }
    else if (kind === "anchor") { mul = 0.78; add = new THREE.Color(0.35, 0.22, 0.06); }
    else if (kind === "resonator"){ mul = 0.85; add = new THREE.Color(0.20, 0.55, 0.50); }
    else if (kind === "observer"){ mul = 0.82; add = new THREE.Color(0.55, 0.55, 0.75); }
    else if (kind === "reaper") { mul = 0.72; add = new THREE.Color(0.15, 0.15, 0.15); }
    else if (kind === "ranged") { mul = 0.9;  add = new THREE.Color(0.15, 0.25, 0.55); }

    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m.color) continue;
        m.color.r = clamp(m.color.r * mul + (add ? add.r : 0), 0, 1);
        m.color.g = clamp(m.color.g * mul + (add ? add.g : 0), 0, 1);
        m.color.b = clamp(m.color.b * mul + (add ? add.b : 0), 0, 1);
        if (kind === "boss" && m.emissive) {
          m.emissiveIntensity = Math.max(m.emissiveIntensity || 0, 1.15);
        }
        m.needsUpdate = true;
      }
    });
  }

  

function makeBossModel(){
  // Unique boss: "Archon Warden" — multi-layer armor, glowing cracks, animated cores, crown + back reactor.
  const base = makeBotModel();
  const root = base.root;

  // Materials (keep voxel style, add depth)
  const obsA = new THREE.MeshStandardMaterial({ color: 0x070a10, roughness: 0.98, metalness: 0.08 });
  const obsB = new THREE.MeshStandardMaterial({ color: 0x141a26, roughness: 0.95, metalness: 0.12 });
  const steel= new THREE.MeshStandardMaterial({ color: 0x3a4456, roughness: 0.60, metalness: 0.55 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xb08a2a, roughness: 0.42, metalness: 0.78 });
  const coreRed = new THREE.MeshStandardMaterial({ color: 0xff3b6a, emissive: 0xff3b6a, emissiveIntensity: 1.35, roughness: 0.45, metalness: 0.55 });
  const coreCyan= new THREE.MeshStandardMaterial({ color: 0x00b7ff, emissive: 0x00b7ff, emissiveIntensity: 1.10, roughness: 0.48, metalness: 0.60 });
  const crackMat= new THREE.MeshStandardMaterial({ color: 0x1a2030, emissive: 0xff4aa6, emissiveIntensity: 0.95, roughness: 0.90, metalness: 0.10 });

  const box = (sx,sy,sz, mat, x,y,z, rx=0,ry=0,rz=0)=>{
    const m = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), mat);
    m.scale.set(sx,sy,sz);
    m.position.set(x,y,z);
    m.rotation.set(rx,ry,rz);
    m.castShadow = true; m.receiveShadow = true;
    root.add(m);
    return m;
  };

  const addTo = (parent, sx,sy,sz, mat, x,y,z, rx=0,ry=0,rz=0)=>{
    const m = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), mat);
    m.scale.set(sx,sy,sz);
    m.position.set(x,y,z);
    m.rotation.set(rx,ry,rz);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // Scale up overall
  root.scale.multiplyScalar(1.08);

  // --- Silhouette: bulked torso armor ---
  box(1.35, 1.10, 0.92, obsA, 0, 1.08, 0.02);
  box(1.55, 0.55, 1.02, obsB, 0, 1.55, 0.00); // shoulders slab
  box(1.05, 0.75, 0.70, obsB, 0, 0.78,-0.15); // abdomen plate
  box(1.25, 0.55, 0.85, steel,0, 1.10,-0.38); // back plate

  // --- Chest "window" + cores ---
  const frame = box(0.62, 0.46, 0.10, steel, 0, 1.12, 0.52);
  const coreA = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), coreRed);
  const coreB = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), coreCyan);
  coreA.position.set(0.16, 1.16, 0.60);
  coreB.position.set(-0.22, 1.04, 0.58);
  root.add(coreA, coreB);

  // add crack strips around chest (glowing seams)
  for (let i=0;i<6;i++){
    const a = i/6 * Math.PI*2;
    const cx = Math.cos(a)*0.36;
    const cy = 1.12 + Math.sin(a)*0.22;
    const cz = 0.56;
    box(0.08, 0.22, 0.06, crackMat, cx, cy, cz, 0, 0, a);
  }

  // Expose core meshes for phase/vulnerability pulses
  base.coreMeshes = [coreA, coreB];

  // --- Crown / halo ---
  const crown = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 12, 20), gold);
  ring.rotation.x = Math.PI*0.5;
  crown.add(ring);
  for (let i=0;i<8;i++){
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 6), gold);
    const a = i/8 * Math.PI*2;
    spike.position.set(Math.cos(a)*0.40, 0.14, Math.sin(a)*0.40);
    spike.rotation.x = Math.PI;
    crown.add(spike);
  }
  // floating pylons
  for (let i=0;i<4;i++){
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.10,0.28,0.10), coreCyan);
    const a = i/4*Math.PI*2 + 0.4;
    p.position.set(Math.cos(a)*0.32, 0.20, Math.sin(a)*0.32);
    crown.add(p);
  }
  crown.position.set(0, 2.12, 0.04);
  root.add(crown);
  base.crown = crown;

  // --- Back reactor + vents ---
  const reactor = new THREE.Group();
  reactor.position.set(0, 1.12, -0.62);
  root.add(reactor);
  addTo(reactor, 0.70, 0.58, 0.34, obsB, 0, 0.0, 0.0);
  const ventL = addTo(reactor, 0.14, 0.40, 0.20, steel, -0.30, 0.08, -0.05);
  const ventR = addTo(reactor, 0.14, 0.40, 0.20, steel,  0.30, 0.08, -0.05);
  const coil1 = addTo(reactor, 0.18, 0.18, 0.18, coreCyan, 0, -0.10, 0.10);
  const coil2 = addTo(reactor, 0.14, 0.14, 0.14, coreRed,  0,  0.18, 0.10);
  base.reactorCoils = [coil1, coil2];

  // --- Shoulder pauldrons + horns ---
  box(0.70, 0.46, 0.78, obsA, -1.12, 1.55, 0.02);
  box(0.70, 0.46, 0.78, obsA,  1.12, 1.55, 0.02);
  box(0.16, 0.42, 0.16, coreRed, -1.24, 1.72, 0.02);
  box(0.16, 0.42, 0.16, coreRed,  1.24, 1.72, 0.02);

  // --- Leg guards (bulk + readability) ---
  // attach to existing legs if present
  if (base.legL && base.legR){
    addTo(base.legL, 0.42, 0.52, 0.42, obsB, 0, -0.25, 0.05);
    addTo(base.legR, 0.42, 0.52, 0.42, obsB, 0, -0.25, 0.05);
    addTo(base.legL, 0.22, 0.22, 0.10, coreCyan, 0.14, -0.38, 0.26);
    addTo(base.legR, 0.22, 0.22, 0.10, coreCyan,-0.14, -0.38, 0.26);
  }

  // --- Arms: gauntlets + weapon (spiked mace) ---
  if (base.armR){
    // gauntlet
    addTo(base.armR, 0.30, 0.18, 0.30, obsB, 0, -0.92, 0.05);
    addTo(base.armR, 0.10, 0.10, 0.28, coreCyan, -0.16, -0.62, 0.14);

    // mace
    const mace = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.07,1.05,10), gold);
    handle.rotation.z = Math.PI*0.5;
    handle.position.set(0.10, -1.20, 0.10);
    mace.add(handle);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42,0.42,0.42), obsA);
    head.position.set(0.72, -1.20, 0.10);
    mace.add(head);

    // spikes
    const spGeom = new THREE.ConeGeometry(0.07, 0.16, 6);
    for (let i=0;i<10;i++){
      const sp = new THREE.Mesh(spGeom, obsB);
      const a = i/10*Math.PI*2;
      sp.position.set(0.72 + Math.cos(a)*0.28, -1.20, 0.10 + Math.sin(a)*0.28);
      sp.rotation.x = Math.PI;
      mace.add(sp);
    }

    // glow node on mace
    const rune = new THREE.Mesh(new THREE.BoxGeometry(0.10,0.10,0.10), coreRed);
    rune.position.set(0.72, -1.20, 0.10);
    mace.add(rune);
    base.maceRune = rune;

    base.armR.add(mace);
  }
  if (base.armL){
    addTo(base.armL, 0.30, 0.18, 0.30, obsB, 0, -0.92, 0.05);
    addTo(base.armL, 0.10, 0.10, 0.28, coreCyan, 0.16, -0.62, 0.14);
  }

  // --- Head: helmet overlay + visor ---
  const helm = box(0.72, 0.58, 0.70, obsB, 0, 1.90, 0.05);
  box(0.46, 0.18, 0.08, coreCyan, 0, 1.86, 0.42); // visor strip
  box(0.10, 0.10, 0.10, coreRed, -0.20, 1.86, 0.42);
  box(0.10, 0.10, 0.10, coreRed,  0.20, 1.86, 0.42);

  // --- Tiny floating "orbs" (cheap wow) ---
  const orbs = new THREE.Group();
  orbs.position.set(0, 1.25, 0);
  root.add(orbs);
  for (let i=0;i<3;i++){
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 8), (i===1)?coreRed:coreCyan);
    const a = i/3*Math.PI*2;
    orb.position.set(Math.cos(a)*0.95, 0.22, Math.sin(a)*0.95);
    orbs.add(orb);
  }
  base.orbs = orbs;

  return base;
}


function makeBruteModel(){
  const m = makeBotModel();
  // add shoulder blocks for silhouette
  const root = m.root;
  const mat = new THREE.MeshStandardMaterial({ color: 0x2b3a28, roughness: 0.95, metalness: 0.05 });
  const hump = new THREE.Mesh(new THREE.BoxGeometry(1.25,0.45,0.85), mat);
  hump.position.set(0,1.55,-0.05);
  root.add(hump);
  return m;
}

function makeSprinterModel(){
  const m = makeBotModel();
  // slimmer: shrink torso slightly
  m.root.scale.setScalar(0.90);
  return m;
}

function makeBomberModel(){
  const m = makeBotModel();
  const root = m.root;
  const red = new THREE.MeshStandardMaterial({ color: 0x6b1515, emissive:0xff2a2a, emissiveIntensity:0.7, roughness:0.8, metalness:0.1 });
  const bomb = new THREE.Mesh(new THREE.SphereGeometry(0.20, 10, 8), red);
  bomb.position.set(0,1.05,0.55);
  root.add(bomb);
  return m;
}

function makeSniperModel(){
  const m = makeRangedModel();
  const root = m.root;
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness:0.55, metalness:0.65 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.75,8), steel);
  barrel.rotation.z = Math.PI*0.5;
  barrel.position.set(0.65, 1.10, 0.20);
  root.add(barrel);
  return m;
}

function makeShielderModel(){
  const m = makeBotModel();
  const root = m.root;
  const shieldMat = new THREE.MeshStandardMaterial({ color: 0x1b3d24, roughness:0.95, metalness:0.10 });
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.85,0.95,0.10), shieldMat);
  shield.position.set(0,1.05,0.78);
  root.add(shield);
  m.shieldMesh = shield;
  return m;
}

function makeSummonerModel(){
  const m = makeRangedModel();
  const root = m.root;
  const robe = new THREE.MeshStandardMaterial({ color: 0x2e0e3a, roughness:0.98, metalness:0.02 });
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.72,0.55,0.72), robe);
  hood.position.set(0,1.80,0.05);
  root.add(hood);
  return m;
}

function createEnemy(kind = "melee") {
    let model;
    if (kind === "ranged") model = makeRangedModel();
    else if (kind === "sniper") model = makeSniperModel();
    else if (kind === "summoner") model = makeSummonerModel();
    else if (kind === "boss") model = makeBossModel();
    else if (kind === "brute") model = makeBruteModel();
    else if (kind === "sprinter") model = makeSprinterModel();
    else if (kind === "bomber") model = makeBomberModel();
    else if (kind === "shielder") model = makeShielderModel();
    else model = makeBotModel();
    const root = model.root;
    root.position.copy(randomSpawnFromPortal(portalsCtrl, world));

    // Use VOX for all enemy types. keepExisting:false removes procedural mesh immediately.
    let voxKey = "bot";
    if (kind === "boss") voxKey = "boss";
    else if (kind === "brute") voxKey = "brute";
    else if (kind === "bomber") voxKey = "bomber";
    else if (kind === "sniper") voxKey = "sniper";
    else if (kind === "summoner") voxKey = "summoner";
    else if (kind === "ranged") voxKey = "ranged";
    else if (kind === "sprinter") voxKey = "sprinter";
    else if (kind === "shielder") voxKey = "shielder";
    else if (kind === "anchor" || kind === "resonator" || kind === "observer" || kind === "reaper") voxKey = "bot";
    attachVOXSkin(root, voxKey, { keepExisting: false, replace: true });

    const id = nextId++;
    let hpMax = BASE_HP + (wave - 1) * 5;
    let speed = BASE_SPEED + (wave - 1) * 0.08;
    let damage = BASE_DMG;
    let xpVal = 1 + Math.floor((wave - 1) * 0.2);

    if (kind === "ranged"){
      hpMax = RANGED_HP + (wave - 1) * 5;
      speed = RANGED_SPEED + (wave - 1) * 0.05;
      damage = RANGED_DMG + (wave - 1) * 1.0;
      xpVal = 2 + Math.floor((wave - 1) * 0.25);
    }
    if (kind === "brute"){
      hpMax = (BASE_HP*3.2) + (wave - 1) * 16;
      speed = (BASE_SPEED*0.55) + (wave - 1) * 0.03;
      damage = (BASE_DMG*2.7) + (wave - 1) * 1.4;
      xpVal = 5 + Math.floor((wave - 1) * 0.35);
    }
    if (kind === "sprinter"){
      hpMax = (BASE_HP*0.65) + (wave - 1) * 3;
      speed = (BASE_SPEED*1.75) + (wave - 1) * 0.09;
      damage = (BASE_DMG*0.85) + (wave - 1) * 0.8;
      xpVal = 3 + Math.floor((wave - 1) * 0.25);
    }
    if (kind === "bomber"){
      hpMax = (BASE_HP*0.85) + (wave - 1) * 4;
      speed = (BASE_SPEED*1.30) + (wave - 1) * 0.06;
      damage = (BASE_DMG*3.0) + (wave - 1) * 1.2; // explosion damage
      xpVal = 4 + Math.floor((wave - 1) * 0.30);
    }
    if (kind === "sniper"){
      hpMax = (RANGED_HP*1.10) + (wave - 1) * 5;
      speed = (RANGED_SPEED*0.95) + (wave - 1) * 0.03;
      damage = (RANGED_DMG*2.2) + (wave - 1) * 1.6;
      xpVal = 6 + Math.floor((wave - 1) * 0.40);
    }
    if (kind === "shielder"){
      hpMax = (BASE_HP*1.65) + (wave - 1) * 10;
      speed = (BASE_SPEED*0.95) + (wave - 1) * 0.05;
      damage = (BASE_DMG*1.10) + (wave - 1) * 0.9;
      xpVal = 5 + Math.floor((wave - 1) * 0.30);
    }
    if (kind === "summoner"){
      hpMax = (RANGED_HP*1.35) + (wave - 1) * 8;
      speed = (RANGED_SPEED*0.85) + (wave - 1) * 0.02;
      damage = (RANGED_DMG*1.10) + (wave - 1) * 0.9;
      xpVal = 7 + Math.floor((wave - 1) * 0.45);
    }

    if (kind === "boss"){
      hpMax = BOSS_HP + (wave - 1) * 28;
      speed = BOSS_SPEED + (wave - 1) * 0.02;
      damage = BOSS_DMG + (wave - 1) * 1.8;
      xpVal = 12 + Math.floor((wave - 1) * 0.8);
    }

    let s = rand(0.95, 1.08);
    if (kind === "boss") s *= 1.85;
    if (kind === "brute") s *= 1.35;
    if (kind === "sprinter") s *= 0.90;
    if (kind === "bomber") s *= 1.00;
    if (kind === "sniper") s *= 1.02;
    if (kind === "summoner") s *= 1.10;
    if (kind === "anchor") s *= 1.35;
    if (kind === "resonator") s *= 1.20;
    if (kind === "observer") s *= 1.25;
    if (kind === "reaper") s *= 1.45;
    if (kind === "shielder") s *= 1.12;
    if (kind === "ranged") s *= 0.98;
    root.scale.setScalar(s);

    const enemy = {
      id,
      root,
      baseScale: s,
      radius: (kind === "boss" ? BOSS_RADIUS : ENEMY_RADIUS) * s,
      hp: hpMax,
      hpMax,
      speed,
      kind,
      damage,
      xp: xpVal,
      threat: THREAT[kind] ?? 1.0,
      aggroT: 0,
      broken: false,
      rangedCd: rand(0.2, 0.8),
      summonCd: rand(2.0, 4.0),
      summonT: 0,
      markT: 0,
      markMul: 1.0,
      bleedT: 0,
      bleedDps: 0,
      burnT: 0,
      burnDps: 0,
      shieldFrontMul: (kind === "shielder" ? 0.65 : 1.0),
      // auras / events
      auraR: (kind === "anchor" ? ANCHOR_AURA_R : (kind === "observer" ? OBS_AURA_R : (kind === "resonator" ? RESO_AURA_R : 0))),
      auraRing: null,
      eventT: (kind === "observer" ? OBS_LIFE : (kind === "reaper" ? REAPER_LIFE : 0)),
      charge: 0,
      chargeT: 0,
      rangedT: 0,
      bossLoot: (kind === "boss"),
      bossPhase: (kind === "boss" ? 1 : 0),
      bossNextSpecial: (kind === "boss" ? rand(1.2, 2.2) : 0),
      bossWave: null,
      bossAnchorsT: (kind === "boss" ? rand(1.0, 2.0) : 0),
      bossZoneT: (kind === "boss" ? rand(2.5, 4.0) : 0),
      coreOpenT: 0,
      incomingMul: 1.0,
      attackCd: rand(0.0, 0.25),
      bombT: 0,
      attackPhase: 0, // 0 idle,1 windup,2 swing,3 recover
      attackT: 0,
      hitThisSwing: false,
      model
    };


    // aura ring visuals (cheap readability)
    if (kind === "anchor" || kind === "observer" || kind === "resonator"){
      try{
        const r0 = enemy.auraR || 0;
        if (r0 > 0.1){
          const geo = new THREE.RingGeometry(r0*0.92, r0*1.02, 32);
          const col = (kind==="anchor") ? 0xffcc55 : (kind==="observer" ? 0xbad6ff : 0x6fffe6);
          const mat = new THREE.MeshBasicMaterial({ color: col, transparent:true, opacity: kind==="observer"?0.18:0.22, depthWrite:false, side:THREE.DoubleSide });
          const ring = new THREE.Mesh(geo, mat);
          ring.rotation.x = -Math.PI/2;
          ring.position.y = 0.05;
          enemy.root.add(ring);
          enemy.auraRing = ring;
        }
      }catch(e2){}
    }

        tintModel(root, kind);

enemies.set(id, enemy);
    group.add(root);
    return enemy;
  }

  function removeEnemy(enemy) {
    enemies.delete(enemy.id);
    group.remove(enemy.root);

    enemy.root.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose?.();
        if (Array.isArray(o.material)) o.material.forEach((m) => m?.dispose?.());
        else o.material?.dispose?.();
      }
    });
  }

  
function countBossAuraAdds(boss){
  // Counts alive aura-type adds that were spawned by this boss instance.
  let n = 0;
  for (const x of enemies.values()){
    if (!x) continue;
    if (x.spawnedByBoss && x.bossRef === boss && (x.kind === "anchor" || x.kind === "resonator" || x.kind === "shielder")) n++;
  }
  return n;
}

function spawnBatch(counts){
  const c = counts || {};
  for (const k of Object.keys(c)){
    const n = Math.max(0, Math.floor(c[k]||0));
    for (let i=0;i<n;i++) createEnemy(k);
  }
}

function spawnWave() {
  const isBossWave = (wave % BOSS_EVERY) === 0;

  // --- adaptation (playstyle -> counters)
  const tot = (style.melee + style.arrow + style.spell) || 1e-6;
  const meleeBias = style.melee / tot;
  const rangedBias = (style.arrow + style.spell) / tot;
  const aoeRate = (style.samples > 1e-6) ? (style.aoe / style.samples) : 0;
  api.playstyle = { meleeBias, rangedBias, aoeRate, avgDist: style.avgDist||0 };

  // baseline special spawns
  let anchorsN = (wave >= 4) ? Math.floor(1 + wave/10) : 0;
  let resonatorsN = (wave >= 5) ? Math.floor(wave/10) : 0;

  // adapt: counter dominant patterns (soft, not punitive)
  if (wave >= 4){
    if (meleeBias > 0.58){
      anchorsN += 1;
      // more shielders -> flanking matters
      // (handled later via composition tweak)
    }
    if (rangedBias > 0.62){
      // add extra sprinters by waveType tweak below
      // and slightly increase Reaper chance
    }
    if (aoeRate > 0.32){
      resonatorsN += 1;
    }
  }

  // cap
  anchorsN = Math.min(3, anchorsN);
  resonatorsN = Math.min(3, resonatorsN);

  // Event chances (enemy-events): Observer + Reaper
  let obsChance = (wave >= 4 && !isBossWave) ? 0.22 : 0.0;
  let reaperChance = (wave >= 6 && !isBossWave) ? 0.16 : 0.0;
  if (rangedBias > 0.62) reaperChance += 0.08; // counters kite
  if (meleeBias > 0.58) obsChance += 0.06; // adds priority target
  obsChance = Math.min(0.42, obsChance);
  reaperChance = Math.min(0.34, reaperChance);


  // wave archetypes: make waves more readable
  const types = ["mixed", "pressure", "ranged", "chaos"];
  // Boss waves lean into pressure
  if (isBossWave) waveType = "pressure";
  else {
    // weights evolve with wave number
    const wMixed = 0.42;
    const wPressure = 0.20 + Math.min(0.12, wave * 0.01);
    const wRanged = 0.20 + Math.min(0.12, Math.max(0, wave-3) * 0.015);
    const wChaos = 0.18;
    const r = Math.random() * (wMixed + wPressure + wRanged + wChaos);
    if (r < wMixed) waveType = "mixed";
    else if (r < wMixed + wPressure) waveType = "pressure";
    else if (r < wMixed + wPressure + wRanged) waveType = "ranged";
    else waveType = "chaos";
  }

  let n = 4 + Math.min(20, wave * 2); // base count grows
  if (isBossWave) n = Math.max(7, Math.floor(n * 0.70));

  // composition by wave
  let ranged = 0, snipers = 0, summoners = 0, brutes = 0, sprinters = 0, shielders = 0, bombers = 0;

  if (wave >= 2) sprinters = Math.floor(n * 0.18);
  if (wave >= 3) ranged    = Math.floor(n * (wave < 8 ? 0.22 : 0.28));
  if (wave >= 4) brutes    = Math.floor(n * 0.10);
  if (wave >= 5) shielders = Math.floor(n * 0.10);
  if (wave >= 6) bombers   = Math.floor(n * 0.08);
  if (wave >= 7) snipers   = Math.floor(n * 0.06);
  if (wave >= 8) summoners = Math.floor(n * 0.05);

  // normalize so we don't exceed n
  let used = ranged+snipers+summoners+brutes+sprinters+shielders+bombers;
  if (used > n){
    const scale = n/used;
    ranged    = Math.floor(ranged*scale);
    snipers   = Math.floor(snipers*scale);
    summoners = Math.floor(summoners*scale);
    brutes    = Math.floor(brutes*scale);
    sprinters = Math.floor(sprinters*scale);
    shielders = Math.floor(shielders*scale);
    bombers   = Math.floor(bombers*scale);
    used = ranged+snipers+summoners+brutes+sprinters+shielders+bombers;
  }
  const melee = Math.max(0, n - used);

  // Apply wave archetype tweaks (composition)
  if (waveType === "pressure"){
    // more brutes/shielders, fewer ranged
    brutes = Math.min(n, brutes + Math.floor(n * 0.10));
    shielders = Math.min(n, shielders + Math.floor(n * 0.08));
    ranged = Math.max(0, ranged - Math.floor(n * 0.10));
    snipers = Math.max(0, snipers - Math.floor(n * 0.03));
  } else if (waveType === "ranged"){
    ranged = Math.min(n, ranged + Math.floor(n * 0.18));
    snipers = Math.min(n, snipers + Math.floor(n * 0.04));
    summoners = Math.min(n, summoners + Math.floor(n * 0.03));
    bombers = Math.max(0, bombers - Math.floor(n * 0.03));
  } else if (waveType === "chaos"){
    bombers = Math.min(n, bombers + Math.floor(n * 0.10));
    sprinters = Math.min(n, sprinters + Math.floor(n * 0.08));
    ranged = Math.max(0, ranged - Math.floor(n * 0.08));
    summoners = Math.max(0, summoners - Math.floor(n * 0.03));
  }

  // Playstyle counter-tweaks (light adaptation)
  if (wave >= 4){
    if (meleeBias > 0.58){
      shielders = Math.min(n, shielders + Math.floor(n * 0.06));
      brutes = Math.min(n, brutes + Math.floor(n * 0.04));
      ranged = Math.max(0, ranged - Math.floor(n * 0.04));
    }
    if (rangedBias > 0.62){
      sprinters = Math.min(n, sprinters + Math.floor(n * 0.08));
      bombers = Math.min(n, bombers + Math.floor(n * 0.04));
      // slightly reduce ranged density so fights don't become turret wars
      ranged = Math.max(0, ranged - Math.floor(n * 0.03));
    }
    if (aoeRate > 0.32){
      // AoE builds get more "fuse" targets, but resonators punish sloppy AoE
      sprinters = Math.min(n, sprinters + Math.floor(n * 0.04));
    }
  }

  // Renormalize after archetype adjustments
  used = ranged+snipers+summoners+brutes+sprinters+shielders+bombers;
  if (used > n){
    const scale2 = n/used;
    ranged    = Math.floor(ranged*scale2);
    snipers   = Math.floor(snipers*scale2);
    summoners = Math.floor(summoners*scale2);
    brutes    = Math.floor(brutes*scale2);
    sprinters = Math.floor(sprinters*scale2);
    shielders = Math.floor(shielders*scale2);
    bombers   = Math.floor(bombers*scale2);
    used = ranged+snipers+summoners+brutes+sprinters+shielders+bombers;
  }
  const melee2 = Math.max(0, n - used);


  // spawn positional / anti-synergy enemies first so the arena "shape" is set
  // NOTE: we no longer spawn everything instantly. We build a wave batch plan and spawn 1st batch now.
  const batches = [];

  // Positional shapers are always in the first batch (so the arena reads immediately).
  const first = { counts: {} };
  if (anchorsN > 0) first.counts.anchor = anchorsN;
  if (resonatorsN > 0) first.counts.resonator = resonatorsN;

  // timed event enemies (observer/reaper) at wave start
  if (!activeObserver && Math.random() < obsChance){
    activeObserver = true;
    first.counts.observer = 1;
  }
  if (!activeReaper && Math.random() < reaperChance){
    activeReaper = true;
    first.counts.reaper = 1;
  }

  // Boss wave: boss first, then reinforcements in later batches
  if (isBossWave){
    first.counts.boss = 1;
    batches.push(first);
    const adds = Math.min(10, 3 + Math.floor(wave/4));
    batches.push({ counts: { sprinter: Math.floor(adds*0.60), ranged: Math.floor(adds*0.25), melee: Math.floor(adds*0.15) }});
    if (wave >= 14) batches.push({ counts: { brute: 1, shielder: 1 }});
  } else {
    // Non-boss wave: split composition into 2-3 batches.
    const bN = Math.min(3, 2 + Math.floor((wave-1)/8)); // waves 1-8 =>2, 9+ =>3
    function split(x){
      if (bN === 2){
        const a = Math.floor(x*0.62);
        return [a, Math.max(0, x-a), 0];
      }
      const a = Math.floor(x*0.50);
      const b = Math.floor(x*0.30);
      const c = Math.max(0, x-a-b);
      return [a,b,c];
    }

    const [me1,me2,me3] = split(melee2);
    const [sp1,sp2,sp3] = split(sprinters);
    const [br1,br2,br3] = split(brutes);
    const [sh1,sh2,sh3] = split(shielders);
    const [bo1,bo2,bo3] = split(bombers);
    const [ra1,ra2,ra3] = split(ranged);
    const [sn1,sn2,sn3] = split(snipers);
    const [su1,su2,su3] = split(summoners);

    // add to first batch
    Object.assign(first.counts, { melee:me1, sprinter:sp1, brute:br1, shielder:sh1, bomber:bo1, ranged:ra1, sniper:sn1, summoner:su1 });
    batches.push(first);

    // second batch
    batches.push({ counts: { melee:me2, sprinter:sp2, brute:br2, shielder:sh2, bomber:bo2, ranged:ra2, sniper:sn2, summoner:su2 }});

    // third batch (late waves)
    if (bN === 3){
      batches.push({ counts: { melee:me3, sprinter:sp3, brute:br3, shielder:sh3, bomber:bo3, ranged:ra3, sniper:sn3, summoner:su3 }});
    }
  }

  waveBatchPlan = { batches, idx: 0 };

  // spawn first batch immediately
  spawnBatch(batches[0].counts);

  api.count = enemies.size;
  api.wave = wave;
  api.waveType = waveType;
}

function forEachInRadius
(pos, r, fn) {
    for (const enemy of enemies.values()) {
      const dx = enemy.root.position.x - pos.x;
      const dz = enemy.root.position.z - pos.z;
      const reach = enemy.radius + r;
      if ((dx * dx + dz * dz) <= reach * reach) {
        fn({
          id: enemy.id,
          root: enemy.root,
          pos: enemy.root.position,
          radius: enemy.radius,
          hp: enemy.hp,
          hpMax: enemy.hpMax
        });
      }
    }
  }

  // firstHit has two modes for backward compatibility:
  // 1) firstHit(pos, dir, maxDist)  -> ray-like hit (used by some older weapon code)
  // 2) firstHit(pos, radius)        -> sphere hit at a point (used by projectiles)
  function firstHit(pos, dirOrRadius, maxDist = 0) {
    // --- Mode 2: sphere hit (projectiles) ---
    if (typeof dirOrRadius === "number") {
      const r = dirOrRadius;
      let best = null;
      for (const enemy of enemies.values()) {
        const dx = enemy.root.position.x - pos.x;
        const dz = enemy.root.position.z - pos.z;
        const reach = enemy.radius + r;
        const d2 = dx * dx + dz * dz;
        if (d2 <= reach * reach) {
          if (!best || d2 < best.d2) best = { d2, id: enemy.id, root: enemy.root };
        }
      }
      return best
        ? { id: best.id, root: best.root, position: best.root.position.clone(), dist: Math.sqrt(best.d2) }
        : null;
    }

    // --- Mode 1: ray-like hit ---
    const dir = dirOrRadius;
    let best = null;
    const d = (dir && typeof dir.clone === "function") ? dir.clone().setY(0) : new THREE.Vector3(0, 0, -1);
    if (d.lengthSq() < 1e-6) return null;
    d.normalize();

    for (const enemy of enemies.values()) {
      const to = enemy.root.position.clone().sub(pos);
      to.y = 0;
      const t = to.dot(d);
      if (t < 0 || t > maxDist) continue;

      const closest = pos.clone().addScaledVector(d, t);
      const dx = enemy.root.position.x - closest.x;
      const dz = enemy.root.position.z - closest.z;

      if ((dx * dx + dz * dz) <= enemy.radius * enemy.radius) {
        if (!best || t < best.t) best = { t, id: enemy.id, root: enemy.root, point: closest.clone() };
      }
    }
    return best
      ? { id: best.id, root: best.root, position: best.point || best.root.position.clone(), dist: best.t }
      : null;
  }

  function applyDamage(id, dmg, meta = {}) {
    const e = enemies.get(id);
    if (!e) return { killed: false, xp: 0 };

    // Mark: increases damage taken for a short time (bow perk)
    if (meta?.mark && meta.mark.mul){
      e.markT = Math.max(e.markT || 0, meta.mark.dur || 3.0);
      e.markMul = Math.max(e.markMul || 1.0, meta.mark.mul || 1.15);
    }

    // DOTs
    if (meta?.bleed && (meta.bleed.dps || meta.bleed.dur)){
      e.bleedT = Math.max(e.bleedT || 0, meta.bleed.dur || 2.0);
      e.bleedDps = Math.max(e.bleedDps || 0, meta.bleed.dps || 6.0);
    }
    if (meta?.burn && (meta.burn.dps || meta.burn.dur)){
      e.burnT = Math.max(e.burnT || 0, meta.burn.dur || 2.0);
      e.burnDps = Math.max(e.burnDps || 0, meta.burn.dps || 6.0);
    }

    // Shielder: reduces frontal damage (unless crushed by heavy weapon)
    if (e.kind === "shielder" && e.shieldFrontMul < 1 && meta?.srcPos && !meta?.crushShield){
      const ep = e.root.position;
      const toPlayer = player?.position ? player.position.clone().sub(ep) : new THREE.Vector3(0,0,1);
      toPlayer.y = 0;
      if (toPlayer.lengthSq() > 1e-6) toPlayer.normalize();
      const toSrc = meta.srcPos.clone ? meta.srcPos.clone().sub(ep) : new THREE.Vector3(meta.srcPos.x-ep.x, 0, meta.srcPos.z-ep.z);
      toSrc.y = 0;
      if (toSrc.lengthSq() > 1e-6) toSrc.normalize();
      // if attacker is in front hemisphere
      const frontal = clamp(toPlayer.dot(toSrc), -1, 1) > 0.25;
      if (frontal) dmg *= e.shieldFrontMul;
    }

    // Apply mark multiplier to incoming damage (after shield)
    if ((e.markT || 0) > 0 && (e.markMul || 1) > 1){
      dmg *= e.markMul;
    }

    // Boss: dynamic incoming damage multiplier (anchors / core windows)
    if (e.kind === "boss" && typeof e.incomingMul === "number") dmg *= e.incomingMul;

    e.hp -= dmg;

    // Stun (e.g. Hammer Earthshaker Slam)
    if (meta?.stun && e.kind !== "boss") {
      e.stunT = Math.max(e.stunT || 0, meta.stun);
      e.attackPhase = 0;
      e.attackT = 0;
      e.attackCd = Math.max(e.attackCd || 0, meta.stun + 0.4);
      const weaponArm = (e.kind === "brute") ? (e.root.armL || e.root.voxMesh?.armL) : (e.root.armR || e.root.voxMesh?.armR);
      if (weaponArm) weaponArm.rotation.set(0, 0, 0);
    }

    // Stagger (interrupt enemy attack windup on heavy hits)
    if (meta?.stagger && e.attackPhase === 1 && e.kind !== "boss") {
      e.attackPhase = 0;
      e.attackT = 0;
      e.attackCd = Math.max(e.attackCd || 0, meta.stagger);
      const weaponArm = (e.kind === "brute") ? (e.root.armL || e.root.voxMesh?.armL) : (e.root.armR || e.root.voxMesh?.armR);
      if (weaponArm) weaponArm.rotation.set(0, 0, 0);
    }

    // Knockback (push enemy away physically)
    if (meta?.knockback && meta?.knockDir && e.kind !== "boss") {
      const kb = meta.knockback;
      e.root.position.x += meta.knockDir.x * kb;
      e.root.position.z += meta.knockDir.z * kb;
      if (world?.bounds) {
        e.root.position.x = clamp(e.root.position.x, world.bounds.minX + 0.6, world.bounds.maxX - 0.6);
        e.root.position.z = clamp(e.root.position.z, world.bounds.minZ + 0.6, world.bounds.maxZ - 0.6);
      }
    }

    // Getting hit makes enemy briefly more aggressive (prevents poke->kite loop)
    e.aggroT = Math.max(e.aggroT || 0, 1.4);

    // Low-HP feedback once
    if (!e.broken && e.hp > 0 && e.hp < e.hpMax * 0.30){
      e.broken = true;
      try {
        // darken slightly + add warm tint
        e.root.traverse((o)=>{
          if (o && o.isMesh && o.material && o.material.color){
            o.material.color.multiplyScalar(0.82);
            o.material.color.r = Math.min(1, o.material.color.r + 0.10);
          }
        });
        const pt = meta?.point ? meta.point : e.root.position.clone().add(new THREE.Vector3(0, 1.0, 0));
        fx?.addHit?.(pt, "break", 1.25);
      } catch(e2) {}
    }


    // Visual feedback: any hit on an enemy spawns a short impact effect.
    // (This is the main readability cue instead of ground arcs.)
    try {
      const pt = meta?.point ? meta.point : e.root.position.clone().add(new THREE.Vector3(0, 1.05, 0));
      const k  = meta?.kind || meta?.damageKind || "generic";
      fx?.addHit?.(pt, k, meta?.splash ? 1.15 : 1.0);
    } catch(e2) {}

    if (e.hp <= 0) {
      const xp = e.xp;
      // style tracking
      noteKill(meta, e.root?.position);
      if (e.kind === "observer") activeObserver = false;
      if (e.kind === "reaper") activeReaper = false;
      // resonator charge: nearby deaths empower resonators (anti-synergy vs AoE)
      try{
        const deathPos = e.root?.position;
        if (deathPos){
          for (const rr of enemies.values()){
            if (rr.kind !== "resonator") continue;
            const d = rr.root.position.distanceTo(deathPos);
            if (d <= (rr.auraR || RESO_AURA_R)){
              rr.charge = Math.min(6, (rr.charge||0) + 1);
              rr.chargeT = Math.max(rr.chargeT||0, 3.0);
              // visual pulse
              if (rr.auraRing?.material){ rr.auraRing.material.opacity = 0.35; }
            }
          }
        }
      }catch(e2){}
      removeEnemy(e);
      api.count = enemies.size;
      return { killed: true, xp, bossLoot: !!e.bossLoot, kind: e.kind };
    }
    return { killed: false, xp: 0 };
  }

  function damage(id, dmg, meta = {}) {
    return applyDamage(id, dmg, meta);
  }

  function tick(dt) {
    if (portalsCtrl) portalsCtrl.tick(dt);

    // wave spawner
    spawnCooldown -= dt;

    // If a wave has pending batches, spawn them before advancing wave counter.
    if (enemies.size === 0 && spawnCooldown <= 0 && waveBatchPlan && waveBatchPlan.batches && waveBatchPlan.batches.length > 0 && waveBatchPlan.idx < waveBatchPlan.batches.length - 1){
      waveBatchPlan.idx++;
      spawnBatch(waveBatchPlan.batches[waveBatchPlan.idx].counts);
      spawnCooldown = 1.35;
    }

    // When no pending batches remain, start next wave.
    if (enemies.size === 0 && spawnCooldown <= 0 && (!waveBatchPlan || !waveBatchPlan.batches || waveBatchPlan.batches.length === 0 || waveBatchPlan.idx >= waveBatchPlan.batches.length - 1)) {
      // reward for clearing previous wave
      if (wave > 1 && progression?.onWaveComplete) progression.onWaveComplete(wave - 1);
      waveBatchPlan = null;
      spawnWave();
      spawnCooldown = 2.6; // slightly longer breather for longer runs
      wave += 1;
    }

    if (!player?.position) return;
    const ppos = player.position;

    const temp = [];
    for (const enemy of enemies.values()) temp.push(enemy);

    // arena threat: used to slightly tune intensity and some timings
    let arenaThreat = 0;
    for (const e of temp) arenaThreat += (e.threat || 1);
    api.arenaThreat = arenaThreat;
    const pressure = clamp(arenaThreat / 14, 0, 1);

    

    // boss telegraphs / timed hazards
    tickBossFX(dt);
// ---- positional auras (anchors) affect player + enemies
    let arenaMoveMul = 1.0;
    let arenaDmgMul = 1.0;
    // Track nearest aura sources
    const anchors = temp.filter(e => e.kind === "anchor");
    const observers = temp.filter(e => e.kind === "observer");
    // apply debuff to player if inside anchor aura(s)
    for (const a of anchors){
      const d = a.root.position.distanceTo(ppos);
      if (d <= (a.auraR || ANCHOR_AURA_R)){
        arenaMoveMul *= 0.75;
        arenaDmgMul  *= 0.85;
      }
    }
    // cap so it never becomes unplayable
    arenaMoveMul = Math.max(0.55, arenaMoveMul);
    arenaDmgMul  = Math.max(0.60, arenaDmgMul);

    if (progression?.stats){
      progression.stats.arenaMoveSpeedMul = arenaMoveMul;
      progression.stats.arenaDamageMul = arenaDmgMul;
    }

    const pFwd = player.forward ? player.forward() : new THREE.Vector3(0,0,-1);
    pFwd.y = 0;
    const pFL = Math.sqrt(pFwd.x*pFwd.x + pFwd.z*pFwd.z) || 1e-6;
    pFwd.multiplyScalar(1/pFL);

    function pingFromEnemy(epos, kind){
      if (!hud?.addPing) return;
      const dx = epos.x - ppos.x;
      const dz = epos.z - ppos.z;
      const d = Math.sqrt(dx*dx + dz*dz) || 1e-6;
      const ux = dx/d, uz = dz/d;
      const dot = clamp(pFwd.x*ux + pFwd.z*uz, -1, 1);
      const cross = pFwd.x*uz - pFwd.z*ux;
      const ang = Math.atan2(cross, dot);
      hud.addPing(ang, 1.0, kind || "ranged");
    }

    for (const e of temp) {
      // vector to player
      const dxp = ppos.x - e.root.position.x;
      const dzp = ppos.z - e.root.position.z;
      const dist = Math.sqrt(dxp*dxp + dzp*dzp) || 1e-6;


      // ---------------- Boss brain (phases + specials) ----------------
      if (e.kind === "boss"){
        // Phase thresholds by HP
        const hp01 = (e.hpMax > 1e-6) ? (e.hp / e.hpMax) : 0;
        let phase = 1;
        if (hp01 <= 0.65) phase = 2;
        if (hp01 <= 0.25) phase = 3;
        if (e.bossPhase !== phase){
          e.bossPhase = phase;
          // small announcement / feedback
          try{
            fx?.addShockwave?.(e.root.position.clone(), 1.8);
            hud?.flashBossPhase?.(phase);
          }catch(e2){}
        }

        // Boss shield from active anchors (encourages killing anchors)
        const aliveAnchors = anchors.length;
        e.incomingMul = Math.max(0.45, 1.0 - 0.18 * aliveAnchors);
        if (e.coreOpenT > 0) e.incomingMul = 1.35; // vulnerable window

        // Core glow feedback
        if (e.model?.coreMeshes){
          const openK = (e.coreOpenT > 0) ? 1 : 0;
          for (const cm of e.model.coreMeshes){
            if (cm?.material){
              cm.material.emissiveIntensity = 1.35 + openK*1.1 + 0.35*Math.sin((ctx.engine?.time||0)*8 + e.id);
            }
          }
        }

        // Extra boss cosmetics (halo/orbs/rune) — purely visual
        try{
          const t = (ctx.engine?.time||0);
          if (e.model?.crown){
            e.model.crown.rotation.y = t * 0.9 + e.id*0.1;
            e.model.crown.position.y = 2.12 + 0.04*Math.sin(t*2.2 + e.id);
          }
          if (e.model?.orbs){
            e.model.orbs.rotation.y = -t * 1.1;
            e.model.orbs.position.y = 1.25 + 0.03*Math.sin(t*3.0);
          }
          if (e.model?.maceRune?.material){
            e.model.maceRune.material.emissiveIntensity = 0.9 + 0.6*Math.sin(t*6.0);
          }
          if (e.model?.reactorCoils){
            for (let k=0;k<e.model.reactorCoils.length;k++){
              const c = e.model.reactorCoils[k];
              if (c?.material) c.material.emissiveIntensity = 1.0 + 0.35*Math.sin(t*5.0 + k*1.7);
            }
          }
        }catch(e2){}

        // Timers
        e.bossNextSpecial -= dt;
        e.bossAnchorsT -= dt;
        e.bossZoneT -= dt;
        if (e.coreOpenT > 0) e.coreOpenT = Math.max(0, e.coreOpenT - dt);

        // Phase 1: energy ring + anchors
        if (e.bossPhase === 1){
          if (e.bossAnchorsT <= 0){
            e.bossAnchorsT = 7.0 + rand(-1.0, 1.2);
            // spawn 2 anchors around boss (slightly offset)
            for (let k=0;k<2;k++){
            if (countBossAuraAdds(e) >= 2) break;
            const a = createEnemy("anchor");
            if (a){
              a.spawnedByBoss = true; a.bossRef = e;
const ang = (Math.PI*2) * (k/2) + rand(-0.25,0.25);
                a.root.position.set(
                  clamp(e.root.position.x + Math.cos(ang)*6.2, world.bounds.minX+1.0, world.bounds.maxX-1.0),
                  0,
                  clamp(e.root.position.z + Math.sin(ang)*6.2, world.bounds.minZ+1.0, world.bounds.maxZ-1.0)
                );
              }
            }
          }

          if (e.bossNextSpecial <= 0){
            e.bossNextSpecial = 4.6 + rand(-0.6, 0.8);

            // Telegraph: ring charge (visual) + then expanding damage wave.
            const center = e.root.position.clone();
            addGroundRing(center, 0.45, 1.35, 0xff3b6a, 0.85, 0.35);
            // schedule wave object: expands outward
            e.bossWave = { r:1.0, sp: 11.5, thick:0.85, hit:false, dmg: e.damage*1.05 };
            // Audio/FX nudge
            try{ fx?.addImpact?.(center.clone().add(new THREE.Vector3(0,1.1,0)), 1.2, 0xff3b6a); }catch(e2){}
          }
        }

        // Phase 2: control zones + elites + occasional wave
        if (e.bossPhase === 2){
          if (e.bossZoneT <= 0){
            e.bossZoneT = 5.2 + rand(-0.8, 1.0);
            // spawn 3 hazard discs near player but not too close
            for (let i=0;i<3;i++){
              const ang = rand(0, Math.PI*2);
              const rr = rand(3.5, 7.5);
              const pos = new THREE.Vector3(
                clamp(ppos.x + Math.cos(ang)*rr, world.bounds.minX+1.0, world.bounds.maxX-1.0),
                0,
                clamp(ppos.z + Math.sin(ang)*rr, world.bounds.minZ+1.0, world.bounds.maxZ-1.0)
              );
              addGroundDisc(pos, 1.35, 0x00b7ff, 1.15);
              // store detonation marker as ring telegraph (reuse)
              bossFX.telegraphs.push({ mesh:null, t:1.15, t0:1.15, kind:"det", data:{ pos, r:1.45, dmg:e.damage*0.85, done:false } });
            }
            // spawn 2 elites (sprinter + ranged) to force priorities
            const a1 = createEnemy("sprinter"); if (a1) a1.root.position.copy(e.root.position.clone().add(new THREE.Vector3(rand(-2.5,2.5),0,rand(-2.5,2.5))));
            const a2 = createEnemy("ranged");   if (a2) a2.root.position.copy(e.root.position.clone().add(new THREE.Vector3(rand(-2.5,2.5),0,rand(-2.5,2.5))));
          }

          if (e.bossNextSpecial <= 0){
            e.bossNextSpecial = 5.2 + rand(-0.6, 1.0);
            const center = e.root.position.clone();
            addGroundRing(center, 0.55, 1.55, 0xff4aa6, 0.75, 0.35);
            e.bossWave = { r:1.0, sp: 12.5, thick:0.90, hit:false, dmg: e.damage*1.10 };
          }
        }

        // Phase 3: "core open" windows after a slam
        if (e.bossPhase === 3){
          if (e.bossNextSpecial <= 0 && e.coreOpenT <= 0){
            e.bossNextSpecial = 6.0 + rand(-0.8, 1.1);

            // Slam telegraph: big ring that collapses -> explosion
            const center = e.root.position.clone();
            addGroundRing(center, 0.75, 4.2, 0xff3b6a, 1.05, 0.0);

            // Use det marker to apply damage after telegraph
            bossFX.telegraphs.push({ mesh:null, t:1.05, t0:1.05, kind:"slam", data:{ pos:center.clone(), r:4.0, dmg:e.damage*1.35, done:false, boss:e } });
          }
        }

        // Resolve boss wave damage if active
        if (e.bossWave){
          const w = e.bossWave;
          w.r += w.sp * dt;
          // visual ring
          addGroundRing(e.root.position, w.r - w.thick*0.5, w.r + w.thick*0.5, 0xff3b6a, 0.12, 0.0);
          if (!w.hit){
            const pd = Math.sqrt(dxp*dxp + dzp*dzp);
            if (Math.abs(pd - w.r) <= (w.thick*0.55)){
              // if player is jumping high enough, allow dodging
              const jumping = (ppos.y || 0) > 0.28;
              if (!jumping){
                player.applyDamage?.(w.dmg);
              }
              w.hit = true;
            }
          }
          if (w.r > 28) e.bossWave = null;
        }
      }

      // per-enemy dynamic multipliers (auras, charges, etc.)
      let spMul = 1.0;
      let dmgMul = 1.0;

      // event lifetime
      if ((e.kind === "observer" || e.kind === "reaper") && e.eventT > 0){
        e.eventT = Math.max(0, e.eventT - dt);
        if (e.eventT <= 0){
          // despawn event enemy
          try{
            const pos = e.root.position.clone();
            fx?.addShatter?.(pos, 1.35, e.kind==="observer"?0xcfe1ff:0xdddddd);
          }catch(e2){}
          if (e.kind === "observer") activeObserver = false;
          if (e.kind === "reaper") activeReaper = false;
          removeEnemy(e);
          api.count = enemies.size;
          continue;
        }
      }

      // Anchor aura buffs enemies inside; Observer aura buffs enemies inside
      for (const a of anchors){
        const adx = a.root.position.x - e.root.position.x;
        const adz = a.root.position.z - e.root.position.z;
        const ad = Math.sqrt(adx*adx + adz*adz);
        if (ad <= (a.auraR || ANCHOR_AURA_R)){
          spMul *= 1.20;
          dmgMul *= 1.20;
          break;
        }
      }
      for (const o of observers){
        const odx = o.root.position.x - e.root.position.x;
        const odz = o.root.position.z - e.root.position.z;
        const od = Math.sqrt(odx*odx + odz*odz);
        if (od <= (o.auraR || OBS_AURA_R)){
          spMul *= 1.15;
          dmgMul *= 1.15;
          break;
        }
      }

      // Resonator charge buffs itself strongly; decays over time
      if (e.kind === "resonator"){
        if (e.chargeT > 0){
          e.chargeT = Math.max(0, e.chargeT - dt);
        } else if ((e.charge||0) > 0){
          e.charge = Math.max(0, (e.charge||0) - dt*1.2);
        }
        const c = Math.max(0, e.charge||0);
        if (c > 0){
          spMul *= (1.0 + 0.12*Math.min(6,c));
          dmgMul *= (1.0 + 0.10*Math.min(6,c));
          // pulse ring
          if (e.auraRing?.material){
            e.auraRing.material.opacity = 0.22 + 0.10*Math.min(1,c/6) + 0.06*Math.sin((ctx.engine?.time||0)*10);
          }
        } else if (e.auraRing?.material){
          e.auraRing.material.opacity = 0.22;
        }
      } else if (e.auraRing?.material){
        // subtle pulse for anchor/observer
        const base = (e.kind==="observer")?0.18:0.22;
        e.auraRing.material.opacity = base + 0.03*Math.sin((ctx.engine?.time||0)*4 + e.id);
      }


// --- status effects ---
if (e.markT > 0) e.markT = Math.max(0, e.markT - dt);
if (e.bleedT > 0){
  e.bleedT = Math.max(0, e.bleedT - dt);
  const bd = (e.bleedDps || 0) * dt;
  if (bd > 0) {
    e.hp -= bd;
    if (e.hp <= 0){
      noteKill({ kind: "melee" }, e.root?.position);
      if (e.kind === "observer") activeObserver = false;
      if (e.kind === "reaper") activeReaper = false;
      progression?.onKill?.(e.xp);
      removeEnemy(e);
      api.count = enemies.size;
      continue;
    }
  }
}
if (e.burnT > 0){
  e.burnT = Math.max(0, e.burnT - dt);
  const bd = (e.burnDps || 0) * dt;
  if (bd > 0) {
    e.hp -= bd;
    if (e.hp <= 0){
      noteKill({ kind: "spell" }, e.root?.position);
      if (e.kind === "observer") activeObserver = false;
      if (e.kind === "reaper") activeReaper = false;
      progression?.onKill?.(e.xp);
      removeEnemy(e);
      api.count = enemies.size;
      continue;
    }
  }
}

      // --- Stun status (stops movement and attacks) ---
      if ((e.stunT || 0) > 0) {
        e.stunT = Math.max(0, e.stunT - dt);
        // Stunned: shudder / tilt slightly, skip movement and attacking
        const vox = e.root.voxMesh || e.root.children.find(c => c.name && c.name.endsWith("_VOX"));
        if (vox) {
          vox.rotation.z = Math.sin(performance.now() * 0.02) * 0.08;
        }
        continue;
      }

      // base desired direction
      let dirx = dxp / dist;
      let dirz = dzp / dist;

      // special behavior: Observer is an "event enemy" that creates a buff zone.
      // It orbits the player and avoids melee engagement.
      if (e.kind === "observer"){
        // keep orbit distance
        const targetR = (e.auraR || OBS_AURA_R) * 0.72; // sits inside its own aura
        const wantApproach = dist > targetR * 1.05;
        const wantRetreat  = dist < targetR * 0.85;

        if (wantRetreat){ dirx *= -1; dirz *= -1; }

        // strafe / orbit
        const strafe = ((e.id & 1) ? 1 : -1);
        const sx = -dirz * strafe;
        const sz =  dirx * strafe;
        if (!wantApproach && !wantRetreat){
          dirx = dirx * 0.10 + sx * 0.90;
          dirz = dirz * 0.10 + sz * 0.90;
        } else {
          dirx = dirx * 0.55 + sx * 0.45;
          dirz = dirz * 0.55 + sz * 0.45;
        }
      }

      // special behavior: Anchor shapes the arena; it doesn't want to hug the player.
      if (e.kind === "anchor"){
        const keep = 4.8;
        if (dist < keep){
          dirx *= -1; dirz *= -1;
        }
      }


      // mild avoidance from other enemies
      let ax = 0, az = 0;
      for (const o of temp) {
        if (o === e) continue;
        const dx = e.root.position.x - o.root.position.x;
        const dz = e.root.position.z - o.root.position.z;
        const d2 = dx * dx + dz * dz;
        const min = (e.radius + o.radius) * 0.9;
        if (d2 > 1e-6 && d2 < min * min) {
          const inv = 1 / Math.sqrt(d2);
          ax += dx * inv;
          az += dz * inv;
        }
      }

      // --- movement by kind ---
      // precompute ranged combat bands so movement + shooting share the same values
      let rr = RANGED_RANGE;
      let rk = RANGED_KEEP;
      if (e.kind === "sniper") { rr = 18.0; rk = 12.0; }
      else if (e.kind === "summoner") { rr = 13.5; rk = 9.0; }

      // during aggro, ranged enemies stop trying to keep perfect distance
      if ((e.aggroT || 0) > 0) rk = 0;

      if (e.kind === "ranged" || e.kind === "sniper" || e.kind === "summoner") {

        // keep distance and strafe
        const wantApproach = dist > rr;
        const wantRetreat  = dist < rk;

        if (wantRetreat) { dirx *= -1; dirz *= -1; }

        // strafe component when in combat band
        if (!wantApproach && !wantRetreat) {
          const strafe = ((e.id & 1) ? 1 : -1);
          const sx = -dirz * strafe;
          const sz =  dirx * strafe;
          dirx = dirx * 0.25 + sx * 0.75;
          dirz = dirz * 0.25 + sz * 0.75;
        }

        // avoidance still matters
        dirx += ax * 0.35;
        dirz += az * 0.35;
      } else {
        // melee / boss approach
        dirx += ax * 0.45;
        dirz += az * 0.45;
      }

      // Column / pillar obstacle avoidance so enemies never get stuck
      if (world?.circles) {
        for (const c of world.circles) {
          const dx = e.root.position.x - c.x;
          const dz = e.root.position.z - c.z;
          const d2 = dx * dx + dz * dz;
          const reach = e.radius + c.r + 1.4;
          if (d2 < reach * reach && d2 > 1e-4) {
            const d = Math.sqrt(d2);
            const push = (1 - d / reach);
            dirx += (dx / d) * push * 1.5;
            dirz += (dz / d) * push * 1.5;
          }
        }
      }

      const dlen = Math.sqrt(dirx*dirx + dirz*dirz) || 1e-6;
      dirx /= dlen; dirz /= dlen;

      // move
      let spdMul = (1 + pressure * 0.08) * spMul;
      if ((e.aggroT || 0) > 0) {
        e.aggroT = Math.max(0, e.aggroT - dt);
        spdMul *= 1.25;
      }
      const spd = e.speed * spdMul;
      e.root.position.x += dirx * spd * dt;
      e.root.position.z += dirz * spd * dt;

      // clamp + solid walls
      e.root.position.x = clamp(e.root.position.x, world.bounds.minX, world.bounds.maxX);
      e.root.position.z = clamp(e.root.position.z, world.bounds.minZ, world.bounds.maxZ);
      if (world?.resolveCircle) world.resolveCircle(e.root.position, e.radius, 2);

      // Solid body-to-body collision with player:
      // Enemies CANNOT clip inside the player's torso/camera!
      const isBoss = (e.kind === "boss");
      const isBrute = (e.kind === "brute");
      const pRad = player.radius ?? 0.55;
      const minPdist = isBoss ? 2.10 : (isBrute ? 1.75 : 1.45);
      const curDxp = e.root.position.x - ppos.x;
      const curDzp = e.root.position.z - ppos.z;
      const curD2 = curDxp * curDxp + curDzp * curDzp;
      if (curD2 < minPdist * minPdist) {
        const curD = Math.sqrt(curD2);
        let nx = curDxp, nz = curDzp;
        if (curD > 1e-4) {
          nx /= curD; nz /= curD;
        } else {
          nx = 0; nz = 1;
        }
        const push = (minPdist - curD) + 1e-4;
        // Two-way collision: enemy is pushed back, and player is stopped from penetrating enemy
        e.root.position.x += nx * push * 0.60;
        e.root.position.z += nz * push * 0.60;
        ppos.x -= nx * push * 0.40;
        ppos.z -= nz * push * 0.40;
        if (world?.bounds) {
          ppos.x = clamp(ppos.x, world.bounds.minX, world.bounds.maxX);
          ppos.z = clamp(ppos.z, world.bounds.minZ, world.bounds.maxZ);
        }
      }

      // Recompute distance & vector to player after separation
      const sepDxp = ppos.x - e.root.position.x;
      const sepDzp = ppos.z - e.root.position.z;
      const sepDist = Math.hypot(sepDxp, sepDzp) || 1e-6;

      // face player (safe distance >= 1.45m ensures lookAt is 100% stable!)
      e.root.lookAt(ppos.x, e.root.position.y, ppos.z);

      // Articulated limb references (supports VOX skeletal rig and procedural models)
      const armL = e.root.armL || e.root.voxMesh?.armL || e.model?.armL;
      const armR = e.root.armR || e.root.voxMesh?.armR || e.model?.armR;
      const legL = e.root.legL || e.root.voxMesh?.legL || e.model?.legL;
      const legR = e.root.legR || e.root.voxMesh?.legR || e.model?.legR;
      const head = e.root.head || e.root.voxMesh?.head || e.model?.head;
      const torso = e.root.torso || e.root.voxMesh?.torso || e.model?.torso;

      // Walk / stride locomotion
      const t = performance.now() * 0.007 + e.id * 1.5;
      const spdRatio = clamp(spd / BASE_SPEED, 0.4, 2.2);
      const step = Math.sin(t * spdRatio) * 0.55;

      if (legL) legL.rotation.x = -step;
      if (legR) legR.rotation.x = step;

      // Natural arm swing during locomotion when not attacking
      if (e.attackPhase === 0) {
        if (armL) {
          armL.rotation.x = step * 0.85;
          armL.rotation.z = 0.06;
          armL.rotation.y = 0;
        }
        if (armR) {
          armR.rotation.x = -step * 0.85;
          armR.rotation.z = -0.06;
          armR.rotation.y = 0;
        }
        if (torso) {
          torso.rotation.y = 0;
          torso.rotation.z = 0;
        }
      }

      // Stable upright body: ZERO whole-body rocking/swaying/wobble!
      const vox = e.root.voxMesh || e.root.children.find(c => c.name && c.name.endsWith("_VOX"));
      if (vox) {
        vox.position.y = 0;
        vox.position.z = 0;
        vox.rotation.z = 0; // ZERO rocking side-to-side
        vox.rotation.x = 0; // ZERO bobbing
        vox.rotation.y = 0;
      }

      // --- RANGED/SNIPER/SUMMONER: shoot / summon ---
      if (e.kind === "ranged" || e.kind === "sniper" || e.kind === "summoner") {
        if (e.kind === "summoner"){
          e.summonCd -= dt;
          if (e.summonCd <= 0){
            e.summonCd = 5.0 + rand(-0.8, 0.8);
            // summon 1 sprinter near portal (or near summoner)
            const baby = createEnemy("sprinter");
            if (baby) baby.root.position.copy(e.root.position.clone().add(new THREE.Vector3(rand(-1.4,1.4),0,rand(-1.4,1.4))));
          }
        }

        e.rangedCd -= dt;
        if (e.rangedCd <= 0 && dist <= rr * 1.05) {
          const baseCd = (e.kind === "sniper") ? 2.6 : (e.kind === "summoner" ? 2.1 : RANGED_COOLDOWN);
          e.rangedCd = baseCd + rand(-0.25, 0.35);

          // spawn slow blue orb toward player
          if (projectiles?.spawn) {
            const origin = e.root.position.clone().add(new THREE.Vector3(0, 1.15, 0));
            const dir = new THREE.Vector3(dxp / dist, 0, dzp / dist).normalize();
            projectiles.spawn({
              kind: "enemyOrb",
              team: "enemy",
              origin,
              dir,
              speed: (e.kind === "sniper") ? 10.5 : (e.kind === "summoner" ? 8.4 : RANGED_PROJECTILE_SPEED),
              life: (e.kind === "sniper") ? 3.0 : 2.6,
              damage: e.damage * dmgMul,
              radius: 0.26,
              splash: 0,
              pierce: 0
            });
            pingFromEnemy(e.root.position, e.kind === "sniper" ? "sniper" : (e.kind === "summoner" ? "summoner" : "ranged"));
          }
        }
        continue;
      }

// --- BOMBER: wind-up explosion (telegraphed) ---
if (e.kind === "bomber"){
  const triggerDist = 2.2 + e.radius;
  const boomDist = 2.6 + e.radius;

  // start wind-up when close enough
  if (dist < triggerDist && (e.bombT || 0) <= 0){
    e.bombT = 0.75; // seconds to detonate
    if (hud?.addPing){
      pingFromEnemy(e.root.position, "bomber");
    }
  }

  // during wind-up: stop and "pulse"
  if ((e.bombT || 0) > 0){
    e.bombT -= dt;

    // readable pulse
    const pulse = 1 + 0.08 * Math.sin((0.75 - e.bombT) * 18);
    e.root.scale.setScalar((e.baseScale || 1) * pulse);

    if (e.bombT <= 0){
      // detonate only if player is still nearby
      if (dist < boomDist){
        player.applyDamage?.(e.damage * dmgMul);
        fx?.addImpact?.(e.root.position.clone().add(new THREE.Vector3(0,1.0,0)), 2.2);
        removeEnemy(e);
        api.count = enemies.size;
        continue;
      } else {
        // aborted: reset scale and allow chase
        e.bombT = 0;
        e.root.scale.setScalar(e.baseScale || 1);
      }
    }
    // don't do melee attack logic while charging
    continue;
  }
}


      // Observer has no melee attack; its danger is positional.
      if (e.kind === "observer") continue;

      // --- MELEE / BOSS attack ---
      const isSprinter = (e.kind === "sprinter");
      const isShielder = (e.kind === "shielder");
      const isReaper = (e.kind === "reaper");
      const atkRange = ((isBoss ? 1.95 : ATTACK_RANGE) + e.radius) * (isBrute ? 1.15 : 1) * (isSprinter ? 0.95 : 1) * (isReaper ? 1.25 : 1);
      const atkArc = isBoss ? (ATTACK_ARC_DEG + 10) : ATTACK_ARC_DEG;
      const windup = isBoss ? (ATTACK_WINDUP + 0.12) : (isSprinter ? (ATTACK_WINDUP*0.75) : (isBrute ? (ATTACK_WINDUP*1.15) : ATTACK_WINDUP));
      const swing  = isBoss ? (ATTACK_SWING + 0.06)  : (isSprinter ? (ATTACK_SWING*0.85) : ATTACK_SWING);
      const recover= isBoss ? (ATTACK_RECOVER + 0.20): (isSprinter ? (ATTACK_RECOVER*0.85) : (isBrute ? (ATTACK_RECOVER*1.10) : ATTACK_RECOVER));
      const cdBase = isBoss ? (ATTACK_COOLDOWN + 0.40) : (isSprinter ? (ATTACK_COOLDOWN*0.80) : (isBrute ? (ATTACK_COOLDOWN*1.10) : ATTACK_COOLDOWN));

      // melee attack: windup -> swing -> recover
      if (e.attackPhase === 0 || e.attackPhase === 3) e.attackCd -= dt;

      const toPnx = sepDxp / sepDist;
      const toPnz = sepDzp / sepDist;

      // enemy forward (after lookAt)
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(e.root.quaternion);
      fwd.y = 0;
      const fLen = Math.sqrt(fwd.x * fwd.x + fwd.z * fwd.z) || 1e-6;
      fwd.multiplyScalar(1 / fLen);

      const dot = clamp(fwd.x * toPnx + fwd.z * toPnz, -1, 1);
      const angDeg = Math.acos(dot) * 180 / Math.PI;

      // At point-blank / touching distance (sepDist <= minPdist + 0.45m),
      // the enemy is in direct melee contact with player and MUST attack relentlessly!
      const isTouching = (sepDist <= minPdist + 0.45);
      const canInitiate = (sepDist < atkRange) && (isTouching || (angDeg < atkArc));

      if (e.attackPhase === 0 && e.attackCd <= 0 && canInitiate) {
        e.attackPhase = 1;
        e.attackT = 0;
        e.hitThisSwing = false;
      }

      if (e.attackPhase !== 0) {
        e.attackT += dt;

        // Weapon arm detection: Brute holds sword in armL and shield in armR; others swing with armR
        const isLeftHandedWeapon = (e.kind === "brute");
        const weaponArm = isLeftHandedWeapon ? armL : armR;
        const shieldArm = isLeftHandedWeapon ? armR : armL;
        const sideSign = isLeftHandedWeapon ? -1 : 1;

        if (e.attackPhase === 1) { // windup
          const a = clamp(e.attackT / windup, 0, 1);
          if (weaponArm) {
            weaponArm.rotation.x = -0.6 - a * 1.15; // raise sword arm back & high
            weaponArm.rotation.z = sideSign * (-0.15 - a * 0.25);
            weaponArm.rotation.y = sideSign * (a * 0.25);
          }
          if (shieldArm) {
            shieldArm.rotation.x = 0.35 + a * 0.20; // shield arm guards the chest
            shieldArm.rotation.z = sideSign * 0.20;
          }
          if (torso) {
            torso.rotation.y = sideSign * (-a * 0.20); // torso winds back
          }

          if (e.attackT >= windup) { e.attackPhase = 2; e.attackT = 0; }
        } else if (e.attackPhase === 2) { // swing / slash
          const a = clamp(e.attackT / swing, 0, 1);
          if (weaponArm) {
            weaponArm.rotation.x = -1.75 + a * 2.85; // powerful downward sword slash forward
            weaponArm.rotation.z = sideSign * (-0.40 + a * 0.50);
            weaponArm.rotation.y = sideSign * (0.25 - a * 0.45);
          }
          if (shieldArm) {
            shieldArm.rotation.x = 0.55 - a * 0.25; // shield maintains forward guard
            shieldArm.rotation.z = sideSign * 0.15;
          }
          if (torso) {
            torso.rotation.y = sideSign * (-0.20 + a * 0.35); // torso follows the sword strike
          }

          if (!e.hitThisSwing && a >= 0.40 && a <= 0.80) {
            const hitRange = (isBoss ? 2.35 : 1.70) + e.radius;
            const playerRadius = player.radius ?? 0.55;

            // recompute angle window
            const dot2 = clamp(fwd.x * toPnx + fwd.z * toPnz, -1, 1);
            const ang2 = Math.acos(dot2) * 180 / Math.PI;
            const canHit = isTouching || (ang2 < (atkArc + 25));

            if (sepDist < hitRange + playerRadius && canHit) {
              player.applyDamage?.(e.damage * dmgMul);
              e.hitThisSwing = true;
            }
          }

          if (e.attackT >= swing) { e.attackPhase = 3; e.attackT = 0; }
        } else if (e.attackPhase === 3) { // recover
          const a = clamp(e.attackT / recover, 0, 1);
          if (weaponArm) {
            weaponArm.rotation.x = 1.10 * (1 - a);
            weaponArm.rotation.z = sideSign * (0.10 * (1 - a));
            weaponArm.rotation.y = sideSign * (-0.20 * (1 - a));
          }
          if (shieldArm) {
            shieldArm.rotation.x = 0.25 * (1 - a);
            shieldArm.rotation.z = sideSign * (0.10 * (1 - a));
          }
          if (torso) {
            torso.rotation.y = sideSign * (0.15 * (1 - a));
          }

          if (e.attackT >= recover) {
            e.attackPhase = 0;
            e.attackT = 0;
            // Short recovery downtime so melee enemies attack relentlessly at point-blank
            e.attackCd = cdBase * 0.35;
            if (torso) torso.rotation.y = 0;
            if (weaponArm) weaponArm.rotation.set(0, 0, 0);
            if (shieldArm) shieldArm.rotation.set(0, 0, 0);
          }
        }
      }
    }

    api.count = enemies.size;
    api.wave = Math.max(1, wave - 1);
  }


  // public API (shape main/weapons expects)
  const api = {
    tick,
    group,
    createEnemy,
    count: 0,
    wave: 1,
    waveType: "mixed",
    arenaThreat: 0,
    forEachInRadius,
    firstHit,
    applyDamage,
    damage
  };

  return api;
}