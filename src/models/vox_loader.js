
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

  if (!voxels || voxels.length === 0) return null;

  // Compute active voxel bounding box for exact centering and floor alignment
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const v of voxels) {
    if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
    if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
  }

  // Detect height axis:
  // MagicaVoxel standard models (e.g. 80x80 skeletons) have Z as height.
  // Other tools export with Y as height (e.g. 32x32 models).
  const spanY = maxY - minY + 1;
  const spanZ = maxZ - minZ + 1;
  const upAxis = opts?.upAxis ? opts.upAxis.toLowerCase() : (spanZ >= spanY ? "z" : "y");

  const midX = (minX + maxX + 1) * 0.5;
  const midY = (minY + maxY + 1) * 0.5;
  const midZ = (minZ + maxZ + 1) * 0.5;

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

  for (const v of voxels){
    const col = palette[v.c] >>> 0;
    const r = ((col >> 16) & 255) / 255;
    const g = ((col >>  8) & 255) / 255;
    const b = ((col >>  0) & 255) / 255;

    let px, py, pz;
    if (upAxis === "z") {
      // MagicaVoxel: X=width, Y=depth (eyes/front towards +Y), Z=height (up is +Z)
      // Three.js: X=width, Y=height (up is +Y), Z=depth (forward is +Z)
      if (pivot === "bottom_center") {
        px = (v.x + 0.5 - midX) * voxelSize;
        py = (v.z - minZ) * voxelSize;
        pz = (v.y + 0.5 - midY) * voxelSize;
      } else if (pivot === "center") {
        px = (v.x + 0.5 - midX) * voxelSize;
        py = (v.z + 0.5 - midZ) * voxelSize;
        pz = (v.y + 0.5 - midY) * voxelSize;
      } else {
        px = (v.x + 0.5) * voxelSize;
        py = (v.z + 0.5) * voxelSize;
        pz = (v.y + 0.5) * voxelSize;
      }
    } else {
      // Y-up models: X=width, Y=height (up is +Y), Z=depth (visor/front is minZ)
      // In Three.js forward is +Z, so (midZ - v.z) maps visor to forward +Z.
      if (pivot === "bottom_center") {
        px = (v.x + 0.5 - midX) * voxelSize;
        py = (v.y - minY) * voxelSize;
        pz = (midZ - (v.z + 0.5)) * voxelSize;
      } else if (pivot === "center") {
        px = (v.x + 0.5 - midX) * voxelSize;
        py = (v.y + 0.5 - midY) * voxelSize;
        pz = (midZ - (v.z + 0.5)) * voxelSize;
      } else {
        px = (v.x + 0.5) * voxelSize;
        py = (v.y + 0.5) * voxelSize;
        pz = (v.z + 0.5) * voxelSize;
      }
    }

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
    if (!_cache.has(url)){
      const p = (async ()=>{
        const res = await fetch(url);
        if (!res.ok) return null;
        const buf = await res.arrayBuffer();
        const parsed = parseVOX(buf);
        if (!parsed) return null;
        return buildMesh(parsed, opts);
      })().catch(()=>null);
      _cache.set(url, p);
    }
    const template = await _cache.get(url);
    if (!template) return null;

    // Return an independent clone so each entity (and each enemy) gets its own
    // Mesh in the Three.js scene graph. Otherwise, adding the shared mesh to new
    // enemies steals it from previous enemies (making them invisible).
    // Also clone geometry & material so disposal on enemy death doesn't break other enemies.
    const geo = template.geometry.clone();
    const mat = template.material.clone();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.copy(template.scale);
    return mesh;
  } catch(e){
    return null;
  }
}
