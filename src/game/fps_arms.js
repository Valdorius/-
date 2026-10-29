import * as THREE from "three";
import { clamp } from "../core/math.js";

/**
 * First-person voxel character arms rig.
 * - Provides realistic two-handed kinetic animations for weapons (Hammer, Spear, Bow, Staff).
 * - Arms and gauntlets physically grip the weapon handles.
 * - Head & torso are omitted from first-person view to prevent camera clipping,
 *   while the physical 3D avatar remains in world space for shadows and collisions.
 */
export function createFpsArms({ camera }) {
  const root = new THREE.Group();
  root.name = "FpsArmsRoot";
  camera.add(root);

  // Voxel combat suit & gauntlet materials (matches player avatar palette)
  const suitDark  = new THREE.MeshStandardMaterial({ color: 0x182030, roughness: 0.80, metalness: 0.18 });
  const suitMid   = new THREE.MeshStandardMaterial({ color: 0x223048, roughness: 0.70, metalness: 0.22 });
  const suitLite  = new THREE.MeshStandardMaterial({ color: 0x314668, roughness: 0.60, metalness: 0.25 });
  const steel     = new THREE.MeshStandardMaterial({ color: 0xd8e4fc, roughness: 0.32, metalness: 0.70 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x283242, roughness: 0.52, metalness: 0.55 });

  // Glowing runic wristband (color dynamically adapts to weapon)
  const runeMat = new THREE.MeshStandardMaterial({
    color: 0xffaa22,
    emissive: 0xff9900,
    emissiveIntensity: 2.2,
    roughness: 0.18,
    metalness: 0.10
  });

  function box(w, h, d, x, y, z, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  }

  // Base arm segment lengths
  const UPPER_LEN = 0.29;
  const FORE_LEN  = 0.29;

  // Builds a segmented voxel gauntlet (closed fist gripping around a weapon handle)
  function createGauntlet(isLeft = false) {
    const g = new THREE.Group();
    g.name = isLeft ? "GauntletL" : "GauntletR";

    const sign = isLeft ? -1 : 1;

    // 1. Armored wrist cuff
    g.add(box(0.100, 0.095, 0.045, 0, 0.015, 0.065, darkSteel));

    // 2. Glowing runic energy inlay band around wrist
    g.add(box(0.104, 0.098, 0.020, 0, 0.015, 0.050, runeMat));

    // 3. Palm & back-of-hand core
    g.add(box(0.092, 0.040, 0.085, 0, 0.042, 0.005, suitMid));

    // 4. Heavy steel knuckle-guard plate across knuckles
    g.add(box(0.096, 0.028, 0.035, 0, 0.055, -0.015, steel));

    // 5. Four segmented armored gripping fingers wrapping around the handle (shaft passes through 0,0,0 along Z)
    const fingerZs = [0.030, 0.010, -0.010, -0.030];
    for (const fz of fingerZs) {
      // Finger proximal segment (curving down the side of handle)
      g.add(box(0.024, 0.075, 0.018, sign * 0.048, 0.008, fz, steel));
      // Finger distal segment (curling under the handle to lock the grip)
      g.add(box(0.055, 0.022, 0.018, sign * 0.020, -0.042, fz, darkSteel));
      // Finger tips curling back into palm
      g.add(box(0.020, 0.032, 0.018, -sign * 0.015, -0.024, fz, suitLite));
    }

    // 6. Armored thumb bracing the handle from the opposite side
    const thumbX = -sign * 0.048;
    const thumb = box(0.026, 0.032, 0.055, thumbX, 0.022, 0.010, steel);
    thumb.rotation.z = -sign * 0.35;
    g.add(thumb);

    const thumbTip = box(0.024, 0.048, 0.024, thumbX + sign * 0.012, -0.012, 0.020, darkSteel);
    thumbTip.rotation.z = -sign * 0.45;
    g.add(thumbTip);

    return g;
  }

  // Builds an arm hierarchy: upper arm + forearm + gauntlet
  function createArm(isLeft = false) {
    const arm = {
      isLeft,
      upperGroup: new THREE.Group(),
      foreGroup: new THREE.Group(),
      handGroup: createGauntlet(isLeft),
      shoulderPos: new THREE.Vector3(isLeft ? -0.28 : 0.28, -0.28, -0.15),
      bendHint: new THREE.Vector3(isLeft ? -0.45 : 0.45, -0.85, -0.20)
    };

    // Upper arm mesh: pivot at (0,0,0), extends along -Z to (0,0,-UPPER_LEN)
    const uMeshGroup = new THREE.Group();
    // Bicep/Tricep voxel core
    uMeshGroup.add(box(0.105, 0.105, UPPER_LEN * 0.92, 0, 0, -UPPER_LEN * 0.46, suitMid));
    // Shoulder pauldrons / upper sleeve plate
    uMeshGroup.add(box(0.120, 0.120, UPPER_LEN * 0.48, 0, 0.015, -UPPER_LEN * 0.28, suitLite));
    // Upper arm accent inlay
    uMeshGroup.add(box(0.112, 0.025, UPPER_LEN * 0.60, 0, 0.060, -UPPER_LEN * 0.50, darkSteel));
    arm.upperGroup.add(uMeshGroup);

    // Forearm mesh: pivot at (0,0,0), extends along -Z to (0,0,-FORE_LEN)
    const fMeshGroup = new THREE.Group();
    // Forearm core
    fMeshGroup.add(box(0.098, 0.098, FORE_LEN * 0.92, 0, 0, -FORE_LEN * 0.46, suitDark));
    // Heavy vambrace steel forearm guard
    fMeshGroup.add(box(0.108, 0.030, FORE_LEN * 0.70, 0, 0.056, -FORE_LEN * 0.48, steel));
    // Vambrace side plates
    fMeshGroup.add(box(0.024, 0.102, FORE_LEN * 0.60, 0.052, 0, -FORE_LEN * 0.50, darkSteel));
    fMeshGroup.add(box(0.024, 0.102, FORE_LEN * 0.60, -0.052, 0, -FORE_LEN * 0.50, darkSteel));
    arm.foreGroup.add(fMeshGroup);

    root.add(arm.upperGroup);
    root.add(arm.foreGroup);
    root.add(arm.handGroup);

    return arm;
  }

  const armL = createArm(true);
  const armR = createArm(false);

  // Two-bone analytical inverse kinematics solver
  const _vDiff = new THREE.Vector3();
  const _vDir = new THREE.Vector3();
  const _vBend = new THREE.Vector3();
  const _elbowPos = new THREE.Vector3();
  const _vShoulderR = new THREE.Vector3();
  const _vShoulderL = new THREE.Vector3();
  const _fwd = new THREE.Vector3(0, 0, -1);
  const _toUpper = new THREE.Vector3();
  const _toFore = new THREE.Vector3();
  const _qUpper = new THREE.Quaternion();
  const _qFore = new THREE.Quaternion();

  function solveTwoBoneIK(shoulder, handPos, bendHint, arm) {
    _vDiff.subVectors(handPos, shoulder);
    const dist = _vDiff.length();
    const maxLen = (UPPER_LEN + FORE_LEN) * 0.998;
    const minLen = Math.abs(UPPER_LEN - FORE_LEN) * 1.002;
    const d = Math.max(minLen, Math.min(maxLen, dist));

    _vDir.copy(_vDiff).normalize();

    // Law of cosines
    const cosAlpha = clamp((UPPER_LEN * UPPER_LEN + d * d - FORE_LEN * FORE_LEN) / (2 * UPPER_LEN * d), -1, 1);
    const alpha = Math.acos(cosAlpha);
    const sinAlpha = Math.sin(alpha);

    // Project bendHint onto plane orthogonal to _vDir
    _vBend.copy(bendHint).projectOnPlane(_vDir);
    if (_vBend.lengthSq() < 1e-5) {
      _vBend.set(0, -1, 0).projectOnPlane(_vDir);
    }
    _vBend.normalize();

    // Calculate elbow joint location
    _elbowPos.copy(shoulder)
      .addScaledVector(_vDir, UPPER_LEN * cosAlpha)
      .addScaledVector(_vBend, UPPER_LEN * sinAlpha);

    // Orient upper arm from shoulder to elbow
    arm.upperGroup.position.copy(shoulder);
    _toUpper.subVectors(_elbowPos, shoulder);
    const lenU = _toUpper.length();
    if (lenU > 1e-4) {
      _toUpper.normalize();
      _qUpper.setFromUnitVectors(_fwd, _toUpper);
      arm.upperGroup.quaternion.copy(_qUpper);
      arm.upperGroup.scale.set(1, 1, lenU / UPPER_LEN);
    }

    // Orient forearm from elbow to hand
    arm.foreGroup.position.copy(_elbowPos);
    _toFore.subVectors(handPos, _elbowPos);
    const lenF = _toFore.length();
    if (lenF > 1e-4) {
      _toFore.normalize();
      _qFore.setFromUnitVectors(_fwd, _toFore);
      arm.foreGroup.quaternion.copy(_qFore);
      arm.foreGroup.scale.set(1, 1, lenF / FORE_LEN);
    }
  }

  function setRuneColor(hex) {
    if (runeMat) {
      runeMat.color.setHex(hex);
      runeMat.emissive.setHex(hex);
    }
  }

  function setRuneGlow(intensity) {
    if (runeMat) {
      runeMat.emissiveIntensity = intensity;
    }
  }

  function setVisible(v) {
    root.visible = !!v;
  }

  // Updates both arms to physically hold the grips of the weapon
  function update(dt, weaponType, handPosR, handRotR, handPosL, handRotL, showL = true, showR = true) {
    armR.upperGroup.visible = showR;
    armR.foreGroup.visible  = showR;
    armR.handGroup.visible  = showR;

    armL.upperGroup.visible = showL;
    armL.foreGroup.visible  = showL;
    armL.handGroup.visible  = showL;

    if (showR && handPosR) {
      // Right hand position and orientation
      armR.handGroup.position.copy(handPosR);
      if (handRotR) armR.handGroup.quaternion.copy(handRotR);

      // Anatomical clavicle/shoulder elevation when hands raise high (e.g. overhead slam)
      const shrugR = Math.max(0, handPosR.y - (-0.20)) * 0.32;
      _vShoulderR.copy(armR.shoulderPos);
      _vShoulderR.y += shrugR;
      _vShoulderR.x -= shrugR * 0.15; // shoulders slightly pinch inward when raising high overhead

      // Solve right arm kinematics
      solveTwoBoneIK(_vShoulderR, handPosR, armR.bendHint, armR);
    }

    if (showL && handPosL) {
      // Left hand position and orientation
      armL.handGroup.position.copy(handPosL);
      if (handRotL) armL.handGroup.quaternion.copy(handRotL);

      const shrugL = Math.max(0, handPosL.y - (-0.20)) * 0.32;
      _vShoulderL.copy(armL.shoulderPos);
      _vShoulderL.y += shrugL;
      _vShoulderL.x += shrugL * 0.15;

      // Solve left arm kinematics
      solveTwoBoneIK(_vShoulderL, handPosL, armL.bendHint, armL);
    }
  }

  return {
    root,
    armL,
    armR,
    setRuneColor,
    setRuneGlow,
    setVisible,
    update
  };
}
