import * as THREE from "three";
import { clamp } from "../core/math.js";
import { createPixelWoodTexture } from "./textures.js";

// ВНИМАНИЕ: это файл-замена. Тут ОДНО объявление spawnProjectile (без дубля).

export function createWeapons({ engine, input, player, world, fx, progression=null }) {
  const { camera } = engine;

  // === ВАРИАНТ "НОРМАЛЬНЫЙ FPS" ===
  const HAND_X = 0.30;
  const HAND_Y = -0.28;
  const HAND_Z = -0.45;
  const MODEL_SCALE = 0.44;

  const hand = new THREE.Group();
  hand.position.set(HAND_X, HAND_Y, HAND_Z);
  hand.rotation.set(0.10, 0.0, -0.10);
  camera.add(hand);

  const baseHandPos = hand.position.clone();
  const baseHandRot = hand.rotation.clone();

  let weapon = null;
  let weaponName = "—";
  let model = null;

  // refs for bow viewmodel animation
  const bowAnim = {
    stringLine: null,
    stringGeo: null,
    arrow: null,
    tipTop: new THREE.Vector3(0, 0.78, 0.00),
    tipBot: new THREE.Vector3(0, -0.22, 0.00),
    nock: new THREE.Vector3(0, 0.28, 0.03),
    muzzle: null
  };

  // refs for staff viewmodel animation
  const staffAnim = {
    crystal: null,
    crystalMat: null,
    muzzle: null
  };

  
  function getStats(){
    return (progression && progression.stats) ? progression.stats : null;
  }
  const weaponsState = {};
let cd = 0,
    swingT = 0,
    swingMax = 0,
    castT = 0,
    bowCharging = false,
    bowCharge = 0;

  // spear combo state
  let comboStep = 0;
  let comboGrace = 0;
  let comboQueued = false;
  let prevMouseDown = false;
  let spearHitSet = new Set();

  // spear hit-streak (damage reward for consecutive hits)
  let spearStreak = 0;
  let spearStreakT = 0;

  // === ВАЖНО: объявлено ОДИН РАЗ ===
  let spawnProjectile = null;

  const defs = {
    spear: { name: "Копьё", hint: "Ближний бой. Тычки и отмах древком.", meleeRange: 3.2, dmg: 32, rate: 1.8, arc: 1.25 },
    bow: { name: "Лук", hint: "Дальний бой. Удерживай ЛКМ — заряд, отпусти — выстрел.", dmgMin: 22, dmgMax: 56, chargeTime: 0.85, speed: 24 },
    // Посох: медленный большой взрывной шар (чтобы читалось и было "опасно")
    staff: { name: "Посох", hint: "Магия. Медленная взрывная сфера с высоким уроном.", dmg: 34, rate: 1.35, speed: 9.0, splash: 2.20 }
  };

  function list() { return Object.keys(defs); }
  function def(id) { return defs[id]; }
  function hasWeapon(id) {
    if (id === undefined) return !!weapon;
    return !!defs[id];
  }

  function box(w, h, d, x, y, z, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  }

  function safeCloneVec3(v) {
    if (!v) return new THREE.Vector3();
    const x = Number(v.x) || 0, y = Number(v.y) || 0, z = Number(v.z) || 0;
    return new THREE.Vector3(x, y, z);
  }

  function buildModel(w) {
    if (model) hand.remove(model);

    const woodTex = createPixelWoodTexture();
    woodTex.repeat.set(1, 4);

    const metal = new THREE.MeshStandardMaterial({ color: 0xdfe9ff, roughness: 0.55, metalness: 0.25 });
    const wood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85 });

    model = new THREE.Group();

    if (w === "spear") {
      // Копьё (FPS): ГОРИЗОНТАЛЬНО вдоль Z.
      const g = new THREE.Group();

      const spearWoodTex = createPixelWoodTexture();
      spearWoodTex.repeat.set(1, 8);

      const metal3 = new THREE.MeshStandardMaterial({ color: 0xd8e4fc, roughness: 0.40, metalness: 0.45 });
      const darkWood = new THREE.MeshStandardMaterial({ map: spearWoodTex, roughness: 0.88 });
      const wrap = new THREE.MeshStandardMaterial({ color: 0x33241b, roughness: 0.95 });

      // Древко: цилиндр по умолчанию вдоль Y, поворачиваем чтобы стало вдоль Z
      const SHAFT_LEN = 1.65;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.034, SHAFT_LEN, 8), darkWood);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.set(0, 0.02, -0.88);
      g.add(shaft);

      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.040, 0.34, 8), wrap);
      grip.rotation.x = Math.PI / 2;
      grip.position.set(0, 0.02, -0.18);
      g.add(grip);

      const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.18, 8), metal3);
      socket.rotation.x = Math.PI / 2;
      socket.position.set(0, 0.02, -1.62);
      g.add(socket);

      // Листовидный наконечник (вдоль Z)
      g.add(box(0.07, 0.04, 0.24, 0, 0.02, -1.78, metal3));
      g.add(box(0.05, 0.03, 0.18, 0, 0.02, -1.92, metal3));
      g.add(box(0.03, 0.02, 0.10, 0, 0.02, -2.02, metal3));
      g.add(box(0.012, 0.012, 0.30, 0, 0.035, -1.90, metal3));

      g.scale.set(1.22, 1.22, 1.22);
      model.add(g);

      model.rotation.set(0.02, 0.06, -0.10);
      model.position.set(0.14, -0.10, 0.05);
    }

    if (w === "bow") {
      bowAnim.stringLine = null;
      bowAnim.stringGeo = null;
      bowAnim.arrow = null;
      bowAnim.muzzle = null;

      const g = new THREE.Group();
      const limbMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.88 });

      // цельная дуга
      const X = 0.16;
      const curvePts = [
        new THREE.Vector3(X, -0.20, -0.06),
        new THREE.Vector3(X, 0.02, 0.08),
        new THREE.Vector3(X, 0.26, 0.10),
        new THREE.Vector3(X, 0.50, 0.08),
        new THREE.Vector3(X, 0.78, -0.06)
      ];
      const curve = new THREE.CatmullRomCurve3(curvePts);
      const tube = new THREE.TubeGeometry(curve, 24, 0.028, 8, false);
      g.add(new THREE.Mesh(tube, limbMat));

      // рукоять
      g.add(box(0.08, 0.22, 0.08, X, 0.28, -0.02, wood));

      bowAnim.tipBot.set(X, -0.20, -0.06);
      bowAnim.tipTop.set(X, 0.78, -0.06);
      bowAnim.nock.set(X + 0.02, 0.28, -0.02);

      const tipGeo = new THREE.BoxGeometry(0.030, 0.030, 0.050);
      const tipTop = new THREE.Mesh(tipGeo, metal);
      const tipBot = new THREE.Mesh(tipGeo, metal);
      tipTop.position.copy(bowAnim.tipTop);
      tipBot.position.copy(bowAnim.tipBot);
      g.add(tipTop); g.add(tipBot);

      bowAnim.stringGeo = new THREE.BufferGeometry();
      bowAnim.stringGeo.setFromPoints([bowAnim.tipTop.clone(), bowAnim.nock.clone(), bowAnim.tipBot.clone()]);
      bowAnim.stringLine = new THREE.Line(
        bowAnim.stringGeo,
        new THREE.LineBasicMaterial({ color: 0xdddddd })
      );
      g.add(bowAnim.stringLine);

      const arrowMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.018, 0.018, 0.34),
        new THREE.MeshStandardMaterial({ color: 0xe7eefc, roughness: 0.55, metalness: 0.12 })
      );
      arrowMesh.position.set(bowAnim.nock.x, bowAnim.nock.y, bowAnim.nock.z + 0.11);
      arrowMesh.rotation.y = Math.PI;
      arrowMesh.visible = false;
      bowAnim.arrow = arrowMesh;

      bowAnim.muzzle = new THREE.Object3D();
      bowAnim.muzzle.position.set(0, 0, 0.19);
      arrowMesh.add(bowAnim.muzzle);
      g.add(arrowMesh);

      g.scale.set(2.05, 2.05, 2.05);
      model.add(g);

      model.rotation.set(0.05, Math.PI * 0.99, -0.18);
      model.position.set(0.16, 0.05, 0.03);
    }

    if (w === "staff") {
      staffAnim.crystal = null;
      staffAnim.crystalMat = null;
      staffAnim.muzzle = null;

      const g = new THREE.Group();

      const darkWood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.90 });
      const metal2 = new THREE.MeshStandardMaterial({ color: 0xc7ceda, roughness: 0.35, metalness: 0.55 });
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0xff4455,
        emissive: 0xff1122,
        emissiveIntensity: 1.35,
        roughness: 0.25,
        metalness: 0.05
      });

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.05, 10), darkWood);
      shaft.position.set(0.02, 0.35, -0.02);
      g.add(shaft);

      const butt = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.10, 10), metal2);
      butt.position.set(0.02, -0.17, -0.02);
      g.add(butt);

      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.060, 0.010, 8, 18), metal2);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0.02, 0.05 + i * 0.22, -0.02);
        g.add(ring);
      }

      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.060, 0.075, 0.16, 10), metal2);
      head.position.set(0.02, 0.90, -0.02);
      g.add(head);

      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), crystalMat);
      crystal.position.set(0.02, 1.02, -0.02);
      g.add(crystal);

      const muzzle = new THREE.Object3D();
      muzzle.position.set(0.02, 1.02, -0.18);
      g.add(muzzle);

      staffAnim.crystal = crystal;
      staffAnim.crystalMat = crystalMat;
      staffAnim.muzzle = muzzle;

      g.scale.set(1.55, 1.55, 1.55);
      model.add(g);

      model.rotation.set(0.04, Math.PI * 0.98, -0.14);
      model.position.set(0.16, 0.02, 0.03);
    }

    model.scale.setScalar(MODEL_SCALE);
    hand.add(model);
  }

  function setBowPull(p) {
    if (!bowAnim.stringGeo || !bowAnim.stringLine) return;

    const pull = clamp(p, 0, 1);
    bowAnim.nock.z = -0.02 - 0.22 * pull;

    if (bowAnim.arrow) {
      bowAnim.arrow.visible = pull > 0.01;
      bowAnim.arrow.position.set(bowAnim.nock.x, bowAnim.nock.y, bowAnim.nock.z + 0.11);
    }

    bowAnim.stringGeo.setFromPoints([bowAnim.tipTop.clone(), bowAnim.nock.clone(), bowAnim.tipBot.clone()]);
    bowAnim.stringGeo.attributes.position.needsUpdate = true;
  }

  function fireBow() {
    if (!spawnProjectile) return;
    const p = clamp(bowCharge / defs.bow.chargeTime, 0.12, 1);
    cd = 0.45 + 0.55 * p;

    const origin = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    camera.getWorldDirection(camDir).normalize();

    if (bowAnim.muzzle && typeof bowAnim.muzzle.getWorldPosition === "function") bowAnim.muzzle.getWorldPosition(origin);
    else origin.copy(camPos);

    const aimPoint = camPos.clone().addScaledVector(camDir, 80);
    const dir = aimPoint.clone().sub(origin).normalize();

    spawnProjectile({
      kind: "arrow",
      origin,
      dir,
      speed: defs.bow.speed * (getStats()?.projectileSpeedMul ?? 1),
      life: 1.6,
      damage: (defs.bow.dmgMin + (defs.bow.dmgMax - defs.bow.dmgMin) * p) * ((getStats()?.damageMul ?? 1) * (getStats()?.arenaDamageMul ?? 1)),
      radius: 0.18,
      splash: (getStats()?.extraSplash ?? 0),
      pierce: ((getStats()?.bowPierce ?? 0))
    });

    // optional multishot relic (chance-based)
    const ms = (getStats()?.bowMultishot ?? 0);
    if (ms > 0 && Math.random() < 0.22 + 0.06*ms) {
      const spread = 0.10;
      const yawL = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), -spread);
      const yawR = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),  spread);
      const dL = dir.clone().applyQuaternion(yawL).normalize();
      const dR = dir.clone().applyQuaternion(yawR).normalize();
      spawnProjectile({
        kind: "arrow",
        origin: origin.clone(),
        dir: dL,
        speed: defs.bow.speed * (getStats()?.projectileSpeedMul ?? 1),
        life: 1.55,
        damage: (defs.bow.dmgMin + (defs.bow.dmgMax - defs.bow.dmgMin) * p) * 0.72 * ((getStats()?.damageMul ?? 1) * (getStats()?.arenaDamageMul ?? 1)),
        radius: 0.18,
        splash: (getStats()?.extraSplash ?? 0),
        pierce: ((getStats()?.bowPierce ?? 0))
      });
      spawnProjectile({
        kind: "arrow",
        origin: origin.clone(),
        dir: dR,
        speed: defs.bow.speed * (getStats()?.projectileSpeedMul ?? 1),
        life: 1.55,
        damage: (defs.bow.dmgMin + (defs.bow.dmgMax - defs.bow.dmgMin) * p) * 0.72 * ((getStats()?.damageMul ?? 1) * (getStats()?.arenaDamageMul ?? 1)),
        radius: 0.18,
        splash: (getStats()?.extraSplash ?? 0),
        pierce: ((getStats()?.bowPierce ?? 0))
      });
    }
  }

  function fireStaff() {
    if (!spawnProjectile) return;

    const origin = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    camera.getWorldDirection(camDir).normalize();

    if (staffAnim?.muzzle) staffAnim.muzzle.getWorldPosition(origin);
    else origin.copy(camPos);

    const aimPoint = camPos.clone().addScaledVector(camDir, 60);
    const dir = aimPoint.sub(origin).normalize();

    spawnProjectile({
      kind: "spell",
      origin,
      dir,
      speed: defs.staff.speed * (getStats()?.projectileSpeedMul ?? 1),
      // slower, bigger, heavier
      life: 1.60,
      damage: defs.staff.dmg * ((getStats()?.damageMul ?? 1) * (getStats()?.arenaDamageMul ?? 1)) * (getStats()?.staffDamageMul ?? 1),
      radius: 0.34,
      splash: Math.max(defs.staff.splash, (getStats()?.extraSplash ?? 0)),
      pierce: (getStats()?.projectilePierce ?? 0)
    });
  }

  const spearCombos = [
    { dur: 0.34, dmgMul: 1.10, arc: 0.55, rangeMul: 1.25, active: [0.18, 0.48],
      anim(p) {
        const s = Math.sin(p * Math.PI);
        hand.rotation.x = baseHandRot.x - 0.10 * s;
        hand.rotation.y = baseHandRot.y;
        hand.rotation.z = baseHandRot.z;
        hand.position.set(baseHandPos.x, baseHandPos.y + 0.01 * s, baseHandPos.z - 0.26 * s);
      }
    },
    { dur: 0.28, dmgMul: 0.85, arc: 0.55, rangeMul: 1.20, active: [0.16, 0.42],
      anim(p) {
        const s = Math.sin(p * Math.PI);
        hand.rotation.x = baseHandRot.x - 0.06 * s;
        hand.rotation.y = baseHandRot.y + 0.04 * Math.sin(p * Math.PI * 2);
        hand.rotation.z = baseHandRot.z;
        hand.position.set(baseHandPos.x, baseHandPos.y + 0.005 * s, baseHandPos.z - 0.22 * s);
      }
    },
    { dur: 0.44, dmgMul: 1.00, arc: 1.35, rangeMul: 0.95, active: [0.22, 0.58],
      anim(p) {
        const s = Math.sin(p * Math.PI);
        hand.rotation.x = baseHandRot.x - 0.18 * s;
        hand.rotation.y = baseHandRot.y + 1.05 * s;
        hand.rotation.z = baseHandRot.z + 0.06 * s;
        hand.position.copy(baseHandPos);
      }
    }
  ];

  function startSpearSwing(stepIdx) {
    const s = spearCombos[stepIdx] || spearCombos[0];
    comboStep = stepIdx;
    swingMax = s.dur;
    swingT = swingMax;
    cd = 0;
    comboGrace = 0.65;
    comboQueued = false;
    spearHitSet = new Set();
    // consume one-shot radius boost on swing start
    const st = getStats();
    if (st && (st.spearNextRadiusT || 0) > 0) st.spearNextRadiusT = 0;
    spearStreak = 0; spearStreakT = 0;
    // trail telegraph spawns once per swing
    weaponsState.spearTrailSpawned = false;
  }

  function equip(w) {
    if (!defs[w]) w = "spear";
    weapon = w;
    weaponName = defs[w].name;

    cd = 0; swingT = 0; castT = 0; bowCharge = 0; bowCharging = false;
    comboStep = 0; comboGrace = 0; comboQueued = false;
    spearHitSet = new Set();
    spearStreak = 0; spearStreakT = 0;

    buildModel(w);
    if (w === "bow") setBowPull(0);
  }

  function tick(dt) {
    if (!weapon) return;
    cd = Math.max(0, cd - dt);

    const mouseDown = !!input?.mouse?.down;
    const justPressed = mouseDown && !prevMouseDown;
    prevMouseDown = mouseDown;

    if (comboGrace > 0) comboGrace = Math.max(0, comboGrace - dt);
    if (spearStreakT > 0) {
      spearStreakT = Math.max(0, spearStreakT - dt);
      if (spearStreakT === 0) spearStreak = 0;
    }

    const st0 = getStats();
    if (st0 && (st0.spearNextRadiusT || 0) > 0) st0.spearNextRadiusT = Math.max(0, st0.spearNextRadiusT - dt);

    if (weapon === "spear") {
      if (swingT > 0) {
        swingT -= dt;
        const p = 1 - swingT / swingMax;
        const s = spearCombos[comboStep] || spearCombos[0];
        s.anim(p);

        if (justPressed && p > 0.55 && p < 0.92) comboQueued = true;

        if (swingT <= 0) {
          swingT = 0;
          // miss -> break streak
          if (spearHitSet.size === 0) spearStreak = 0;
          if (comboQueued) startSpearSwing((comboStep + 1) % spearCombos.length);
        }
      } else {
        hand.rotation.copy(baseHandRot);
        hand.position.copy(baseHandPos);

        if (comboGrace <= 0) comboStep = 0;

        if (justPressed && cd <= 0) startSpearSwing(comboStep);
      }
    }

    if (weapon === "bow") {
      if (input.mouse.down) {
        bowCharging = true;
        bowCharge = Math.min(defs.bow.chargeTime, bowCharge + dt);
        setBowPull(bowCharge / defs.bow.chargeTime);
      } else if (bowCharging) {
        bowCharging = false;
        if (cd <= 0) fireBow();
        bowCharge = 0;
        setBowPull(0);
      } else {
        setBowPull(0);
      }
    }

    if (weapon === "staff") {
      const CAST_DUR = 0.22;
      if (castT > 0) {
        castT = Math.max(0, castT - dt);
        const p = 1 - (castT / CAST_DUR);

        hand.rotation.x = 0.10 - 0.20 * Math.sin(p * Math.PI);
        hand.rotation.z = -0.10 - 0.18 * Math.sin(p * Math.PI);
        hand.rotation.y = 0.02 * Math.sin(p * Math.PI);

        if (staffAnim?.crystalMat) staffAnim.crystalMat.emissiveIntensity = 1.0 + 1.6 * Math.sin(p * Math.PI);
        if (staffAnim?.crystal) {
          staffAnim.crystal.rotation.y += dt * 6.5;
          staffAnim.crystal.rotation.x += dt * 3.0;
        }
      } else {
        hand.rotation.copy(baseHandRot);
        hand.position.copy(baseHandPos);
        if (staffAnim?.crystalMat) staffAnim.crystalMat.emissiveIntensity = 1.15;

        if (input.mouse.down && cd <= 0) {
          cd = 1 / (defs.staff.rate * (getStats()?.staffAttackSpeedMul ?? 1));
          castT = CAST_DUR;
          fireStaff();
        }
      }
    }
  }

  function meleeQuery(enemies) {
    if (weapon !== "spear" || swingT <= 0) return;
    const s = spearCombos[comboStep] || spearCombos[0];
    const p = 1 - swingT / swingMax;
    if (p < s.active[0] || p > s.active[1]) return;

    // We rely on impact VFX on hit (for readability) instead of a persistent ground arc.

    const origin = new THREE.Vector3();
    camera.getWorldPosition(origin);

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y *= 0.25;
    dir.normalize();

    if (!enemies || typeof enemies.forEachInRadius !== "function") return;

    const st = getStats();

    const range = defs.spear.meleeRange * (s.rangeMul ?? 1) * (st?.spearReachMul ?? 1);
    const radiusBoost = (st?.spearNextRadiusT > 0) ? (st.spearNextRadiusMul ?? 1.0) : 1.0;
    const rangeBoosted = range * radiusBoost;

    enemies.forEachInRadius(origin, rangeBoosted, (e) => {
      const ep = (e && e.position) || e?.pos || (e.mesh && e.mesh.position);
      if (!ep) return;

      const to = safeCloneVec3(ep).sub(origin);
      to.y = 0;
      if (to.length() > rangeBoosted) return;
      to.normalize();

      const arc = s.arc * (st?.spearArcMul ?? 1);
      if (Math.acos(clamp(to.dot(dir), -1, 1)) > arc) return;

      const id = (e && (e.id ?? e._id ?? e.uuid)) ?? null;
      if (id !== null && spearHitSet.has(id)) return;
      if (id !== null) spearHitSet.add(id);

      let dmg = defs.spear.dmg * s.dmgMul * ((st?.damageMul ?? 1) * (st?.arenaDamageMul ?? 1)) * (st?.spearDamageMul ?? 1);

      // Hit streak: 2nd hit +10%, 3rd+ +20% (resets on miss / pause)
      if (spearStreak > 0){
        const extra = Math.min(Math.max(spearStreak-1, 0), 2) * 0.10;
        dmg *= (1 + extra);
      }

      // Перки/реликвии копья: тяжёлый удар раз в N попаданий
      if (st?.spearHeavyEvery){
        weaponsState.spearHitCounter = (weaponsState.spearHitCounter || 0) + 1;
        if ((weaponsState.spearHitCounter % st.spearHeavyEvery) === 0){
          dmg *= (st.spearHeavyMul ?? 1.6);
        }
      }

      // Реликвия: Пронзание
      if (st?.spearImpaleEvery){
        weaponsState.spearImpaleCounter = (weaponsState.spearImpaleCounter || 0) + 1;
        if ((weaponsState.spearImpaleCounter % st.spearImpaleEvery) === 0){
          dmg *= (st.spearImpaleMul ?? 1.8);
        }
      }

      // register hit for streak
      spearStreak = Math.min(4, spearStreak + 1);
      spearStreakT = 1.0;

      const meta = { kind: "melee", combo: comboStep, srcPos: origin };
      // Кровотечение
      if (st?.spearBleed && Math.random() < (st.spearBleed.chance ?? 0)){
        meta.bleed = st.spearBleed;
      }

      if (typeof enemies.applyDamage === "function") {
        const dealt = enemies.applyDamage(id, dmg, meta);
if (st?.spearLifesteal){
          player.hp = clamp(player.hp + dmg*(st.spearLifesteal||0), 0, player.hpMax);
        }

        if (dealt?.killed && progression?.onKill) {
          progression.onKill(dealt.xp || 0);
          if (dealt.bossLoot && progression.openBossLoot) progression.openBossLoot();
        }
      }

      // Enemy hit VFX is spawned centrally in enemies.applyDamage.
    });
  }

  function bindProjectiles(api) {
    spawnProjectile = api?.spawn || null;
  }

  return {
    list,
    def,
    hasWeapon,
    equip,
    tick,
    meleeQuery,
    bindProjectiles,
    get weapon() { return weapon; },
    get name() { return weaponName; }
  };
}