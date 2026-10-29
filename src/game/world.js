import * as THREE from "three";
import {
  createPixelStoneBrickTexture,
  createPixelRuneEmissiveTexture,
  createPixelFloorTextures
} from "./textures.js";

/**
 * Hex arena + internal walls + solid collision.
 * - Arena is ~3x larger than the old rectangular box.
 * - Walls are "solid" via a circle-vs-capsule resolver in XZ plane.
 * - Retro Voxel / Pixel-Art styling: razor-sharp NearestFilter textures,
 *   architectural 3-piece voxel pillars with glowing runes, modular floor.
 */

export function createWorld(engine){
  const { scene } = engine;

  const group = new THREE.Group();
  group.name = "World";
  scene.add(group);

  // ===== Scale (bigger arena) =====
  const HEX_R = 48;        // outer radius
  const WALL_H = 6;
  const WALL_T = 1.8;      // thickness
  const WALL_R = WALL_T*0.5;

  // ===== Modular Pixel-Art Floor Textures =====
  const floorTex = createPixelFloorTextures();
  // 260m plane / 65 repeats = 4m per 128x128 texture, exactly 1m per 32x32 cobblestone tile!
  floorTex.map.repeat.set(65, 65);
  floorTex.emissiveMap.repeat.set(65, 65);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: floorTex.map,
    emissive: new THREE.Color(0x0a223a),
    emissiveIntensity: 0.90,
    emissiveMap: floorTex.emissiveMap,
    roughness: 0.88,
    metalness: 0.05
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  group.add(floor);

  // Neon rim ring (purely visual)
  const rimGeo = new THREE.RingGeometry(HEX_R * 0.96, HEX_R * 1.03, 96, 1);
  const rimMat = new THREE.MeshBasicMaterial({ color: 0x39c7ff, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.02;
  group.add(rim);

  // ===== Stone & Rune Materials for Pillars and Walls =====
  const wallBrickTex = createPixelStoneBrickTexture();
  wallBrickTex.repeat.set(12, 2);
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallBrickTex,
    roughness: 0.88,
    metalness: 0.05,
    emissive: new THREE.Color(0x091420),
    emissiveIntensity: 0.22
  });

  const wallTrimMat = new THREE.MeshBasicMaterial({
    color: 0x00d2ff,
    transparent: true,
    opacity: 0.80
  });

  // Pillar trim: dark chiseled stone for base and capital
  const pillarTrimTex = createPixelStoneBrickTexture({
    palette: ["#1e2838", "#253347", "#1a2332", "#2c3c52"],
    mortarColor: "#0b1018"
  });
  pillarTrimTex.repeat.set(2, 1);
  const pillarTrimMat = new THREE.MeshStandardMaterial({
    map: pillarTrimTex,
    roughness: 0.92,
    metalness: 0.05
  });

  // Plain stone brick shaft
  const pillarShaftTex = createPixelStoneBrickTexture();
  pillarShaftTex.repeat.set(2, 3);
  const pillarShaftMat = new THREE.MeshStandardMaterial({
    map: pillarShaftTex,
    roughness: 0.88,
    metalness: 0.05,
    emissive: new THREE.Color(0x08101a),
    emissiveIntensity: 0.20
  });

  // Cyan glowing rune pillar
  const runeCyanBaseTex = createPixelStoneBrickTexture();
  runeCyanBaseTex.repeat.set(1, 2);
  const runeCyanEmissiveTex = createPixelRuneEmissiveTexture({
    color: "#39c7ff",
    glowColor: "rgba(20, 130, 220, 0.60)"
  });
  runeCyanEmissiveTex.repeat.set(1, 2);
  const pillarRuneCyanMat = new THREE.MeshStandardMaterial({
    map: runeCyanBaseTex,
    emissiveMap: runeCyanEmissiveTex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 1.5,
    roughness: 0.85,
    metalness: 0.05
  });

  // Emerald glowing rune pillar
  const runeEmeraldBaseTex = createPixelStoneBrickTexture();
  runeEmeraldBaseTex.repeat.set(1, 2);
  const runeEmeraldEmissiveTex = createPixelRuneEmissiveTexture({
    color: "#2af598",
    glowColor: "rgba(10, 160, 80, 0.60)"
  });
  runeEmeraldEmissiveTex.repeat.set(1, 2);
  const pillarRuneEmeraldMat = new THREE.MeshStandardMaterial({
    map: runeEmeraldBaseTex,
    emissiveMap: runeEmeraldEmissiveTex,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 1.5,
    roughness: 0.85,
    metalness: 0.05
  });

  // ===== Colliders =====
  const segs = [];   // {ax,az,bx,bz,r}
  const circles = []; // {x,z,r}

  function addSegment(ax, az, bx, bz, mat = wallMat){
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);

    const geo = new THREE.BoxGeometry(WALL_T, WALL_H, Math.max(0.01, len));
    const m = new THREE.Mesh(geo, mat);
    m.position.set((ax + bx) * 0.5, WALL_H * 0.5, (az + dz) * 0.5);
    m.rotation.y = Math.atan2(dx, dz);
    group.add(m);

    // Glowing neon crenellation trim along the wall top
    const trimGeo = new THREE.BoxGeometry(WALL_T * 1.04, 0.16, Math.max(0.01, len));
    const trimMesh = new THREE.Mesh(trimGeo, wallTrimMat);
    trimMesh.position.set((ax + bx) * 0.5, WALL_H + 0.08, (az + dz) * 0.5);
    trimMesh.rotation.y = Math.atan2(dx, dz);
    group.add(trimMesh);

    segs.push({ ax, az, bx, bz, r: WALL_R });
  }

  // ===== Outer hex =====
  const pts = [];
  for(let i = 0; i < 6; i++){
    const ang = Math.PI / 3 * i + Math.PI / 6; // flat side faces -Z/+Z
    pts.push([Math.cos(ang) * HEX_R, Math.sin(ang) * HEX_R]);
  }
  for(let i = 0; i < 6; i++){
    const a = pts[i], b = pts[(i + 1) % 6];
    addSegment(a[0], a[1], b[0], b[1], wallMat);
  }

  // ===== Columns for cover (Architectural Voxel Pillars) =====
  const baseCapGeo = new THREE.BoxGeometry(2.5, 0.45, 2.5);
  const shaftGeo = new THREE.BoxGeometry(2.0, 3.5, 2.0);

  const spots = [];
  // Evenly distributed cover columns (no central wall). Rings across arena.
  const rings = [
    { r: 10, n: 6 },
    { r: 18, n: 10 },
    { r: 28, n: 14 },
    { r: 38, n: 16 }
  ];
  for (const ring of rings){
    for (let i = 0; i < ring.n; i++){
      const a = (i / ring.n) * Math.PI * 2;
      const j = (Math.sin(i * 12.345) + Math.cos(i * 3.21)) * 0.6; // deterministic jitter
      const rr = ring.r + j;
      spots.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
  }
  // A few inner columns for tactics, but keep the very center open.
  const inner = [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, -12], [0, 12], [-12, 0], [12, 0]];
  for (const p of inner) spots.push(p);

  for (let idx = 0; idx < spots.length; idx++){
    const [x, z] = spots[idx];
    const pillarGroup = new THREE.Group();
    pillarGroup.position.set(x, 0, z);

    // 1. Stepped Base Pedestal (0 to 0.45m)
    const baseMesh = new THREE.Mesh(baseCapGeo, pillarTrimMat);
    baseMesh.position.y = 0.225;
    pillarGroup.add(baseMesh);

    // 2. Shaft with alternating glowing runes (0.45m to 3.95m)
    // 33% Cyan Runes, 33% Emerald Runes, 34% Plain Stone Brick
    const shaftMat = (idx % 3 === 0)
      ? pillarRuneCyanMat
      : (idx % 3 === 1)
        ? pillarRuneEmeraldMat
        : pillarShaftMat;

    const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
    shaftMesh.position.y = 2.20;
    pillarGroup.add(shaftMesh);

    // 3. Stepped Capital Crown (3.95m to 4.40m)
    const capMesh = new THREE.Mesh(baseCapGeo, pillarTrimMat);
    capMesh.position.y = 4.175;
    pillarGroup.add(capMesh);

    // Subtle soft light near glowing rune pillars
    if (idx % 3 !== 2) {
      const pColor = (idx % 3 === 0) ? 0x39c7ff : 0x2af598;
      const pLight = new THREE.PointLight(pColor, 0.45, 6.0, 2.0);
      pLight.position.set(0, 2.2, 0);
      pillarGroup.add(pLight);
    }

    group.add(pillarGroup);
    circles.push({ x, z, r: 1.25 }); // collision radius in XZ preserved!
  }

  // Coarse clamp (stability). Real "solid" is colliders.
  const bounds = { minX: -HEX_R - 2, maxX: HEX_R + 2, minZ: -HEX_R - 2, maxZ: HEX_R + 2 };

  function resolveCircle(pos, radius, iterations = 2){
    for(let it = 0; it < iterations; it++){
      // segments as capsules
      for(const s of segs){
        const ax = s.ax, az = s.az, bx = s.bx, bz = s.bz, wr = s.r;
        const vx = bx - ax, vz = bz - az;
        const wx = pos.x - ax, wz = pos.z - az;
        const vv = vx * vx + vz * vz || 1e-6;

        let t = (wx * vx + wz * vz) / vv;
        t = Math.max(0, Math.min(1, t));

        const cx = ax + vx * t;
        const cz = az + vz * t;

        let dx = pos.x - cx;
        let dz = pos.z - cz;
        let d2 = dx * dx + dz * dz;

        const minD = radius + wr;
        const minD2 = minD * minD;

        if(d2 < minD2){
          let d = Math.sqrt(d2);
          if(d < 1e-5){
            // stable normal: perpendicular to segment
            const nx = -vz, nz = vx;
            const nl = Math.hypot(nx, nz) || 1;
            dx = nx / nl; dz = nz / nl;
            d = 1e-5;
          }else{
            dx /= d; dz /= d;
          }
          const push = (minD - d) + 1e-4;
          pos.x += dx * push;
          pos.z += dz * push;
        }
      }

      // circles
      for(const c of circles){
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        const minD = radius + c.r;
        const d2 = dx * dx + dz * dz;
        if(d2 < minD * minD){
          let d = Math.sqrt(d2);
          let nx = 1, nz = 0;
          if(d > 1e-5){ nx = dx / d; nz = dz / d; }
          const push = (minD - d) + 1e-4;
          pos.x += nx * push;
          pos.z += nz * push;
        }
      }

      pos.x = Math.max(bounds.minX, Math.min(bounds.maxX, pos.x));
      pos.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, pos.z));
    }
  }

  return { group, bounds, resolveCircle, circles };
}
