// portals.js
// Builds animated spawn portals along a single arena wall.
// Pure helper: does not depend on enemies.js API to avoid init-order issues.

import * as THREE from "three";

export function createPortals({ scene }) {
  const portals = [];
  const group = new THREE.Group();
  group.name = "Portals";
  scene.add(group);

  // Match world.js hex params (kept local so this module is self-contained)
  const HEX_R = 48;

  function hexPt(i) {
    const ang = Math.PI / 3 * i + Math.PI / 6;
    return { x: Math.cos(ang) * HEX_R, z: Math.sin(ang) * HEX_R };
  }

  // Choose ONE wall segment: between vertex 4 and 5 (bottom-right wall)
  const A = hexPt(4);
  const B = hexPt(5);

  const vx = B.x - A.x;
  const vz = B.z - A.z;
  const vlen = Math.hypot(vx, vz) || 1;
  const tx = vx / vlen, tz = vz / vlen;

  // Perp normal (candidate)
  let nx = -tz, nz = tx;
  // Ensure it points inward (towards center 0,0)
  const mx = (A.x + B.x) * 0.5;
  const mz = (A.z + B.z) * 0.5;
  if (nx * (-mx) + nz * (-mz) < 0) { nx = -nx; nz = -nz; }

  const PORTAL_COUNT = 3;
  const PORTAL_INSET = 2.2;  // push portal inside arena from the wall
  const PORTAL_Y = 2.0;
  const PORTAL_R = 1.55;

  const ringGeo = new THREE.TorusGeometry(PORTAL_R, 0.22, 10, 32);
  const diskGeo = new THREE.CircleGeometry(PORTAL_R * 0.82, 28);
  const shardGeo = new THREE.PlaneGeometry(0.35, 1.1);

  const baseRingMat = new THREE.MeshStandardMaterial({
    color: 0x102038,
    emissive: 0x2aa7ff,
    emissiveIntensity: 1.35,
    roughness: 0.35,
    metalness: 0.2
  });

  const baseDiskMat = new THREE.MeshBasicMaterial({
    color: 0x1b76ff,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const baseShardMat = new THREE.MeshBasicMaterial({
    color: 0x69c7ff,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });

  for (let i = 0; i < PORTAL_COUNT; i++) {
    const t = (i + 1) / (PORTAL_COUNT + 1);
    const px = A.x + vx * t + nx * PORTAL_INSET;
    const pz = A.z + vz * t + nz * PORTAL_INSET;

    const root = new THREE.Group();
    root.position.set(px, PORTAL_Y, pz);
    // face inward; forward (+Z) points inward after this rotation
    root.rotation.y = Math.atan2(nx, nz);

    const ring = new THREE.Mesh(ringGeo, baseRingMat.clone());
    ring.rotation.x = Math.PI / 2; // keep torus vertical
    root.add(ring);

    const disk = new THREE.Mesh(diskGeo, baseDiskMat.clone());
    disk.position.z = 0.05;
    root.add(disk);

    const shards = [];
    for (let k = 0; k < 5; k++) {
      const s = new THREE.Mesh(shardGeo, baseShardMat.clone());
      const ang = (k / 5) * Math.PI * 2;
      s.position.set(Math.cos(ang) * 0.85, 0, Math.sin(ang) * 0.15);
      s.rotation.y = ang;
      s.rotation.x = (k % 2 ? 0.25 : -0.25);
      s.scale.setScalar(0.9 + 0.25 * Math.random());
      root.add(s);
      shards.push(s);
    }

    const light = new THREE.PointLight(0x2aa7ff, 0.75, 9.0, 2.0);
    light.position.set(0, 0, 0.4);
    root.add(light);

    group.add(root);

    const forward = new THREE.Vector3(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    portals.push({
      pos: new THREE.Vector3(px, 0, pz),
      root, ring, disk, shards, light,
      forward, right,
      t: Math.random() * 10
    });
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
      const pulse = 0.75 + 0.25 * Math.sin(p.t * 2.0);
      p.disk.material.opacity = 0.18 + 0.12 * pulse;
      p.ring.material.emissiveIntensity = 1.15 + 0.65 * pulse;
      p.ring.rotation.z += dt * 0.6;
      let k = 0;
      for (const s of p.shards) {
        s.rotation.y += dt * (0.6 + 0.15 * k);
        s.rotation.z += dt * (0.4 + 0.1 * k);
        k++;
      }
      p.light.intensity = 0.55 + 0.55 * pulse;
    }
  }

  function dispose() {
    scene.remove(group);
  }

  return { group, portals, tick, nextSpawnPos, dispose };
}
