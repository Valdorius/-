
import * as THREE from "three";
import { attachVOXSkin } from "../models/vox_registry.js";

/**
 * Voxel avatar intended for multiplayer (3rd-person representation).
 * - Attached to player's yaw node (so it follows position + yaw)
 * - NOT parented to pitch/camera, so it cannot affect weapon/camera animations.
 * - By default it lives on layer 2 (hidden from the first-person camera).
 */
export function createVoxelAvatar({
  skinTone = 0x8b6a4a,
  suitDark = 0x1a2233,
  suitMid  = 0x23314a,
  suitLite = 0x2f4368,
  accent   = 0x00b7ff,
  accent2  = 0xff4aa6,
} = {}) {

  const g = new THREE.Group();
  g.name = "VoxelAvatar";
  g.visible = false; // hidden from local first-person camera by default
  g.layers.set(2);
  attachVOXSkin(g, "player");

  // Shared geometries
  const box = new THREE.BoxGeometry(1, 1, 1);
  const bevel = new THREE.BoxGeometry(1, 1, 1); // kept simple; voxel look

  const matSkin = new THREE.MeshStandardMaterial({
    color: skinTone, roughness: 0.85, metalness: 0.05
  });
  const matDark = new THREE.MeshStandardMaterial({
    color: suitDark, roughness: 0.75, metalness: 0.15
  });
  const matMid = new THREE.MeshStandardMaterial({
    color: suitMid, roughness: 0.7, metalness: 0.18
  });
  const matLite = new THREE.MeshStandardMaterial({
    color: suitLite, roughness: 0.65, metalness: 0.22
  });
  const matAccent = new THREE.MeshStandardMaterial({
    color: accent, emissive: accent, emissiveIntensity: 1.1, roughness: 0.45, metalness: 0.6
  });
  const matAccent2 = new THREE.MeshStandardMaterial({
    color: accent2, emissive: accent2, emissiveIntensity: 0.9, roughness: 0.5, metalness: 0.55
  });

  function part({ sx, sy, sz, x=0, y=0, z=0, mat=matMid, name="" }) {
    const m = new THREE.Mesh(box, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    if (name) m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    m.layers.set(2);
    return m;
  }

  // Root offset: player bodyRoot's origin is at feet (roughly).
  // We keep avatar feet on y=0, and build upwards.
  const rig = new THREE.Group();
  rig.name = "Rig";
  rig.layers.set(2);
  g.add(rig);

  // --- Proportions (meters-ish) ---
  const H = 1.72; // target height
  const footY = 0.05;

  // Skeleton groups for future animation/networking
  const pelvis = new THREE.Group(); pelvis.name="Pelvis"; pelvis.layers.set(2);
  const torso  = new THREE.Group(); torso.name ="Torso";  torso.layers.set(2);
  const head   = new THREE.Group(); head.name  ="Head";   head.layers.set(2);
  const armL   = new THREE.Group(); armL.name  ="ArmL";   armL.layers.set(2);
  const armR   = new THREE.Group(); armR.name  ="ArmR";   armR.layers.set(2);
  const legL   = new THREE.Group(); legL.name  ="LegL";   legL.layers.set(2);
  const legR   = new THREE.Group(); legR.name  ="LegR";   legR.layers.set(2);

  rig.add(pelvis);
  pelvis.add(torso);
  torso.add(head);
  torso.add(armL);
  torso.add(armR);
  pelvis.add(legL);
  pelvis.add(legR);

  // Pelvis position
  pelvis.position.set(0, 0.92, 0);

  // --- Legs ---
  // thigh + shin + boot as chunky voxels
  legL.position.set(-0.18, -0.38, 0);
  legR.position.set( 0.18, -0.38, 0);

  legL.add(part({ sx:0.22, sy:0.50, sz:0.22, x:0, y:-0.20, z:0, mat:matDark, name:"ThighL" }));
  legL.add(part({ sx:0.20, sy:0.46, sz:0.20, x:0, y:-0.66, z:0.01, mat:matMid, name:"ShinL" }));
  legL.add(part({ sx:0.26, sy:0.14, sz:0.34, x:0, y:-0.94, z:0.07, mat:matLite, name:"BootL" }));
  legL.add(part({ sx:0.24, sy:0.06, sz:0.30, x:0, y:-1.01, z:0.10, mat:matAccent, name:"BootGlowL" }));

  legR.add(part({ sx:0.22, sy:0.50, sz:0.22, x:0, y:-0.20, z:0, mat:matDark, name:"ThighR" }));
  legR.add(part({ sx:0.20, sy:0.46, sz:0.20, x:0, y:-0.66, z:0.01, mat:matMid, name:"ShinR" }));
  legR.add(part({ sx:0.26, sy:0.14, sz:0.34, x:0, y:-0.94, z:0.07, mat:matLite, name:"BootR" }));
  legR.add(part({ sx:0.24, sy:0.06, sz:0.30, x:0, y:-1.01, z:0.10, mat:matAccent, name:"BootGlowR" }));

  // --- Pelvis armor / belt ---
  pelvis.add(part({ sx:0.58, sy:0.22, sz:0.34, x:0, y:-0.02, z:0, mat:matDark, name:"Hip" }));
  pelvis.add(part({ sx:0.56, sy:0.18, sz:0.36, x:0, y:0.13, z:0.01, mat:matMid,  name:"Belt" }));
  pelvis.add(part({ sx:0.10, sy:0.10, sz:0.10, x:-0.22, y:0.13, z:0.19, mat:matAccent2, name:"BuckleL" }));
  pelvis.add(part({ sx:0.10, sy:0.10, sz:0.10, x: 0.22, y:0.13, z:0.19, mat:matAccent2, name:"BuckleR" }));

  // --- Torso ---
  torso.position.set(0, 0.32, 0);
  torso.add(part({ sx:0.62, sy:0.58, sz:0.36, x:0, y:0.18, z:0, mat:matMid, name:"Chest" }));
  torso.add(part({ sx:0.66, sy:0.34, sz:0.40, x:0, y:0.38, z:0.01, mat:matLite, name:"ChestPlate" }));
  torso.add(part({ sx:0.18, sy:0.18, sz:0.08, x:0, y:0.42, z:0.24, mat:matAccent, name:"Core" }));

  // Back pack / reactor
  torso.add(part({ sx:0.52, sy:0.46, sz:0.22, x:0, y:0.24, z:-0.27, mat:matDark, name:"Backpack" }));
  torso.add(part({ sx:0.14, sy:0.32, sz:0.10, x:-0.18, y:0.26, z:-0.34, mat:matAccent, name:"ReactorL" }));
  torso.add(part({ sx:0.14, sy:0.32, sz:0.10, x: 0.18, y:0.26, z:-0.34, mat:matAccent, name:"ReactorR" }));

  // Collar / neck guard
  torso.add(part({ sx:0.64, sy:0.10, sz:0.42, x:0, y:0.55, z:0, mat:matDark, name:"Collar" }));

  // Shoulder pads
  torso.add(part({ sx:0.22, sy:0.18, sz:0.30, x:-0.44, y:0.42, z:0, mat:matLite, name:"ShoulderL" }));
  torso.add(part({ sx:0.22, sy:0.18, sz:0.30, x: 0.44, y:0.42, z:0, mat:matLite, name:"ShoulderR" }));

  // --- Arms ---
  armL.position.set(-0.46, 0.40, 0);
  armR.position.set( 0.46, 0.40, 0);

  armL.add(part({ sx:0.18, sy:0.44, sz:0.18, x:0, y:-0.18, z:0, mat:matDark, name:"UpperArmL" }));
  armL.add(part({ sx:0.16, sy:0.42, sz:0.16, x:0, y:-0.62, z:0.01, mat:matMid, name:"ForearmL" }));
  armL.add(part({ sx:0.20, sy:0.12, sz:0.22, x:0, y:-0.88, z:0.06, mat:matLite, name:"GloveL" }));
  armL.add(part({ sx:0.06, sy:0.06, sz:0.12, x:0.10, y:-0.60, z:0.11, mat:matAccent, name:"WristGlowL" }));

  armR.add(part({ sx:0.18, sy:0.44, sz:0.18, x:0, y:-0.18, z:0, mat:matDark, name:"UpperArmR" }));
  armR.add(part({ sx:0.16, sy:0.42, sz:0.16, x:0, y:-0.62, z:0.01, mat:matMid, name:"ForearmR" }));
  armR.add(part({ sx:0.20, sy:0.12, sz:0.22, x:0, y:-0.88, z:0.06, mat:matLite, name:"GloveR" }));
  armR.add(part({ sx:0.06, sy:0.06, sz:0.12, x:-0.10, y:-0.60, z:0.11, mat:matAccent, name:"WristGlowR" }));

  // --- Head ---
  head.position.set(0, 0.78, 0);
  head.add(part({ sx:0.40, sy:0.36, sz:0.34, x:0, y:0.02, z:0, mat:matSkin, name:"Face" }));
  head.add(part({ sx:0.46, sy:0.40, sz:0.40, x:0, y:0.02, z:0, mat:matDark, name:"Helmet" }));
  // Visor
  head.add(part({ sx:0.34, sy:0.12, sz:0.06, x:0, y:0.06, z:0.23, mat:matAccent, name:"Visor" }));
  head.add(part({ sx:0.08, sy:0.08, sz:0.06, x:-0.18, y:0.06, z:0.23, mat:matAccent2, name:"VisorL" }));
  head.add(part({ sx:0.08, sy:0.08, sz:0.06, x: 0.18, y:0.06, z:0.23, mat:matAccent2, name:"VisorR" }));
  // Antenna / sensor
  head.add(part({ sx:0.06, sy:0.18, sz:0.06, x:0.22, y:0.22, z:-0.10, mat:matAccent, name:"Antenna" }));

  // --- Overall scaling ---
  // Target height ~1.72m
  g.scale.set(0.92, 0.92, 0.92);
  g.position.set(0, 0, 0);

  // --- Third-person Weapon Meshes for Dynamic Shadows & Multiplayer ---
  const weaponAnchor = new THREE.Group();
  weaponAnchor.name = "ThirdPersonWeaponAnchor";
  weaponAnchor.position.set(0, -0.52, 0.08);
  weaponAnchor.rotation.set(-0.35, 0, 0);
  weaponAnchor.layers.set(2);
  armR.add(weaponAnchor);

  const matWeaponWood = new THREE.MeshStandardMaterial({ color: 0x3d281a, roughness: 0.85 });
  const matWeaponSteel = new THREE.MeshStandardMaterial({ color: 0xc8d6ee, roughness: 0.35, metalness: 0.70 });
  const matWeaponDark = new THREE.MeshStandardMaterial({ color: 0x222c3c, roughness: 0.55, metalness: 0.50 });
  const matAmberRune = new THREE.MeshStandardMaterial({
    color: 0xffaa22,
    emissive: 0xff8800,
    emissiveIntensity: 2.2,
    roughness: 0.20
  });
  const matCyanRune = new THREE.MeshStandardMaterial({
    color: 0x00f5ff,
    emissive: 0x00d0ff,
    emissiveIntensity: 2.2,
    roughness: 0.20
  });
  const matGoldRune = new THREE.MeshStandardMaterial({
    color: 0xffcc22,
    emissive: 0xffaa00,
    emissiveIntensity: 2.4,
    roughness: 0.18
  });

  function createThirdPersonWeapon(wType) {
    const wg = new THREE.Group();
    wg.name = `TP_Weapon_${wType}`;
    wg.layers.set(2);

    function wpart({ sx, sy, sz, x=0, y=0, z=0, mat=matWeaponSteel, name="" }) {
      const m = new THREE.Mesh(box, mat);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      if (name) m.name = name;
      m.castShadow = true;
      m.receiveShadow = true;
      m.layers.set(2);
      wg.add(m);
      return m;
    }

    if (wType === "hammer") {
      // 1. Heavy ash shaft
      wpart({ sx: 0.065, sy: 1.35, sz: 0.065, x: 0, y: 0.32, z: 0, mat: matWeaponWood, name: "Shaft" });
      // Pommel
      wpart({ sx: 0.09, sy: 0.12, sz: 0.09, x: 0, y: -0.32, z: 0, mat: matWeaponDark, name: "Pommel" });
      // Reinforcing steel langets
      wpart({ sx: 0.08, sy: 0.45, sz: 0.02, x: 0, y: 0.65, z: 0.035, mat: matWeaponDark });
      wpart({ sx: 0.08, sy: 0.45, sz: 0.02, x: 0, y: 0.65, z: -0.035, mat: matWeaponDark });
      // Massive steel hammer head
      wpart({ sx: 0.26, sy: 0.26, sz: 0.36, x: 0, y: 0.88, z: 0, mat: matWeaponDark, name: "HeadCore" });
      // Crushing face front (-Z, toward enemies)
      wpart({ sx: 0.24, sy: 0.24, sz: 0.10, x: 0, y: 0.88, z: -0.22, mat: matWeaponSteel, name: "Face" });
      // Rear armor-piercing spike (+Z, toward shoulder)
      wpart({ sx: 0.12, sy: 0.12, sz: 0.18, x: 0, y: 0.88, z: 0.26, mat: matWeaponSteel, name: "Spike" });
      // Top siege spike
      wpart({ sx: 0.08, sy: 0.18, sz: 0.08, x: 0, y: 1.08, z: 0, mat: matWeaponSteel, name: "TopSpike" });
      // Glowing Amber Rune Core
      wpart({ sx: 0.12, sy: 0.12, sz: 0.12, x: 0, y: 0.88, z: 0, mat: matAmberRune, name: "RuneCore" });
      wpart({ sx: 0.27, sy: 0.06, sz: 0.16, x: 0, y: 0.88, z: 0, mat: matAmberRune, name: "RuneBandL" });
    } else if (wType === "sword") {
      // Одноручный палаш паладина
      // 1. Pommel
      wpart({ sx: 0.08, sy: 0.10, sz: 0.08, x: 0, y: -0.22, z: 0, mat: matWeaponDark, name: "Pommel" });
      // 2. Leather grip
      wpart({ sx: 0.055, sy: 0.22, sz: 0.055, x: 0, y: -0.06, z: 0, mat: matWeaponWood, name: "Grip" });
      // 3. Steel Crossguard
      wpart({ sx: 0.26, sy: 0.045, sz: 0.07, x: 0, y: 0.08, z: 0, mat: matWeaponDark, name: "Guard" });
      wpart({ sx: 0.045, sy: 0.055, sz: 0.075, x: -0.13, y: 0.08, z: 0, mat: matWeaponSteel });
      wpart({ sx: 0.045, sy: 0.055, sz: 0.075, x: 0.13, y: 0.08, z: 0, mat: matWeaponSteel });
      wpart({ sx: 0.04, sy: 0.04, sz: 0.076, x: 0, y: 0.08, z: 0, mat: matGoldRune });
      // 4. Damascus Steel Blade
      wpart({ sx: 0.07, sy: 0.90, sz: 0.026, x: 0, y: 0.58, z: 0, mat: matWeaponSteel, name: "Blade" });
      wpart({ sx: 0.018, sy: 0.90, sz: 0.016, x: -0.042, y: 0.58, z: 0, mat: matWeaponSteel });
      wpart({ sx: 0.018, sy: 0.90, sz: 0.016, x: 0.042, y: 0.58, z: 0, mat: matWeaponSteel });
      // Tapered tip
      wpart({ sx: 0.05, sy: 0.10, sz: 0.020, x: 0, y: 1.07, z: 0, mat: matWeaponSteel });
      wpart({ sx: 0.024, sy: 0.08, sz: 0.014, x: 0, y: 1.13, z: 0, mat: matWeaponSteel });
      // Glowing golden fuller channel
      wpart({ sx: 0.022, sy: 0.72, sz: 0.030, x: 0, y: 0.54, z: 0, mat: matGoldRune, name: "RuneFuller" });
    } else if (wType === "spear") {
      // 1. Long shaft (2.45m)
      wpart({ sx: 0.05, sy: 2.45, sz: 0.05, x: 0, y: 0.55, z: 0, mat: matWeaponWood, name: "Shaft" });
      // Rings & steel bands
      wpart({ sx: 0.07, sy: 0.04, sz: 0.07, x: 0, y: 1.15, z: 0, mat: matWeaponDark });
      wpart({ sx: 0.07, sy: 0.04, sz: 0.07, x: 0, y: 1.45, z: 0, mat: matWeaponDark });
      wpart({ sx: 0.07, sy: 0.04, sz: 0.07, x: 0, y: 1.70, z: 0, mat: matWeaponDark });
      // Socket & Guard
      wpart({ sx: 0.08, sy: 0.12, sz: 0.08, x: 0, y: 1.76, z: 0, mat: matWeaponDark, name: "Socket" });
      wpart({ sx: 0.18, sy: 0.04, sz: 0.09, x: 0, y: 1.82, z: 0, mat: matWeaponDark, name: "Guard" });
      // Broad curved glefa blade (0.85m)
      wpart({ sx: 0.04, sy: 0.85, sz: 0.26, x: 0, y: 2.24, z: 0.06, mat: matWeaponSteel, name: "Blade" });
      // Hook / back spike
      wpart({ sx: 0.035, sy: 0.14, sz: 0.11, x: 0, y: 2.05, z: -0.10, mat: matWeaponDark, name: "Hook" });
      // Glowing cyan rune channel
      wpart({ sx: 0.048, sy: 0.65, sz: 0.04, x: 0, y: 2.22, z: 0.04, mat: matCyanRune, name: "RuneChannel" });
      // Rear counter-pommel & spike
      wpart({ sx: 0.07, sy: 0.10, sz: 0.07, x: 0, y: -0.66, z: 0, mat: matWeaponDark, name: "Pommel" });
      wpart({ sx: 0.03, sy: 0.08, sz: 0.03, x: 0, y: -0.74, z: 0, mat: matWeaponSteel, name: "RearSpike" });
    } else if (wType === "bow") {
      // Curved runic bow stave
      wpart({ sx: 0.05, sy: 1.30, sz: 0.12, x: 0, y: 0.20, z: 0.05, mat: matWeaponWood, name: "Stave" });
      wpart({ sx: 0.06, sy: 0.25, sz: 0.06, x: 0, y: 0.20, z: 0.05, mat: matWeaponDark, name: "Grip" });
      wpart({ sx: 0.055, sy: 0.50, sz: 0.03, x: 0, y: 0.45, z: 0.08, mat: matCyanRune, name: "TopRune" });
      wpart({ sx: 0.055, sy: 0.50, sz: 0.03, x: 0, y: -0.05, z: 0.08, mat: matCyanRune, name: "BotRune" });
    } else if (wType === "staff") {
      // Magic crystal staff
      wpart({ sx: 0.05, sy: 1.55, sz: 0.05, x: 0, y: 0.35, z: 0, mat: matWeaponWood, name: "Shaft" });
      wpart({ sx: 0.12, sy: 0.16, sz: 0.12, x: 0, y: 1.15, z: 0, mat: matWeaponDark, name: "Crown" });
      wpart({ sx: 0.14, sy: 0.22, sz: 0.14, x: 0, y: 1.28, z: 0, mat: matAmberRune, name: "Crystal" });
    }
    return wg;
  }

  function createThirdPersonShield() {
    const sg = new THREE.Group();
    sg.name = "TP_Shield";
    sg.layers.set(2);

    function spart({ sx, sy, sz, x=0, y=0, z=0, mat=matWeaponSteel, name="" }) {
      const m = new THREE.Mesh(box, mat);
      m.scale.set(sx, sy, sz);
      m.position.set(x, y, z);
      if (name) m.name = name;
      m.castShadow = true;
      m.receiveShadow = true;
      m.layers.set(2);
      sg.add(m);
      return m;
    }

    // 1. Корпус щита
    spart({ sx: 0.44, sy: 0.32, sz: 0.04, x: 0, y: 0.14, z: 0, mat: matWeaponDark });
    spart({ sx: 0.38, sy: 0.28, sz: 0.038, x: 0, y: -0.12, z: 0, mat: matWeaponDark });
    spart({ sx: 0.26, sy: 0.24, sz: 0.036, x: 0, y: -0.34, z: 0, mat: matWeaponDark });
    spart({ sx: 0.14, sy: 0.18, sz: 0.034, x: 0, y: -0.50, z: 0, mat: matWeaponDark });

    // 2. Стальной обод
    spart({ sx: 0.48, sy: 0.042, sz: 0.048, x: 0, y: 0.31, z: 0, mat: matWeaponSteel });
    spart({ sx: 0.040, sy: 0.44, sz: 0.046, x: -0.22, y: 0.12, z: 0, mat: matWeaponSteel });
    spart({ sx: 0.040, sy: 0.44, sz: 0.046, x: 0.22, y: 0.12, z: 0, mat: matWeaponSteel });
    spart({ sx: 0.036, sy: 0.36, sz: 0.044, x: -0.14, y: -0.30, z: 0, mat: matWeaponSteel });
    spart({ sx: 0.036, sy: 0.36, sz: 0.044, x: 0.14, y: -0.30, z: 0, mat: matWeaponSteel });
    spart({ sx: 0.052, sy: 0.08, sz: 0.048, x: 0, y: -0.56, z: 0, mat: matWeaponSteel });

    // 3. Центральный умбон с шипом
    spart({ sx: 0.18, sy: 0.18, sz: 0.06, x: 0, y: 0.02, z: -0.04, mat: matWeaponSteel });
    spart({ sx: 0.10, sy: 0.10, sz: 0.08, x: 0, y: 0.02, z: -0.08, mat: matWeaponSteel });
    spart({ sx: 0.04, sy: 0.04, sz: 0.08, x: 0, y: 0.02, z: -0.14, mat: matWeaponSteel });

    // 4. Золотой солнечный рунный герб
    spart({ sx: 0.034, sy: 0.54, sz: 0.046, x: 0, y: 0.0, z: -0.025, mat: matGoldRune });
    spart({ sx: 0.32, sy: 0.034, sz: 0.046, x: 0, y: 0.08, z: -0.025, mat: matGoldRune });
    spart({ sx: 0.15, sy: 0.15, sz: 0.044, x: 0, y: 0.02, z: -0.025, mat: matGoldRune });

    // 5. Ремни сзади
    spart({ sx: 0.18, sy: 0.045, sz: 0.045, x: 0, y: 0.10, z: 0.035, mat: matWeaponWood });
    spart({ sx: 0.035, sy: 0.18, sz: 0.035, x: 0, y: -0.08, z: 0.045, mat: matWeaponDark });

    return sg;
  }

  let currentWeaponId = "spear";
  let activeWeaponMesh = createThirdPersonWeapon("spear");
  weaponAnchor.add(activeWeaponMesh);

  // Крепление щита к левой руке
  const shieldAnchor = new THREE.Group();
  shieldAnchor.name = "ThirdPersonShieldAnchor";
  shieldAnchor.position.set(0.08, -0.38, 0.04);
  shieldAnchor.layers.set(2);
  armL.add(shieldAnchor);

  let activeShieldMesh = createThirdPersonShield();
  shieldAnchor.add(activeShieldMesh);
  shieldAnchor.visible = false;

  function setWeapon(wType) {
    if (!wType || wType === currentWeaponId) return;
    currentWeaponId = wType;
    if (activeWeaponMesh) weaponAnchor.remove(activeWeaponMesh);
    activeWeaponMesh = createThirdPersonWeapon(wType);
    weaponAnchor.add(activeWeaponMesh);

    shieldAnchor.visible = (wType === "sword");
  }

  // Combat animation state
  let combatAction = null;

  function setCombatAction(actionObj) {
    combatAction = actionObj;
  }

  // Animation driver state
  const state = {
    t: 0,
    moving: 0,
    aimPitch: 0,
  };

  function setMoving01(v){ state.moving = Math.max(0, Math.min(1, v||0)); }
  function setAimPitch(rad){ state.aimPitch = rad || 0; }

  function tick(dt){
    state.t += dt;

    // Reparent weaponAnchor to voxMesh.armR once loaded
    const targetArmR = (g.voxMesh && g.voxMesh.armR) ? g.voxMesh.armR : armR;
    if (weaponAnchor.parent !== targetArmR) {
      targetArmR.add(weaponAnchor);
    }
    const targetArmL = (g.voxMesh && g.voxMesh.armL) ? g.voxMesh.armL : armL;
    if (shieldAnchor.parent !== targetArmL) {
      targetArmL.add(shieldAnchor);
    }

    // Default locomotion & breathing
    const breathe = Math.sin(state.t * 2.0) * 0.008;
    const sway = state.moving * Math.sin(state.t * 9.0) * 0.55;
    const pitchClamped = Math.max(-0.6, Math.min(0.6, state.aimPitch));

    // Target transforms for limbs
    let torsoPosY = 0.32 + breathe;
    let torsoRotX = 0, torsoRotY = 0, torsoRotZ = 0;
    let headRotX = pitchClamped * 0.35, headRotY = 0, headRotZ = 0;
    let armRRotX = 0.55, armRRotY = -0.20, armRRotZ = 0.15;
    let armLRotX = 0.75, armLRotY = 0.30, armLRotZ = -0.10;
    let legLRotX = sway, legLRotZ = 0;
    let legRRotX = -sway, legRRotZ = 0;

    // Resting stance with hammer on shoulder
    if (currentWeaponId === "hammer" && !combatAction) {
      armRRotX = 0.85; armRRotY = -0.25; armRRotZ = 0.35;
      armLRotX = 0.95; armLRotY = 0.40; armLRotZ = -0.20;
      torsoRotY = -0.15;
      if (state.moving > 0.05) {
        armRRotX += sway * 0.25;
        armLRotX += -sway * 0.25;
      }
    }

    // Resting stance with Sword & Shield
    if (currentWeaponId === "sword" && !combatAction) {
      armRRotX = 0.45; armRRotY = -0.15; armRRotZ = 0.18;
      armLRotX = 0.62; armLRotY = 0.45; armLRotZ = -0.28;
      torsoRotY = -0.12;
      if (state.moving > 0.05) {
        armRRotX += sway * 0.20;
        armLRotX += -sway * 0.20;
      }
    }

    if (combatAction && combatAction.weapon === "sword") {
      const p = Math.max(0, Math.min(1, combatAction.progress || 0));

      if (combatAction.action === "block") {
        const k = p * p * (3 - 2 * p);
        armLRotX = 0.95 + 0.40 * k;
        armLRotY = 0.45 - 0.90 * k;
        armLRotZ = -0.22 + 0.45 * k;
        armRRotX = 0.45 - 0.15 * k;
        armRRotY = -0.15 + 0.25 * k;
        armRRotZ = 0.18 - 0.10 * k;
        torsoRotY = -0.12 + 0.24 * k;
      } else if (combatAction.action === "bash") {
        if (p < 0.40) {
          const t = p / 0.40;
          const k = t * t;
          armLRotX = 1.35 - 0.65 * k;
          armLRotY = -0.45 + 0.35 * k;
          armLRotZ = 0.23 - 0.15 * k;
          torsoRotY = 0.12 - 0.35 * k;
          torsoRotX = 0.22 * k;
        } else {
          const t = (p - 0.40) / 0.60;
          const k = 1 - t * (2 - t);
          armLRotX = 1.35 * (1 - k) + 0.70 * k;
          armLRotY = -0.45 * (1 - k) - 0.10 * k;
          torsoRotY = 0.12 * (1 - k) - 0.23 * k;
        }
      } else if (combatAction.action === "slash_1") {
        const t = p < 0.25 ? (p / 0.25) : ((p - 0.25) / 0.75);
        if (p < 0.25) {
          armRRotX = 0.45 + 0.45 * t;
          armRRotY = -0.15 + 0.60 * t;
          torsoRotY = -0.12 + 0.25 * t;
        } else {
          armRRotX = 0.90 - 0.95 * t;
          armRRotY = 0.45 - 1.15 * t;
          torsoRotY = 0.13 - 0.45 * t;
        }
      } else if (combatAction.action === "slash_2") {
        const t = p < 0.22 ? (p / 0.22) : ((p - 0.22) / 0.78);
        if (p < 0.22) {
          armRRotX = 0.45 - 0.15 * t;
          armRRotY = -0.15 - 0.75 * t;
          torsoRotY = -0.12 - 0.35 * t;
        } else {
          armRRotX = 0.30 + 0.65 * t;
          armRRotY = -0.90 + 1.45 * t;
          torsoRotY = -0.47 + 0.65 * t;
        }
      } else if (combatAction.action === "slash_3") {
        const t = p < 0.25 ? (p / 0.25) : ((p - 0.25) / 0.75);
        if (p < 0.25) {
          armRRotX = 0.45 - 0.30 * t;
          armRRotZ = 0.18 + 0.15 * t;
        } else {
          armRRotX = 0.15 + 0.85 * t;
          armRRotZ = 0.33 - 0.25 * t;
          torsoRotX = 0.20 * Math.sin(t * Math.PI);
        }
      }
    }

    if (combatAction && combatAction.weapon === "hammer") {
      const p = Math.max(0, Math.min(1, combatAction.progress || 0));

      if (combatAction.action === "slam") {
        // --- HAMMER ПКМ: Ground Slam (Землетрясение) ---
        if (p < 0.48) {
          // 1. Overhead hoist: arms reach high above head, spine arches backward
          const t = p / 0.48;
          const k = t * t * (3 - 2 * t);
          torsoRotX = -0.32 * k;
          headRotX = -0.35 * k;
          armRRotX = 2.45 * k;
          armRRotY = -0.15 * k;
          armRRotZ = 0.22 * k;
          armLRotX = 2.45 * k;
          armLRotY = 0.15 * k;
          armLRotZ = -0.22 * k;
          legLRotZ = 0.22 * k;
          legRRotZ = -0.22 * k;
        } else if (p < 0.65) {
          // 2. Powerful vertical smash down to floor
          const t = (p - 0.48) / 0.17;
          const k = t * t;
          torsoRotX = -0.32 + 0.95 * k;
          torsoPosY = 0.32 - 0.24 * k;
          headRotX = -0.35 + 0.75 * k;
          armRRotX = 2.45 - 2.90 * k;
          armRRotY = -0.15 * (1 - k);
          armRRotZ = 0.22 - 0.15 * k;
          armLRotX = 2.45 - 2.90 * k;
          armLRotY = 0.15 * (1 - k);
          armLRotZ = -0.22 + 0.15 * k;
          legLRotX = -0.35 * k;
          legLRotZ = 0.22 + 0.15 * k;
          legRRotX = -0.35 * k;
          legRRotZ = -0.22 - 0.15 * k;
        } else {
          // 3. Impact vibration & recovery
          const t = (p - 0.65) / 0.35;
          const k = 1 - t * (2 - t);
          const bounce = Math.sin(t * Math.PI) * 0.05;
          torsoRotX = 0.63 * k;
          torsoPosY = 0.32 - 0.24 * k + bounce;
          headRotX = 0.40 * k;
          armRRotX = -0.45 * k + 0.85 * (1 - k);
          armLRotX = -0.45 * k + 0.95 * (1 - k);
          legLRotX = -0.35 * k;
          legRRotX = -0.35 * k;
        }
      } else {
        // --- HAMMER ЛКМ: Истинный Overhead Smash (Сокрушительный вертикальный удар сверху вниз) ---
        if (p < 0.26) {
          // 1. Взвод: подъем массы вверх-назад за правое плечо, прогиб спины
          const t = p / 0.26;
          const k = t * t * (3 - 2 * t);
          torsoRotX = -0.28 * k;
          torsoRotY = -0.15 - 0.20 * k;
          headRotY = 0.30 * k;
          armRRotX = 0.85 + 1.35 * k;
          armRRotY = -0.25 - 0.10 * k;
          armRRotZ = 0.35 + 0.15 * k;
          armLRotX = 0.95 + 1.10 * k;
          armLRotY = 0.40 - 0.20 * k;
          legRRotX = -0.25 * k;
          legLRotX = 0.20 * k;
        } else if (p < 0.50) {
          // 2. Падение массы: яростный вертикальный разруб сверху вниз через центр
          const t = (p - 0.26) / 0.24;
          const k = Math.pow(t, 2.2);
          torsoRotX = -0.28 + 0.85 * k;
          torsoRotY = -0.35 + 0.35 * k;
          torsoPosY = 0.32 - 0.20 * k;
          headRotX = pitchClamped * 0.35 + 0.45 * k;
          armRRotX = 2.20 - 2.65 * k;
          armRRotZ = 0.50 - 0.40 * k;
          armLRotX = 2.05 - 2.50 * k;
          armLRotY = 0.20 - 0.15 * k;
          legLRotX = 0.20 + 0.30 * k;
          legRRotX = -0.25 - 0.15 * k;
        } else {
          // 3. Импакт в землю и инерционный подъем обратно на плечо
          const t = (p - 0.50) / 0.50;
          const k = 1 - t * (2 - t);
          torsoRotX = 0.57 * k;
          torsoPosY = 0.32 - 0.20 * k;
          armRRotX = -0.45 * k + 0.85 * (1 - k);
          armRRotY = -0.25;
          armRRotZ = 0.10 * k + 0.35 * (1 - k);
          armLRotX = -0.45 * k + 0.95 * (1 - k);
          armLRotY = 0.05 * k + 0.40 * (1 - k);
          legLRotX = 0.50 * k;
          legRRotX = -0.40 * k;
        }
      }
    } else if (combatAction && combatAction.weapon === "spear") {
      // --- SPEAR COMBOS & DEEP THRUST ---
      const p = Math.max(0, Math.min(1, combatAction.progress || 0));
      const action = combatAction.action || "swing";
      const step = combatAction.comboStep || 0;

      if (action === "thrust") {
        // Deep Piercing Lunge (глубокий выпад)
        if (p < 0.22) {
          // Windup: оттяг назад, скрутка корпуса, замах копьем
          const t = p / 0.22;
          const k = t * t;
          torsoRotX = -0.18 * k;
          torsoRotY = -0.32 * k;
          armRRotX = 0.55 - 0.35 * k;
          armRRotY = -0.25 * k;
          armLRotX = 0.75 + 0.20 * k;
          legRRotX = -0.30 * k;
          legLRotX = 0.25 * k;
        } else if (p < 0.58) {
          // Мощный стремительный выпад вперед с глубоким наклоном и выпрямлением рук
          const t = (p - 0.22) / 0.36;
          const k = t * t * (3 - 2 * t);
          torsoRotX = -0.18 + 0.58 * k;
          torsoRotY = -0.32 + 0.50 * k;
          armRRotX = 0.20 + 1.25 * k;
          armRRotY = -0.25 + 0.45 * k;
          armRRotZ = -0.20 * k;
          armLRotX = 0.95 - 0.45 * k;
          armLRotY = 0.30 * k;
          legLRotX = 0.25 + 0.45 * k;
          legRRotX = -0.30 - 0.35 * k;
          torsoPosY = -0.12 * k;
        } else {
          // Возврат в исходную боевую стойку
          const t = (p - 0.58) / 0.42;
          const k = 1 - t * (2 - t);
          torsoRotX = 0.40 * k;
          torsoRotY = 0.18 * k;
          armRRotX = 1.45 * k + 0.55 * (1 - k);
          armRRotY = 0.20 * k;
          armLRotX = 0.50 * k + 0.75 * (1 - k);
          legLRotX = 0.70 * k;
          legRRotX = -0.65 * k;
          torsoPosY = -0.12 * k;
        }
      } else if (step === 2) {
        // Overhead heavy finisher
        if (p < 0.35) {
          const t = p / 0.35;
          const k = t * t;
          torsoRotX = -0.25 * k;
          armRRotX = 0.55 + 1.65 * k;
          armLRotX = 0.75 + 1.45 * k;
        } else if (p < 0.65) {
          const t = (p - 0.35) / 0.30;
          const k = t * t;
          torsoRotX = -0.25 + 0.65 * k;
          armRRotX = 2.20 - 2.50 * k;
          armLRotX = 2.20 - 2.50 * k;
          legLRotX = 0.40 * k;
        } else {
          const t = (p - 0.65) / 0.35;
          const k = 1 - t * (2 - t);
          torsoRotX = 0.40 * k;
          armRRotX = -0.30 * k + 0.55 * (1 - k);
          armLRotX = -0.30 * k + 0.75 * (1 - k);
        }
      } else {
        // Horizontal Cleaves (step 0 & 1)
        if (p < 0.25) {
          const t = p / 0.25;
          torsoRotY = (step === 0 ? -0.45 : 0.45) * t;
          armRRotX = 0.55 + 0.25 * t;
          armLRotX = 0.75 - 0.15 * t;
        } else if (p < 0.65) {
          const t = (p - 0.25) / 0.40;
          const k = t * t * (3 - 2 * t);
          torsoRotY = (step === 0) ? (-0.45 + 0.95 * k) : (0.45 - 0.95 * k);
          armRRotX = 0.80 - 0.30 * k;
          armRRotY = (step === 0 ? 0.85 : -0.85) * k;
          legLRotX = 0.35 * k;
        } else {
          const t = (p - 0.65) / 0.35;
          const k = 1 - t * (2 - t);
          torsoRotY = (step === 0 ? 0.50 : -0.50) * k;
        }
      }
    } else {
      // Locomotion sway blended into arm swing when moving
      if (state.moving > 0.05) {
        armLRotX += -sway * 0.45;
        armRRotX += sway * 0.45;
      }
    }

    // Apply transforms to procedural rig
    torso.position.y = torsoPosY;
    torso.rotation.set(torsoRotX, torsoRotY, torsoRotZ);
    head.rotation.set(headRotX, headRotY, headRotZ);
    armR.rotation.set(armRRotX, armRRotY, armRRotZ);
    armL.rotation.set(armLRotX, armLRotY, armLRotZ);
    legL.rotation.set(legLRotX, 0, legLRotZ);
    legR.rotation.set(legRRotX, 0, legRRotZ);

    // Apply synchronized transforms to loaded VOX skeleton (player_armored.vox)
    if (g.voxMesh) {
      if (g.voxMesh.torso) {
        g.voxMesh.torso.position.y = (torsoPosY - 0.32);
        g.voxMesh.torso.rotation.set(torsoRotX, torsoRotY, torsoRotZ);
      }
      if (g.voxMesh.head) g.voxMesh.head.rotation.set(headRotX, headRotY, headRotZ);
      if (g.voxMesh.armR) g.voxMesh.armR.rotation.set(armRRotX, armRRotY, armRRotZ);
      if (g.voxMesh.armL) g.voxMesh.armL.rotation.set(armLRotX, armLRotY, armLRotZ);
      if (g.voxMesh.legL) g.voxMesh.legL.rotation.set(legLRotX, 0, legLRotZ);
      if (g.voxMesh.legR) g.voxMesh.legR.rotation.set(legRRotX, 0, legRRotZ);
    }
  }

  return {
    root: g,
    rig,
    setMoving01,
    setAimPitch,
    setWeapon,
    setCombatAction,
    tick,
  };
}
