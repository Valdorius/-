
import * as THREE from "three";

// Minimal MagicaVoxel .vox (VOX 150) loader (no external deps).
// - Silent on errors (returns null)
// - Builds a single mesh with vertex colors
// Notes: For best colors, export with palette (RGBA chunk). If absent, we fall back to a simple palette.

const _cache = new Map(); // url -> Promise<THREE.Object3D|null>

function _u32(dv, o){ return dv.getUint32(o, true); }
function _i32(dv, o){ return dv.getInt32(o, true); }

function _readString(dv, o, n){
  let s = "";
  for (let i=0;i<n;i++) s += String.fromCharCode(dv.getUint8(o+i));
  return s;
}

function _defaultPalette(){
  // Simple fallback palette: grayscale ramp.
  const pal = new Uint32Array(256);
  for (let i=0;i<256;i++){
    const v = i;
    pal[i] = (255<<24) | (v<<16) | (v<<8) | v;
  }
  pal[0] = 0; // index 0 unused/transparent
  return pal;
}

function parseVOX(arrayBuffer){
  try{
    const dv = new DataView(arrayBuffer);
    if (_readString(dv,0,4) !== "VOX ") return null;
    const version = _i32(dv,4);
    // version is usually 150
    let o = 8;

    // Main chunk
    const mainId = _readString(dv,o,4); o+=4;
    const mainSize = _u32(dv,o); o+=4;
    const mainChildren = _u32(dv,o); o+=4;
    if (mainId !== "MAIN") return null;
    o += mainSize; // usually 0

    let size = { x:0, y:0, z:0 };
    let voxels = []; // {x,y,z,c}
    let palette = null;

    const end = 8 + 12 + mainSize + mainChildren;
    while (o < end){
      const id = _readString(dv,o,4); o+=4;
      const chunkSize = _u32(dv,o); o+=4;
      const childSize = _u32(dv,o); o+=4;
      const dataStart = o;

      if (id === "SIZE"){
        size.x = _i32(dv, o); o+=4;
        size.y = _i32(dv, o); o+=4;
        size.z = _i32(dv, o); o+=4;
      } else if (id === "XYZI"){
        const n = _i32(dv, o); o+=4;
        voxels = new Array(n);
        for (let i=0;i<n;i++){
          const x = dv.getUint8(o++), y = dv.getUint8(o++), z = dv.getUint8(o++), c = dv.getUint8(o++);
          voxels[i] = { x, y, z, c };
        }
      } else if (id === "RGBA"){
        palette = new Uint32Array(256);
        for (let i=0;i<256;i++){
          const r = dv.getUint8(o++), g = dv.getUint8(o++), b = dv.getUint8(o++), a = dv.getUint8(o++);
          palette[i] = (a<<24) | (r<<16) | (g<<8) | (b);
        }
      }

      o = dataStart + chunkSize;
      o += childSize; // skip children (we don't support multi-model in this minimal loader)
    }

    if (!palette) palette = _defaultPalette();
    return { size, voxels, palette };
  } catch(e){
    return null;
  }
}

function buildMesh(parsed, opts){
  const voxelSize = opts?.voxelSize ?? 0.08;
  const scale = opts?.scale ?? 1.0;
  const pivot = opts?.pivot ?? ( (opts?.center === false) ? "origin" : "bottom_center" );

  const { size, voxels, palette } = parsed;

  // Precompute cube face data
  const hs = voxelSize * 0.5;
  const faces = [
    // +X
    { n:[ 1,0,0], v:[[ hs,-hs,-hs],[ hs, hs,-hs],[ hs, hs, hs],[ hs,-hs, hs]] },
    // -X
    { n:[-1,0,0], v:[[-hs,-hs, hs],[-hs, hs, hs],[-hs, hs,-hs],[-hs,-hs,-hs]] },
    // +Y
    { n:[0, 1,0], v:[[-hs, hs,-hs],[-hs, hs, hs],[ hs, hs, hs],[ hs, hs,-hs]] },
    // -Y
    { n:[0,-1,0], v:[[ hs,-hs,-hs],[ hs,-hs, hs],[-hs,-hs, hs],[-hs,-hs,-hs]] },
    // +Z
    { n:[0,0, 1], v:[[ hs,-hs, hs],[ hs, hs, hs],[-hs, hs, hs],[-hs,-hs, hs]] },
    // -Z
    { n:[0,0,-1], v:[[-hs,-hs,-hs],[-hs, hs,-hs],[ hs, hs,-hs],[ hs,-hs,-hs]] },
  ];

  const positions = [];
  const normals = [];
  const colors = [];

    // Pivot:
  // - "origin": keep VOX origin (0,0,0) at (0,0,0)
  // - "center": center the model around (0,0,0)
  // - "bottom_center": center X/Z but keep bottom on Y=0 (best for characters)
  let ox = 0, oy = 0, oz = 0;
  if (pivot === "center"){
    ox = size.x * voxelSize * 0.5;
    oy = size.y * voxelSize * 0.5;
    oz = size.z * voxelSize * 0.5;
  } else if (pivot === "bottom_center"){
    ox = size.x * voxelSize * 0.5;
    oy = 0;
    oz = size.z * voxelSize * 0.5;
  }


  for (const v of voxels){
    const col = palette[v.c] >>> 0;
    const r = ((col >> 16) & 255) / 255;
    const g = ((col >>  8) & 255) / 255;
    const b = ((col >>  0) & 255) / 255;

    const px = (v.x + 0.5) * voxelSize - cx;
    const py = (v.z + 0.5) * voxelSize - cz; // map VOX z -> world y? No: keep y up, but VOX uses y as up. We'll keep y up.
    const pz = (v.y + 0.5) * voxelSize - cy; // map VOX y -> world z
    // The above swap (y<->z) makes many VOX exports look correct in our world where Y is up.

    for (const f of faces){
      const n = f.n;
      const vv = f.v;
      // two triangles: 0-1-2 and 0-2-3
      const tri = [0,1,2, 0,2,3];
      for (let k=0;k<6;k++){
        const q = vv[tri[k]];
        positions.push(px + q[0], py + q[1], pz + q[2]);
        normals.push(n[0], n[1], n[2]);
        colors.push(r, g, b);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.1,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(scale);
  return mesh;
}

export async function loadVOX(url, opts){
  try{
    if (_cache.has(url)) return await _cache.get(url);
    const p = (async ()=>{
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const parsed = parseVOX(buf);
      if (!parsed) return null;
      return buildMesh(parsed, opts);
    })().catch(()=>null);
    _cache.set(url, p);
    return await p;
  } catch(e){
    return null;
  }
}
