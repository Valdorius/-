
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
  // Our constructed rig is roughly height ~2.0 in these units; scale down a bit.
  g.scale.set(0.92, 0.92, 0.92);
  g.position.set(0, 0, 0);

  // Tiny idle animation params (optional): stored for external tick
  const state = {
    t: 0,
    moving: 0,
    aimPitch: 0,
  };

  function setMoving01(v){ state.moving = Math.max(0, Math.min(1, v||0)); }
  function setAimPitch(rad){ state.aimPitch = rad || 0; }

  function tick(dt){
    state.t += dt;

    // Subtle breathing + movement sway for networked readability (doesn't touch FPS camera)
    const breathe = Math.sin(state.t*2.0) * 0.008;
    torso.position.y = 0.32 + breathe;

    const sway = state.moving * Math.sin(state.t*9.0) * 0.06;
    legL.rotation.x =  sway;
    legR.rotation.x = -sway;
    armL.rotation.x = -sway*0.6;
    armR.rotation.x =  sway*0.6;

    // Head slightly follows aim pitch (clamped)
    const p = Math.max(-0.6, Math.min(0.6, state.aimPitch));
    head.rotation.x = p * 0.35;
  }

  return {
    root: g,
    rig,
    setMoving01,
    setAimPitch,
    tick,
  };
}
