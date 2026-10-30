import * as THREE from "three";
import { clamp } from "../core/math.js";
import { createVoxelAvatar } from "./avatar.js?v=20261030_09";

export function createPlayer({ engine, input, world, progression=null }) {
  const { camera, scene } = engine;

  // --- Camera tuning ---
  const TARGET_FOV = 85;
  const EYE_HEIGHT = 1.35;
  const PLAYER_RADIUS = 0.55; // collision radius vs walls/columns

  camera.fov = TARGET_FOV;
  camera.updateProjectionMatrix();

  // IMPORTANT: camera must be at local origin inside the pitch node,
  // otherwise pitch rotation makes it swing toward the floor.
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 0, 0);

  // Player rig:
  // bodyRoot (moves in world, includes jumping Y)
  //   └── yaw (rotates left/right)
  //        └── eye (offset up by EYE_HEIGHT)
  //             └── pitch (rotates up/down)
  //                  └── camera
  const bodyRoot = new THREE.Object3D();
  const yaw = new THREE.Object3D();
  const eye = new THREE.Object3D();
  const pitch = new THREE.Object3D();

  bodyRoot.add(yaw);
  yaw.add(eye);
  eye.position.set(0, EYE_HEIGHT, 0);
  eye.add(pitch);
  pitch.add(camera);

  scene.add(bodyRoot);

  // --- Third-person voxel avatar (for world presence, shadows & future multiplayer) ---
  // IMPORTANT: on layer 2, so local FPS camera does not render torso/head into screen view
  const avatar = createVoxelAvatar();
  avatar.root.visible = true;
  yaw.add(avatar.root);
  avatar.root.position.set(0, 0, 0);
  camera.layers.disable(2);


  // start
  bodyRoot.position.set(0, 0, 6);

  let yRot = 0;
  let pRot = 0;

  // movement
  const vel = new THREE.Vector3(0, 0, 0);
  let onGround = true;

  const GRAVITY = 18.0;
  const JUMP_V = 7.2;

  let hpMax = 120;
  let hp = hpMax;

  function applyDamage(dmg) {
    // optional shield relic
    if (progression && typeof progression.shouldBlockDamage === 'function') {
      if (progression.shouldBlockDamage()) return;
    }
    hp = Math.max(0, hp - dmg);
  }

  function lockFov(){
    if (camera.fov !== TARGET_FOV) {
      camera.fov = TARGET_FOV;
      camera.updateProjectionMatrix();
    }
  }

  function tick(dt) {
    lockFov();

    // look
    const m = input.consumeMouse();
    if (m.locked) {
      const sens = 0.0022;
      yRot -= m.dx * sens;
      pRot -= m.dy * sens;
      pRot = clamp(pRot, -1.45, 1.45);
    }
    yaw.rotation.y = yRot;
    pitch.rotation.x = pRot;

    // move XZ
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(yaw.quaternion).setY(0).normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(yaw.quaternion).setY(0).normalize();

    const w = input.isDown("KeyW") ? 1 : 0;
    const s = input.isDown("KeyS") ? 1 : 0;
    const a = input.isDown("KeyA") ? 1 : 0;
    const d = input.isDown("KeyD") ? 1 : 0;

    const run = input.isDown("ShiftLeft") || input.isDown("ShiftRight");
    const mul = (progression && progression.stats && progression.stats.moveSpeedMul) ? progression.stats.moveSpeedMul : 1.0;
    const arenaMul = (progression && progression.stats && progression.stats.arenaMoveSpeedMul) ? progression.stats.arenaMoveSpeedMul : 1.0;
    const spd = (run ? 8.2 : 6.0) * mul * arenaMul;

    const wish = new THREE.Vector3();
    wish.addScaledVector(fwd, w - s);
    wish.addScaledVector(right, d - a);
    if (wish.lengthSq() > 0) wish.normalize();

    vel.x = wish.x * spd;
    vel.z = wish.z * spd;

    // jump
    if (input.isDown("Space") && onGround) {
      vel.y = JUMP_V;
      onGround = false;
    }

    // gravity
    vel.y -= GRAVITY * dt;

    // integrate
    bodyRoot.position.addScaledVector(vel, dt);

    // ground at y=0 (bodyRoot). Eye is offset above it.
    if (bodyRoot.position.y <= 0) {
      bodyRoot.position.y = 0;
      vel.y = 0;
      onGround = true;
    }

    // bounds (XZ only)
    bodyRoot.position.x = clamp(bodyRoot.position.x, world.bounds.minX, world.bounds.maxX);
    bodyRoot.position.z = clamp(bodyRoot.position.z, world.bounds.minZ, world.bounds.maxZ);
    // solid walls (hex segments)
    if (world.resolveCircle) world.resolveCircle(bodyRoot.position, PLAYER_RADIUS, 3);

    // --- avatar animation driver (safe: does not touch camera/weapon rigs) ---
    const sp = Math.hypot(vel.x, vel.z);
    avatar.setMoving01(Math.min(1, sp / 6.0));
    avatar.setAimPitch(pitch.rotation.x);
    avatar.tick(dt);
  }

  function forward() {
    // forward from yaw (not pitch) for movement/attacks
    return new THREE.Vector3(0, 0, -1).applyQuaternion(yaw.quaternion).normalize();
  }

  return {
    root: bodyRoot,
    radius: PLAYER_RADIUS,

    // Third-person voxel avatar (hidden from local FPS camera by default via layers)
    avatar,
    // Enable/disable rendering of avatars (layer 2) on this camera.
    showAvatars(v=true){
      avatar.root.visible = !!v;
      v ? camera.layers.enable(2) : camera.layers.disable(2);
    },

    // Pose snapshot for future multiplayer sync
    getPose(){
      return {
        x: bodyRoot.position.x, y: bodyRoot.position.y, z: bodyRoot.position.z,
        yaw: yaw.rotation.y,
        pitch: pitch.rotation.x,
        vx: vel.x, vy: vel.y, vz: vel.z,
        onGround
      };
    },

    camera,
    tick,
    applyDamage,
    forward,
    get position() { return bodyRoot.position; },
    get hp() { return hp; },
    get hpMax() { return hpMax; },
    set hp(v) { hp = v; },
    set hpMax(v) { hpMax = v; },
    get onGround(){ return onGround; }
  };
}