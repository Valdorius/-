import * as THREE from "three";

/**
 * Hex arena + internal walls + solid collision.
 * - Arena is ~3x larger than the old rectangular box.
 * - Walls are "solid" via a circle-vs-capsule resolver in XZ plane.
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
  // Floor + Materials (visual upgrade only; no gameplay changes)
  // ===== Materials (upgraded arena look; no gameplay changes) =====
  const texPack = (function(){
    const size = 1024;
    // --- Color map ---
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const g = c.getContext("2d");
    // base
    const base = g.createRadialGradient(size*0.5,size*0.5, size*0.12, size*0.5,size*0.5, size*0.62);
    base.addColorStop(0, "#111c2f");
    base.addColorStop(1, "#0a1020");
    g.fillStyle = base;
    g.fillRect(0,0,size,size);

    // subtle noise
    const img = g.getImageData(0,0,size,size);
    for(let i=0;i<img.data.length;i+=4){
      const n = (Math.random()*14)|0;
      img.data[i]   = Math.min(255, img.data[i]   + n);
      img.data[i+1] = Math.min(255, img.data[i+1] + n);
      img.data[i+2] = Math.min(255, img.data[i+2] + n);
    }
    g.putImageData(img,0,0);

    // hex-ish grid (draw rotated honeycomb impression)
    g.globalAlpha = 0.22;
    g.strokeStyle = "rgba(120,200,255,0.55)";
    g.lineWidth = 2;
    const step = 64;
    const h = step * Math.sqrt(3)/2;
    for(let y=-step; y<size+step; y+=h){
      const odd = (((y/h)|0) % 2) ? step/2 : 0;
      for(let x=-step; x<size+step; x+=step){
        const cx = x + odd;
        const cy = y;
        g.beginPath();
        for(let k=0;k<6;k++){
          const a = Math.PI/3*k + Math.PI/6;
          const px = cx + Math.cos(a)*step*0.42;
          const py = cy + Math.sin(a)*step*0.42;
          if(k===0) g.moveTo(px,py); else g.lineTo(px,py);
        }
        g.closePath();
        g.stroke();
      }
    }

    // arena rings + markings
    g.globalAlpha = 0.28;
    g.strokeStyle = "rgba(255,120,180,0.55)";
    g.lineWidth = 4;
    for(let r=140;r<=420;r+=70){
      g.beginPath();
      g.arc(size*0.5,size*0.5,r,0,Math.PI*2);
      g.stroke();
    }
    // central emblem
    g.globalAlpha = 0.22;
    g.fillStyle = "rgba(0,200,255,0.35)";
    g.beginPath();
    g.moveTo(size*0.5, size*0.5-80);
    g.lineTo(size*0.5+70, size*0.5+60);
    g.lineTo(size*0.5-70, size*0.5+60);
    g.closePath();
    g.fill();

    // --- Emissive map (glow lines) ---
    const e = document.createElement("canvas");
    e.width = size; e.height = size;
    const eg = e.getContext("2d");
    eg.clearRect(0,0,size,size);
    eg.globalAlpha = 0.95;
    // copy grid as glow
    eg.drawImage(c,0,0);
    // boost rings/emblem
    eg.globalCompositeOperation = "lighter";
    eg.globalAlpha = 0.55;
    eg.fillStyle = "rgba(0,180,255,0.65)";
    eg.beginPath(); eg.arc(size*0.5,size*0.5,18,0,Math.PI*2); eg.fill();

    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(1,1);
    map.anisotropy = 8;

    const emissiveMap = new THREE.CanvasTexture(e);
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
    emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;
    emissiveMap.repeat.set(1,1);
    emissiveMap.anisotropy = 8;

    return { map, emissiveMap };
  })();

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texPack.map,
    emissive: new THREE.Color(0x113355),
    emissiveIntensity: 0.85,
    emissiveMap: texPack.emissiveMap,
    roughness: 0.95,
    metalness: 0.0
  });

  const wallMat  = new THREE.MeshStandardMaterial({
    color: 0x1a2438,
    roughness:0.88,
    metalness:0.0,
    emissive: new THREE.Color(0x081018),
    emissiveIntensity: 0.18
  });

  const innerMat = new THREE.MeshStandardMaterial({
    color: 0x22304a,
    roughness:0.86,
    metalness:0.0,
    emissive: new THREE.Color(0x0a1520),
    emissiveIntensity: 0.16
  });

  const colMat   = new THREE.MeshStandardMaterial({ color: 0x27324a, roughness:0.95, metalness:0.0 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(260,260), floorMat);
  floor.rotation.x = -Math.PI/2;
  floor.position.y = 0;
  group.add(floor);

  // Neon rim ring (purely visual)
  const rimGeo = new THREE.RingGeometry(HEX_R*0.96, HEX_R*1.03, 96, 1);
  const rimMat = new THREE.MeshBasicMaterial({ color: 0x39c7ff, transparent:true, opacity:0.55, side:THREE.DoubleSide });
  const rim = new THREE.Mesh(rimGeo, rimMat);
  rim.rotation.x = -Math.PI/2;
  rim.position.y = 0.02;
  group.add(rim);

  // ===== Colliders =====
  const segs = [];   // {ax,az,bx,bz,r}
  const circles = []; // {x,z,r}

  function addSegment(ax, az, bx, bz, mat=wallMat){
    const dx = bx-ax, dz = bz-az;
    const len = Math.hypot(dx,dz);

    const geo = new THREE.BoxGeometry(WALL_T, WALL_H, Math.max(0.01, len));
    const m = new THREE.Mesh(geo, mat);
    m.position.set((ax+bx)*0.5, WALL_H*0.5, (az+bz)*0.5);
    m.rotation.y = Math.atan2(dx, dz);
    group.add(m);

    segs.push({ ax, az, bx, bz, r: WALL_R });
  }

  // ===== Outer hex =====
  const pts = [];
  for(let i=0;i<6;i++){
    const ang = Math.PI/3 * i + Math.PI/6; // flat side faces -Z/+Z
    pts.push([Math.cos(ang)*HEX_R, Math.sin(ang)*HEX_R]);
  }
  for(let i=0;i<6;i++){
    const a = pts[i], b = pts[(i+1)%6];
    addSegment(a[0], a[1], b[0], b[1], wallMat);
  }


  // ===== Columns for cover (scaled) =====
  const colGeo = new THREE.BoxGeometry(2.2, 4.2, 2.2);
  const spots = [];
  // Evenly distributed cover columns (no central wall). Rings across arena.
  const rings = [
    { r: 10, n: 6 },
    { r: 18, n: 10 },
    { r: 28, n: 14 },
    { r: 38, n: 16 }
  ];
  for (const ring of rings){
    for (let i=0;i<ring.n;i++){
      const a = (i/ring.n) * Math.PI * 2;
      const j = (Math.sin(i*12.345)+Math.cos(i*3.21))*0.6; // deterministic jitter
      const rr = ring.r + j;
      spots.push([Math.cos(a)*rr, Math.sin(a)*rr]);
    }
  }
  // A few inner columns for tactics, but keep the very center open.
  const inner = [[-6,-6],[6,-6],[-6,6],[6,6],[0,-12],[0,12],[-12,0],[12,0]];
  for (const p of inner) spots.push(p);
  for (const [x,z] of spots){
    const c = new THREE.Mesh(colGeo, colMat);
    c.position.set(x, 2.1, z);
    group.add(c);
    circles.push({ x, z, r: 1.25 }); // collision radius in XZ
  }

  // Coarse clamp (stability). Real "solid" is colliders.
  const bounds = { minX:-HEX_R-2, maxX:HEX_R+2, minZ:-HEX_R-2, maxZ:HEX_R+2 };

  function resolveCircle(pos, radius, iterations=2){
    for(let it=0; it<iterations; it++){
      // segments as capsules
      for(const s of segs){
        const ax=s.ax, az=s.az, bx=s.bx, bz=s.bz, wr=s.r;
        const vx = bx-ax, vz = bz-az;
        const wx = pos.x-ax, wz = pos.z-az;
        const vv = vx*vx+vz*vz || 1e-6;

        let t = (wx*vx + wz*vz)/vv;
        t = Math.max(0, Math.min(1, t));

        const cx = ax + vx*t;
        const cz = az + vz*t;

        let dx = pos.x - cx;
        let dz = pos.z - cz;
        let d2 = dx*dx + dz*dz;

        const minD = radius + wr;
        const minD2 = minD*minD;

        if(d2 < minD2){
          let d = Math.sqrt(d2);
          if(d < 1e-5){
            // stable normal: perpendicular to segment
            const nx = -vz, nz = vx;
            const nl = Math.hypot(nx,nz) || 1;
            dx = nx/nl; dz = nz/nl;
            d = 1e-5;
          }else{
            dx /= d; dz /= d;
          }
          const push = (minD - d) + 1e-4;
          pos.x += dx*push;
          pos.z += dz*push;
        }
      }

      // circles
      for(const c of circles){
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        const minD = radius + c.r;
        const d2 = dx*dx + dz*dz;
        if(d2 < minD*minD){
          let d = Math.sqrt(d2);
          let nx=1, nz=0;
          if(d > 1e-5){ nx = dx/d; nz = dz/d; }
          const push = (minD - d) + 1e-4;
          pos.x += nx*push;
          pos.z += nz*push;
        }
      }

      pos.x = Math.max(bounds.minX, Math.min(bounds.maxX, pos.x));
      pos.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, pos.z));
    }
  }

  return { group, bounds, resolveCircle };
}
