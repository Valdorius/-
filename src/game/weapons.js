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
    tipTop: new THREE.Vector3(0, 0.74, -0.05),
    tipBot: new THREE.Vector3(0, -0.74, -0.05),
    nock: new THREE.Vector3(0, 0.01, -0.02),
    muzzle: null,
    runeMats: []
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
    spear: { name: "Руническая глефа", hint: "Ближний бой. Колющие выпады и сокрушительный серповидный взмах.", meleeRange: 3.2, dmg: 32, rate: 1.8, arc: 1.25 },
    bow: { name: "Рунический лук", hint: "Дальний бой. Удерживай ЛКМ — натяжение и рунный заряд, отпусти — выстрел.", dmgMin: 22, dmgMax: 56, chargeTime: 0.85, speed: 24 },
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
      // Руническая глефа / копьё-алебарда (FPS): ГОРИЗОНТАЛЬНО вдоль Z.
      const g = new THREE.Group();

      const spearWoodTex = createPixelWoodTexture();
      spearWoodTex.repeat.set(1, 10);

      const darkWood = new THREE.MeshStandardMaterial({ map: spearWoodTex, roughness: 0.88 });
      const wrap = new THREE.MeshStandardMaterial({ color: 0x241812, roughness: 0.95 });
      const steel = new THREE.MeshStandardMaterial({ color: 0xd2dcfa, roughness: 0.35, metalness: 0.55 });
      const darkSteel = new THREE.MeshStandardMaterial({ color: 0x566276, roughness: 0.55, metalness: 0.45 });
      const runeMat = new THREE.MeshStandardMaterial({
        color: 0x00f5ff,
        emissive: 0x00e1ff,
        emissiveIntensity: 1.8,
        roughness: 0.20,
        metalness: 0.15
      });

      // 1. Древко: мощное, прочное
      const SHAFT_LEN = 1.85;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.040, SHAFT_LEN, 8), darkWood);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.set(0, 0.02, -0.32);
      g.add(shaft);

      // 2. Двойная кожаная обмотка хвата с металлическими кольцами
      // Передний хват
      const gripFront = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.32, 8), wrap);
      gripFront.rotation.x = Math.PI / 2;
      gripFront.position.set(0, 0.02, -0.15);
      g.add(gripFront);

      // Задний хват
      const gripRear = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.28, 8), wrap);
      gripRear.rotation.x = Math.PI / 2;
      gripRear.position.set(0, 0.02, 0.35);
      g.add(gripRear);

      // Стальные фиксирующие кольца
      const ringZ = [-0.32, 0.01, 0.20, 0.50];
      for (const rz of ringZ) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.050, 0.050, 0.024, 8), darkSteel);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, 0.02, rz);
        g.add(ring);
      }

      // 3. Кованый затыльник-противовес с задним шипом
      const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.065, 0.09), darkSteel);
      pommel.position.set(0, 0.02, 0.58);
      g.add(pommel);
      const rearSpike = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.09), steel);
      rearSpike.position.set(0, 0.02, 0.65);
      g.add(rearSpike);

      // 4. Стальная посадочная втулка наконечника
      const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.22, 8), darkSteel);
      socket.rotation.x = Math.PI / 2;
      socket.position.set(0, 0.02, -1.02);
      g.add(socket);

      // 5. Центральное колющее остриё (Pike)
      // Основной клинок
      g.add(box(0.086, 0.038, 0.32, 0, 0.02, -1.22, steel));
      // Сужающаяся средняя часть
      g.add(box(0.058, 0.026, 0.24, 0, 0.02, -1.42, steel));
      // Игольчатое остриё
      g.add(box(0.026, 0.014, 0.16, 0, 0.02, -1.56, steel));
      // Продольное ребро жёсткости
      g.add(box(0.016, 0.046, 0.44, 0, 0.02, -1.32, steel));
      // Светящаяся руническая канавка вдоль лезвия
      g.add(box(0.010, 0.048, 0.32, 0, 0.02, -1.30, runeMat));

      // 6. Боковой рубящий серп глефы/алебарды (слева, x < 0)
      // Шейка крепления к втулке
      g.add(box(0.14, 0.036, 0.09, -0.09, 0.02, -1.14, darkSteel));
      // Тело серповидного рубящего лезвия
      g.add(box(0.036, 0.30, 0.34, -0.19, 0.02, -1.24, steel));
      // Верхний клюв серпа
      g.add(box(0.030, 0.044, 0.16, -0.22, 0.15, -1.40, steel));
      // Нижний бородатый шип
      g.add(box(0.030, 0.044, 0.12, -0.22, -0.11, -1.08, steel));
      // Светящаяся дуговая инкрустация на серпе
      g.add(box(0.042, 0.024, 0.24, -0.19, 0.02, -1.24, runeMat));

      // 7. Задний бронебойный клюв-крюк (справа, x > 0)
      g.add(box(0.14, 0.034, 0.06, 0.10, 0.02, -1.12, darkSteel));
      g.add(box(0.034, 0.044, 0.09, 0.18, 0.00, -1.08, steel));

      // 8. Светящийся рунический кристалл в центре втулки
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.052, 0), runeMat);
      gem.position.set(0, 0.02, -1.14);
      g.add(gem);

      // Защитные лапки вокруг кристалла
      g.add(box(0.014, 0.014, 0.08, 0.044, 0.02, -1.14, darkSteel));
      g.add(box(0.014, 0.014, 0.08, -0.044, 0.02, -1.14, darkSteel));

      g.scale.set(1.30, 1.30, 1.30);
      model.add(g);

      model.rotation.set(-0.06, 0.12, -0.22);
      model.position.set(0.18, -0.10, 0.28);
    }

    if (w === "bow") {
      bowAnim.stringLine = null;
      bowAnim.stringGeo = null;
      bowAnim.arrow = null;
      bowAnim.muzzle = null;
      bowAnim.runeMats = [];

      const g = new THREE.Group();

      const bowWoodTex = createPixelWoodTexture();
      bowWoodTex.repeat.set(1, 4);

      const darkWood = new THREE.MeshStandardMaterial({ map: bowWoodTex, roughness: 0.86 });
      const wrap = new THREE.MeshStandardMaterial({ color: 0x221610, roughness: 0.95 });
      const steel = new THREE.MeshStandardMaterial({ color: 0xc4d2e8, roughness: 0.35, metalness: 0.65 });
      const darkSteel = new THREE.MeshStandardMaterial({ color: 0x485264, roughness: 0.60, metalness: 0.45 });
      const runeMat = new THREE.MeshStandardMaterial({
        color: 0x00f5ff,
        emissive: 0x00d8ff,
        emissiveIntensity: 1.2,
        roughness: 0.25,
        metalness: 0.15
      });
      bowAnim.runeMats.push(runeMat);

      // 1. Эргономичная рукоять (ТОНКАЯ, НИКАКИХ ГИГАНТСКИХ КУБОВ!)
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.022, 0.16, 8), wrap);
      g.add(grip);

      // Металлические кольца на рукояти
      const ringTop = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.018, 8), darkSteel);
      ringTop.position.set(0, 0.085, 0);
      g.add(ringTop);
      const ringBot = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.018, 8), darkSteel);
      ringBot.position.set(0, -0.085, 0);
      g.add(ringBot);

      // 2. Верхнее плечо (составное, рекурсивное)
      const u1 = box(0.032, 0.20, 0.028, 0, 0.18, 0.02, darkWood);
      u1.rotation.x = -0.15;
      const u2 = box(0.028, 0.20, 0.024, 0, 0.36, 0.06, darkWood);
      u2.rotation.x = 0.05;
      const u3 = box(0.024, 0.18, 0.020, 0, 0.53, 0.05, darkWood);
      u3.rotation.x = 0.25;
      const u4 = box(0.020, 0.14, 0.018, 0, 0.67, -0.01, darkWood);
      u4.rotation.x = 0.45;
      g.add(u1, u2, u3, u4);

      // Светящиеся руны на верхнем плече
      const ur1 = box(0.018, 0.045, 0.010, 0, 0.25, 0.038, runeMat);
      const ur2 = box(0.016, 0.045, 0.010, 0, 0.38, 0.075, runeMat);
      const ur3 = box(0.014, 0.040, 0.010, 0, 0.51, 0.065, runeMat);
      g.add(ur1, ur2, ur3);

      // Верхний роговой зацеп под тетиву
      const tipTop = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.06, 0.032), steel);
      tipTop.position.set(0, 0.74, -0.05);
      tipTop.rotation.x = 0.55;
      g.add(tipTop);

      // 3. Нижнее плечо (симметричное рекурсивное)
      const d1 = box(0.032, 0.20, 0.028, 0, -0.18, 0.02, darkWood);
      d1.rotation.x = 0.15;
      const d2 = box(0.028, 0.20, 0.024, 0, -0.36, 0.06, darkWood);
      d2.rotation.x = -0.05;
      const d3 = box(0.024, 0.18, 0.020, 0, -0.53, 0.05, darkWood);
      d3.rotation.x = -0.25;
      const d4 = box(0.020, 0.14, 0.018, 0, -0.67, -0.01, darkWood);
      d4.rotation.x = -0.45;
      g.add(d1, d2, d3, d4);

      // Светящиеся руны на нижнем плече
      const dr1 = box(0.018, 0.045, 0.010, 0, -0.25, 0.038, runeMat);
      const dr2 = box(0.016, 0.045, 0.010, 0, -0.38, 0.075, runeMat);
      const dr3 = box(0.014, 0.040, 0.010, 0, -0.51, 0.065, runeMat);
      g.add(dr1, dr2, dr3);

      // Нижний роговой зацеп под тетиву
      const tipBot = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.06, 0.032), steel);
      tipBot.position.set(0, -0.74, -0.05);
      tipBot.rotation.x = -0.55;
      g.add(tipBot);

      // Точки привязки тетивы
      bowAnim.tipTop.set(0, 0.74, -0.05);
      bowAnim.tipBot.set(0, -0.74, -0.05);
      bowAnim.nock.set(0, 0.01, -0.02);

      // 4. Светящаяся магическая тетива
      bowAnim.stringGeo = new THREE.BufferGeometry();
      bowAnim.stringGeo.setFromPoints([bowAnim.tipTop.clone(), bowAnim.nock.clone(), bowAnim.tipBot.clone()]);
      bowAnim.stringLine = new THREE.Line(
        bowAnim.stringGeo,
        new THREE.LineBasicMaterial({ color: 0x88e8ff })
      );
      g.add(bowAnim.stringLine);

      // 5. Настоящая руническая стрела
      const arrowGroup = new THREE.Group();

      // Древко стрелы (от nock z=0 вперед вдоль +Z до наконечника)
      const arrowShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.64, 6), darkWood);
      arrowShaft.rotation.x = Math.PI / 2;
      arrowShaft.position.set(0, 0, 0.32);
      arrowGroup.add(arrowShaft);

      // Стальной гранёный наконечник (впереди, направлен вперед)
      arrowGroup.add(box(0.036, 0.012, 0.08, 0, 0, 0.64, steel));
      arrowGroup.add(box(0.020, 0.008, 0.06, 0, 0, 0.69, steel));
      // Светящийся кристаллический сердечник наконечника
      arrowGroup.add(box(0.016, 0.016, 0.05, 0, 0, 0.64, runeMat));

      // Тройное воксельное оперение (перья) у запятника
      const fletchMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
      arrowGroup.add(box(0.004, 0.036, 0.10, 0, 0.022, 0.08, fletchMat));
      const fL = box(0.032, 0.004, 0.10, -0.018, -0.011, 0.08, fletchMat);
      fL.rotation.z = Math.PI / 6;
      arrowGroup.add(fL);
      const fR = box(0.032, 0.004, 0.10, 0.018, -0.011, 0.08, fletchMat);
      fR.rotation.z = -Math.PI / 6;
      arrowGroup.add(fR);

      // Хвостовик с выемкой под тетиву
      arrowGroup.add(box(0.012, 0.012, 0.025, 0, 0, 0.01, steel));

      // Muzzle (дуло вылета снаряда)
      bowAnim.muzzle = new THREE.Object3D();
      bowAnim.muzzle.position.set(0, 0, 0.72);
      arrowGroup.add(bowAnim.muzzle);

      arrowGroup.position.set(bowAnim.nock.x, bowAnim.nock.y, bowAnim.nock.z);
      arrowGroup.visible = true;
      bowAnim.arrow = arrowGroup;
      g.add(arrowGroup);

      g.scale.set(0.72, 0.72, 0.72);
      model.add(g);

      // Диагональный комфортный боевой хват (видны оба плеча, лук не перекрывает центр экрана)
      model.rotation.set(0.04, Math.PI * 0.98, -0.42);
      model.position.set(0.18, 0.05, -0.08);
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
    bowAnim.nock.z = -0.02 - 0.28 * pull;

    if (bowAnim.arrow) {
      bowAnim.arrow.position.set(bowAnim.nock.x, bowAnim.nock.y, bowAnim.nock.z);
    }

    bowAnim.stringGeo.setFromPoints([bowAnim.tipTop.clone(), bowAnim.nock.clone(), bowAnim.tipBot.clone()]);
    bowAnim.stringGeo.attributes.position.needsUpdate = true;

    // Flare up runic inlays on limbs as bow is drawn
    if (bowAnim.runeMats) {
      const glow = 1.1 + 2.4 * pull;
      for (const m of bowAnim.runeMats) {
        if (m) m.emissiveIntensity = glow;
      }
    }
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
        const p = bowCharge / defs.bow.chargeTime;
        setBowPull(p);
        // Draw animation: bring bow into shooting alignment
        hand.position.set(baseHandPos.x - 0.04 * p, baseHandPos.y + 0.02 * p, baseHandPos.z + 0.04 * p);
        hand.rotation.set(baseHandRot.x - 0.03 * p, baseHandRot.y - 0.02 * p, baseHandRot.z + 0.06 * p);
      } else if (bowCharging) {
        bowCharging = false;
        if (cd <= 0) fireBow();
        bowCharge = 0;
        setBowPull(0);
        hand.position.copy(baseHandPos);
        hand.rotation.copy(baseHandRot);
      } else {
        setBowPull(0);
        hand.position.copy(baseHandPos);
        hand.rotation.copy(baseHandRot);
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
    setBowPull,
    get weapon() { return weapon; },
    get name() { return weaponName; }
  };
}