import * as THREE from "three";
import { clamp } from "../core/math.js";
import { createPixelWoodTexture } from "./textures.js";
import { createFpsArms } from "./fps_arms.js?v=20261030_16";

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
  hand.rotation.set(0.18, -0.05, -0.10);
  camera.add(hand);

  const baseHandPos = hand.position.clone();
  const baseHandRot = hand.rotation.clone();

  // Исходная боевая стойка для тяжелого молота: покоится на правом плече,
  // развернут внутрь к прицелу (видна грань с руной, боёк смотрит вперед в цель)
  const HAMMER_REST_POS = new THREE.Vector3(0.24, -0.27, -0.44);
  const HAMMER_REST_ROT = new THREE.Euler(-0.38, 0.42, -0.24);

  // Боевые позиции для сета "Меч и Щит"
  const SWORD_REST_POS  = new THREE.Vector3(0.24, -0.26, -0.40);
  const SWORD_REST_ROT  = new THREE.Euler(0.15, -0.18, -0.08);

  const SHIELD_REST_POS = new THREE.Vector3(-0.38, -0.48, -0.44);
  const SHIELD_REST_ROT = new THREE.Euler(-0.22, 0.50, -0.28);

  const SHIELD_BLOCK_POS = new THREE.Vector3(-0.04, -0.16, -0.32);
  const SHIELD_BLOCK_ROT = new THREE.Euler(-0.05, 0.05, 0.0);

  const SWORD_BLOCK_POS  = new THREE.Vector3(0.20, -0.28, -0.34);
  const SWORD_BLOCK_ROT  = new THREE.Euler(0.25, -0.10, 0.0);

  // Боевая позиция для авангардного рунического лука
  const BOW_REST_POS = new THREE.Vector3(0.24, -0.25, -0.42);
  const BOW_REST_ROT = new THREE.Euler(0.15, -0.06, -0.08);

  // Боевые позиции для теневых метательных клинков (парный хват)
  const DAGGER_R_REST_POS = new THREE.Vector3(0.22, -0.27, -0.40);
  const DAGGER_R_REST_ROT = new THREE.Euler(0.42, -0.32, 0.18);
  const DAGGER_L_REST_POS = new THREE.Vector3(-0.22, -0.27, -0.40);
  const DAGGER_L_REST_ROT = new THREE.Euler(0.42, 0.32, -0.18);

  // Боевая позиция для рунной ручной мортиры (тяжелое осадное орудие)
  const BOMBARD_REST_POS = new THREE.Vector3(0.18, -0.22, -0.38);
  const BOMBARD_REST_ROT = new THREE.Euler(0.08, -0.06, 0.03);

  // Боевые позиции для магического арсенала Бездны
  const STAFF_REST_POS = new THREE.Vector3(0.24, -0.28, -0.42);
  const STAFF_REST_ROT = new THREE.Euler(0.20, -0.15, 0.08);

  const SCEPTER_REST_POS = new THREE.Vector3(0.22, -0.25, -0.38);
  const SCEPTER_REST_ROT = new THREE.Euler(0.22, -0.18, 0.06);

  const GRIMOIRE_REST_POS = new THREE.Vector3(0.06, -0.25, -0.38);
  const GRIMOIRE_REST_ROT = new THREE.Euler(0.32, -0.10, 0.04);

  // Первоклассный риг воксельных рук от первого лица
  const fpsArms = createFpsArms({ camera });
  fpsArms.setVisible(false);

  // Левая группа оружия (для рыцарского щита)
  const shieldHand = new THREE.Group();
  shieldHand.name = "ShieldHandGroup";
  camera.add(shieldHand);
  shieldHand.visible = false;
  let shieldModel = null;

  const _camWorldQuat = new THREE.Quaternion();
  const _camInvQuat = new THREE.Quaternion();
  const _tmpPosR = new THREE.Vector3();
  const _tmpQuatR = new THREE.Quaternion();
  const _tmpPosL = new THREE.Vector3();
  const _tmpQuatL = new THREE.Quaternion();

  let weapon = null;
  let weaponName = "—";
  let model = null;

  // refs for spear viewmodel animation
  const spearAnim = {
    gripRear: null,
    gripFront: null,
    runeMat: null
  };

  // refs for bow viewmodel animation
  const bowAnim = {
    stringLine: null,
    stringGeo: null,
    arrow: null,
    gripLeft: null,
    gripRight: null,
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
    muzzle: null,
    gripRight: null
  };

  // refs for hammer viewmodel animation
  const hammerAnim = {
    coreMat: null,
    gripRear: null,
    gripFront: null
  };

  // refs for sword and shield viewmodel animation
  const swordAnim = {
    grip: null,
    runeMat: null
  };

  const shieldAnim = {
    grip: null,
    runeMat: null
  };

  // refs for daggers viewmodel animation
  const daggersAnim = {
    gripR: null,
    gripL: null,
    meshR: null,
    meshL: null,
    runeMats: []
  };

  // refs for bombard viewmodel animation
  const bombardAnim = {
    gripRear: null,
    gripFront: null,
    muzzle: null,
    runeMats: []
  };

  // refs for scepter viewmodel animation
  const scepterAnim = {
    gripRight: null,
    muzzle: null,
    prism: null,
    prismMat: null,
    clawGroup: null,
    claws: [],
    runeMats: []
  };

  // refs for grimoire viewmodel animation
  const grimoireAnim = {
    gripRight: null,
    gripLeft: null,
    talisman: null,
    pagesL: null,
    pagesR: null,
    runeMats: []
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

  // spear combo & thrust state
  let comboStep = 0;
  let comboNextStep = 0;
  let comboGrace = 0;
  let comboQueued = false;
  let prevMouseDown = false;
  let spearHitSet = new Set();
  let spearThrustT = 0;
  let spearThrustMax = 0.40;
  let spearThrustCd = 0;
  let spearThrustHitTriggered = false;
  let spearThrustHitSet = new Set();
  let spearCharging = false;
  let spearCharge = 0;
  let spearChargeCommitted = false;
  const SPEAR_CHARGE_MAX = 0.38;

  // hammer state
  let hammerSwingT = 0;
  let hammerSwingMax = 0.52;
  let hammerSwingImpulseFired = false;
  let hammerHitSet = new Set();

  let hammerSlamT = 0;
  let hammerSlamMax = 0.70;
  let hammerSlamCd = 0;
  let hammerSlamHitTriggered = false;

  // sword combo state
  let swordSwingT = 0;
  let swordSwingMax = 0.38;
  let swordComboStep = 0;
  let swordComboNext = 0;
  let swordComboGrace = 0;
  let swordComboQueued = false;
  let swordHitSet = new Set();
  let swordNextHitCrit = false;

  // shield block & bash state
  let shieldBlocking = false;
  let shieldBlockT = 0; // 0..1 smooth transition
  let shieldParryTimer = 999;
  let shieldBashT = 0;
  let shieldBashMax = 0.38;
  let shieldBashHitTriggered = false;
  let shieldBashHitSet = new Set();
  let shieldBashCharging = false;
  let shieldBashCharge = 0;
  let shieldBashCommitted = false;
  const SHIELD_BASH_CHARGE_MAX = 0.35;

  // daggers combat state
  let daggerThrowT = 0;
  let daggerThrowHand = 0; // 0 = right hand, 1 = left hand
  const DAGGER_THROW_DUR = 0.20;
  let daggerFanT = 0;
  let daggerFanCd = 0;
  const DAGGER_FAN_DUR = 0.28;

  // bombard combat state
  let bombardRecoilT = 0;
  const BOMBARD_RECOIL_DUR = 0.38;
  let bombardCanisterT = 0;
  let bombardCanisterCd = 0;
  const BOMBARD_CANISTER_DUR = 0.44;

  // mage combat & spell state
  let mageCastT = 0;
  let mageCastMax = 0.55;
  let staffVortexCd = 0;
  let scepterBeamActive = false;
  let scepterBeamTimer = 0;
  let scepterNovaT = 0;
  let scepterNovaCd = 0;
  let grimoireDomeCd = 0;
  let grimoireCastT = 0;

  // Persistent active spells collections
  const activeVortices = [];
  const activePillars = [];
  const activeMeteors = [];
  const activeDomes = [];

  // Circular SVG charge HUD ring around crosshair
  const ringEl = typeof document !== "undefined" ? document.getElementById("chargeRing") : null;
  const circleEl = typeof document !== "undefined" ? document.getElementById("chargeCircle") : null;
  const CIRCLE_CIRCUMFERENCE = 106.81;

  function setChargeRing(p, color = "#00f0ff") {
    if (!ringEl || !circleEl) return;
    if (p <= 0.005) {
      ringEl.style.opacity = "0";
      return;
    }
    ringEl.style.opacity = "1";
    circleEl.style.stroke = color;
    const offset = Math.max(0, Math.min(CIRCLE_CIRCUMFERENCE, CIRCLE_CIRCUMFERENCE * (1 - p)));
    circleEl.style.strokeDashoffset = offset.toFixed(1);
    if (p >= 0.98) {
      circleEl.style.filter = `drop-shadow(0 0 6px ${color})`;
    } else {
      circleEl.style.filter = "none";
    }
  }

  let prevRightMouseDown = false;
  let lastEnemiesRef = null;

  // camera micro-impulse / tilt for combat impact
  let camImpulseZ = 0; // roll
  let camImpulseX = 0; // pitch

  // spear hit-streak (damage reward for consecutive hits)
  let spearStreak = 0;
  let spearStreakT = 0;

  // === ВАЖНО: объявлено ОДИН РАЗ ===
  let spawnProjectile = null;

  const defs = {
    spear: {
      name: "Руническая глефа",
      hint: "Ближний бой. ЛКМ — рубящие комбо-свипы (3.35м). Удерживай ПКМ — зарядка глубокого выпада (пробитие брони, дальность 4.2м).",
      meleeRange: 3.35,
      dmg: 34,
      rate: 2.0,
      arc: 1.45,
      thrustRange: 4.15,
      thrustDmg: 68
    },
    hammer: { name: "Рунический молот", hint: "Тяжелый сокрушитель. ЛКМ — размашистый сокрушительный свип (стан/нокаут). ПКМ — удар оземь (AoE-землетрясение).", meleeRange: 2.85, dmg: 58, rate: 1.25, arc: 2.30 },
    sword: { name: "Меч и Щит", hint: "Авангард. ЛКМ — серия из 3 ударов. ПКМ — блок (80% защита) и парирование. Удерживай ПКМ+ЛКМ — зарядка удара щитом (стан толпы).", meleeRange: 2.65, dmg: 38, rate: 2.2, arc: 1.60 },
    bow: { name: "Авангардный рунический лук", hint: "Дальний бой. Удерживай ЛКМ — натяжение монолитного лука и рунный заряд, отпусти — выстрел.", dmgMin: 22, dmgMax: 56, chargeTime: 0.85, speed: 24 },
    daggers: {
      name: "Теневые клинки",
      hint: "Парные клинки. ЛКМ — стремительное поочередное метание на бегу (темп 3.4/с). ПКМ — Веер клинков (5 кинжалов дугой, кровотечение).",
      dmg: 28,
      rate: 3.4,
      speed: 34
    },
    bombard: {
      name: "Рунная мортира",
      hint: "Осадное орудие. ЛКМ — навесная осадная бомба (дуга, тяжелый AoE-взрыв и отбрасывание). ПКМ — картечный залп (8 раскаленных осколков).",
      dmg: 80,
      rate: 0.9,
      speed: 20,
      splash: 3.4
    },
    // Посох Бездны: каст по земле Столпа Бездны и Гравитационная воронка
    staff: {
      name: "Посох Бездны",
      hint: "Магия. Удерживай ЛКМ — выбор зоны и каст Столпа Бездны (взмывающий гейзер). ПКМ — гравитационная воронка (стягивает врагов в точку на 4с).",
      dmg: 95,
      splash: 3.6,
      castTime: 0.55
    },
    // Астральный скипетр: непрерывный луч дезинтеграции и импульс аннигиляции
    scepter: {
      name: "Астральный скипетр",
      hint: "Концентрация. Удерживай ЛКМ — непрерывный луч дезинтеграции (быстро плавит врагов). ПКМ — взрывная перегрузка фокуса (отбрасывание толпы).",
      dmgPerSec: 160,
      range: 28
    },
    // Гримуар Катастроф: падение метеорита и купол искажения времени
    grimoire: {
      name: "Гримуар Катастроф",
      hint: "Ритуалы. Удерживай ЛКМ — глубокий каст Звездного Метеорита (гигантский кратер). ПКМ — Купол искажения времени (замедление врагов на 70%).",
      dmg: 140,
      splash: 5.5,
      castTime: 0.85
    }
  };

  let currentClass = "knight";
  const classWeapons = {
    knight: ["hammer", "sword", "spear"],
    ranger: ["bow", "daggers", "bombard"],
    mage:   ["staff", "scepter", "grimoire"]
  };

  function setClass(c) {
    currentClass = (c === "ranger") ? "ranger" : (c === "mage") ? "mage" : "knight";
    if (fpsArms && typeof fpsArms.setClassArms === "function") {
      fpsArms.setClassArms(currentClass);
    }
    const primary = classWeapons[currentClass]?.[0] || "spear";
    equip(primary);
  }

  function getClass() {
    return currentClass;
  }

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

  function buildShieldModel() {
    if (shieldModel) shieldHand.remove(shieldModel);
    shieldModel = new THREE.Group();
    shieldModel.name = "ShieldViewModel";

    const steel = new THREE.MeshStandardMaterial({ color: 0x90a5c0, roughness: 0.30, metalness: 0.88 });
    const edgeSteel = new THREE.MeshStandardMaterial({ color: 0xdde8fc, roughness: 0.18, metalness: 0.95 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x1e2634, roughness: 0.55, metalness: 0.65 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x3d2214, roughness: 0.90, metalness: 0.05 });
    const goldRune = new THREE.MeshStandardMaterial({
      color: 0xffcc22,
      emissive: 0xffaa00,
      emissiveIntensity: 2.5,
      roughness: 0.18,
      metalness: 0.12
    });
    shieldAnim.runeMat = goldRune;

    const sg = new THREE.Group();

    // 1. Каплевидный / тарч корпус щита (слоеные воксельные пластины)
    // Верхняя широкая плита
    sg.add(box(0.44, 0.32, 0.038, 0, 0.14, 0, darkSteel));
    // Средняя сужающаяся плита
    sg.add(box(0.38, 0.28, 0.036, 0, -0.12, 0, darkSteel));
    // Нижняя треугольная клиновидная плита
    sg.add(box(0.26, 0.24, 0.034, 0, -0.34, 0, darkSteel));
    // Заостренный нижний клюв щита
    sg.add(box(0.14, 0.18, 0.032, 0, -0.50, 0, darkSteel));

    // 2. Усиленный стальной кант / обод по периметру
    // Верхняя перекладина обода
    sg.add(box(0.48, 0.042, 0.048, 0, 0.31, 0, steel));
    // Боковые вертикальные канты
    sg.add(box(0.040, 0.44, 0.046, -0.22, 0.12, 0, steel));
    sg.add(box(0.040, 0.44, 0.046, 0.22, 0.12, 0, steel));
    // Диагональные скосы к нижнему острию
    sg.add(box(0.036, 0.36, 0.044, -0.14, -0.30, 0, steel));
    sg.add(box(0.036, 0.36, 0.044, 0.14, -0.30, 0, steel));
    // Оковка нижнего острия
    sg.add(box(0.052, 0.08, 0.048, 0, -0.56, 0, steel));

    // Заклёпки по углам и ободу
    const rivetMat = edgeSteel;
    sg.add(box(0.024, 0.024, 0.052, -0.21, 0.29, 0, rivetMat));
    sg.add(box(0.024, 0.024, 0.052, 0.21, 0.29, 0, rivetMat));
    sg.add(box(0.024, 0.024, 0.052, 0, 0.29, 0, rivetMat));
    sg.add(box(0.024, 0.024, 0.052, -0.21, -0.06, 0, rivetMat));
    sg.add(box(0.024, 0.024, 0.052, 0.21, -0.06, 0, rivetMat));

    // 3. Выступающий гранёный умбон (Umbo) по центру для Shield Bash
    sg.add(box(0.18, 0.18, 0.055, 0, 0.02, -0.035, steel));
    sg.add(box(0.12, 0.12, 0.065, 0, 0.02, -0.075, steel));
    // Колющий пирамидальный шип в центре умбона
    sg.add(box(0.06, 0.06, 0.065, 0, 0.02, -0.125, edgeSteel));
    sg.add(box(0.028, 0.028, 0.045, 0, 0.02, -0.165, edgeSteel));

    // 4. Сияющий солнечный / орденский рунический герб
    sg.add(box(0.032, 0.54, 0.044, 0, 0.0, -0.022, goldRune));
    sg.add(box(0.32, 0.032, 0.044, 0, 0.08, -0.022, goldRune));
    // Ромбовидный ореол вокруг умбона
    sg.add(box(0.15, 0.15, 0.042, 0, 0.02, -0.022, goldRune));

    // 5. Внутренняя сторона: крепление к левой руке
    // Кожаные ремни под предплечье
    sg.add(box(0.18, 0.042, 0.045, 0, 0.14, 0.035, leather));
    // Стальная рукоять для латной перчатки
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 8), darkSteel);
    handle.position.set(0, -0.04, 0.045);
    sg.add(handle);

    // Точка хвата левой рукой (IK)
    shieldAnim.grip = new THREE.Object3D();
    shieldAnim.grip.position.set(0, -0.04, 0.045);
    sg.add(shieldAnim.grip);

    sg.scale.set(1.35, 1.35, 1.35);
    shieldModel.add(sg);
    shieldHand.add(shieldModel);
  }

  function createDaggerMeshPiece(isLeft = false) {
    const g = new THREE.Group();
    g.name = isLeft ? "DaggerViewModel_L" : "DaggerViewModel_R";

    const obsidian = new THREE.MeshStandardMaterial({ color: 0x161c28, roughness: 0.38, metalness: 0.50 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xa4bedc, roughness: 0.20, metalness: 0.88 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x1a222c, roughness: 0.55, metalness: 0.70 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x2b1c14, roughness: 0.88, metalness: 0.08 });
    const rune = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00d4ff,
      emissiveIntensity: 2.5,
      roughness: 0.20,
      metalness: 0.10
    });

    const sweep = isLeft ? -1 : 1;

    // 1. Рукоять с кожаной обмоткой (центрирована в точке хвата y=0)
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.11, 8), leather);
    grip.position.set(0, 0, 0);
    g.add(grip);

    // Кожаные витки и темные стальные стяжки
    for (let y of [-0.035, 0.0, 0.035]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.003, 6, 12), darkSteel);
      ring.position.set(0, y, 0);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
    }

    // 2. Серповидное навершие-крюк (Hooked crescent pommel)
    const pommelCollar = box(0.036, 0.014, 0.028, 0, -0.060, 0, darkSteel);
    const pommel = new THREE.Mesh(new THREE.TorusGeometry(0.020, 0.006, 6, 14, Math.PI * 1.4), steel);
    pommel.position.set(sweep * 0.008, -0.082, 0);
    pommel.rotation.z = sweep * (Math.PI * 0.25);
    g.add(pommelCollar, pommel);

    // 3. Гарда/больстер с рунным камнем
    const guard = box(0.068, 0.015, 0.030, 0, 0.058, 0, darkSteel);
    const guardGem = box(0.016, 0.017, 0.034, 0, 0.058, 0, rune);
    g.add(guard, guardGem);

    // 4. Изогнутый обсидиановый клинок (Curved obsidian crescent blade в плоскости X-Y)
    // Сегмент 1: основание клинка
    const b1 = box(0.038, 0.075, 0.012, 0, 0.10, 0, obsidian);
    // Сегмент 2: середина с изгибом внутрь к прицелу
    const b2 = box(0.032, 0.075, 0.010, sweep * 0.010, 0.165, 0, obsidian);
    b2.rotation.z = -sweep * 0.14;
    // Сегмент 3: верхний изгиб клинка
    const b3 = box(0.024, 0.065, 0.008, sweep * 0.020, 0.225, 0, obsidian);
    b3.rotation.z = -sweep * 0.28;
    // Сегмент 4: граненое колющее острие (Needle tip)
    const tip = box(0.014, 0.055, 0.007, sweep * 0.018, 0.275, 0, steel);
    tip.rotation.z = -sweep * 0.38;
    g.add(b1, b2, b3, tip);

    // Стальное режущее лезвие по внешней кромке
    const edge1 = box(0.008, 0.075, 0.007, sweep * 0.020, 0.10, 0, steel);
    const edge2 = box(0.007, 0.075, 0.006, sweep * 0.028, 0.165, 0, steel);
    edge2.rotation.z = -sweep * 0.14;
    const edge3 = box(0.006, 0.065, 0.005, sweep * 0.034, 0.225, 0, steel);
    edge3.rotation.z = -sweep * 0.28;
    const edgeTip = box(0.005, 0.055, 0.004, sweep * 0.026, 0.275, 0, steel);
    edgeTip.rotation.z = -sweep * 0.38;
    g.add(edge1, edge2, edge3, edgeTip);

    // 5. Пылающая руническая жила по центру лезвия
    const rune1 = box(0.007, 0.065, 0.015, 0, 0.10, 0, rune);
    const rune2 = box(0.006, 0.065, 0.013, sweep * 0.010, 0.165, 0, rune);
    rune2.rotation.z = -sweep * 0.14;
    const rune3 = box(0.005, 0.055, 0.011, sweep * 0.020, 0.225, 0, rune);
    rune3.rotation.z = -sweep * 0.28;
    g.add(rune1, rune2, rune3);

    // Якорь хвата кистью руки (IK) - строго в начале координат хватного цилиндра
    const gripAnchor = new THREE.Object3D();
    gripAnchor.position.set(0, 0, 0);
    g.add(gripAnchor);

    g.scale.set(1.0, 1.0, 1.0);
    g.rotation.set(0, 0, 0);
    g.position.set(0, 0, 0);

    return { root: g, gripAnchor, runeMat: rune };
  }

  // ===== МЕХАНИКА КАСТА И ПРИЦЕЛИВАНИЯ МАГА БЕЗДНЫ (GROUND TARGETING & SPELLS) =====

  // 1. Рунический проекционный круг на полу (Ground Targeting Reticle)
  const groundReticle = (function createGroundReticle() {
    const root = new THREE.Group();
    root.name = "GroundReticleRoot";
    root.visible = false;
    engine.scene.add(root);

    const runeMat = new THREE.MeshBasicMaterial({
      color: 0xff2387,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xff70be,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const discMat = new THREE.MeshBasicMaterial({
      color: 0x4a0a38,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const outerRing = new THREE.Mesh(new THREE.RingGeometry(3.4, 3.6, 44), runeMat);
    outerRing.rotation.x = -Math.PI / 2;

    const midRing = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.74, 32), innerMat);
    midRing.rotation.x = -Math.PI / 2;

    const centerDisc = new THREE.Mesh(new THREE.CircleGeometry(3.4, 36), discMat);
    centerDisc.rotation.x = -Math.PI / 2;
    centerDisc.position.y = -0.005;

    const pointers = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2;
      const spike = box(0.12, 0.02, 0.60, Math.cos(ang) * 3.5, 0.01, Math.sin(ang) * 3.5, runeMat);
      spike.rotation.y = -ang + Math.PI / 2;
      pointers.add(spike);
    }

    root.add(outerRing, midRing, centerDisc, pointers);
    let curR = 3.6;

    return {
      root,
      show(pos, radius = 3.6, color = 0xff2387, progress = 0) {
        root.visible = true;
        root.position.set(pos.x, 0.03, pos.z);
        if (Math.abs(curR - radius) > 0.05) {
          curR = radius;
          const s = radius / 3.6;
          root.scale.set(s, 1, s);
        }
        runeMat.color.setHex(color);
        innerMat.color.setHex(color);
        outerRing.rotation.z += 0.03 * (1.0 + progress * 2.5);
        midRing.rotation.z -= 0.05 * (1.0 + progress * 3.0);
        pointers.rotation.y += 0.03 * (1.0 + progress * 2.5);
        runeMat.opacity = 0.65 + 0.35 * progress;
      },
      hide() {
        root.visible = false;
      }
    };
  })();

  // 2. Непрерывный лазерный луч дезинтеграции (Sustained Void Beam)
  const voidBeam = (function createVoidBeam() {
    const beamG = new THREE.Group();
    beamG.name = "SustainedVoidBeam";
    beamG.visible = false;
    engine.scene.add(beamG);

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xff2387,
      transparent: true,
      opacity: 0.70,
      depthWrite: false
    });
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });

    const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.0, 8, 1, true), beamMat);
    outer.rotation.x = Math.PI / 2;
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.0, 8, 1, true), coreMat);
    inner.rotation.x = Math.PI / 2;

    beamG.add(outer, inner);

    return {
      group: beamG,
      outer,
      inner,
      beamMat,
      coreMat,
      update(startPos, endPos) {
        beamG.visible = true;
        const toEnd = endPos.clone().sub(startPos);
        const len = toEnd.length();
        if (len < 0.1) return;
        const mid = startPos.clone().addScaledVector(toEnd, 0.5);
        beamG.position.copy(mid);
        beamG.lookAt(endPos);
        outer.scale.set(1, 1, len);
        inner.scale.set(1, 1, len);
        beamMat.opacity = 0.55 + 0.40 * Math.random();
      },
      hide() {
        beamG.visible = false;
      }
    };
  })();

  // 3. Вычисление точки на полу под прицелом (Raycast to Floor)
  const _groundRayPos = new THREE.Vector3();
  const _groundRayDir = new THREE.Vector3();
  function getGroundTarget(maxDist = 32) {
    camera.getWorldPosition(_groundRayPos);
    camera.getWorldDirection(_groundRayDir).normalize();

    if (_groundRayDir.y < -0.015) {
      const t = -_groundRayPos.y / _groundRayDir.y;
      if (t > 0 && t <= maxDist) {
        const x = _groundRayPos.x + _groundRayDir.x * t;
        const z = _groundRayPos.z + _groundRayDir.z * t;
        return new THREE.Vector3(x, 0.03, z);
      }
    }
    const clampedDist = Math.min(20, maxDist);
    const len = Math.hypot(_groundRayDir.x, _groundRayDir.z) || 1;
    return new THREE.Vector3(
      _groundRayPos.x + (_groundRayDir.x / len) * clampedDist,
      0.03,
      _groundRayPos.z + (_groundRayDir.z / len) * clampedDist
    );
  }

  // 4. Призыв Столпа Бездны (Abyssal Geyser Pillar)
  function spawnAbyssalPillar(pos) {
    const pG = new THREE.Group();
    pG.position.set(pos.x, 0, pos.z);

    const colGeo = new THREE.CylinderGeometry(3.5, 3.8, 12, 24, 1, true);
    const colMat = new THREE.MeshBasicMaterial({
      color: 0xff2387,
      transparent: true,
      opacity: 0.80,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const colMesh = new THREE.Mesh(colGeo, colMat);
    colMesh.position.y = 6.0;

    const coreGeo = new THREE.CylinderGeometry(1.6, 1.8, 12, 16, 1, true);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.y = 6.0;

    pG.add(colMesh, coreMesh);
    engine.scene.add(pG);

    activePillars.push({ group: pG, colMesh, coreMesh, colMat, coreMat, t: 0.45, t0: 0.45, pos: pos.clone() });

    // Урон и подбрасывание врагов
    fx?.addShockwave?.(pos, 3.8, 0xff2387);
    fx?.addHit?.(pos, "bomb", 2.6);

    const dmgMul = (getStats()?.damageMul ?? 1) * (getStats()?.arenaDamageMul ?? 1);
    if (lastEnemiesRef && typeof lastEnemiesRef.forEachInRadius === "function") {
      lastEnemiesRef.forEachInRadius(pos, 3.8, (e) => {
        if (!e) return;
        const ep = e.pos || e.root?.position || pos;
        const toCenter = new THREE.Vector3(ep.x - pos.x, 0, ep.z - pos.z);
        if (toCenter.lengthSq() < 1e-4) toCenter.set(0, 0, 1);
        else toCenter.normalize();

        if (e.root) e.root.position.y += 1.8;
        if (typeof lastEnemiesRef.applyDamage === "function") {
          const dealt = lastEnemiesRef.applyDamage(e.id, 95 * dmgMul, {
            knockback: 3.5,
            knockDir: toCenter,
            stun: 0.65,
            kind: "spell",
            point: ep
          });
          if (dealt && dealt.killed && progression) {
            progression.onKill?.(dealt.xp);
          }
        }
      });
    }
  }

  // 5. Призыв Гравитационной Воронки (Singularity Vortex)
  function spawnSingularityVortex(pos) {
    const vG = new THREE.Group();
    vG.position.set(pos.x, 0.03, pos.z);

    const disc = new THREE.Mesh(new THREE.RingGeometry(0.1, 5.0, 36), new THREE.MeshBasicMaterial({
      color: 0x24083a, transparent: true, opacity: 0.70, depthWrite: false, side: THREE.DoubleSide
    }));
    disc.rotation.x = -Math.PI / 2;

    const spiral = new THREE.Mesh(new THREE.RingGeometry(0.2, 3.4, 24), new THREE.MeshBasicMaterial({
      color: 0xff2387, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide
    }));
    spiral.rotation.x = -Math.PI / 2;

    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), new THREE.MeshStandardMaterial({
      color: 0x08040d, roughness: 0.9, emissive: 0x6a0044, emissiveIntensity: 1.4
    }));
    sphere.position.y = 0.45;

    vG.add(disc, spiral, sphere);
    engine.scene.add(vG);

    fx?.addShockwave?.(pos, 3.0, 0x9922cc);

    activeVortices.push({
      group: vG,
      spiral,
      sphere,
      pos: pos.clone(),
      t: 4.0,
      t0: 4.0,
      tickTimer: 0
    });
  }

  // 6. Призыв Звездного Метеорита (Astral Meteor Drop)
  function spawnAstralMeteor(pos) {
    const meteorMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.75, 0),
      new THREE.MeshStandardMaterial({
        color: 0x24102c,
        emissive: 0xff2387,
        emissiveIntensity: 3.2,
        roughness: 0.35,
        metalness: 0.65
      })
    );
    meteorMesh.position.set(pos.x, 22, pos.z);
    engine.scene.add(meteorMesh);

    activeMeteors.push({
      mesh: meteorMesh,
      pos: meteorMesh.position,
      targetPos: pos.clone(),
      speed: 48
    });
  }

  // 7. Призыв Купола Замедления Времени (Chrono Dilation Dome)
  function spawnChronoDome(pos) {
    const domeGeo = new THREE.SphereGeometry(7.0, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const domeMat = new THREE.MeshBasicMaterial({
      color: 0x9933ff,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeMesh.position.set(pos.x, 0.02, pos.z);
    engine.scene.add(domeMesh);

    fx?.addShockwave?.(pos, 4.0, 0x9933ff);

    activeDomes.push({
      mesh: domeMesh,
      mat: domeMat,
      pos: pos.clone(),
      t: 5.0,
      t0: 5.0
    });
  }

  // 8. Обновление всех активных заклинаний Бездны в мире каждый кадр
  function tickActiveSpells(dt) {
    const dmgMul = (getStats()?.damageMul ?? 1) * (getStats()?.arenaDamageMul ?? 1);

    // Воронки (Vortices): притягивают и наносят тикающий урон
    for (let i = activeVortices.length - 1; i >= 0; i--) {
      const v = activeVortices[i];
      v.t -= dt;
      v.spiral.rotation.z += dt * 4.5;
      v.sphere.rotation.y += dt * 3.0;

      if (lastEnemiesRef && typeof lastEnemiesRef.forEachInRadius === "function") {
        lastEnemiesRef.forEachInRadius(v.pos, 6.5, (e) => {
          if (!e) return;
          const ep = e.pos || e.root?.position;
          if (!ep) return;
          const toCenter = new THREE.Vector3(v.pos.x - ep.x, 0, v.pos.z - ep.z);
          const d = toCenter.length();
          if (d > 0.35) {
            toCenter.normalize();
            ep.x += toCenter.x * dt * 4.0;
            ep.z += toCenter.z * dt * 4.0;
          }
          e.slowT = Math.max(e.slowT || 0, 0.4);
          e.slowMul = 0.45;
        });
      }

      v.tickTimer += dt;
      if (v.tickTimer >= 0.35) {
        v.tickTimer -= 0.35;
        if (lastEnemiesRef && typeof lastEnemiesRef.forEachInRadius === "function") {
          lastEnemiesRef.forEachInRadius(v.pos, 5.0, (e) => {
            if (!e) return;
            if (typeof lastEnemiesRef.applyDamage === "function") {
              const dealt = lastEnemiesRef.applyDamage(e.id, 14 * dmgMul, {
                kind: "spell",
                stagger: 0.1,
                point: v.pos
              });
              if (dealt && dealt.killed && progression) progression.onKill?.(dealt.xp);
            }
          });
        }
      }

      if (v.t <= 0) {
        engine.scene.remove(v.group);
        activeVortices.splice(i, 1);
      }
    }

    // Столпы (Pillars): расширение и затухание
    for (let i = activePillars.length - 1; i >= 0; i--) {
      const p = activePillars[i];
      p.t -= dt;
      const k = p.t / p.t0;
      p.colMat.opacity = 0.80 * k;
      p.coreMat.opacity = 0.95 * k;
      p.colMesh.scale.x = 1.0 + (1.0 - k) * 0.25;
      p.colMesh.scale.z = 1.0 + (1.0 - k) * 0.25;
      if (p.t <= 0) {
        engine.scene.remove(p.group);
        activePillars.splice(i, 1);
      }
    }

    // Метеориты (Meteors): полет вниз и детонация
    for (let i = activeMeteors.length - 1; i >= 0; i--) {
      const m = activeMeteors[i];
      m.pos.y -= m.speed * dt;
      m.mesh.rotation.x += dt * 8.0;
      m.mesh.rotation.y += dt * 6.0;

      if (m.pos.y <= 0.3) {
        engine.scene.remove(m.mesh);
        activeMeteors.splice(i, 1);

        fx?.addShockwave?.(m.targetPos, 5.2, 0xff2387);
        fx?.addHit?.(m.targetPos, "bomb", 3.2);

        if (lastEnemiesRef && typeof lastEnemiesRef.forEachInRadius === "function") {
          lastEnemiesRef.forEachInRadius(m.targetPos, 5.5, (e) => {
            if (!e) return;
            const ep = e.pos || e.root?.position || m.targetPos;
            const toCenter = new THREE.Vector3(ep.x - m.targetPos.x, 0, ep.z - m.targetPos.z);
            if (toCenter.lengthSq() < 1e-4) toCenter.set(0, 0, 1);
            else toCenter.normalize();

            if (typeof lastEnemiesRef.applyDamage === "function") {
              const dealt = lastEnemiesRef.applyDamage(e.id, 140 * dmgMul, {
                knockback: 6.5,
                knockDir: toCenter,
                stun: 0.85,
                kind: "bomb",
                point: ep
              });
              if (dealt && dealt.killed && progression) progression.onKill?.(dealt.xp);
            }
          });
        }
      }
    }

    // Купола (Time Dilation Domes): замедление входящих врагов на 70%
    for (let i = activeDomes.length - 1; i >= 0; i--) {
      const d = activeDomes[i];
      d.t -= dt;
      d.mat.opacity = 0.22 * (d.t / d.t0);

      if (lastEnemiesRef && typeof lastEnemiesRef.forEachInRadius === "function") {
        lastEnemiesRef.forEachInRadius(d.pos, 7.0, (e) => {
          if (!e) return;
          e.slowT = Math.max(e.slowT || 0, 0.4);
          e.slowMul = 0.30;
        });
      }

      if (d.t <= 0) {
        engine.scene.remove(d.mesh);
        activeDomes.splice(i, 1);
      }
    }
  }

  function buildModel(w) {
    if (model) hand.remove(model);

    const woodTex = createPixelWoodTexture();
    woodTex.repeat.set(1, 4);

    const metal = new THREE.MeshStandardMaterial({ color: 0xdfe9ff, roughness: 0.55, metalness: 0.25 });
    const wood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.85 });

    model = new THREE.Group();

    if (w === "spear") {
      // Настоящая массивная боевая руническая глефа (FPS)
      const g = new THREE.Group();

      const spearWoodTex = createPixelWoodTexture();
      spearWoodTex.repeat.set(1, 10);

      const darkWood = new THREE.MeshStandardMaterial({ map: spearWoodTex, roughness: 0.88 });
      const wrap = new THREE.MeshStandardMaterial({ color: 0x221610, roughness: 0.95 });
      const steel = new THREE.MeshStandardMaterial({ color: 0xd8e4fc, roughness: 0.32, metalness: 0.65 });
      const edgeSteel = new THREE.MeshStandardMaterial({ color: 0xf0f5ff, roughness: 0.20, metalness: 0.80 });
      const darkSteel = new THREE.MeshStandardMaterial({ color: 0x444f62, roughness: 0.55, metalness: 0.50 });
      const runeMat = new THREE.MeshStandardMaterial({
        color: 0x00f5ff,
        emissive: 0x00e1ff,
        emissiveIntensity: 2.0,
        roughness: 0.18,
        metalness: 0.15
      });

      // 1. Древко: мощный мореный ясень увеличенной длины (2.45м)
      const SHAFT_LEN = 2.45;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.048, SHAFT_LEN, 8), darkWood);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.set(0, 0.02, -0.42);
      g.add(shaft);

      // 2. Стальные накладные полосы-лангеты (защита древка от перерубания вражеским оружием)
      const langetTop = box(0.018, 0.014, 0.85, 0, 0.07, -1.02, darkSteel);
      const langetBot = box(0.018, 0.014, 0.85, 0, -0.03, -1.02, darkSteel);
      const langetLeft = box(0.014, 0.018, 0.85, -0.05, 0.02, -1.02, darkSteel);
      const langetRight = box(0.014, 0.018, 0.85, 0.05, 0.02, -1.02, darkSteel);
      g.add(langetTop, langetBot, langetLeft, langetRight);

      // Стальные фиксирующие кольца с заклепками
      for (const rz of [-0.60, -0.98, -1.36]) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.032, 8), darkSteel);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, 0.02, rz);
        g.add(ring);
      }

      // 3. Плотная двойная кожаная обмотка хвата
      // Передний хват (направляющая рука)
      const gripFront = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.38, 8), wrap);
      gripFront.rotation.x = Math.PI / 2;
      gripFront.position.set(0, 0.02, -0.06);
      g.add(gripFront);

      // Задний хват (толчковая рука)
      const gripRear = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.34, 8), wrap);
      gripRear.rotation.x = Math.PI / 2;
      gripRear.position.set(0, 0.02, 0.52);
      g.add(gripRear);

      // Якоря для воксельных рук от 1-го лица
      spearAnim.gripRear = new THREE.Object3D();
      spearAnim.gripRear.position.set(0, 0.02, 0.52);
      g.add(spearAnim.gripRear);

      spearAnim.gripFront = new THREE.Object3D();
      spearAnim.gripFront.position.set(0, 0.02, -0.06);
      spearAnim.gripFront.rotation.set(0, 0, Math.PI);
      g.add(spearAnim.gripFront);

      // 4. Массивный гранёный затыльник-противовес с задним шипом
      const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.056, 0.12, 8), darkSteel);
      pommel.rotation.x = Math.PI / 2;
      pommel.position.set(0, 0.02, 0.80);
      g.add(pommel);
      const rearSpike = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.030, 0.12), steel);
      rearSpike.position.set(0, 0.02, 0.90);
      g.add(rearSpike);

      // 5. Мощная стальная посадочная втулка и фигурная гарда
      const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.076, 0.22, 8), darkSteel);
      socket.rotation.x = Math.PI / 2;
      socket.position.set(0, 0.02, -1.45);
      g.add(socket);

      // Массивная фигурная крестовина-упор
      const guard = box(0.20, 0.10, 0.048, 0, 0.02, -1.52, darkSteel);
      g.add(guard);

      // Светящийся рунический кристалл в гарде
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.058, 0), runeMat);
      gem.position.set(0, 0.02, -1.52);
      g.add(gem);

      // 6. НАСТОЯЩИЙ МАССИВНЫЙ КЛИНОК ГЛЕФЫ (Широкое изогнутое рубящее лезвие)
      const bladeGroup = new THREE.Group();
      bladeGroup.position.set(0, 0.02, -1.54);

      // Основание клинка (шейка у втулки)
      bladeGroup.add(box(0.052, 0.15, 0.18, 0, 0.02, -0.09, darkSteel));

      // Основное тело клинка глефы:
      // Секция 1: расширение от втулки
      bladeGroup.add(box(0.048, 0.20, 0.24, 0, 0.04, -0.26, steel));
      bladeGroup.add(box(0.056, 0.06, 0.24, 0, -0.05, -0.26, darkSteel)); // тяжелый обух

      // Секция 2: широкое рубящее брюхо глефы
      bladeGroup.add(box(0.044, 0.25, 0.28, 0, 0.07, -0.48, steel));
      bladeGroup.add(box(0.052, 0.06, 0.28, 0, -0.04, -0.48, darkSteel));

      // Секция 3: изогнутое сужение к острию
      bladeGroup.add(box(0.038, 0.19, 0.24, 0, 0.09, -0.70, steel));
      bladeGroup.add(box(0.046, 0.05, 0.24, 0, -0.02, -0.70, darkSteel));

      // Остриё глефы: хищный изогнутый клювовидный кончик
      bladeGroup.add(box(0.030, 0.10, 0.18, 0, 0.12, -0.87, steel));

      // Острая режущая кромка по всему брюшку глефы (светлая зеркальная сталь)
      bladeGroup.add(box(0.016, 0.05, 0.76, 0, 0.18, -0.48, edgeSteel));

      // Боевой крюк/зуб на обухе глефы (классический шип против латников)
      bladeGroup.add(box(0.042, 0.12, 0.09, 0, -0.12, -0.42, darkSteel));
      bladeGroup.add(box(0.028, 0.08, 0.07, 0, -0.18, -0.40, steel));

      // Светящийся рунический дол во всю длину клинка
      bladeGroup.add(box(0.050, 0.038, 0.60, 0, 0.04, -0.46, runeMat));

      // Рунические плитки-гравировки вдоль клинка
      bladeGroup.add(box(0.052, 0.020, 0.06, 0, 0.04, -0.22, runeMat));
      bladeGroup.add(box(0.052, 0.020, 0.06, 0, 0.04, -0.38, runeMat));
      bladeGroup.add(box(0.052, 0.020, 0.06, 0, 0.04, -0.54, runeMat));
      bladeGroup.add(box(0.052, 0.020, 0.06, 0, 0.05, -0.68, runeMat));

      // Поворачиваем группу клинка под углом ~38° для идеального обзора широкой грани клинка!
      bladeGroup.rotation.z = Math.PI * 0.21;
      g.add(bladeGroup);
      spearAnim.runeMat = runeMat;

      g.scale.set(2.05, 2.05, 2.05);
      model.add(g);

      // Боевая диагональная стойка в руках от 1-го лица
      model.rotation.set(-0.08, 0.14, -0.18);
      model.position.set(0.18, -0.09, 0.32);
    }

    if (w === "hammer") {
      const g = new THREE.Group();

      const hammerWoodTex = createPixelWoodTexture();
      hammerWoodTex.repeat.set(1, 8);

      const darkWood = new THREE.MeshStandardMaterial({ map: hammerWoodTex, roughness: 0.88 });
      const wrap = new THREE.MeshStandardMaterial({ color: 0x1c120c, roughness: 0.95 });
      const steel = new THREE.MeshStandardMaterial({ color: 0xd8e4fc, roughness: 0.32, metalness: 0.65 });
      const darkSteel = new THREE.MeshStandardMaterial({ color: 0x2e3746, roughness: 0.52, metalness: 0.55 });
      const edgeSteel = new THREE.MeshStandardMaterial({ color: 0xf2f7ff, roughness: 0.18, metalness: 0.82 });

      // Warm amber/gold runic glow (contrasts with cyan spear)
      const runeMat = new THREE.MeshStandardMaterial({
        color: 0xff9900,
        emissive: 0xff8800,
        emissiveIntensity: 2.2,
        roughness: 0.15,
        metalness: 0.10
      });
      hammerAnim.coreMat = runeMat;

      // 1. Древко настоящего двуручного боевого молота (вдоль Y)
      const SHAFT_LEN = 1.25;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.052, SHAFT_LEN, 8), darkWood);
      shaft.position.set(0, -0.05, 0);
      g.add(shaft);

      // Стальные лангеты (продольные бронеполосы по бокам древка)
      const langetR = box(0.016, 0.52, 0.032, 0.050, 0.25, 0, darkSteel);
      const langetL = box(0.016, 0.52, 0.032, -0.050, 0.25, 0, darkSteel);
      g.add(langetR, langetL);

      // 2. Двойной кожаный хват для двух рук
      // Верхний хват (Правая рука)
      const gripUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.26, 8), wrap);
      gripUpper.position.set(0, 0.02, 0);
      g.add(gripUpper);

      // Нижний хват (Левая рука)
      const gripLower = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.24, 8), wrap);
      gripLower.position.set(0, -0.38, 0);
      g.add(gripLower);

      // Точки привязки воксельных рук от 1-го лица
      hammerAnim.gripFront = new THREE.Object3D(); // Правая рука (ведущая, выше на рукояти)
      hammerAnim.gripFront.position.set(0, 0.02, 0);
      g.add(hammerAnim.gripFront);

      hammerAnim.gripRear = new THREE.Object3D();  // Левая рука (опорная, у противовеса)
      hammerAnim.gripRear.position.set(0, -0.38, 0);
      g.add(hammerAnim.gripRear);

      // 3. Массивный противовес-яблоко (heavy faceted pommel)
      const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.065, 0.14, 8), darkSteel);
      pommel.position.set(0, -0.66, 0);
      g.add(pommel);

      const pommelRing = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 8, 16), steel);
      pommelRing.position.set(0, -0.74, 0);
      pommelRing.rotation.x = Math.PI / 2;
      g.add(pommelRing);

      // 4. Посадочная втулка и воротник молота
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.090, 0.16, 8), darkSteel);
      collar.position.set(0, 0.50, 0);
      g.add(collar);

      // 5. МОНОЛИТНАЯ Т-ОБРАЗНАЯ ГОЛОВА БОЕВОГО МОЛОТА (Massive T-Shaped Hammer Head)
      const headGroup = new THREE.Group();
      headGroup.position.set(0, 0.56, 0);

      // Центральный стальной сердечник
      headGroup.add(box(0.24, 0.24, 0.26, 0, 0, 0, darkSteel));

      // ПЕРЕДНИЙ УДАРНЫЙ БОЁК (-Z, направлен вперед к цели)
      headGroup.add(box(0.22, 0.22, 0.10, 0, 0, -0.18, steel));
      headGroup.add(box(0.24, 0.24, 0.03, 0, 0, -0.14, darkSteel));
      // Вафельные насечки/зубья на ударной грани бойка
      for (let ix = -0.06; ix <= 0.06; ix += 0.06) {
        for (let iy = -0.06; iy <= 0.06; iy += 0.06) {
          const tooth = box(0.032, 0.032, 0.032, ix, iy, -0.24, edgeSteel);
          headGroup.add(tooth);
        }
      }

      // ЗАДНИЙ КЛЕВЕЦ-ШИП (+Z, бронебойный клюв смотрит назад к плечу)
      headGroup.add(box(0.12, 0.12, 0.10, 0, 0, 0.18, darkSteel));
      headGroup.add(box(0.08, 0.08, 0.12, 0, -0.01, 0.28, steel));
      headGroup.add(box(0.04, 0.04, 0.10, 0, -0.02, 0.38, edgeSteel));

      // ВЕРХНИЙ ОСАДНЫЙ ШИП-КОРОНА (+Y)
      headGroup.add(box(0.08, 0.14, 0.08, 0, 0.18, 0, darkSteel));
      headGroup.add(box(0.04, 0.08, 0.04, 0, 0.26, 0, steel));

      // Пылающее руническое ядро в центре молота
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.095, 0), runeMat);
      core.position.set(0, 0, 0);
      headGroup.add(core);

      // Рунические инкрустации на щеках молота
      headGroup.add(box(0.252, 0.10, 0.16, 0, 0, 0, runeMat));
      headGroup.add(box(0.16, 0.10, 0.272, 0, 0, 0, runeMat));

      g.add(headGroup);
      g.scale.set(1.42, 1.42, 1.42);
      model.add(g);
    }

    if (w === "sword") {
      swordAnim.runeMat = null;
      swordAnim.grip = null;

      const g = new THREE.Group();
      g.name = "SwordViewModel";

      const steel = new THREE.MeshStandardMaterial({ color: 0x98adc8, roughness: 0.28, metalness: 0.88 });
      const edgeSteel = new THREE.MeshStandardMaterial({ color: 0xe6f0ff, roughness: 0.16, metalness: 0.95 });
      const darkSteel = new THREE.MeshStandardMaterial({ color: 0x222a38, roughness: 0.50, metalness: 0.70 });
      const leather = new THREE.MeshStandardMaterial({ color: 0x3d2214, roughness: 0.90, metalness: 0.05 });
      const goldRune = new THREE.MeshStandardMaterial({
        color: 0xffcc22,
        emissive: 0xffaa00,
        emissiveIntensity: 2.5,
        roughness: 0.18,
        metalness: 0.12
      });
      swordAnim.runeMat = goldRune;

      // 1. Навершие (восьмигранный стальной противовес)
      const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.038, 0.08, 8), darkSteel);
      pommel.position.set(0, -0.34, 0);
      g.add(pommel);
      const pommelRing = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.012, 8, 16), steel);
      pommelRing.position.set(0, -0.39, 0);
      pommelRing.rotation.x = Math.PI / 2;
      g.add(pommelRing);

      // 2. Рукоять с витой кожаной оплеткой
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.030, 0.032, 0.22, 8), leather);
      grip.position.set(0, -0.19, 0);
      g.add(grip);
      // Золотые витки оплетки рукояти
      for (let y = -0.27; y <= -0.11; y += 0.04) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.005, 6, 12), goldRune);
        ring.position.set(0, y, 0);
        ring.rotation.x = Math.PI / 2;
        g.add(ring);
      }

      // Точка хвата правой латной перчаткой (IK)
      swordAnim.grip = new THREE.Object3D();
      swordAnim.grip.position.set(0, -0.19, 0);
      g.add(swordAnim.grip);

      // 3. Стальная фигурная крестовина гарды (Crossguard)
      g.add(box(0.26, 0.036, 0.065, 0, -0.06, 0, darkSteel));
      // Граненые наконечники крестовины
      g.add(box(0.045, 0.052, 0.075, -0.13, -0.06, 0, steel));
      g.add(box(0.045, 0.052, 0.075, 0.13, -0.06, 0, steel));
      // Золотой рунный медальон в центре гарды
      g.add(box(0.032, 0.032, 0.072, 0, -0.06, 0, goldRune));

      // 4. Рикассо (усиленная пята клинка)
      g.add(box(0.074, 0.08, 0.034, 0, 0.0, 0, darkSteel));

      // 5. Двусторонний стальной клинок паладина (длина ~0.95м)
      // Центральное тело клинка
      g.add(box(0.060, 0.88, 0.022, 0, 0.48, 0, steel));
      // Острые режущие грани
      g.add(box(0.016, 0.88, 0.012, -0.038, 0.48, 0, edgeSteel));
      g.add(box(0.016, 0.88, 0.012, 0.038, 0.48, 0, edgeSteel));
      // Граненое колющее острие (Tip)
      g.add(box(0.046, 0.08, 0.018, 0, 0.94, 0, steel));
      g.add(box(0.022, 0.07, 0.012, 0, 0.99, 0, edgeSteel));

      // 6. Пылающий золотой рунический дол (Fuller)
      g.add(box(0.016, 0.72, 0.026, 0, 0.46, 0, goldRune));

      g.scale.set(1.35, 1.35, 1.35);
      model.add(g);

      // Сборка рыцарского тарча / щита
      buildShieldModel();
      shieldHand.visible = true;
    } else {
      shieldHand.visible = false;
    }

    if (w === "bow") {
      bowAnim.stringLine = null;
      bowAnim.stringGeo = null;
      bowAnim.arrow = null;
      bowAnim.muzzle = null;
      bowAnim.runeMats = [];

      const g = new THREE.Group();

      const obsidianMat = new THREE.MeshStandardMaterial({ color: 0x181e2a, roughness: 0.45, metalness: 0.35 });
      const facetMat    = new THREE.MeshStandardMaterial({ color: 0x283244, roughness: 0.35, metalness: 0.50 });
      const alloyMat    = new THREE.MeshStandardMaterial({ color: 0x364052, roughness: 0.30, metalness: 0.70 });
      const steelEdge   = new THREE.MeshStandardMaterial({ color: 0xa4bddc, roughness: 0.20, metalness: 0.85 });
      const gripWrap    = new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.88, metalness: 0.05 });
      const cyanRuneMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00e5ff,
        emissiveIntensity: 2.2,
        roughness: 0.15,
        metalness: 0.10
      });
      const cyanGlowMat = new THREE.MeshStandardMaterial({
        color: 0x80f8ff,
        emissive: 0x00f5ff,
        emissiveIntensity: 3.0,
        roughness: 0.10,
        metalness: 0.05
      });
      bowAnim.runeMats.push(cyanRuneMat, cyanGlowMat);

      // --- 1. Riser & Grip (Центральная монолитная рукоять) ---
      // Central ergonomic grip core (рукоять опущена вниз под хват руки)
      g.add(box(0.046, 0.22, 0.054, 0, -0.040, 0.015, gripWrap));
      // Angled geometric facet cheeks
      g.add(box(0.040, 0.20, 0.024, 0, -0.040, -0.015, facetMat));
      // Alloy brackets top & bottom of grip
      g.add(box(0.056, 0.025, 0.062, 0, 0.075, 0.015, alloyMat));
      g.add(box(0.056, 0.025, 0.062, 0, -0.155, 0.015, alloyMat));
      // Arrow shelf (угловая полочка под стрелу на правой стороне прямо под стрелой)
      g.add(box(0.034, 0.016, 0.065, 0.028, 0.072, 0.025, alloyMat));
      // Riser center cyan energy core node
      g.add(box(0.020, 0.16, 0.014, 0, -0.030, 0.038, cyanRuneMat));

      // --- 2. Upper Limb (Верхнее граненое плечо) ---
      // Segment U1 (Riser transition, angled forward towards +Z)
      const u1 = box(0.056, 0.16, 0.058, 0, 0.18, 0.038, obsidianMat);
      u1.rotation.x = 0.16;
      const u1_e = box(0.020, 0.15, 0.014, 0, 0.18, 0.062, cyanRuneMat);
      u1_e.rotation.x = 0.16;
      const u1_a = box(0.058, 0.15, 0.015, 0, 0.18, 0.015, alloyMat);
      u1_a.rotation.x = 0.16;
      g.add(u1, u1_e, u1_a);

      // Segment U2 (Mid-limb chevron wedge - prominent aggressive forward chevron in Concept 4!)
      const u2 = box(0.052, 0.18, 0.060, 0, 0.34, 0.082, obsidianMat);
      u2.rotation.x = -0.10;
      const u2_w = box(0.044, 0.12, 0.038, 0, 0.35, 0.125, facetMat);
      u2_w.rotation.x = -0.35;
      const u2_we = box(0.018, 0.11, 0.012, 0, 0.35, 0.142, cyanGlowMat);
      u2_we.rotation.x = -0.35;
      const u2_e = box(0.020, 0.17, 0.014, 0, 0.34, 0.106, cyanRuneMat);
      u2_e.rotation.x = -0.10;
      g.add(u2, u2_w, u2_we, u2_e);

      // Segment U3 (Recurve transition, sweeping backward towards -Z)
      const u3 = box(0.046, 0.18, 0.050, 0, 0.51, 0.075, obsidianMat);
      u3.rotation.x = -0.32;
      const u3_e = box(0.018, 0.17, 0.014, 0, 0.51, 0.096, cyanRuneMat);
      u3_e.rotation.x = -0.32;
      const u3_a = box(0.048, 0.16, 0.015, 0, 0.51, 0.052, alloyMat);
      u3_a.rotation.x = -0.32;
      g.add(u3, u3_e, u3_a);

      // Segment U4 (Outer limb, sweeping recurve back and up)
      const u4 = box(0.040, 0.16, 0.042, 0, 0.66, 0.015, obsidianMat);
      u4.rotation.x = -0.54;
      const u4_e = box(0.018, 0.15, 0.014, 0, 0.66, 0.034, cyanRuneMat);
      u4_e.rotation.x = -0.54;
      g.add(u4, u4_e);

      // Top Tip / Nock (Sharp angular hook holding string)
      const tipTopMesh = box(0.034, 0.10, 0.046, 0, 0.77, -0.060, steelEdge);
      tipTopMesh.rotation.x = -0.68;
      const tipTop_e = box(0.016, 0.08, 0.014, 0, 0.78, -0.048, cyanGlowMat);
      tipTop_e.rotation.x = -0.68;
      g.add(tipTopMesh, tipTop_e);

      // --- 3. Lower Limb (Нижнее граненое плечо - зеркально-симметричное) ---
      // Segment D1
      const d1 = box(0.056, 0.16, 0.058, 0, -0.18, 0.038, obsidianMat);
      d1.rotation.x = -0.16;
      const d1_e = box(0.020, 0.15, 0.014, 0, -0.18, 0.062, cyanRuneMat);
      d1_e.rotation.x = -0.16;
      const d1_a = box(0.058, 0.15, 0.015, 0, -0.18, 0.015, alloyMat);
      d1_a.rotation.x = -0.16;
      g.add(d1, d1_e, d1_a);

      // Segment D2 (Mid-limb chevron wedge)
      const d2 = box(0.052, 0.18, 0.060, 0, -0.34, 0.082, obsidianMat);
      d2.rotation.x = 0.10;
      const d2_w = box(0.044, 0.12, 0.038, 0, -0.35, 0.125, facetMat);
      d2_w.rotation.x = 0.35;
      const d2_we = box(0.018, 0.11, 0.012, 0, -0.35, 0.142, cyanGlowMat);
      d2_we.rotation.x = 0.35;
      const d2_e = box(0.020, 0.17, 0.014, 0, -0.34, 0.106, cyanRuneMat);
      d2_e.rotation.x = 0.10;
      g.add(d2, d2_w, d2_we, d2_e);

      // Segment D3
      const d3 = box(0.046, 0.18, 0.050, 0, -0.51, 0.075, obsidianMat);
      d3.rotation.x = 0.32;
      const d3_e = box(0.018, 0.17, 0.014, 0, -0.51, 0.096, cyanRuneMat);
      d3_e.rotation.x = 0.32;
      const d3_a = box(0.048, 0.16, 0.015, 0, -0.51, 0.052, alloyMat);
      d3_a.rotation.x = 0.32;
      g.add(d3, d3_e, d3_a);

      // Segment D4
      const d4 = box(0.040, 0.16, 0.042, 0, -0.66, 0.015, obsidianMat);
      d4.rotation.x = 0.54;
      const d4_e = box(0.018, 0.15, 0.014, 0, -0.66, 0.034, cyanRuneMat);
      d4_e.rotation.x = 0.54;
      g.add(d4, d4_e);

      // Bottom Tip / Nock
      const tipBotMesh = box(0.034, 0.10, 0.046, 0, -0.77, -0.060, steelEdge);
      tipBotMesh.rotation.x = 0.68;
      const tipBot_e = box(0.016, 0.08, 0.014, 0, -0.78, -0.048, cyanGlowMat);
      tipBot_e.rotation.x = 0.68;
      g.add(tipBotMesh, tipBot_e);

      // --- 4. Radiant Energy Bowstring ---
      bowAnim.tipTop.set(0, 0.77, -0.060);
      bowAnim.tipBot.set(0, -0.77, -0.060);
      bowAnim.nock.set(0, 0.080, -0.018);

      bowAnim.stringGeo = new THREE.BufferGeometry();
      bowAnim.stringGeo.setFromPoints([bowAnim.tipTop.clone(), bowAnim.nock.clone(), bowAnim.tipBot.clone()]);
      bowAnim.stringLine = new THREE.Line(
        bowAnim.stringGeo,
        new THREE.LineBasicMaterial({ color: 0x00f5ff, linewidth: 2.5 })
      );
      g.add(bowAnim.stringLine);

      // --- 5. Monolithic Vanguard Arrow (лежит выше руки на полке) ---
      const arrowGroup = new THREE.Group();
      // Main faceted shaft
      arrowGroup.add(box(0.018, 0.018, 0.62, 0, 0, 0.22, obsidianMat));
      // Energy core spine along arrow
      arrowGroup.add(box(0.008, 0.006, 0.58, 0, 0.008, 0.22, cyanRuneMat));

      // 3D граненый монолитный наконечник (Broadhead с острым колющим острием)
      const headG = new THREE.Group();
      // Посадочная граненая втулка (ferrule collar)
      headG.add(box(0.024, 0.024, 0.040, 0, 0, 0.46, alloyMat));

      // Стальное 3D граненое лезвие наконечника с острым жалом (0, 0, 0.65)
      const bhTip    = [0, 0, 0.65];
      const bhRidgeT = [0, 0.016, 0.54];
      const bhRidgeB = [0, -0.016, 0.54];
      const bhWingR  = [0.048, 0, 0.48];
      const bhWingL  = [-0.048, 0, 0.48];
      const bhColT   = [0, 0.012, 0.44];
      const bhColB   = [0, -0.012, 0.44];
      const bhColR   = [0.012, 0, 0.44];
      const bhColL   = [-0.012, 0, 0.44];

      const bhTris = [
        // Верхние и нижние передние лезвия, сходящиеся в колющую иглу
        bhTip, bhRidgeT, bhWingR,
        bhTip, bhWingL, bhRidgeT,
        bhTip, bhWingR, bhRidgeB,
        bhTip, bhRidgeB, bhWingL,

        // Задние зазубренные скосы (barbs) к посадочной втулке
        bhRidgeT, bhColT, bhWingR,
        bhWingR, bhColT, bhColR,
        bhRidgeT, bhWingL, bhColT,
        bhWingL, bhColL, bhColT,

        bhRidgeB, bhWingR, bhColB,
        bhWingR, bhColR, bhColB,
        bhRidgeB, bhColB, bhWingL,
        bhWingL, bhColB, bhColL,
      ];
      const bhBladeGeo = new THREE.BufferGeometry();
      bhBladeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bhTris.flat()), 3));
      bhBladeGeo.computeVertexNormals();
      headG.add(new THREE.Mesh(bhBladeGeo, steelEdge));

      // Светящийся бирюзовый рунный хребет наконечника
      const bhCTip    = [0, 0, 0.635];
      const bhCRidgeT = [0, 0.009, 0.545];
      const bhCRidgeB = [0, -0.009, 0.545];
      const bhCWingR  = [0.018, 0, 0.49];
      const bhCWingL  = [-0.018, 0, 0.49];
      const bhCColT   = [0, 0.007, 0.45];
      const bhCColB   = [0, -0.007, 0.45];

      const bhCoreTris = [
        bhCTip, bhCRidgeT, bhCWingR,
        bhCTip, bhCWingL, bhCRidgeT,
        bhCTip, bhCWingR, bhCRidgeB,
        bhCTip, bhCRidgeB, bhCWingL,

        bhCRidgeT, bhCColT, bhCWingR,
        bhCRidgeT, bhCWingL, bhCColT,
        bhCRidgeB, bhCWingR, bhCColB,
        bhCRidgeB, bhCColB, bhCWingL,
      ];
      const bhCoreGeo = new THREE.BufferGeometry();
      bhCoreGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bhCoreTris.flat()), 3));
      bhCoreGeo.computeVertexNormals();
      headG.add(new THREE.Mesh(bhCoreGeo, cyanGlowMat));
      arrowGroup.add(headG);

      // 3-Blade faceted crystalline fletchings
      arrowGroup.add(box(0.006, 0.042, 0.10, 0, 0.024, -0.06, cyanGlowMat));
      const fR = box(0.038, 0.020, 0.10, 0.020, -0.012, -0.06, cyanGlowMat);
      fR.rotation.z = -Math.PI / 6;
      arrowGroup.add(fR);
      const fL = box(0.038, 0.020, 0.10, -0.020, -0.012, -0.06, cyanGlowMat);
      fL.rotation.z = Math.PI / 6;
      arrowGroup.add(fL);

      // Muzzle
      bowAnim.muzzle = new THREE.Object3D();
      bowAnim.muzzle.position.set(0, 0, 0.66);
      arrowGroup.add(bowAnim.muzzle);

      // Якоря для воксельных рук от 1-го лица
      // Левая рука держит рукоять НИЖЕ полки со стрелой
      bowAnim.gripLeft = new THREE.Object3D();
      bowAnim.gripLeft.position.set(0, -0.070, 0.015);
      g.add(bowAnim.gripLeft);

      // Правая рука держит тетиву и стрелу у хвостовика
      bowAnim.gripRight = new THREE.Object3D();
      bowAnim.gripRight.position.set(0, 0, 0.02);
      arrowGroup.add(bowAnim.gripRight);

      arrowGroup.position.set(bowAnim.nock.x, bowAnim.nock.y, bowAnim.nock.z);
      arrowGroup.visible = true;
      bowAnim.arrow = arrowGroup;
      g.add(arrowGroup);

      g.scale.set(1.22, 1.22, 1.22);
      model.add(g);

      // Диагональный стильный боевой хват авангардного лука
      model.rotation.set(0.05, Math.PI * 0.98, -0.32);
      model.position.set(0.04, 0.02, 0.04);
    }

    if (w === "staff") {
      staffAnim.crystal = null;
      staffAnim.crystalMat = null;
      staffAnim.muzzle = null;
      staffAnim.shards = [];

      const g = new THREE.Group();
      g.name = "VoidStaffViewModel";

      const darkWood = new THREE.MeshStandardMaterial({ color: 0x221626, roughness: 0.88, metalness: 0.10 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xd8ad3e, roughness: 0.35, metalness: 0.80 });
      const paleGoldMat = new THREE.MeshStandardMaterial({ color: 0xf8dc6e, roughness: 0.25, metalness: 0.90 });
      const obsidian = new THREE.MeshStandardMaterial({ color: 0x120c18, roughness: 0.65, metalness: 0.40 });
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0xff2387,
        emissive: 0xff0066,
        emissiveIntensity: 2.8,
        roughness: 0.15,
        metalness: 0.05
      });
      const shardMat = new THREE.MeshStandardMaterial({
        color: 0xff66b8,
        emissive: 0xff2387,
        emissiveIntensity: 2.5,
        roughness: 0.20,
        metalness: 0.10
      });

      // 1. Древко посоха (Dark Starwood)
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 1.25, 10), darkWood);
      shaft.position.set(0, 0.10, 0);
      g.add(shaft);

      // 2. Золотые муфты и кольца с рунами
      for (const y of [-0.30, -0.05, 0.20, 0.45]) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.030, 10), goldMat);
        ring.position.set(0, y, 0);
        const runeBand = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.012, 10), crystalMat);
        runeBand.position.set(0, y, 0);
        g.add(ring, runeBand);
      }

      // 3. Заостренный золотой подток (Spike Butt)
      const buttCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.030, 0.08, 10), goldMat);
      buttCollar.position.set(0, -0.52, 0);
      const buttSpike = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.12, 8), obsidian);
      buttSpike.position.set(0, -0.60, 0);
      buttSpike.rotation.x = Math.PI;
      g.add(buttCollar, buttSpike);

      // 4. Тройная витая корона (Horned Chalice Crown)
      const crownCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.032, 0.08, 10), goldMat);
      crownCollar.position.set(0, 0.70, 0);
      const crownRim = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 8, 16), paleGoldMat);
      crownRim.position.set(0, 0.74, 0);
      crownRim.rotation.x = Math.PI / 2;
      g.add(crownCollar, crownRim);

      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2;
        const prongGroup = new THREE.Group();
        prongGroup.position.set(Math.cos(ang) * 0.055, 0.74, Math.sin(ang) * 0.055);
        prongGroup.rotation.y = -ang;
        const p1 = box(0.022, 0.14, 0.022, 0, 0.06, 0.015, goldMat);
        p1.rotation.x = 0.22;
        const p2 = box(0.016, 0.12, 0.016, 0, 0.16, -0.012, obsidian);
        p2.rotation.x = -0.35;
        const pR = box(0.008, 0.10, 0.008, 0, 0.16, -0.014, crystalMat);
        pR.rotation.x = -0.35;
        prongGroup.add(p1, p2, pR);
        g.add(prongGroup);
      }

      // 5. Парящий кристалл Бездны (Floating Octahedron Crystal)
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), crystalMat);
      crystal.position.set(0, 0.86, 0);
      const crystalInner = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), shardMat);
      crystalInner.position.set(0, 0.86, 0);
      g.add(crystal, crystalInner);

      // 6. Парящие орбитальные рунические осколки
      const shardGroup = new THREE.Group();
      shardGroup.position.set(0, 0.86, 0);
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2;
        const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), shardMat);
        shard.position.set(Math.cos(ang) * 0.11, (i - 1) * 0.02, Math.sin(ang) * 0.11);
        shardGroup.add(shard);
        staffAnim.shards.push(shard);
      }
      g.add(shardGroup);

      // Дуло / точка проекции магии
      const muzzle = new THREE.Object3D();
      muzzle.position.set(0, 0.94, -0.08);
      g.add(muzzle);

      staffAnim.crystal = crystal;
      staffAnim.crystalInner = crystalInner;
      staffAnim.crystalMat = crystalMat;
      staffAnim.shardGroup = shardGroup;
      staffAnim.muzzle = muzzle;

      staffAnim.gripRight = new THREE.Object3D();
      staffAnim.gripRight.position.set(0, 0.15, 0);
      g.add(staffAnim.gripRight);

      g.scale.set(1.35, 1.35, 1.35);
      model.add(g);
      model.position.set(0.08, -0.06, 0.04);
      model.rotation.set(0.08, Math.PI * 0.96, -0.12);
    }

    if (w === "scepter") {
      scepterAnim.gripRight = null;
      scepterAnim.muzzle = null;
      scepterAnim.prismMat = null;
      scepterAnim.claws = [];
      scepterAnim.runeMats = [];

      const g = new THREE.Group();
      g.name = "AstralScepterViewModel";

      const leatherMat = new THREE.MeshStandardMaterial({ color: 0x321a24, roughness: 0.90, metalness: 0.05 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xd8ad3e, roughness: 0.35, metalness: 0.80 });
      const paleGoldMat = new THREE.MeshStandardMaterial({ color: 0xf8dc6e, roughness: 0.25, metalness: 0.90 });
      const obsidian = new THREE.MeshStandardMaterial({ color: 0x140e1c, roughness: 0.60, metalness: 0.45 });
      const prismMat = new THREE.MeshStandardMaterial({
        color: 0xff2387,
        emissive: 0xff0066,
        emissiveIntensity: 3.2,
        roughness: 0.12,
        metalness: 0.05
      });
      scepterAnim.prismMat = prismMat;
      scepterAnim.runeMats.push(prismMat);

      // 1. Рукоять с кожей
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.020, 0.18, 8), leatherMat);
      grip.position.set(0, -0.12, 0);
      g.add(grip);

      // 2. Навершие с аметистом
      const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.024, 0.04, 8), goldMat);
      pommel.position.set(0, -0.22, 0);
      const pommelGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), prismMat);
      pommelGem.position.set(0, -0.25, 0);
      g.add(pommel, pommelGem);

      // 3. Граненый обсидиановый стержень
      const rod = box(0.032, 0.28, 0.032, 0, 0.08, 0, obsidian);
      g.add(rod);
      for (const y of [0.0, 0.10, 0.20]) {
        const ring = box(0.038, 0.016, 0.038, 0, y, 0, goldMat);
        const rune = box(0.040, 0.008, 0.040, 0, y, 0, prismMat);
        g.add(ring, rune);
      }

      // 4. Головная фокусирующая муфта
      const headCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.028, 0.06, 8), goldMat);
      headCollar.position.set(0, 0.25, 0);
      g.add(headCollar);

      // 4 золотых когтя вокруг призмы
      const clawGroup = new THREE.Group();
      clawGroup.position.set(0, 0.27, 0);
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2;
        const claw = box(0.012, 0.12, 0.012, Math.cos(ang) * 0.035, 0.05, Math.sin(ang) * 0.035, paleGoldMat);
        claw.rotation.y = -ang;
        claw.rotation.x = 0.12;
        clawGroup.add(claw);
        scepterAnim.claws.push(claw);
      }
      g.add(clawGroup);
      scepterAnim.clawGroup = clawGroup;

      // 5. Центральная призма и фокусирующая игла
      const prism = new THREE.Mesh(new THREE.OctahedronGeometry(0.038, 0), prismMat);
      prism.position.set(0, 0.34, 0);
      const needle = box(0.008, 0.12, 0.008, 0, 0.42, 0, prismMat);
      g.add(prism, needle);
      scepterAnim.prism = prism;

      // Muzzle anchor
      const muzzle = new THREE.Object3D();
      muzzle.position.set(0, 0.48, 0);
      g.add(muzzle);
      scepterAnim.muzzle = muzzle;

      // Grip anchor
      const gripRight = new THREE.Object3D();
      gripRight.position.set(0, -0.12, 0);
      g.add(gripRight);
      scepterAnim.gripRight = gripRight;

      g.scale.set(1.4, 1.4, 1.4);
      model.add(g);
      model.position.set(0.06, -0.04, 0.02);
      model.rotation.set(0.12, Math.PI * 0.97, -0.08);
    }

    if (w === "grimoire") {
      grimoireAnim.gripRight = null;
      grimoireAnim.gripLeft = null;
      grimoireAnim.talisman = null;
      grimoireAnim.pagesL = null;
      grimoireAnim.pagesR = null;
      grimoireAnim.runeMats = [];

      const g = new THREE.Group();
      g.name = "CataclysmGrimoireViewModel";

      const leatherMat = new THREE.MeshStandardMaterial({ color: 0x301624, roughness: 0.85, metalness: 0.10 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xd8ad3e, roughness: 0.35, metalness: 0.80 });
      const paperMat = new THREE.MeshStandardMaterial({ color: 0xdfd4bc, roughness: 0.90, metalness: 0.02 });
      const runeTextMat = new THREE.MeshStandardMaterial({
        color: 0xff2387,
        emissive: 0xff0066,
        emissiveIntensity: 2.6,
        roughness: 0.20,
        metalness: 0.05
      });
      const obsidian = new THREE.MeshStandardMaterial({ color: 0x120c18, roughness: 0.60, metalness: 0.50 });
      grimoireAnim.runeMats.push(runeTextMat);

      // 1. Кожаный корешок по центру
      const spine = box(0.045, 0.30, 0.025, 0, 0, 0.02, goldMat);
      g.add(spine);

      // 2. Левая и правая обложки
      const coverL = box(0.18, 0.28, 0.016, -0.10, 0, 0, leatherMat);
      coverL.rotation.y = -0.28;
      const coverR = box(0.18, 0.28, 0.016, 0.10, 0, 0, leatherMat);
      coverR.rotation.y = 0.28;
      g.add(coverL, coverR);

      // Угловые золотые накладки
      for (const cx of [-0.17, 0.17]) {
        for (const cy of [-0.12, 0.12]) {
          const sign = cx < 0 ? -1 : 1;
          const corner = box(0.04, 0.04, 0.022, cx, cy, 0.005, goldMat);
          corner.rotation.y = sign * 0.28;
          g.add(corner);
        }
      }

      // 3. Блоки страниц (пергамент)
      const pagesL = box(0.16, 0.26, 0.028, -0.09, 0, -0.018, paperMat);
      pagesL.rotation.y = -0.24;
      const pagesR = box(0.16, 0.26, 0.028, 0.09, 0, -0.018, paperMat);
      pagesR.rotation.y = 0.24;
      g.add(pagesL, pagesR);
      grimoireAnim.pagesL = pagesL;
      grimoireAnim.pagesR = pagesR;

      // 4. Светящиеся рунические строки на страницах
      for (const py of [-0.08, -0.04, 0.0, 0.04, 0.08]) {
        const lineL = box(0.12, 0.008, 0.004, -0.09, py, -0.034, runeTextMat);
        lineL.rotation.y = -0.24;
        const lineR = box(0.12, 0.008, 0.004, 0.09, py, -0.034, runeTextMat);
        lineR.rotation.y = 0.24;
        g.add(lineL, lineR);
      }

      // 5. Парящий талисман Око Бездны
      const talisman = new THREE.Group();
      talisman.position.set(0, 0, -0.065);
      const talisFrame = box(0.06, 0.06, 0.018, 0, 0, 0, goldMat);
      const talisEye = box(0.038, 0.038, 0.024, 0, 0, 0, runeTextMat);
      const talisPupil = box(0.012, 0.030, 0.026, 0, 0, 0, obsidian);
      talisman.add(talisFrame, talisEye, talisPupil);
      g.add(talisman);
      grimoireAnim.talisman = talisman;

      // 6. Хваты для обеих рук (IK)
      const gripLeft = new THREE.Object3D();
      gripLeft.position.set(-0.06, -0.14, 0.03);
      g.add(gripLeft);
      grimoireAnim.gripLeft = gripLeft;

      const gripRight = new THREE.Object3D();
      gripRight.position.set(0.10, -0.04, -0.08);
      g.add(gripRight);
      grimoireAnim.gripRight = gripRight;

      g.scale.set(1.4, 1.4, 1.4);
      model.add(g);
      model.position.set(0.02, -0.04, 0.0);
      model.rotation.set(0.32, Math.PI * 0.98, -0.04);
    }

    if (w === "daggers") {
      daggersAnim.gripR = null;
      daggersAnim.gripL = null;
      daggersAnim.meshR = null;
      daggersAnim.meshL = null;
      daggersAnim.runeMats = [];

      const dR = createDaggerMeshPiece(false);
      model.add(dR.root);
      daggersAnim.gripR = dR.gripAnchor;
      daggersAnim.meshR = dR.root;
      if (dR.runeMat) daggersAnim.runeMats.push(dR.runeMat);

      if (shieldModel) shieldHand.remove(shieldModel);
      shieldModel = new THREE.Group();
      shieldModel.name = "DaggerShieldGroup";
      const dL = createDaggerMeshPiece(true);
      shieldModel.add(dL.root);
      shieldHand.add(shieldModel);
      daggersAnim.gripL = dL.gripAnchor;
      daggersAnim.meshL = dL.root;
      if (dL.runeMat) daggersAnim.runeMats.push(dL.runeMat);

      shieldHand.visible = true;
    }

    if (w === "bombard") {
      bombardAnim.gripRear = null;
      bombardAnim.gripFront = null;
      bombardAnim.muzzle = null;
      bombardAnim.runeMats = [];

      const g = new THREE.Group();
      g.name = "BombardViewModel";

      const ironMat = new THREE.MeshStandardMaterial({ color: 0x222a36, roughness: 0.55, metalness: 0.78 });
      const darkIronMat = new THREE.MeshStandardMaterial({ color: 0x141820, roughness: 0.65, metalness: 0.85 });
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x38404d, roughness: 0.72, metalness: 0.40 });
      const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.88 });
      const runeMat = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00d4ff,
        emissiveIntensity: 2.4,
        roughness: 0.20,
        metalness: 0.10
      });
      bombardAnim.runeMats.push(runeMat);
      const brassMat = new THREE.MeshStandardMaterial({ color: 0xc8963e, roughness: 0.35, metalness: 0.80 });

      // 1. Массивный ствол мортиры (Monolithic cannon barrel)
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.095, 0.55, 8), ironMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.04, -0.08);
      g.add(barrel);

      // Полое жерло (Bore)
      const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.12, 8), darkIronMat);
      bore.rotation.x = Math.PI / 2;
      bore.position.set(0, 0.04, -0.34);
      g.add(bore);

      // 2. Скульптурное дуло "Пасть Дракона/Гаргульи" (Dragon Maw muzzle)
      const muzzleRing = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.086, 0.10, 8), stoneMat);
      muzzleRing.rotation.x = Math.PI / 2;
      muzzleRing.position.set(0, 0.04, -0.36);
      g.add(muzzleRing);

      // Клыки пасти гаргульи вокруг дула
      for (let a = 0; a < 4; a++) {
        const fang = box(0.024, 0.038, 0.045, 0, 0, 0, stoneMat);
        const ang = a * (Math.PI / 2) + Math.PI / 4;
        fang.position.set(Math.cos(ang) * 0.09, 0.04 + Math.sin(ang) * 0.09, -0.40);
        g.add(fang);
      }

      // 3. Кованые обручи ствола с заклепками
      for (let z of [-0.20, -0.05, 0.10]) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.038, 8), darkIronMat);
        band.rotation.x = Math.PI / 2;
        band.position.set(0, 0.04, z);
        g.add(band);
      }

      // 4. Пылающие рунические желоба вдоль ствола (Cyan Runic inlays)
      const runeR = box(0.012, 0.020, 0.36, 0.088, 0.04, -0.08, runeMat);
      const runeL = box(0.012, 0.020, 0.36, -0.088, 0.04, -0.08, runeMat);
      const runeTop = box(0.020, 0.012, 0.36, 0, 0.128, -0.08, runeMat);
      g.add(runeR, runeL, runeTop);

      // 5. Деревянное ложе и рукоять (Heavy stock)
      const foreStock = box(0.12, 0.09, 0.44, 0, -0.035, -0.06, woodMat);
      g.add(foreStock);
      const rearGrip = box(0.075, 0.18, 0.12, 0, -0.14, 0.18, woodMat);
      rearGrip.rotation.x = -0.32;
      const buttPlate = box(0.082, 0.035, 0.14, 0, -0.22, 0.22, darkIronMat);
      buttPlate.rotation.x = -0.32;
      g.add(rearGrip, buttPlate);

      // 6. Латунный замок и курок (Flintlock hammer)
      const lockBox = box(0.04, 0.06, 0.10, 0.065, 0.04, 0.14, brassMat);
      const hammer = box(0.02, 0.07, 0.03, 0.07, 0.09, 0.14, brassMat);
      hammer.rotation.z = -0.22;
      g.add(lockBox, hammer);

      // Якоря для IK рук и дула
      const muzzleAnchor = new THREE.Object3D();
      muzzleAnchor.position.set(0, 0.04, -0.44);
      g.add(muzzleAnchor);
      bombardAnim.muzzle = muzzleAnchor;

      // Правая рука (на курке/рукояти сзади)
      const gripRear = new THREE.Object3D();
      gripRear.position.set(0, -0.13, 0.16);
      g.add(gripRear);
      bombardAnim.gripRear = gripRear;

      // Левая рука (поддерживает массивное цевье снизу спереди)
      const gripFront = new THREE.Object3D();
      gripFront.position.set(0, -0.07, -0.12);
      g.add(gripFront);
      bombardAnim.gripFront = gripFront;

      g.scale.set(1.4, 1.4, 1.4);
      model.add(g);
    }

    model.scale.setScalar(MODEL_SCALE);
    hand.add(model);
  }

  function setBowPull(p) {
    if (!bowAnim.stringGeo || !bowAnim.stringLine) return;

    const pull = clamp(p, 0, 1);
    bowAnim.nock.z = -0.018 - 0.28 * pull;

    if (bowAnim.arrow) {
      bowAnim.arrow.position.set(bowAnim.nock.x, bowAnim.nock.y, bowAnim.nock.z);
    }

    bowAnim.stringGeo.setFromPoints([bowAnim.tipTop.clone(), bowAnim.nock.clone(), bowAnim.tipBot.clone()]);
    bowAnim.stringGeo.attributes.position.needsUpdate = true;

    // Flare up runic inlays on limbs as bow is drawn (from 2.2 to 5.5)
    if (bowAnim.runeMats) {
      const glow = 2.2 + 3.3 * pull;
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

  function fireSingleDagger(handIndex) {
    if (!spawnProjectile) return;

    const camPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    camera.getWorldDirection(camDir).normalize();

    const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const origin = camPos.clone();
    if (handIndex === 0) {
      origin.addScaledVector(camRight, 0.16);
    } else {
      origin.addScaledVector(camRight, -0.16);
    }
    origin.y -= 0.10;

    const aimPoint = camPos.clone().addScaledVector(camDir, 60);
    const dir = aimPoint.sub(origin).normalize();

    const dmgMul = (getStats()?.damageMul ?? 1) * (getStats()?.arenaDamageMul ?? 1);

    spawnProjectile({
      kind: "dagger",
      origin,
      dir,
      speed: defs.daggers.speed * (getStats()?.projectileSpeedMul ?? 1),
      life: 1.4,
      damage: defs.daggers.dmg * dmgMul,
      radius: 0.22,
      splash: (getStats()?.extraSplash ?? 0),
      pierce: (getStats()?.projectilePierce ?? 0),
      team: "player"
    });

    camImpulseZ = (handIndex === 0 ? -0.015 : 0.015);
    fx?.addArcFlash?.(origin, 0x00f0ff, 0.12, 0.85);
  }

  function fireDaggerFan() {
    if (!spawnProjectile) return;

    const camPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    camera.getWorldDirection(camDir).normalize();

    const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const origin = camPos.clone().addScaledVector(camDir, 0.35);
    origin.y -= 0.10;

    const fanAngles = [-0.32, -0.16, 0.0, 0.16, 0.32];
    const dmgMul = (getStats()?.damageMul ?? 1) * (getStats()?.arenaDamageMul ?? 1);

    for (const ang of fanAngles) {
      const d = camDir.clone().applyAxisAngle(camUp, ang).normalize();
      spawnProjectile({
        kind: "dagger",
        origin: origin.clone(),
        dir: d,
        speed: (defs.daggers.speed + 4) * (getStats()?.projectileSpeedMul ?? 1),
        life: 1.3,
        damage: (defs.daggers.dmg * 0.88) * dmgMul,
        radius: 0.24,
        bleed: { dps: 8, duration: 3.5 },
        splash: (getStats()?.extraSplash ?? 0),
        pierce: (getStats()?.projectilePierce ?? 0),
        team: "player"
      });
    }

    camImpulseX = 0.04;
    fx?.addArcFlash?.(origin, 0x00f0ff, 0.35, 0.95);
  }

  function fireBombardBomb() {
    if (!spawnProjectile) return;

    const origin = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    camera.getWorldDirection(camDir).normalize();

    if (bombardAnim.muzzle && typeof bombardAnim.muzzle.getWorldPosition === "function") {
      bombardAnim.muzzle.getWorldPosition(origin);
    } else {
      origin.copy(camPos).addScaledVector(camDir, 0.45);
      origin.y -= 0.12;
    }

    const aimPoint = camPos.clone().addScaledVector(camDir, 60);
    const dir = aimPoint.sub(origin).normalize();

    const dmgMul = (getStats()?.damageMul ?? 1) * (getStats()?.arenaDamageMul ?? 1);

    spawnProjectile({
      kind: "bomb",
      origin,
      dir,
      speed: defs.bombard.speed * (getStats()?.projectileSpeedMul ?? 1),
      life: 3.2,
      damage: defs.bombard.dmg * dmgMul,
      radius: 0.28,
      splash: Math.max(defs.bombard.splash, getStats()?.extraSplash ?? 0),
      team: "player"
    });

    camImpulseX = 0.075;
    camImpulseZ = (Math.random() - 0.5) * 0.025;
    fx?.addArcFlash?.(origin, 0xff8822, 0.40, 0.95);
    fx?.addHit?.(origin, "bomb", 1.2);
  }

  function fireBombardCanister() {
    if (!spawnProjectile) return;

    const origin = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    camera.getWorldDirection(camDir).normalize();

    if (bombardAnim.muzzle && typeof bombardAnim.muzzle.getWorldPosition === "function") {
      bombardAnim.muzzle.getWorldPosition(origin);
    } else {
      origin.copy(camPos).addScaledVector(camDir, 0.45);
      origin.y -= 0.12;
    }

    const dmgMul = (getStats()?.damageMul ?? 1) * (getStats()?.arenaDamageMul ?? 1);
    const count = 8;

    for (let i = 0; i < count; i++) {
      const spreadX = (Math.random() - 0.5) * 0.28;
      const spreadY = (Math.random() - 0.5) * 0.20;
      const spreadZ = (Math.random() - 0.5) * 0.14;
      const pDir = camDir.clone().add(new THREE.Vector3(spreadX, spreadY, spreadZ)).normalize();

      spawnProjectile({
        kind: "shrapnel",
        origin: origin.clone(),
        dir: pDir,
        speed: (26 + Math.random() * 8) * (getStats()?.projectileSpeedMul ?? 1),
        life: 0.85,
        damage: 22 * dmgMul,
        radius: 0.20,
        pierce: 1,
        team: "player"
      });
    }

    camImpulseX = 0.13;
    camImpulseZ = (Math.random() - 0.5) * 0.04;
    fx?.addArcFlash?.(origin, 0xffaa33, 0.55, 1.0);
    fx?.addHit?.(origin, "bomb", 1.8);
  }

  function triggerCamImpulse(step) {
    if (step === 0) {
      // Horizontal cut: subtle leftward roll impulse
      camImpulseZ = -0.015;
      camImpulseX = 0.004;
    } else if (step === 1) {
      // Diagonal cut: subtle rightward roll and slight upward pitch
      camImpulseZ = 0.013;
      camImpulseX = -0.007;
    } else {
      // Overhead slam: crisp downward pitch nod
      camImpulseX = 0.024;
      camImpulseZ = 0.002;
    }
  }

  let comboImpulseFired = false;

  const spearCombos = [
    // 1. Широкий рубящий свип справа налево (Horizontal Cleave)
    // Руки остаются внизу справа, клинок рассекает экран прямо через перекрестие
    { dur: 0.36, dmgMul: 1.10, arc: 1.45, rangeMul: 1.0, active: [0.18, 0.58],
      anim(p) {
        if (p < 0.20) {
          // Замах назад вправо: остриё взводится справа на уровне глаз
          const t = p / 0.20;
          const k = t * t * (3 - 2 * t);
          hand.position.set(
            baseHandPos.x + 0.02 * k,
            baseHandPos.y + 0.02 * k,
            baseHandPos.z + 0.03 * k
          );
          hand.rotation.set(
            baseHandRot.x + 0.04 * k,
            baseHandRot.y - 0.50 * k,
            baseHandRot.z - 0.18 * k
          );
        } else if (p < 0.58) {
          // Рубящий пронос: клинок с высокой скоростью рассекает экран справа налево через прицел
          const t = (p - 0.20) / 0.38;
          const k = t * t * (3 - 2 * t);
          const fwd = Math.sin(t * Math.PI) * 0.06;
          hand.position.set(
            baseHandPos.x + 0.02 - 0.05 * k,
            baseHandPos.y + 0.02,
            baseHandPos.z + 0.03 - fwd
          );
          hand.rotation.set(
            baseHandRot.x + 0.04 + 0.03 * Math.sin(t * Math.PI),
            baseHandRot.y - 0.50 + 1.12 * k,
            baseHandRot.z - 0.18 + 0.53 * k
          );
        } else {
          // Плавный возврат в боевую стойку
          const t = (p - 0.58) / 0.42;
          const k = 1 - t * (2 - t);
          hand.position.set(
            baseHandPos.x - 0.03 * k,
            baseHandPos.y,
            baseHandPos.z
          );
          hand.rotation.set(
            baseHandRot.x + 0.02 * k,
            baseHandRot.y + 0.62 * k,
            baseHandRot.z + 0.35 * k
          );
        }
      }
    },

    // 2. Обратный восходящий диагональный срез (Upward Diagonal Slash)
    // Клинок взмывает снизу-слева через центр в правый верхний угол
    { dur: 0.34, dmgMul: 1.15, arc: 1.35, rangeMul: 1.0, active: [0.16, 0.54],
      anim(p) {
        if (p < 0.16) {
          // Замах снизу-слева
          const t = p / 0.16;
          const k = t * t * (3 - 2 * t);
          hand.position.set(
            baseHandPos.x - 0.04 * k,
            baseHandPos.y - 0.04 * k,
            baseHandPos.z + 0.01 * k
          );
          hand.rotation.set(
            baseHandRot.x - 0.23 * k,
            baseHandRot.y + 0.55 * k,
            baseHandRot.z + 0.48 * k
          );
        } else if (p < 0.54) {
          // Восходящий рубящий срез через прицел
          const t = (p - 0.16) / 0.38;
          const k = t * t * (3 - 2 * t);
          const fwd = Math.sin(t * Math.PI) * 0.05;
          hand.position.set(
            baseHandPos.x - 0.04 + 0.06 * k,
            baseHandPos.y - 0.04 + 0.06 * k,
            baseHandPos.z + 0.01 - fwd
          );
          hand.rotation.set(
            baseHandRot.x - 0.23 + 0.50 * k,
            baseHandRot.y + 0.55 - 1.05 * k,
            baseHandRot.z + 0.48 - 0.83 * k
          );
        } else {
          // Возврат к боевой стойке
          const t = (p - 0.54) / 0.46;
          const k = 1 - t * (2 - t);
          hand.position.set(
            baseHandPos.x + 0.02 * k,
            baseHandPos.y + 0.02 * k,
            baseHandPos.z
          );
          hand.rotation.set(
            baseHandRot.x + 0.27 * k,
            baseHandRot.y - 0.50 * k,
            baseHandRot.z - 0.35 * k
          );
        }
      }
    },

    // 3. Сокрушительный вертикальный удар сверху вниз (Heavy Overhead Slam Finisher)
    // Подъём глефы высоко над головой и мощное обрушение строго по центральной вертикали
    { dur: 0.44, dmgMul: 1.65, arc: 1.15, rangeMul: 1.05, active: [0.22, 0.56],
      anim(p) {
        if (p < 0.22) {
          // Замах: подъём клинка высоко над прицелом
          const t = p / 0.22;
          const k = t * t * (3 - 2 * t);
          hand.position.set(
            baseHandPos.x,
            baseHandPos.y + 0.10 * k,
            baseHandPos.z + 0.05 * k
          );
          hand.rotation.set(
            baseHandRot.x + 0.37 * k,
            baseHandRot.y,
            baseHandRot.z + 0.15 * k
          );
        } else if (p < 0.58) {
          // Мощное обрушение вертикально вниз ровно через центр экрана
          const t = (p - 0.22) / 0.36;
          const k = t * t;
          hand.position.set(
            baseHandPos.x - 0.03 * k,
            baseHandPos.y + 0.10 - 0.18 * k,
            baseHandPos.z + 0.05 - 0.08 * k
          );
          hand.rotation.set(
            baseHandRot.x + 0.37 - 0.62 * k,
            baseHandRot.y,
            baseHandRot.z + 0.15 - 0.20 * k
          );
        } else {
          // Микро-отскок от удара и возврат в стойку
          const t = (p - 0.58) / 0.42;
          const k = 1 - t * (2 - t);
          const bounce = Math.sin(t * Math.PI) * 0.03;
          hand.position.set(
            baseHandPos.x - 0.03 * k,
            baseHandPos.y - 0.08 * k + bounce,
            baseHandPos.z - 0.03 * k
          );
          hand.rotation.set(
            baseHandRot.x - 0.25 * k,
            baseHandRot.y,
            baseHandRot.z - 0.05 * k
          );
        }
      }
    }
  ];

  function startSpearSwing(stepIdx) {
    const s = spearCombos[stepIdx] || spearCombos[0];
    comboStep = stepIdx;
    comboNextStep = (stepIdx + 1) % spearCombos.length;
    swingMax = s.dur;
    swingT = swingMax;
    cd = 0;
    comboGrace = 0.80;
    comboQueued = false;
    comboImpulseFired = false;
    spearHitSet = new Set();
    // consume one-shot radius boost on swing start
    const st = getStats();
    if (st && (st.spearNextRadiusT || 0) > 0) st.spearNextRadiusT = 0;
    spearStreak = 0; spearStreakT = 0;
  }

  function animateSpearCharge(p) {
    const k = p * p * (3 - 2 * p);
    // Chambered coil: deep pull back, aligned firmly with crosshair
    hand.position.set(
      baseHandPos.x - 0.08 * k,
      baseHandPos.y + 0.04 * k,
      baseHandPos.z + 0.16 * k
    );
    hand.rotation.set(
      baseHandRot.x + 0.06 * k,
      baseHandRot.y - 0.15 * k,
      baseHandRot.z + 0.08 * k
    );
    if (spearAnim.runeMat) {
      spearAnim.runeMat.emissiveIntensity = 2.0 + 3.5 * k;
    }
  }

  function startSpearThrust() {
    spearThrustMax = 0.40;
    spearThrustT = spearThrustMax;
    spearThrustCd = 0.95; // 0.95s CD
    spearThrustHitTriggered = false;
    spearThrustHitSet.clear();
    cd = spearThrustMax + 0.06;
  }

  function animateSpearThrust(p) {
    if (p < 0.38) {
      // 1. Мощный стремительный выпад вперед из заряженной стойки
      const t = p / 0.38;
      const k = t * t * (3 - 2 * t);
      hand.position.set(
        baseHandPos.x - 0.08 + 0.04 * k,
        baseHandPos.y + 0.04 - 0.03 * k,
        baseHandPos.z + 0.16 - 0.98 * k
      );
      hand.rotation.set(
        baseHandRot.x + 0.06 - 0.08 * k,
        baseHandRot.y - 0.15 + 0.17 * k,
        baseHandRot.z + 0.08 - 0.10 * k
      );
      if (spearAnim.runeMat) {
        spearAnim.runeMat.emissiveIntensity = 5.5;
      }
    } else {
      // 2. Четкий плавный возврат в исходную боевую стойку
      const t = (p - 0.38) / 0.62;
      const k = 1 - t * (2 - t);
      hand.position.set(
        baseHandPos.x - 0.04 * k,
        baseHandPos.y + 0.01 * k,
        baseHandPos.z - 0.82 * k
      );
      hand.rotation.set(
        baseHandRot.x - 0.02 * k,
        baseHandRot.y + 0.02 * k,
        baseHandRot.z - 0.02 * k
      );
      if (spearAnim.runeMat) {
        spearAnim.runeMat.emissiveIntensity = 2.0 + 3.5 * (1 - t);
      }
    }
  }

  function executeSpearThrustHit() {
    camImpulseX = 0.025;
    camImpulseZ = (Math.random() - 0.5) * 0.02;

    const origin = new THREE.Vector3();
    camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y *= 0.20;
    dir.normalize();

    // Piercing thrust shockwave along the attack line
    fx?.addShockwave?.(origin.clone().addScaledVector(dir, 2.0), 1.6);

    if (!lastEnemiesRef || typeof lastEnemiesRef.forEachInRadius !== "function") return;

    const st = getStats();
    const range = (defs.spear.thrustRange || 4.15) * (st?.spearReachMul ?? 1);
    const arc = 0.32 * (st?.spearArcMul ?? 1); // focused piercing beam (~18.5 deg)

    spearThrustHitSet.clear();

    lastEnemiesRef.forEachInRadius(origin, range, (e) => {
      const ep = (e && e.position) || e?.pos || (e.mesh && e.mesh.position);
      if (!ep) return;

      const to = safeCloneVec3(ep).sub(origin);
      to.y = 0;
      const dist = to.length();
      if (dist > range) return;
      to.normalize();

      if (Math.acos(clamp(to.dot(dir), -1, 1)) > arc) return;

      const id = (e && (e.id ?? e._id ?? e.uuid)) ?? null;
      if (id !== null && spearThrustHitSet.has(id)) return;
      if (id !== null) spearThrustHitSet.add(id);

      let dmg = (defs.spear.thrustDmg || 68) * ((st?.damageMul ?? 1) * (st?.arenaDamageMul ?? 1)) * (st?.spearDamageMul ?? 1);

      // Hit streak bonus applies to thrust as well
      if (spearStreak > 0) {
        const extra = Math.min(Math.max(spearStreak - 1, 0), 2) * 0.10;
        dmg *= (1 + extra);
      }

      // Impale perk bonus
      if (st?.spearImpaleEvery) {
        weaponsState.spearImpaleCounter = (weaponsState.spearImpaleCounter || 0) + 1;
        if ((weaponsState.spearImpaleCounter % st.spearImpaleEvery) === 0) {
          dmg *= (st.spearImpaleMul ?? 1.8);
        }
      }

      const hitPoint = ep ? new THREE.Vector3(ep.x, (ep.y || 0) + 1.1, ep.z) : origin.clone().addScaledVector(dir, 2.8);
      const meta = {
        kind: "spear_thrust",
        combo: 3,
        srcPos: origin,
        point: hitPoint,
        crushShield: true,
        piercing: true,
        stagger: 0.65,
        knockback: 0.90,
        knockDir: dir
      };

      if (st?.spearBleed) {
        meta.bleed = { ...st.spearBleed, chance: Math.min(1.0, (st.spearBleed.chance ?? 0.3) * 1.5) };
      }

      if (typeof lastEnemiesRef.applyDamage === "function") {
        const dealt = lastEnemiesRef.applyDamage(id, dmg, meta);
        if (st?.spearLifesteal) {
          player.hp = clamp(player.hp + dmg * (st.spearLifesteal || 0), 0, player.hpMax);
        }
        if (dealt?.killed && progression?.onKill) {
          progression.onKill(dealt.xp || 0);
          if (dealt.bossLoot && progression.openBossLoot) progression.openBossLoot();
        }
      }

      // Impale streak increment
      spearStreak = Math.min(4, spearStreak + 1);
      spearStreakT = 1.2;
    });
  }

  function startHammerSwing() {
    const st = getStats();
    const asMul = st?.hammerAttackSpeedMul ?? 1.0;
    hammerSwingMax = 0.64 / asMul;
    hammerSwingT = hammerSwingMax;
    cd = hammerSwingMax + 0.08;
    hammerSwingImpulseFired = false;
    hammerHitSet = new Set();
  }

  function startHammerSlam() {
    hammerSlamMax = 0.82;
    hammerSlamT = hammerSlamMax;
    hammerSlamCd = 4.0;
    hammerSlamHitTriggered = false;
    cd = hammerSlamMax + 0.12;
  }

  function animateHammerSwing(p) {
    if (p < 0.26) {
      // Фаза 1: Взвод за правое плечо вверх-назад (преодоление инерции покоя)
      const t = p / 0.26;
      const k = t * t * (3 - 2 * t);
      hand.position.set(
        HAMMER_REST_POS.x + 0.04 * k,
        HAMMER_REST_POS.y + 0.16 * k,
        HAMMER_REST_POS.z + 0.08 * k
      );
      hand.rotation.set(
        HAMMER_REST_ROT.x + 0.22 * k,
        HAMMER_REST_ROT.y - 0.12 * k,
        HAMMER_REST_ROT.z + 0.10 * k
      );
      camImpulseX = -0.015 * k;
      if (hammerAnim.coreMat) hammerAnim.coreMat.emissiveIntensity = 2.2 + 1.2 * k;
    } else if (p < 0.50) {
      // Фаза 2: Обрушение массы вперед и вниз (боёк спереди со свистом летит через прицел)
      const t = (p - 0.26) / 0.24;
      const k = Math.pow(t, 2.2); // Ускорение падающей тяжести

      const startX = HAMMER_REST_POS.x + 0.04;
      const startY = HAMMER_REST_POS.y + 0.16;
      const startZ = HAMMER_REST_POS.z + 0.08;
      const startRx = HAMMER_REST_ROT.x + 0.22;
      const startRy = HAMMER_REST_ROT.y - 0.12;
      const startRz = HAMMER_REST_ROT.z + 0.10;

      const targetX = 0.02, targetY = -0.42, targetZ = -0.48;
      const targetRx = -1.42, targetRy = 0.0, targetRz = 0.0;

      hand.position.set(
        startX + (targetX - startX) * k,
        startY + (targetY - startY) * k,
        startZ + (targetZ - startZ) * k
      );
      hand.rotation.set(
        startRx + (targetRx - startRx) * k,
        startRy + (targetRy - startRy) * k,
        startRz + (targetRz - startRz) * k
      );
    } else if (p < 0.65) {
      // Фаза 3: Жесткий импакт бойком плашмя в землю/цель прямо перед ногами
      hand.position.set(0.02, -0.42, -0.48);
      hand.rotation.set(-1.42, 0.0, 0.0);
    } else {
      // Фаза 4: Инерционный отрыв от земли и плавный подъем обратно на плечо
      const t = (p - 0.65) / 0.35;
      const k = 1 - t * (2 - t);
      hand.position.set(
        HAMMER_REST_POS.x * (1 - k) + 0.02 * k,
        HAMMER_REST_POS.y * (1 - k) - 0.42 * k,
        HAMMER_REST_POS.z * (1 - k) - 0.48 * k
      );
      hand.rotation.set(
        HAMMER_REST_ROT.x * (1 - k) - 1.42 * k,
        HAMMER_REST_ROT.y * (1 - k),
        HAMMER_REST_ROT.z * (1 - k)
      );
      if (hammerAnim.coreMat) hammerAnim.coreMat.emissiveIntensity = 2.2;
    }
  }

  function animateHammerSlam(p) {
    if (p < 0.48) {
      // Фаза 1: Двуручный подъем строго по центру высоко над головой
      const t = p / 0.48;
      const k = t * t * (3 - 2 * t);
      hand.position.set(
        HAMMER_REST_POS.x * (1 - k),
        HAMMER_REST_POS.y + 0.58 * k,
        HAMMER_REST_POS.z + 0.08 * k
      );
      hand.rotation.set(
        HAMMER_REST_ROT.x + 0.55 * k,
        HAMMER_REST_ROT.y * (1 - k),
        HAMMER_REST_ROT.z * (1 - k)
      );
      if (hammerAnim.coreMat) {
        hammerAnim.coreMat.emissiveIntensity = 2.2 + 4.5 * k;
      }
    } else if (p < 0.62) {
      // Фаза 2: Сокрушительное обрушение оземь всем весом тела
      const t = (p - 0.48) / 0.14;
      const k = t * t;
      const startY = HAMMER_REST_POS.y + 0.58;
      const startZ = HAMMER_REST_POS.z + 0.08;
      const startRx = HAMMER_REST_ROT.x + 0.55;
      hand.position.set(
        0,
        startY + (-0.24 - startY) * k,
        startZ + (-0.10 - startZ) * k
      );
      hand.rotation.set(
        startRx + (-1.42 - startRx) * k,
        0,
        0
      );
    } else {
      // Фаза 3: Отскок, сейсмическая вибрация и возвращение в стойку на плече
      const t = (p - 0.62) / 0.38;
      const k = 1 - t * (2 - t);
      const bounce = Math.sin(t * Math.PI) * 0.04;
      hand.position.set(
        HAMMER_REST_POS.x * (1 - k),
        HAMMER_REST_POS.y * (1 - k) - 0.24 * k + bounce,
        HAMMER_REST_POS.z * (1 - k) - 0.10 * k
      );
      hand.rotation.set(
        HAMMER_REST_ROT.x * (1 - k) - 1.42 * k,
        HAMMER_REST_ROT.y * (1 - k),
        HAMMER_REST_ROT.z * (1 - k)
      );
      if (hammerAnim.coreMat) {
        hammerAnim.coreMat.emissiveIntensity = 2.2;
      }
    }
  }

  function executeHammerGroundSlam() {
    camImpulseX = 0.075;
    camImpulseZ = (Math.random() - 0.5) * 0.03;
    const origin = new THREE.Vector3();
    camera.getWorldPosition(origin);
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();

    const slamPos = origin.clone().addScaledVector(fwd, 2.2);
    const groundY = (typeof world?.getGroundY === "function")
      ? world.getGroundY(slamPos.x, slamPos.z)
      : (player?.pos?.y ?? 0.0);
    slamPos.y = groundY + 0.03;

    const st = getStats();
    const radiusMul = st?.hammerSlamRadiusMul ?? 1.0;
    const slamRadius = 4.5 * radiusMul;

    fx?.addShockwave?.(slamPos, 2.8 * radiusMul, 0xffaa22);
    fx?.addShatter?.(slamPos, 2.5, 0xd49b45);

    if (lastEnemiesRef && typeof lastEnemiesRef.forEachInRadius === "function") {
      const stunDur = 1.3 + (st?.hammerStunBonus ?? 0);
      let baseDmg = 75 * (st?.damageMul ?? 1) * (st?.arenaDamageMul ?? 1) * (st?.hammerDamageMul ?? 1);

      lastEnemiesRef.forEachInRadius(slamPos, slamRadius, (e) => {
        const ep = (e && e.position) || e?.pos || (e.mesh && e.mesh.position);
        if (!ep) return;
        const dist = ep.distanceTo(slamPos);
        if (dist > slamRadius) return;

        let dmg = baseDmg;
        if (st?.hammerEpicenter && dist <= 2.2) {
          dmg *= 1.75;
        }
        if (st?.hammerShatterMul && e.kind === "shielder") {
          dmg *= st.hammerShatterMul;
        }

        const knockDir = ep.clone().sub(slamPos).setY(0);
        if (knockDir.lengthSq() > 1e-4) knockDir.normalize();
        else knockDir.copy(fwd);

        const id = (e && (e.id ?? e._id ?? e.uuid)) ?? null;
        const meta = {
          kind: "melee",
          crushShield: true,
          stun: stunDur,
          knockback: (st?.hammerEpicenter ? 3.8 : 2.4),
          knockDir,
          point: ep.clone().add(new THREE.Vector3(0, 1.0, 0))
        };

        if (typeof lastEnemiesRef.applyDamage === "function") {
          const dealt = lastEnemiesRef.applyDamage(id, dmg, meta);
          if (st?.hammerLifesteal) {
            player.hp = clamp(player.hp + dmg * st.hammerLifesteal, 0, player.hpMax);
          }
          if (dealt?.killed && progression?.onKill) {
            progression.onKill(dealt.xp || 0);
            if (dealt.bossLoot && progression.openBossLoot) progression.openBossLoot();
          }
        }
      });
    }
  }

  // --- КОМБО И МЕХАНИКИ МЕЧА И ЩИТА (SWORD & SHIELD) ---
  const swordCombos = [
    {
      name: "slash",
      dur: 0.36,
      active: [0.18, 0.52],
      rangeMul: 1.0,
      dmgMul: 1.0,
      arc: 1.55,
      anim(p) {
        if (p < 0.22) {
          const t = p / 0.22;
          const k = t * t;
          hand.position.set(
            SWORD_REST_POS.x + 0.10 * k,
            SWORD_REST_POS.y + 0.10 * k,
            SWORD_REST_POS.z + 0.06 * k
          );
          hand.rotation.set(
            SWORD_REST_ROT.x + 0.35 * k,
            SWORD_REST_ROT.y + 0.45 * k,
            SWORD_REST_ROT.z - 0.30 * k
          );
        } else if (p < 0.55) {
          const t = (p - 0.22) / 0.33;
          const k = Math.pow(t, 1.8);
          hand.position.set(
            (SWORD_REST_POS.x + 0.10) - 0.48 * k,
            (SWORD_REST_POS.y + 0.10) - 0.20 * k,
            (SWORD_REST_POS.z + 0.06) - 0.12 * k
          );
          hand.rotation.set(
            (SWORD_REST_ROT.x + 0.35) - 0.65 * k,
            (SWORD_REST_ROT.y + 0.45) - 1.15 * k,
            (SWORD_REST_ROT.z - 0.30) + 0.75 * k
          );
        } else {
          const t = (p - 0.55) / 0.45;
          const k = 1 - t * (2 - t);
          hand.position.set(
            SWORD_REST_POS.x * (1 - k) - 0.14 * k,
            SWORD_REST_POS.y * (1 - k) - 0.36 * k,
            SWORD_REST_POS.z * (1 - k) - 0.46 * k
          );
          hand.rotation.set(
            SWORD_REST_ROT.x * (1 - k) - 0.30 * k,
            SWORD_REST_ROT.y * (1 - k) - 0.70 * k,
            SWORD_REST_ROT.z * (1 - k) + 0.45 * k
          );
        }
      }
    },
    {
      name: "backhand",
      dur: 0.34,
      active: [0.18, 0.50],
      rangeMul: 1.0,
      dmgMul: 1.1,
      arc: 1.55,
      anim(p) {
        if (p < 0.20) {
          const t = p / 0.20;
          const k = t * t;
          hand.position.set(
            -0.14 * k + SWORD_REST_POS.x * (1 - k),
            -0.28 * k + SWORD_REST_POS.y * (1 - k),
            -0.38 * k + SWORD_REST_POS.z * (1 - k)
          );
          hand.rotation.set(
            0.20 * k + SWORD_REST_ROT.x * (1 - k),
            -0.60 * k + SWORD_REST_ROT.y * (1 - k),
            0.35 * k + SWORD_REST_ROT.z * (1 - k)
          );
        } else if (p < 0.52) {
          const t = (p - 0.20) / 0.32;
          const k = Math.pow(t, 1.8);
          hand.position.set(
            -0.14 + 0.50 * k,
            -0.28 + 0.08 * k,
            -0.38 - 0.04 * k
          );
          hand.rotation.set(
            0.20 - 0.15 * k,
            -0.60 + 1.25 * k,
            0.35 - 0.65 * k
          );
        } else {
          const t = (p - 0.52) / 0.48;
          const k = 1 - t * (2 - t);
          hand.position.set(
            SWORD_REST_POS.x * (1 - k) + 0.36 * k,
            SWORD_REST_POS.y * (1 - k) - 0.20 * k,
            SWORD_REST_POS.z * (1 - k) - 0.42 * k
          );
          hand.rotation.set(
            SWORD_REST_ROT.x * (1 - k) + 0.05 * k,
            SWORD_REST_ROT.y * (1 - k) + 0.65 * k,
            SWORD_REST_ROT.z * (1 - k) - 0.30 * k
          );
        }
      }
    },
    {
      name: "thrust",
      dur: 0.42,
      active: [0.20, 0.50],
      rangeMul: 1.30, // 3.45m reach
      dmgMul: 1.5,   // 57 dmg
      arc: 0.85,
      anim(p) {
        if (p < 0.22) {
          const t = p / 0.22;
          const k = t * t;
          hand.position.set(
            SWORD_REST_POS.x - 0.06 * k,
            SWORD_REST_POS.y + 0.04 * k,
            SWORD_REST_POS.z + 0.16 * k
          );
          hand.rotation.set(
            SWORD_REST_ROT.x - 0.12 * k,
            SWORD_REST_ROT.y + 0.16 * k,
            SWORD_REST_ROT.z + 0.08 * k
          );
        } else if (p < 0.50) {
          const t = (p - 0.22) / 0.28;
          const k = Math.pow(t, 2.0);
          hand.position.set(
            (SWORD_REST_POS.x - 0.06) - 0.14 * k,
            (SWORD_REST_POS.y + 0.04) + 0.06 * k,
            (SWORD_REST_POS.z + 0.16) - 0.42 * k
          );
          hand.rotation.set(
            (SWORD_REST_ROT.x - 0.12) - 0.03 * k,
            (SWORD_REST_ROT.y + 0.16) - 0.18 * k,
            (SWORD_REST_ROT.z + 0.08) - 0.08 * k
          );
        } else {
          const t = (p - 0.50) / 0.50;
          const k = 1 - t * (2 - t);
          hand.position.set(
            SWORD_REST_POS.x * (1 - k) + 0.04 * k,
            SWORD_REST_POS.y * (1 - k) - 0.16 * k,
            SWORD_REST_POS.z * (1 - k) - 0.66 * k
          );
          hand.rotation.set(
            SWORD_REST_ROT.x * (1 - k),
            SWORD_REST_ROT.y * (1 - k),
            SWORD_REST_ROT.z * (1 - k)
          );
        }
      }
    }
  ];

  function startSwordSwing(step = 0) {
    swordComboStep = step;
    const s = swordCombos[swordComboStep] || swordCombos[0];
    swordSwingMax = s.dur;
    swordSwingT = swordSwingMax;
    swordHitSet.clear();
    swordComboQueued = false;
    swordComboNext = (swordComboStep + 1) % swordCombos.length;
    swordComboGrace = 0.24;
    cd = swordSwingMax * 0.45;
  }

  function animateShieldBashCharge(p) {
    const k = p * p * (3 - 2 * p);
    // Chambered shield pull-back to chest with forward angle
    shieldHand.position.set(
      SHIELD_BLOCK_POS.x - 0.06 * k,
      SHIELD_BLOCK_POS.y - 0.03 * k,
      SHIELD_BLOCK_POS.z + 0.12 * k
    );
    shieldHand.rotation.set(
      SHIELD_BLOCK_ROT.x + 0.12 * k,
      SHIELD_BLOCK_ROT.y - 0.08 * k,
      SHIELD_BLOCK_ROT.z + 0.06 * k
    );
    if (shieldAnim.runeMat) {
      shieldAnim.runeMat.emissiveIntensity = 2.5 + 3.0 * k;
    }
    // Brace sword hand slightly during heavy shield windup
    hand.position.set(
      SWORD_BLOCK_POS.x + 0.03 * k,
      SWORD_BLOCK_POS.y - 0.02 * k,
      SWORD_BLOCK_POS.z + 0.04 * k
    );
    hand.rotation.set(
      SWORD_BLOCK_ROT.x + 0.08 * k,
      SWORD_BLOCK_ROT.y - 0.04 * k,
      SWORD_BLOCK_ROT.z
    );
  }

  function startShieldBash() {
    shieldBashMax = 0.38;
    shieldBashT = shieldBashMax;
    shieldBashHitTriggered = false;
    shieldBashHitSet.clear();
    cd = shieldBashMax + 0.10;
  }

  function updateShield(dt, mouseDown = false) {
    if (shieldBashT > 0) {
      shieldBashT -= dt;
      const p = 1 - shieldBashT / shieldBashMax;
      player?.avatar?.setCombatAction?.({ weapon: "sword", action: "bash", progress: p });
      if (!shieldBashHitTriggered && p >= 0.20) {
        shieldBashHitTriggered = true;
        executeShieldBashHit();
      }
      if (p < 0.36) {
        const t = p / 0.36;
        const k = t * t * (3 - 2 * t);
        shieldHand.position.set(
          SHIELD_BLOCK_POS.x - 0.06 + (0.02 - (SHIELD_BLOCK_POS.x - 0.06)) * k,
          SHIELD_BLOCK_POS.y - 0.03 + (-0.12 - (SHIELD_BLOCK_POS.y - 0.03)) * k,
          SHIELD_BLOCK_POS.z + 0.12 + (-0.58 - (SHIELD_BLOCK_POS.z + 0.12)) * k
        );
        shieldHand.rotation.set(
          SHIELD_BLOCK_ROT.x + 0.12 + (-0.10 - (SHIELD_BLOCK_ROT.x + 0.12)) * k,
          SHIELD_BLOCK_ROT.y - 0.08 + (0.0 - (SHIELD_BLOCK_ROT.y - 0.08)) * k,
          SHIELD_BLOCK_ROT.z + 0.06 + (0.0 - (SHIELD_BLOCK_ROT.z + 0.06)) * k
        );
        if (shieldAnim.runeMat) {
          shieldAnim.runeMat.emissiveIntensity = 5.5;
        }
      } else {
        const t = (p - 0.36) / 0.64;
        const k = 1 - t * (2 - t);
        shieldHand.position.set(
          SHIELD_BLOCK_POS.x * (1 - k) + 0.02 * k,
          SHIELD_BLOCK_POS.y * (1 - k) - 0.12 * k,
          SHIELD_BLOCK_POS.z * (1 - k) - 0.58 * k
        );
        shieldHand.rotation.set(
          SHIELD_BLOCK_ROT.x * (1 - k) - 0.10 * k,
          SHIELD_BLOCK_ROT.y * (1 - k),
          SHIELD_BLOCK_ROT.z * (1 - k)
        );
        if (shieldAnim.runeMat) {
          shieldAnim.runeMat.emissiveIntensity = 2.5 + 3.0 * (1 - t);
        }
      }
      if (shieldBashT <= 0) {
        shieldBashT = 0;
        player?.avatar?.setCombatAction?.(null);
      }
    } else if (shieldBashCharging) {
      if (!shieldBlocking) {
        shieldBashCharging = false;
        shieldBashCharge = 0;
        shieldBashCommitted = false;
        setChargeRing(0);
      } else {
        shieldBashCharge = Math.min(SHIELD_BASH_CHARGE_MAX, shieldBashCharge + dt);
        const p = shieldBashCharge / SHIELD_BASH_CHARGE_MAX;
        animateShieldBashCharge(p);
        setChargeRing(p, "#ffb700");
        player?.avatar?.setCombatAction?.({ weapon: "sword", action: "bash_charge", progress: p });

        if (!mouseDown) {
          if (p >= 0.70) {
            shieldBashCharging = false;
            shieldBashCharge = 0;
            shieldBashCommitted = false;
            setChargeRing(0);
            startShieldBash();
          } else if (!shieldBashCommitted) {
            shieldBashCommitted = true;
          }
        }

        if (shieldBashCommitted && p >= 1.0) {
          shieldBashCharging = false;
          shieldBashCharge = 0;
          shieldBashCommitted = false;
          setChargeRing(0);
          startShieldBash();
        }
      }
    } else if (shieldBlocking) {
      shieldBlockT = Math.min(1, shieldBlockT + dt * 7.5);
      shieldParryTimer += dt;
      player?.avatar?.setCombatAction?.({ weapon: "sword", action: "block", progress: shieldBlockT });

      const k = shieldBlockT * shieldBlockT * (3 - 2 * shieldBlockT);
      shieldHand.position.lerpVectors(SHIELD_REST_POS, SHIELD_BLOCK_POS, k);
      shieldHand.rotation.x = SHIELD_REST_ROT.x * (1 - k) + SHIELD_BLOCK_ROT.x * k;
      shieldHand.rotation.y = SHIELD_REST_ROT.y * (1 - k) + SHIELD_BLOCK_ROT.y * k;
      shieldHand.rotation.z = SHIELD_REST_ROT.z * (1 - k) + SHIELD_BLOCK_ROT.z * k;

      if (swordSwingT <= 0) {
        hand.position.lerpVectors(SWORD_REST_POS, SWORD_BLOCK_POS, k);
        hand.rotation.x = SWORD_REST_ROT.x * (1 - k) + SWORD_BLOCK_ROT.x * k;
        hand.rotation.y = SWORD_REST_ROT.y * (1 - k) + SWORD_BLOCK_ROT.y * k;
        hand.rotation.z = SWORD_REST_ROT.z * (1 - k) + SWORD_BLOCK_ROT.z * k;
      }
    } else {
      shieldBlockT = Math.max(0, shieldBlockT - dt * 6.5);
      shieldParryTimer = 999;
      if (shieldBlockT > 0) {
        const k = shieldBlockT * shieldBlockT * (3 - 2 * shieldBlockT);
        shieldHand.position.lerpVectors(SHIELD_REST_POS, SHIELD_BLOCK_POS, k);
        shieldHand.rotation.x = SHIELD_REST_ROT.x * (1 - k) + SHIELD_BLOCK_ROT.x * k;
        shieldHand.rotation.y = SHIELD_REST_ROT.y * (1 - k) + SHIELD_BLOCK_ROT.y * k;
        shieldHand.rotation.z = SHIELD_REST_ROT.z * (1 - k) + SHIELD_BLOCK_ROT.z * k;
      } else {
        shieldHand.position.copy(SHIELD_REST_POS);
        shieldHand.rotation.copy(SHIELD_REST_ROT);
      }
    }
  }

  function executeShieldBashHit() {
    camImpulseX = -0.035;
    camImpulseZ = (Math.random() - 0.5) * 0.04;

    const origin = new THREE.Vector3();
    camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y *= 0.25;
    dir.normalize();

    fx?.addShockwave?.(origin.clone().addScaledVector(dir, 1.2), 2.2);

    if (!lastEnemiesRef || typeof lastEnemiesRef.forEachInRadius !== "function") return;
    const range = 2.65;
    const arc = 1.85; // 105 deg

    lastEnemiesRef.forEachInRadius(origin, range, (e) => {
      const ep = (e && e.position) || e?.pos || (e.mesh && e.mesh.position);
      if (!ep) return;
      const to = safeCloneVec3(ep).sub(origin);
      to.y = 0;
      if (to.length() > range) return;
      to.normalize();
      if (Math.acos(clamp(to.dot(dir), -1, 1)) > arc) return;

      const id = (e && (e.id ?? e._id ?? e.uuid)) ?? null;
      if (id !== null && shieldBashHitSet.has(id)) return;
      if (id !== null) shieldBashHitSet.add(id);

      const hitPoint = ep ? new THREE.Vector3(ep.x, (ep.y || 0) + 1.0, ep.z) : origin.clone().addScaledVector(dir, 1.6);
      const knockDir = to.clone();

      const meta = {
        kind: "blunt",
        stagger: 1.5,
        knockback: 4.2,
        knockDir,
        srcPos: origin,
        point: hitPoint
      };

      if (typeof lastEnemiesRef.applyDamage === "function") {
        const dealt = lastEnemiesRef.applyDamage(id, 32, meta);
        if (dealt?.killed && progression?.onKill) {
          progression.onKill(dealt.xp || 0);
          if (dealt.bossLoot && progression.openBossLoot) progression.openBossLoot();
        }
      }
    });
  }

  function triggerPerfectParry(meta) {
    camImpulseX = 0.035;
    camImpulseZ = (Math.random() - 0.5) * 0.05;

    const origin = new THREE.Vector3();
    camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);

    fx?.addShockwave?.(origin.clone().addScaledVector(dir, 1.2), 2.5);
    fx?.addHit?.(origin.clone().addScaledVector(dir, 1.0), "crit", 2.5);

    swordNextHitCrit = true;

    if (lastEnemiesRef && typeof lastEnemiesRef.forEachInRadius === "function") {
      lastEnemiesRef.forEachInRadius(origin, 3.2, (e) => {
        const ep = (e && e.position) || e?.pos || (e.mesh && e.mesh.position);
        if (!ep) return;
        const to = safeCloneVec3(ep).sub(origin);
        to.y = 0;
        if (to.length() > 3.2) return;
        to.normalize();
        if (to.dot(dir) < 0.3) return;
        const id = (e && (e.id ?? e._id ?? e.uuid)) ?? null;
        if (typeof lastEnemiesRef.applyDamage === "function") {
          lastEnemiesRef.applyDamage(id, 14, {
            kind: "parry",
            stagger: 1.8,
            knockback: 3.5,
            knockDir: to,
            srcPos: origin
          });
        }
      });
    }
  }

  function triggerShieldBlock(absorbedDmg) {
    camImpulseX = -0.018;
    const origin = new THREE.Vector3();
    camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    fx?.addHit?.(origin.clone().addScaledVector(dir, 0.9), "metal", 1.3);
  }

  // Hook player damage for Shield Blocking & Perfect Parry
  const originalPlayerApplyDamage = player.applyDamage?.bind(player);
  if (originalPlayerApplyDamage) {
    player.applyDamage = function (dmg, meta = {}) {
      if (weapon === "sword" && shieldBlocking) {
        if (shieldParryTimer <= 0.25) {
          triggerPerfectParry(meta);
          return;
        } else {
          triggerShieldBlock(dmg * 0.80);
          originalPlayerApplyDamage(dmg * 0.20, meta);
          return;
        }
      }
      originalPlayerApplyDamage(dmg, meta);
    };
  }

  function equip(w) {
    if (!defs[w]) w = "spear";
    weapon = w;
    weaponName = defs[w].name;

    cd = 0; swingT = 0; castT = 0; bowCharge = 0; bowCharging = false;
    comboStep = 0; comboNextStep = 0; comboGrace = 0; comboQueued = false;
    spearHitSet = new Set();
    spearThrustT = 0;
    spearThrustCd = 0;
    spearThrustHitTriggered = false;
    spearThrustHitSet.clear();
    spearCharging = false;
    spearCharge = 0;
    spearChargeCommitted = false;
    hammerSwingT = 0;
    hammerSlamT = 0;
    hammerSlamCd = 0;
    hammerHitSet = new Set();
    hammerSwingImpulseFired = false;
    hammerSlamHitTriggered = false;
    comboImpulseFired = false;
    camImpulseZ = 0;
    camImpulseX = 0;
    if (camera) {
      camera.rotation.z = 0;
      camera.rotation.x = 0;
    }
    spearStreak = 0; spearStreakT = 0;

    swordSwingT = 0; swordComboStep = 0; swordComboNext = 0; swordComboGrace = 0; swordComboQueued = false;
    swordHitSet.clear(); swordNextHitCrit = false;
    shieldBlocking = false; shieldBlockT = 0; shieldParryTimer = 999;
    shieldBashT = 0; shieldBashHitTriggered = false; shieldBashHitSet.clear();
    shieldBashCharging = false;
    shieldBashCharge = 0;
    shieldBashCommitted = false;
    daggerThrowT = 0;
    daggerFanT = 0;
    daggerFanCd = 0;
    bombardRecoilT = 0;
    bombardCanisterT = 0;
    bombardCanisterCd = 0;
    setChargeRing(0);

    buildModel(w);
    if (w === "bow") setBowPull(0);

    if (fpsArms) {
      fpsArms.setVisible(true);
      if (w === "hammer") fpsArms.setRuneColor(0xffaa22);
      else if (w === "spear") fpsArms.setRuneColor(0x00f0ff);
      else if (w === "sword") fpsArms.setRuneColor(0xffcc22);
      else if (w === "bow") fpsArms.setRuneColor(0x00f0ff);
      else if (w === "daggers") fpsArms.setRuneColor(0x00f0ff);
      else if (w === "bombard") fpsArms.setRuneColor(0xff8822);
      else if (w === "staff" || w === "scepter" || w === "grimoire") fpsArms.setRuneColor(0xff2387);
    }

    if (w === "hammer") {
      hand.position.copy(HAMMER_REST_POS);
      hand.rotation.copy(HAMMER_REST_ROT);
    } else if (w === "sword") {
      hand.position.copy(SWORD_REST_POS);
      hand.rotation.copy(SWORD_REST_ROT);
      shieldHand.position.copy(SHIELD_REST_POS);
      shieldHand.rotation.copy(SHIELD_REST_ROT);
    } else if (w === "bow") {
      hand.position.copy(BOW_REST_POS);
      hand.rotation.copy(BOW_REST_ROT);
    } else if (w === "daggers") {
      hand.position.copy(DAGGER_R_REST_POS);
      hand.rotation.copy(DAGGER_R_REST_ROT);
      shieldHand.position.copy(DAGGER_L_REST_POS);
      shieldHand.rotation.copy(DAGGER_L_REST_ROT);
    } else if (w === "bombard") {
      hand.position.copy(BOMBARD_REST_POS);
      hand.rotation.copy(BOMBARD_REST_ROT);
    } else if (w === "staff") {
      hand.position.copy(STAFF_REST_POS);
      hand.rotation.copy(STAFF_REST_ROT);
    } else if (w === "scepter") {
      hand.position.copy(SCEPTER_REST_POS);
      hand.rotation.copy(SCEPTER_REST_ROT);
    } else if (w === "grimoire") {
      hand.position.copy(GRIMOIRE_REST_POS);
      hand.rotation.copy(GRIMOIRE_REST_ROT);
    } else {
      hand.position.copy(baseHandPos);
      hand.rotation.copy(baseHandRot);
    }

    mageCastT = 0;
    grimoireCastT = 0;
    scepterBeamActive = false;
    scepterBeamTimer = 0;
    scepterNovaT = 0;
    voidBeam?.hide();
    groundReticle?.hide();

    // Synchronize 3rd-person avatar representation
    if (player && player.avatar) {
      player.avatar.setWeapon?.(w);
      player.avatar.setCombatAction?.(null);
    }
  }

  function tick(dt) {
    if (!weapon) return;
    cd = Math.max(0, cd - dt);

    const mouseDown = !!input?.mouse?.down;
    const justPressed = mouseDown && !prevMouseDown;
    prevMouseDown = mouseDown;

    const rightDown = !!input?.mouse?.rightDown;
    const rightJustPressed = rightDown && !prevRightMouseDown;
    prevRightMouseDown = rightDown;

    if (comboGrace > 0) comboGrace = Math.max(0, comboGrace - dt);
    if (spearStreakT > 0) {
      spearStreakT = Math.max(0, spearStreakT - dt);
      if (spearStreakT === 0) spearStreak = 0;
    }

    if (hammerSlamCd > 0) hammerSlamCd = Math.max(0, hammerSlamCd - dt);

    tickActiveSpells(dt);

    const st0 = getStats();
    if (st0 && (st0.spearNextRadiusT || 0) > 0) st0.spearNextRadiusT = Math.max(0, st0.spearNextRadiusT - dt);

    if (weapon === "hammer") {
      if (hammerSlamT > 0) {
        hammerSlamT -= dt;
        const p = 1 - hammerSlamT / hammerSlamMax;
        animateHammerSlam(p);
        player?.avatar?.setCombatAction?.({ weapon: "hammer", action: "slam", progress: p });
        if (!hammerSlamHitTriggered && p >= 0.54) {
          hammerSlamHitTriggered = true;
          executeHammerGroundSlam();
        }
        if (hammerSlamT <= 0) {
          hammerSlamT = 0;
          player?.avatar?.setCombatAction?.(null);
        }
      } else if (hammerSwingT > 0) {
        hammerSwingT -= dt;
        const p = 1 - hammerSwingT / hammerSwingMax;
        animateHammerSwing(p);
        player?.avatar?.setCombatAction?.({ weapon: "hammer", action: "swing", progress: p });
        if (!hammerSwingImpulseFired && p >= 0.50) {
          hammerSwingImpulseFired = true;
          camImpulseX = 0.095;
          camImpulseZ = (Math.random() - 0.5) * 0.035;
        }
        if (hammerSwingT <= 0) {
          hammerSwingT = 0;
          player?.avatar?.setCombatAction?.(null);
        }
      } else {
        player?.avatar?.setCombatAction?.(null);
        hand.rotation.copy(HAMMER_REST_ROT);
        hand.position.copy(HAMMER_REST_POS);

        if (rightJustPressed && hammerSlamCd <= 0 && hammerSwingT <= 0) {
          startHammerSlam();
        } else if (justPressed && cd <= 0 && hammerSlamT <= 0) {
          startHammerSwing();
        }
      }
    }

    if (weapon === "sword") {
      shieldBlocking = rightDown && shieldBashT <= 0;
      if (rightJustPressed) {
        shieldParryTimer = 0;
      }
      updateShield(dt, mouseDown);

      if (swordSwingT > 0) {
        swordSwingT -= dt;
        const s = swordCombos[swordComboStep] || swordCombos[0];
        const p = 1 - swordSwingT / swordSwingMax;
        s.anim(p);
        player?.avatar?.setCombatAction?.({ weapon: "sword", action: `slash_${swordComboStep + 1}`, progress: p });

        if (justPressed && p >= s.active[0] && swordComboGrace > 0) {
          swordComboQueued = true;
        }

        if (swordSwingT <= 0) {
          swordSwingT = 0;
          player?.avatar?.setCombatAction?.(null);
          if (swordComboQueued) {
            startSwordSwing(swordComboNext);
          }
        }
      } else if (!shieldBashCharging && shieldBashT <= 0) {
        if (!shieldBlocking) {
          player?.avatar?.setCombatAction?.(null);
          hand.rotation.copy(SWORD_REST_ROT);
          hand.position.copy(SWORD_REST_POS);
        }

        if (shieldBlocking && justPressed && cd <= 0) {
          shieldBashCharging = true;
          shieldBashCharge = 0;
          shieldBashCommitted = false;
        } else if (!shieldBlocking && justPressed && cd <= 0) {
          startSwordSwing(swordComboNext && swordComboGrace > 0 ? swordComboNext : 0);
        }
      }

      if (swordComboGrace > 0) {
        swordComboGrace -= dt;
        if (swordComboGrace <= 0) {
          swordComboNext = 0;
        }
      }
    }

    if (weapon === "spear") {
      if (spearThrustCd > 0) spearThrustCd = Math.max(0, spearThrustCd - dt);

      if (spearThrustT > 0) {
        spearThrustT -= dt;
        const p = 1 - spearThrustT / spearThrustMax;
        animateSpearThrust(p);
        player?.avatar?.setCombatAction?.({ weapon: "spear", action: "thrust", progress: p });

        if (!spearThrustHitTriggered && p >= 0.20) {
          spearThrustHitTriggered = true;
          executeSpearThrustHit();
        }

        if (spearThrustT <= 0) {
          spearThrustT = 0;
          player?.avatar?.setCombatAction?.(null);
          hand.rotation.copy(baseHandRot);
          hand.position.copy(baseHandPos);
        }
      } else if (spearCharging) {
        // Feint/Cancel charge into swing if player clicks LMB
        if (justPressed) {
          spearCharging = false;
          spearCharge = 0;
          spearChargeCommitted = false;
          setChargeRing(0);
          startSpearSwing(comboNextStep);
        } else {
          spearCharge = Math.min(SPEAR_CHARGE_MAX, spearCharge + dt);
          const p = spearCharge / SPEAR_CHARGE_MAX;
          animateSpearCharge(p);
          setChargeRing(p, "#00f0ff");
          player?.avatar?.setCombatAction?.({ weapon: "spear", action: "charge", progress: p });

          if (!rightDown) {
            if (p >= 0.70) {
              spearCharging = false;
              spearCharge = 0;
              spearChargeCommitted = false;
              setChargeRing(0);
              startSpearThrust();
            } else if (!spearChargeCommitted) {
              spearChargeCommitted = true;
            }
          }

          if (spearChargeCommitted && p >= 1.0) {
            spearCharging = false;
            spearCharge = 0;
            spearChargeCommitted = false;
            setChargeRing(0);
            startSpearThrust();
          }
        }
      } else if (swingT > 0) {
        swingT -= dt;
        const p = 1 - swingT / swingMax;
        const s = spearCombos[comboStep] || spearCombos[0];
        s.anim(p);
        player?.avatar?.setCombatAction?.({ weapon: "spear", action: "swing", progress: p, comboStep });

        // Trigger camera impulse on the active slice frame
        if (!comboImpulseFired && p >= s.active[0]) {
          comboImpulseFired = true;
          triggerCamImpulse(comboStep);
        }

        if (justPressed && p > 0.45 && p < 0.95) comboQueued = true;

        if (swingT <= 0) {
          swingT = 0;
          player?.avatar?.setCombatAction?.(null);
          if (spearHitSet.size === 0) spearStreak = 0;
          if (comboQueued) {
            startSpearSwing(comboNextStep);
          }
        }
      } else {
        player?.avatar?.setCombatAction?.(null);
        hand.rotation.copy(baseHandRot);
        hand.position.copy(baseHandPos);

        if (comboGrace <= 0) {
          comboStep = 0;
          comboNextStep = 0;
        }

        if (rightJustPressed && spearThrustCd <= 0 && cd <= 0) {
          spearCharging = true;
          spearCharge = 0;
          spearChargeCommitted = false;
        } else if (justPressed && cd <= 0) {
          startSpearSwing(comboNextStep);
        }
      }

      if (comboGrace > 0) comboGrace -= dt;
    }

    if (weapon === "bow") {
      if (input.mouse.down) {
        bowCharging = true;
        bowCharge = Math.min(defs.bow.chargeTime, bowCharge + dt);
        const p = bowCharge / defs.bow.chargeTime;
        setBowPull(p);
        setChargeRing(p, "#00f0ff");
        player?.avatar?.setCombatAction?.({ weapon: "bow", action: "draw", progress: p });
        // Draw animation: smoothly bring bow into archer firing alignment
        hand.position.set(
          BOW_REST_POS.x - 0.05 * p,
          BOW_REST_POS.y + 0.04 * p,
          BOW_REST_POS.z + 0.03 * p
        );
        hand.rotation.set(
          BOW_REST_ROT.x - 0.05 * p,
          BOW_REST_ROT.y + 0.03 * p,
          BOW_REST_ROT.z - 0.08 * p
        );
      } else if (bowCharging) {
        bowCharging = false;
        setChargeRing(0);
        player?.avatar?.setCombatAction?.(null);
        if (cd <= 0) fireBow();
        bowCharge = 0;
        setBowPull(0);
        hand.position.copy(BOW_REST_POS);
        hand.rotation.copy(BOW_REST_ROT);
      } else {
        player?.avatar?.setCombatAction?.(null);
        setBowPull(0);
        hand.position.copy(BOW_REST_POS);
        hand.rotation.copy(BOW_REST_ROT);
      }
    }

    if (weapon === "staff") {
      if (staffVortexCd > 0) staffVortexCd = Math.max(0, staffVortexCd - dt);

      // Continuous crystal & shard idle rotation
      if (staffAnim?.crystal) {
        staffAnim.crystal.rotation.y += dt * 2.8;
        staffAnim.crystal.rotation.z += dt * 1.4;
      }
      if (staffAnim?.shardGroup) {
        staffAnim.shardGroup.rotation.y += dt * 2.2;
      }

      // RMB: Singularity Vortex
      if (rightJustPressed && staffVortexCd <= 0 && cd <= 0) {
        staffVortexCd = 4.5;
        cd = 0.40;
        const target = getGroundTarget(28);
        spawnSingularityVortex(target);
        hand.position.z += 0.08;
        hand.rotation.x -= 0.18;
      }

      // LMB: Channel Ground Abyssal Pillar
      const maxCast = 0.45 / (getStats()?.attackSpeedMul ?? 1);
      if (mouseDown && cd <= 0) {
        mageCastT = Math.min(maxCast, mageCastT + dt);
        const progress = mageCastT / maxCast;
        setChargeRing(progress, "#ff2387");

        const target = getGroundTarget(28);
        groundReticle.show(target, 3.8, 0xff2387, progress);

        // Staff rises into casting posture and shards spin faster
        hand.position.set(
          STAFF_REST_POS.x,
          STAFF_REST_POS.y + 0.08 * progress,
          STAFF_REST_POS.z - 0.06 * progress
        );
        hand.rotation.set(
          STAFF_REST_ROT.x + 0.22 * progress,
          STAFF_REST_ROT.y - 0.10 * progress,
          STAFF_REST_ROT.z + 0.14 * progress
        );

        if (staffAnim?.crystalMat) staffAnim.crystalMat.emissiveIntensity = 2.8 + 2.5 * progress;
        if (staffAnim?.shardGroup) staffAnim.shardGroup.rotation.y += dt * 8.0 * progress;

        player?.avatar?.setCombatAction?.({ weapon: "staff", action: "cast", progress });
      } else {
        if (mageCastT > 0) {
          if (mageCastT >= maxCast * 0.75) {
            // Full cast: spawn Abyssal Pillar!
            const target = getGroundTarget(28);
            spawnAbyssalPillar(target);
            cd = 0.50;
            // Slam recoil
            hand.position.y -= 0.12;
            hand.rotation.x -= 0.30;
            camImpulseX = 0.025;
          }
          mageCastT = 0;
          setChargeRing(0);
          groundReticle.hide();
          player?.avatar?.setCombatAction?.(null);
        } else {
          // Return to rest position smoothly
          hand.position.lerp(STAFF_REST_POS, Math.min(1, dt * 14));
          hand.rotation.x = THREE.MathUtils.lerp(hand.rotation.x, STAFF_REST_ROT.x, Math.min(1, dt * 14));
          hand.rotation.y = THREE.MathUtils.lerp(hand.rotation.y, STAFF_REST_ROT.y, Math.min(1, dt * 14));
          hand.rotation.z = THREE.MathUtils.lerp(hand.rotation.z, STAFF_REST_ROT.z, Math.min(1, dt * 14));
          if (staffAnim?.crystalMat) staffAnim.crystalMat.emissiveIntensity = THREE.MathUtils.lerp(staffAnim.crystalMat.emissiveIntensity, 2.8, Math.min(1, dt * 10));
        }
      }
    }

    if (weapon === "scepter") {
      if (scepterNovaCd > 0) scepterNovaCd = Math.max(0, scepterNovaCd - dt);

      // Continuous prism rotation
      if (scepterAnim?.prism) {
        scepterAnim.prism.rotation.y += dt * 3.5;
        scepterAnim.prism.rotation.x += dt * 1.8;
      }

      // RMB: Cataclysm Nova
      if (scepterNovaT > 0) {
        scepterNovaT -= dt;
        const p = 1 - scepterNovaT / 0.35;
        const kick = Math.sin(p * Math.PI);
        hand.position.set(
          SCEPTER_REST_POS.x,
          SCEPTER_REST_POS.y + 0.10 * kick,
          SCEPTER_REST_POS.z + 0.16 * kick
        );
        hand.rotation.set(
          SCEPTER_REST_ROT.x - 0.35 * kick,
          SCEPTER_REST_ROT.y + 0.05 * kick,
          SCEPTER_REST_ROT.z + 0.12 * kick
        );
        if (scepterNovaT <= 0) {
          scepterNovaT = 0;
          hand.position.copy(SCEPTER_REST_POS);
          hand.rotation.copy(SCEPTER_REST_ROT);
        }
      } else if (rightJustPressed && scepterNovaCd <= 0 && cd <= 0) {
        scepterNovaCd = 3.2;
        cd = 0.35;
        scepterNovaT = 0.35;

        // Fire cone nova
        const origin = new THREE.Vector3();
        camera.getWorldPosition(origin);
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir).normalize();

        const blastCenter = origin.clone().addScaledVector(dir, 3.5);
        fx?.addShockwave?.(blastCenter, 5.5, 0xff2387);
        fx?.addHit?.(blastCenter, "bomb", 2.5);
        camImpulseX = 0.035;

        const dmgMul = (getStats()?.damageMul ?? 1) * (getStats()?.arenaDamageMul ?? 1);
        if (lastEnemiesRef && typeof lastEnemiesRef.forEachInRadius === "function") {
          lastEnemiesRef.forEachInRadius(origin, 8.5, (e) => {
            if (!e) return;
            const ep = e.pos || e.root?.position || origin;
            const to = ep.clone().sub(origin);
            const dist = to.length();
            if (dist < 0.2) return;
            to.normalize();
            if (to.dot(dir) < 0.25) return; // ~150 deg forward cone

            if (typeof lastEnemiesRef.applyDamage === "function") {
              const dealt = lastEnemiesRef.applyDamage(e.id, 75 * dmgMul, {
                knockback: 6.2,
                knockDir: to,
                stun: 0.9,
                kind: "spell",
                point: ep
              });
              if (dealt?.killed && progression?.onKill) {
                progression.onKill(dealt.xp || 0);
              }
            }
          });
        }
      } else if (mouseDown && cd <= 0) {
        // LMB: Sustained Void Beam (channeled laser)
        scepterBeamActive = true;
        scepterBeamTimer += dt;

        // Firing pose with slight chaotic vibration
        const time = (performance.now() || 0) * 0.05;
        const jx = Math.sin(time * 1.7) * 0.003;
        const jy = Math.cos(time * 2.1) * 0.003;
        hand.position.set(0.18 + jx, -0.16 + jy, -0.42);
        hand.rotation.set(0.04, -0.05, 0.02);

        if (scepterAnim?.prismMat) scepterAnim.prismMat.emissiveIntensity = 4.5 + Math.random() * 1.5;

        // Raycast beam
        const camPos = new THREE.Vector3();
        const camDir = new THREE.Vector3();
        camera.getWorldPosition(camPos);
        camera.getWorldDirection(camDir).normalize();

        let muzzlePos = camPos.clone().addScaledVector(camDir, 0.4);
        if (scepterAnim?.muzzle) scepterAnim.muzzle.getWorldPosition(muzzlePos);

        const maxRange = 26;
        let hitPoint = camPos.clone().addScaledVector(camDir, maxRange);
        let closestDist = maxRange;
        let hitEnemy = null;

        if (lastEnemiesRef && typeof lastEnemiesRef.forEachInRadius === "function") {
          lastEnemiesRef.forEachInRadius(camPos, maxRange, (e) => {
            if (!e) return;
            const ep = e.pos || e.root?.position;
            if (!ep) return;
            const toEnemy = ep.clone().sub(camPos);
            const projDist = toEnemy.dot(camDir);
            if (projDist > 0.4 && projDist < closestDist) {
              const perpDistSq = toEnemy.lengthSq() - projDist * projDist;
              const enemyR = e.radius || 0.85;
              if (perpDistSq < enemyR * enemyR) {
                closestDist = projDist;
                hitEnemy = e;
                hitPoint = camPos.clone().addScaledVector(camDir, projDist);
              }
            }
          });
        }

        voidBeam.update(muzzlePos, hitPoint);

        // Tick damage every 0.10s
        if (scepterBeamTimer >= 0.10) {
          scepterBeamTimer -= 0.10;
          fx?.addImpact?.(hitPoint, 1.2, 0xff2387);
          fx?.addArcFlash?.(hitPoint, 0xff0066, 0.18, 0.7);

          if (hitEnemy && lastEnemiesRef && typeof lastEnemiesRef.applyDamage === "function") {
            const dmgMul = (getStats()?.damageMul ?? 1) * (getStats()?.arenaDamageMul ?? 1);
            const dealt = lastEnemiesRef.applyDamage(hitEnemy.id, 16 * dmgMul, {
              kind: "spell",
              point: hitPoint,
              burn: { dur: 2.0, dps: 8 }
            });
            if (dealt?.killed && progression?.onKill) {
              progression.onKill(dealt.xp || 0);
            }
          }
        }
      } else {
        if (scepterBeamActive) {
          scepterBeamActive = false;
          scepterBeamTimer = 0;
          voidBeam.hide();
        }
        hand.position.lerp(SCEPTER_REST_POS, Math.min(1, dt * 14));
        hand.rotation.x = THREE.MathUtils.lerp(hand.rotation.x, SCEPTER_REST_ROT.x, Math.min(1, dt * 14));
        hand.rotation.y = THREE.MathUtils.lerp(hand.rotation.y, SCEPTER_REST_ROT.y, Math.min(1, dt * 14));
        hand.rotation.z = THREE.MathUtils.lerp(hand.rotation.z, SCEPTER_REST_ROT.z, Math.min(1, dt * 14));
        if (scepterAnim?.prismMat) scepterAnim.prismMat.emissiveIntensity = THREE.MathUtils.lerp(scepterAnim.prismMat.emissiveIntensity, 3.2, Math.min(1, dt * 10));
      }
    }

    if (weapon === "grimoire") {
      if (grimoireDomeCd > 0) grimoireDomeCd = Math.max(0, grimoireDomeCd - dt);

      // Idle levitation & breathing
      const time = (performance.now() || 0) * 0.0025;
      if (grimoireAnim?.talisman) {
        grimoireAnim.talisman.position.z = -0.065 + Math.sin(time * 3.5) * 0.006;
      }
      if (grimoireAnim?.pagesL && grimoireAnim?.pagesR) {
        grimoireAnim.pagesL.rotation.y = -0.24 + Math.sin(time * 2.0) * 0.02;
        grimoireAnim.pagesR.rotation.y = 0.24 - Math.sin(time * 2.0) * 0.02;
      }

      // RMB: Chrono Dilation Dome
      if (rightJustPressed && grimoireDomeCd <= 0 && cd <= 0) {
        grimoireDomeCd = 8.0;
        cd = 0.45;
        const target = getGroundTarget(16);
        spawnChronoDome(target);
        hand.position.y += 0.06;
        hand.rotation.x += 0.20;
      }

      // LMB: Deep Ritual Cast: Astral Meteor Drop
      const METEOR_CAST_MAX = 0.85 / (getStats()?.attackSpeedMul ?? 1);
      if (mouseDown && cd <= 0) {
        grimoireCastT = Math.min(METEOR_CAST_MAX, grimoireCastT + dt);
        const progress = grimoireCastT / METEOR_CAST_MAX;
        setChargeRing(progress, "#9933ff");

        const target = getGroundTarget(34);
        groundReticle.show(target, 5.5, 0x9933ff, progress);

        // Grimoire elevates, opens wider, pages flutter rapidly
        const flutter = Math.sin((performance.now() || 0) * 0.035) * 0.06 * progress;
        if (grimoireAnim?.pagesL && grimoireAnim?.pagesR) {
          grimoireAnim.pagesL.rotation.y = -0.24 - 0.15 * progress + flutter;
          grimoireAnim.pagesR.rotation.y = 0.24 + 0.15 * progress - flutter;
        }
        hand.position.set(
          GRIMOIRE_REST_POS.x,
          GRIMOIRE_REST_POS.y + 0.10 * progress,
          GRIMOIRE_REST_POS.z - 0.05 * progress
        );
        hand.rotation.set(
          GRIMOIRE_REST_ROT.x + 0.18 * progress,
          GRIMOIRE_REST_ROT.y,
          GRIMOIRE_REST_ROT.z
        );

        player?.avatar?.setCombatAction?.({ weapon: "grimoire", action: "cast", progress });
      } else {
        if (grimoireCastT > 0) {
          if (grimoireCastT >= METEOR_CAST_MAX * 0.85) {
            // Meteor drops!
            const target = getGroundTarget(34);
            spawnAstralMeteor(target);
            cd = 0.90;
            // Slam reaction
            hand.position.y -= 0.10;
            hand.rotation.x -= 0.25;
            camImpulseX = 0.04;
          }
          grimoireCastT = 0;
          setChargeRing(0);
          groundReticle.hide();
          player?.avatar?.setCombatAction?.(null);
        } else {
          hand.position.lerp(GRIMOIRE_REST_POS, Math.min(1, dt * 14));
          hand.rotation.x = THREE.MathUtils.lerp(hand.rotation.x, GRIMOIRE_REST_ROT.x, Math.min(1, dt * 14));
          hand.rotation.y = THREE.MathUtils.lerp(hand.rotation.y, GRIMOIRE_REST_ROT.y, Math.min(1, dt * 14));
          hand.rotation.z = THREE.MathUtils.lerp(hand.rotation.z, GRIMOIRE_REST_ROT.z, Math.min(1, dt * 14));
        }
      }
    }

    if (weapon === "daggers") {
      if (daggerFanCd > 0) daggerFanCd = Math.max(0, daggerFanCd - dt);

      if (daggerFanT > 0) {
        daggerFanT -= dt;
        const p = 1 - daggerFanT / DAGGER_FAN_DUR;
        const thrust = Math.sin(p * Math.PI);

        // Both daggers whip outward and forward simultaneously
        hand.position.set(
          DAGGER_R_REST_POS.x + 0.08 * thrust,
          DAGGER_R_REST_POS.y + 0.05 * thrust,
          DAGGER_R_REST_POS.z - 0.14 * thrust
        );
        hand.rotation.set(
          DAGGER_R_REST_ROT.x + 0.35 * thrust,
          DAGGER_R_REST_ROT.y - 0.20 * thrust,
          DAGGER_R_REST_ROT.z - 0.35 * thrust
        );

        shieldHand.position.set(
          DAGGER_L_REST_POS.x - 0.08 * thrust,
          DAGGER_L_REST_POS.y + 0.05 * thrust,
          DAGGER_L_REST_POS.z - 0.14 * thrust
        );
        shieldHand.rotation.set(
          DAGGER_L_REST_ROT.x + 0.35 * thrust,
          DAGGER_L_REST_ROT.y + 0.20 * thrust,
          DAGGER_L_REST_ROT.z + 0.35 * thrust
        );

        player?.avatar?.setCombatAction?.({ weapon: "daggers", action: "fan", progress: p });

        if (daggerFanT <= 0) {
          daggerFanT = 0;
          player?.avatar?.setCombatAction?.(null);
          hand.position.copy(DAGGER_R_REST_POS);
          hand.rotation.copy(DAGGER_R_REST_ROT);
          shieldHand.position.copy(DAGGER_L_REST_POS);
          shieldHand.rotation.copy(DAGGER_L_REST_ROT);
        }
      } else if (daggerThrowT > 0) {
        daggerThrowT -= dt;
        const p = 1 - daggerThrowT / DAGGER_THROW_DUR;
        const thrust = Math.sin(p * Math.PI);

        // Previous throw hand was (1 - daggerThrowHand)
        const thrownHand = 1 - daggerThrowHand;
        if (thrownHand === 0) {
          // Right hand snaps forward
          hand.position.set(
            DAGGER_R_REST_POS.x - 0.03 * thrust,
            DAGGER_R_REST_POS.y + 0.06 * thrust,
            DAGGER_R_REST_POS.z - 0.16 * thrust
          );
          hand.rotation.set(
            DAGGER_R_REST_ROT.x + 0.40 * thrust,
            DAGGER_R_REST_ROT.y - 0.15 * thrust,
            DAGGER_R_REST_ROT.z - 0.22 * thrust
          );
          shieldHand.position.copy(DAGGER_L_REST_POS);
          shieldHand.rotation.copy(DAGGER_L_REST_ROT);
          player?.avatar?.setCombatAction?.({ weapon: "daggers", action: "throw_r", progress: p });
        } else {
          // Left hand snaps forward
          shieldHand.position.set(
            DAGGER_L_REST_POS.x + 0.03 * thrust,
            DAGGER_L_REST_POS.y + 0.06 * thrust,
            DAGGER_L_REST_POS.z - 0.16 * thrust
          );
          shieldHand.rotation.set(
            DAGGER_L_REST_ROT.x + 0.40 * thrust,
            DAGGER_L_REST_ROT.y + 0.15 * thrust,
            DAGGER_L_REST_ROT.z + 0.22 * thrust
          );
          hand.position.copy(DAGGER_R_REST_POS);
          hand.rotation.copy(DAGGER_R_REST_ROT);
          player?.avatar?.setCombatAction?.({ weapon: "daggers", action: "throw_l", progress: p });
        }

        if (daggerThrowT <= 0) {
          daggerThrowT = 0;
          player?.avatar?.setCombatAction?.(null);
          hand.position.copy(DAGGER_R_REST_POS);
          hand.rotation.copy(DAGGER_R_REST_ROT);
          shieldHand.position.copy(DAGGER_L_REST_POS);
          shieldHand.rotation.copy(DAGGER_L_REST_ROT);
        }
      } else {
        player?.avatar?.setCombatAction?.(null);
        // Idle breathing sway
        const time = (performance.now() || 0) * 0.0025;
        hand.position.set(DAGGER_R_REST_POS.x, DAGGER_R_REST_POS.y + Math.sin(time) * 0.004, DAGGER_R_REST_POS.z);
        hand.rotation.copy(DAGGER_R_REST_ROT);
        shieldHand.position.set(DAGGER_L_REST_POS.x, DAGGER_L_REST_POS.y + Math.cos(time) * 0.004, DAGGER_L_REST_POS.z);
        shieldHand.rotation.copy(DAGGER_L_REST_ROT);

        if (rightJustPressed && daggerFanCd <= 0 && cd <= 0) {
          daggerFanCd = 1.2;
          cd = 0.45;
          daggerFanT = DAGGER_FAN_DUR;
          fireDaggerFan();
        } else if ((justPressed || mouseDown) && cd <= 0) {
          cd = 1 / (defs.daggers.rate * (getStats()?.attackSpeedMul ?? 1));
          daggerThrowT = DAGGER_THROW_DUR;
          fireSingleDagger(daggerThrowHand);
          daggerThrowHand = 1 - daggerThrowHand;
        }
      }
    }

    if (weapon === "bombard") {
      if (bombardCanisterCd > 0) bombardCanisterCd = Math.max(0, bombardCanisterCd - dt);

      if (bombardCanisterT > 0) {
        bombardCanisterT -= dt;
        const p = 1 - bombardCanisterT / BOMBARD_CANISTER_DUR;
        const kick = p < 0.20 ? (p / 0.20) : Math.max(0, 1 - (p - 0.20) / 0.80);

        hand.position.set(
          BOMBARD_REST_POS.x,
          BOMBARD_REST_POS.y + 0.10 * kick,
          BOMBARD_REST_POS.z + 0.24 * kick
        );
        hand.rotation.set(
          BOMBARD_REST_ROT.x + 0.38 * kick,
          BOMBARD_REST_ROT.y + 0.05 * kick,
          BOMBARD_REST_ROT.z - 0.14 * kick
        );
        player?.avatar?.setCombatAction?.({ weapon: "bombard", action: "canister", progress: p });

        if (bombardCanisterT <= 0) {
          bombardCanisterT = 0;
          player?.avatar?.setCombatAction?.(null);
          hand.position.copy(BOMBARD_REST_POS);
          hand.rotation.copy(BOMBARD_REST_ROT);
        }
      } else if (bombardRecoilT > 0) {
        bombardRecoilT -= dt;
        const p = 1 - bombardRecoilT / BOMBARD_RECOIL_DUR;
        const kick = p < 0.24 ? (p / 0.24) : Math.max(0, 1 - (p - 0.24) / 0.76);

        hand.position.set(
          BOMBARD_REST_POS.x,
          BOMBARD_REST_POS.y + 0.06 * kick,
          BOMBARD_REST_POS.z + 0.16 * kick
        );
        hand.rotation.set(
          BOMBARD_REST_ROT.x + 0.24 * kick,
          BOMBARD_REST_ROT.y,
          BOMBARD_REST_ROT.z - 0.08 * kick
        );
        player?.avatar?.setCombatAction?.({ weapon: "bombard", action: "fire", progress: p });

        if (bombardRecoilT <= 0) {
          bombardRecoilT = 0;
          player?.avatar?.setCombatAction?.(null);
          hand.position.copy(BOMBARD_REST_POS);
          hand.rotation.copy(BOMBARD_REST_ROT);
        }
      } else {
        player?.avatar?.setCombatAction?.(null);
        // Heavy mechanical sway
        const time = (performance.now() || 0) * 0.0018;
        hand.position.set(
          BOMBARD_REST_POS.x,
          BOMBARD_REST_POS.y + Math.sin(time) * 0.003,
          BOMBARD_REST_POS.z
        );
        hand.rotation.set(
          BOMBARD_REST_ROT.x + Math.sin(time * 0.8) * 0.004,
          BOMBARD_REST_ROT.y,
          BOMBARD_REST_ROT.z
        );

        if (rightJustPressed && bombardCanisterCd <= 0 && cd <= 0) {
          bombardCanisterCd = 1.8;
          cd = 1.0;
          bombardCanisterT = BOMBARD_CANISTER_DUR;
          fireBombardCanister();
        } else if (justPressed && cd <= 0) {
          cd = 1 / (defs.bombard.rate * (getStats()?.attackSpeedMul ?? 1));
          bombardRecoilT = BOMBARD_RECOIL_DUR;
          fireBombardBomb();
        }
      }
    }

    // Smooth camera tilt decay
    if (camera) {
      camImpulseZ *= Math.exp(-dt * 22.0);
      camImpulseX *= Math.exp(-dt * 22.0);
      camera.rotation.z = camImpulseZ;
      camera.rotation.x = camImpulseX;
    }

    // Физическая анимация воксельных рук от первого лица
    if (fpsArms && weapon) {
      hand.updateMatrixWorld(true);
      camera.getWorldQuaternion(_camWorldQuat);
      _camInvQuat.copy(_camWorldQuat).invert();

      if (weapon === "hammer" && hammerAnim.gripRear && hammerAnim.gripFront) {
        hammerAnim.gripFront.getWorldPosition(_tmpPosR);
        camera.worldToLocal(_tmpPosR);
        hammerAnim.gripFront.getWorldQuaternion(_tmpQuatR);
        _tmpQuatR.premultiply(_camInvQuat);

        hammerAnim.gripRear.getWorldPosition(_tmpPosL);
        camera.worldToLocal(_tmpPosL);
        hammerAnim.gripRear.getWorldQuaternion(_tmpQuatL);
        _tmpQuatL.premultiply(_camInvQuat);

        if (hammerAnim.coreMat) {
          fpsArms.setRuneGlow(hammerAnim.coreMat.emissiveIntensity);
        }

        fpsArms.update(dt, "hammer", _tmpPosR, _tmpQuatR, _tmpPosL, _tmpQuatL, true, true);
      } else if (weapon === "sword" && swordAnim.grip && shieldAnim.grip) {
        shieldHand.updateMatrixWorld(true);

        swordAnim.grip.getWorldPosition(_tmpPosR);
        camera.worldToLocal(_tmpPosR);
        swordAnim.grip.getWorldQuaternion(_tmpQuatR);
        _tmpQuatR.premultiply(_camInvQuat);

        shieldAnim.grip.getWorldPosition(_tmpPosL);
        camera.worldToLocal(_tmpPosL);
        shieldAnim.grip.getWorldQuaternion(_tmpQuatL);
        _tmpQuatL.premultiply(_camInvQuat);

        fpsArms.update(dt, "sword", _tmpPosR, _tmpQuatR, _tmpPosL, _tmpQuatL, true, true);
      } else if (weapon === "spear" && spearAnim.gripRear && spearAnim.gripFront) {
        spearAnim.gripRear.getWorldPosition(_tmpPosR);
        camera.worldToLocal(_tmpPosR);
        spearAnim.gripRear.getWorldQuaternion(_tmpQuatR);
        _tmpQuatR.premultiply(_camInvQuat);

        spearAnim.gripFront.getWorldPosition(_tmpPosL);
        camera.worldToLocal(_tmpPosL);
        spearAnim.gripFront.getWorldQuaternion(_tmpQuatL);
        _tmpQuatL.premultiply(_camInvQuat);

        fpsArms.update(dt, "spear", _tmpPosR, _tmpQuatR, _tmpPosL, _tmpQuatL, true, true);
      } else if (weapon === "bow" && bowAnim.gripLeft && bowAnim.gripRight) {
        bowAnim.gripRight.getWorldPosition(_tmpPosR);
        camera.worldToLocal(_tmpPosR);
        bowAnim.gripRight.getWorldQuaternion(_tmpQuatR);
        _tmpQuatR.premultiply(_camInvQuat);

        bowAnim.gripLeft.getWorldPosition(_tmpPosL);
        camera.worldToLocal(_tmpPosL);
        bowAnim.gripLeft.getWorldQuaternion(_tmpQuatL);
        _tmpQuatL.premultiply(_camInvQuat);

        fpsArms.update(dt, "bow", _tmpPosR, _tmpQuatR, _tmpPosL, _tmpQuatL, true, true);
      } else if (weapon === "staff" && staffAnim.gripRight) {
        staffAnim.gripRight.getWorldPosition(_tmpPosR);
        camera.worldToLocal(_tmpPosR);
        staffAnim.gripRight.getWorldQuaternion(_tmpQuatR);
        _tmpQuatR.premultiply(_camInvQuat);

        const time = (performance.now() || 0) * 0.003;
        _tmpPosL.set(
          -0.18 + Math.cos(time * 0.7) * 0.015,
          -0.24 + Math.sin(time) * 0.018,
          -0.38 + Math.sin(time * 0.5) * 0.02
        );
        _tmpQuatL.set(0.1, -0.15, 0.05, 0.98).normalize();

        fpsArms.update(dt, "staff", _tmpPosR, _tmpQuatR, _tmpPosL, _tmpQuatL, true, true);
      } else if (weapon === "scepter" && scepterAnim.gripRight) {
        scepterAnim.gripRight.getWorldPosition(_tmpPosR);
        camera.worldToLocal(_tmpPosR);
        scepterAnim.gripRight.getWorldQuaternion(_tmpQuatR);
        _tmpQuatR.premultiply(_camInvQuat);

        const time = (performance.now() || 0) * 0.003;
        _tmpPosL.set(
          -0.16 + Math.cos(time * 0.8) * 0.012,
          -0.22 + Math.sin(time * 1.1) * 0.015,
          -0.34 + Math.sin(time * 0.6) * 0.015
        );
        _tmpQuatL.set(0.12, -0.18, 0.08, 0.98).normalize();

        fpsArms.update(dt, "scepter", _tmpPosR, _tmpQuatR, _tmpPosL, _tmpQuatL, true, true);
      } else if (weapon === "grimoire" && grimoireAnim.gripRight && grimoireAnim.gripLeft) {
        grimoireAnim.gripRight.getWorldPosition(_tmpPosR);
        camera.worldToLocal(_tmpPosR);
        grimoireAnim.gripRight.getWorldQuaternion(_tmpQuatR);
        _tmpQuatR.premultiply(_camInvQuat);

        grimoireAnim.gripLeft.getWorldPosition(_tmpPosL);
        camera.worldToLocal(_tmpPosL);
        grimoireAnim.gripLeft.getWorldQuaternion(_tmpQuatL);
        _tmpQuatL.premultiply(_camInvQuat);

        fpsArms.update(dt, "grimoire", _tmpPosR, _tmpQuatR, _tmpPosL, _tmpQuatL, true, true);
      } else if (weapon === "daggers" && daggersAnim.gripR && daggersAnim.gripL) {
        shieldHand.updateMatrixWorld(true);

        daggersAnim.gripR.getWorldPosition(_tmpPosR);
        camera.worldToLocal(_tmpPosR);
        daggersAnim.gripR.getWorldQuaternion(_tmpQuatR);
        _tmpQuatR.premultiply(_camInvQuat);

        daggersAnim.gripL.getWorldPosition(_tmpPosL);
        camera.worldToLocal(_tmpPosL);
        daggersAnim.gripL.getWorldQuaternion(_tmpQuatL);
        _tmpQuatL.premultiply(_camInvQuat);

        fpsArms.update(dt, "daggers", _tmpPosR, _tmpQuatR, _tmpPosL, _tmpQuatL, true, true);
      } else if (weapon === "bombard" && bombardAnim.gripRear && bombardAnim.gripFront) {
        bombardAnim.gripRear.getWorldPosition(_tmpPosR);
        camera.worldToLocal(_tmpPosR);
        bombardAnim.gripRear.getWorldQuaternion(_tmpQuatR);
        _tmpQuatR.premultiply(_camInvQuat);

        bombardAnim.gripFront.getWorldPosition(_tmpPosL);
        camera.worldToLocal(_tmpPosL);
        bombardAnim.gripFront.getWorldQuaternion(_tmpQuatL);
        _tmpQuatL.premultiply(_camInvQuat);

        fpsArms.update(dt, "bombard", _tmpPosR, _tmpQuatR, _tmpPosL, _tmpQuatL, true, true);
      }
    }
  }

  function meleeQuery(enemies) {
    lastEnemiesRef = enemies;

    if (weapon === "hammer") {
      if (hammerSwingT <= 0) return;
      const p = 1 - hammerSwingT / hammerSwingMax;
      if (p < 0.35 || p > 0.64) return;

      const origin = new THREE.Vector3();
      camera.getWorldPosition(origin);

      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      dir.y *= 0.25;
      dir.normalize();

      if (!enemies || typeof enemies.forEachInRadius !== "function") return;

      const st = getStats();
      const range = defs.hammer.meleeRange * (st?.hammerReachMul ?? 1);

      enemies.forEachInRadius(origin, range, (e) => {
        const ep = (e && e.position) || e?.pos || (e.mesh && e.mesh.position);
        if (!ep) return;

        const to = safeCloneVec3(ep).sub(origin);
        to.y = 0;
        if (to.length() > range) return;
        to.normalize();

        const arc = defs.hammer.arc;
        if (Math.acos(clamp(to.dot(dir), -1, 1)) > arc) return;

        const id = (e && (e.id ?? e._id ?? e.uuid)) ?? null;
        if (id !== null && hammerHitSet.has(id)) return;
        if (id !== null) hammerHitSet.add(id);

        let dmg = defs.hammer.dmg * ((st?.damageMul ?? 1) * (st?.arenaDamageMul ?? 1)) * (st?.hammerDamageMul ?? 1);

        const hitPoint = ep ? new THREE.Vector3(ep.x, (ep.y || 0) + 1.1, ep.z) : origin.clone().addScaledVector(dir, 1.8);
        const knockDir = to.clone();

        const meta = {
          kind: "melee",
          crushShield: true,
          stagger: 1.0,
          knockback: 1.85,
          knockDir,
          srcPos: origin,
          point: hitPoint
        };

        if (typeof enemies.applyDamage === "function") {
          const dealt = enemies.applyDamage(id, dmg, meta);
          if (st?.hammerLifesteal) {
            player.hp = clamp(player.hp + dmg * (st.hammerLifesteal || 0), 0, player.hpMax);
          }

          if (dealt?.killed && progression?.onKill) {
            progression.onKill(dealt.xp || 0);
            if (dealt.bossLoot && progression.openBossLoot) progression.openBossLoot();
          }
        }
      });
      return;
    }

    if (weapon === "sword") {
      if (swordSwingT <= 0) return;
      const s = swordCombos[swordComboStep] || swordCombos[0];
      const p = 1 - swordSwingT / swordSwingMax;
      if (p < s.active[0] || p > s.active[1]) return;

      const origin = new THREE.Vector3();
      camera.getWorldPosition(origin);

      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      dir.y *= 0.25;
      dir.normalize();

      if (!enemies || typeof enemies.forEachInRadius !== "function") return;

      const st = getStats();
      const range = defs.sword.meleeRange * (s.rangeMul ?? 1) * (st?.swordReachMul ?? 1);

      enemies.forEachInRadius(origin, range, (e) => {
        const ep = (e && e.position) || e?.pos || (e.mesh && e.mesh.position);
        if (!ep) return;

        const to = safeCloneVec3(ep).sub(origin);
        to.y = 0;
        if (to.length() > range) return;
        to.normalize();

        const arc = s.arc;
        if (Math.acos(clamp(to.dot(dir), -1, 1)) > arc) return;

        const id = (e && (e.id ?? e._id ?? e.uuid)) ?? null;
        if (id !== null && swordHitSet.has(id)) return;
        if (id !== null) swordHitSet.add(id);

        let dmg = defs.sword.dmg * (s.dmgMul ?? 1) * ((st?.damageMul ?? 1) * (st?.arenaDamageMul ?? 1));
        let isCrit = false;
        if (swordNextHitCrit) {
          dmg *= 2.0; // Гарантированный крит после успешного парирования
          isCrit = true;
          swordNextHitCrit = false;
        }

        const hitPoint = ep ? new THREE.Vector3(ep.x, (ep.y || 0) + 1.1, ep.z) : origin.clone().addScaledVector(dir, 1.8);
        const knockDir = to.clone();

        const meta = {
          kind: isCrit ? "crit" : "melee",
          stagger: isCrit ? 1.5 : 0.8,
          knockback: isCrit ? 2.5 : 1.4,
          knockDir,
          srcPos: origin,
          point: hitPoint
        };

        if (typeof enemies.applyDamage === "function") {
          const dealt = enemies.applyDamage(id, dmg, meta);
          if (dealt?.killed && progression?.onKill) {
            progression.onKill(dealt.xp || 0);
            if (dealt.bossLoot && progression.openBossLoot) progression.openBossLoot();
          }
        }
      });
      return;
    }

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

      const hitPoint = ep ? new THREE.Vector3(ep.x, (ep.y || 0) + 1.1, ep.z) : origin.clone().addScaledVector(dir, 1.8);
      const meta = { kind: "melee", combo: comboStep, srcPos: origin, point: hitPoint };
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
    setClass,
    getClass,
    classWeapons,
    getWeapon() { return weapon; },
    tick,
    meleeQuery,
    bindProjectiles,
    setBowPull,
    get weapon() { return weapon; },
    get name() { return weaponName; }
  };
}