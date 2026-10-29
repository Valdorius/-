// portals.js
// Builds animated 3D voxel spawn portals with orbiting voxel cubes along arena walls.
// Retro Voxel / Pixel-Art styling: stepped pedestal, obsidian pillars with glowing runes,
// and a dynamic volumetric vortex of orbiting glowing voxel cubes.

import * as THREE from "three";
import { createPixelStoneBrickTexture } from "./textures.js";

export function createPortals({ scene }) {
  const portals = [];
  const group = new THREE.Group();
  group.name = "Portals";
  scene.add(group);

  // Match world.js hex params
  const HEX_R = 48;

  function hexPt(i) {
    const ang = Math.PI / 3 * i + Math.PI / 6;
    return { x: Math.cos(ang) * HEX_R, z: Math.sin(ang) * HEX_R };
  }

  const segments = [
    [0, 1], // top-right wall
    [2, 3], // left wall
    [4, 5], // bottom wall
  ];

  const PORTALS_PER_WALL = 2;
  const PORTAL_INSET = 2.8;  // push portal inside arena from the wall
  const PORTAL_Y = 2.0;

  // Shared textures & materials for voxel portal frame
  const portalStoneTex = createPixelStoneBrickTexture({
    palette: ["#151c28", "#1c2536", "#111722", "#222d42"],
    mortarColor: "#080c14"
  });
  portalStoneTex.repeat.set(1, 2);

  const frameMat = new THREE.MeshStandardMaterial({
    map: portalStoneTex,
    roughness: 0.82,
    metalness: 0.15,
    emissive: new THREE.Color(0x060e1a),
    emissiveIntensity: 0.25
  });

  const runeCyanMat = new THREE.MeshBasicMaterial({
    color: 0x00e1ff,
    transparent: true,
    opacity: 0.95
  });

  const runePurpleMat = new THREE.MeshBasicMaterial({
    color: 0xbd42ff,
    transparent: true,
    opacity: 0.90
  });

  const diskGeo = new THREE.CircleGeometry(1.22, 28);
  const baseDiskMat = new THREE.MeshBasicMaterial({
    color: 0x0b1836,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide
  });

  const vortexRingGeo = new THREE.RingGeometry(1.15, 1.34, 32);
  const baseRingMat = new THREE.MeshBasicMaterial({
    color: 0x22b8ff,
    transparent: true,
    opacity: 0.70,
    side: THREE.DoubleSide
  });

  const basePlinthGeo = new THREE.BoxGeometry(3.6, 0.45, 1.4);
  const sideStepGeo = new THREE.BoxGeometry(0.8, 0.75, 1.1);
  const pillarGeo = new THREE.BoxGeometry(0.58, 3.8, 0.58);
  const lintelGeo = new THREE.BoxGeometry(3.5, 0.58, 0.68);
  const runeBandGeo = new THREE.BoxGeometry(0.62, 0.20, 0.62);

  for (const [idxA, idxB] of segments) {
    const A = hexPt(idxA);
    const B = hexPt(idxB);

    const vx = B.x - A.x;
    const vz = B.z - A.z;
    const vlen = Math.hypot(vx, vz) || 1;
    const tx = vx / vlen, tz = vz / vlen;

    let nx = -tz, nz = tx;
    const mx = (A.x + B.x) * 0.5;
    const mz = (A.z + B.z) * 0.5;
    if (nx * (-mx) + nz * (-mz) < 0) { nx = -nx; nz = -nz; }

    for (let i = 0; i < PORTALS_PER_WALL; i++) {
      const t = (i + 1) / (PORTALS_PER_WALL + 1);
      const px = A.x + vx * t + nx * PORTAL_INSET;
      const pz = A.z + vz * t + nz * PORTAL_INSET;

      const root = new THREE.Group();
      root.position.set(px, PORTAL_Y, pz);
      // Face towards center of arena
      root.rotation.y = Math.atan2(nx, nz);

      // 1. Stepped Voxel Pedestal at floor level
      const plinth = new THREE.Mesh(basePlinthGeo, frameMat);
      plinth.position.set(0, -PORTAL_Y + 0.225, 0);
      root.add(plinth);

      const stepL = new THREE.Mesh(sideStepGeo, frameMat);
      stepL.position.set(-1.75, -PORTAL_Y + 0.375, 0);
      root.add(stepL);

      const stepR = new THREE.Mesh(sideStepGeo, frameMat);
      stepR.position.set(1.75, -PORTAL_Y + 0.375, 0);
      root.add(stepR);

      // 2. Voxel Frame: Pillars & Lintel
      const pillarL = new THREE.Mesh(pillarGeo, frameMat);
      pillarL.position.set(-1.45, 0.25, 0);
      root.add(pillarL);

      const pillarR = new THREE.Mesh(pillarGeo, frameMat);
      pillarR.position.set(1.45, 0.25, 0);
      root.add(pillarR);

      const lintel = new THREE.Mesh(lintelGeo, frameMat);
      lintel.position.set(0, 2.22, 0);
      root.add(lintel);

      // Glowing rune bands on pillars
      const runeL1 = new THREE.Mesh(runeBandGeo, runeCyanMat);
      runeL1.position.set(-1.45, -0.4, 0);
      root.add(runeL1);

      const runeL2 = new THREE.Mesh(runeBandGeo, runePurpleMat);
      runeL2.position.set(-1.45, 1.1, 0);
      root.add(runeL2);

      const runeR1 = new THREE.Mesh(runeBandGeo, runeCyanMat);
      runeR1.position.set(1.45, -0.4, 0);
      root.add(runeR1);

      const runeR2 = new THREE.Mesh(runeBandGeo, runePurpleMat);
      runeR2.position.set(1.45, 1.1, 0);
      root.add(runeR2);

      // 3. Central Event Horizon (Dark Void Disc + Swirling Rim)
      const disk = new THREE.Mesh(diskGeo, baseDiskMat.clone());
      disk.position.set(0, 0.25, 0.02);
      root.add(disk);

      const ring = new THREE.Mesh(vortexRingGeo, baseRingMat.clone());
      ring.position.set(0, 0.25, 0.03);
      root.add(ring);

      // 4. Volumetric Orbiting Voxel Cubes (Swirling 3D Vortex)
      const cubes = [];
      const CUBE_COUNT = 28;
      for (let k = 0; k < CUBE_COUNT; k++) {
        const sz = 0.14 + Math.random() * 0.12;
        const cubeGeo = new THREE.BoxGeometry(sz, sz, sz);
        const isCyan = (k % 2 === 0);
        const cubeMat = new THREE.MeshBasicMaterial({
          color: isCyan ? 0x2ae0ff : 0xd25eff,
          transparent: true,
          opacity: 0.75 + Math.random() * 0.25
        });

        const mesh = new THREE.Mesh(cubeGeo, cubeMat);
        const radius = 0.35 + Math.random() * 0.90;
        const angle = Math.random() * Math.PI * 2;
        const speed = (0.9 + Math.random() * 1.8) * (Math.random() < 0.35 ? -1 : 1);
        const zOffset = 0.04 + Math.random() * 0.24;
        const zSpeed = 1.5 + Math.random() * 2.5;

        mesh.position.set(
          Math.cos(angle) * radius,
          0.25 + Math.sin(angle) * radius * 0.9,
          zOffset
        );
        root.add(mesh);

        cubes.push({
          mesh,
          radius,
          angle,
          speed,
          zOffset,
          zSpeed,
          rotSpd: (Math.random() - 0.5) * 4.0
        });
      }

      const light = new THREE.PointLight(0x2aa7ff, 0.85, 10.0, 2.0);
      light.position.set(0, 0.25, 0.5);
      root.add(light);

      group.add(root);

      const forward = new THREE.Vector3(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y));
      const right = new THREE.Vector3(forward.z, 0, -forward.x);

      portals.push({
        pos: new THREE.Vector3(px, 0, pz),
        root, ring, disk, cubes, light,
        forward, right,
        t: Math.random() * 10
      });
    }
  }

  let seq = 0;

  function nextSpawnPos(randFn) {
    if (portals.length === 0) return null;
    const p = portals[(seq++) % portals.length];
    const rand = randFn || ((a, b) => a + Math.random() * (b - a));
    const jT = rand(-1.2, 1.2);
    const jN = rand(0.4, 2.2);
    return {
      pos: new THREE.Vector3(
        p.pos.x + p.right.x * jT + p.forward.x * jN,
        0,
        p.pos.z + p.right.z * jT + p.forward.z * jN
      ),
      portal: p
    };
  }

  function tick(dt) {
    for (const p of portals) {
      p.t += dt;
      const pulse = 0.75 + 0.25 * Math.sin(p.t * 2.2);

      p.disk.material.opacity = 0.82 + 0.15 * pulse;
      p.ring.rotation.z += dt * 0.8;
      p.ring.material.opacity = 0.55 + 0.35 * pulse;

      // Animate orbiting 3D voxel cubes
      for (const c of p.cubes) {
        c.angle += c.speed * dt;
        const wave = Math.sin(p.t * c.zSpeed);
        c.mesh.position.x = Math.cos(c.angle) * c.radius;
        c.mesh.position.y = 0.25 + Math.sin(c.angle) * c.radius * 0.95;
        c.mesh.position.z = c.zOffset + 0.08 * wave;
        c.mesh.rotation.x += dt * c.rotSpd;
        c.mesh.rotation.y += dt * (c.rotSpd * 1.2);
      }

      p.light.intensity = 0.65 + 0.50 * pulse;
    }
  }

  function dispose() {
    scene.remove(group);
  }

  return { group, portals, tick, nextSpawnPos, dispose };
}
