import * as THREE from "three";

// Minimal MagicaVoxel .vox (VOX 150) loader with articulated skeletal limb rigging.
// - Silent on errors (returns null)
// - Segments voxel characters into anatomical limbs:
//   Head, Torso, ArmL, ArmR, LegL, LegR
// - Joint pivots placed precisely at anatomical joints (neck, hips, shoulders)
// - Zero gaps or seams at rest (rotations = 0)
// - Exposes .head, .torso, .armL, .armR, .legL, .legR directly on the returned rig.

const _cache = new Map(); // url -> Promise<THREE.Group|null>

function _u32(dv, o){ return dv.getUint32(o, true); }
function _i32(dv, o){ return dv.getInt32(o, true); }

function _readString(dv, o, n){
  let s = "";
  for (let i = 0; i < n; i++) s += String.fromCharCode(dv.getUint8(o + i));
  return s;
}

function _defaultPalette(){
  const pal = new Uint32Array(256);
  for (let i = 0; i < 256; i++){
    const v = i;
    pal[i] = (255 << 24) | (v << 16) | (v << 8) | v;
  }
  pal[0] = 0;
  return pal;
}

function parseVOX(arrayBuffer){
  try{
    const dv = new DataView(arrayBuffer);
    if (_readString(dv, 0, 4) !== "VOX ") return null;
    const version = _i32(dv, 4);
    let o = 8;

    const mainId = _readString(dv, o, 4); o += 4;
    const mainSize = _u32(dv, o); o += 4;
    const mainChildren = _u32(dv, o); o += 4;
    if (mainId !== "MAIN") return null;
    o += mainSize;

    let size = { x: 0, y: 0, z: 0 };
    let voxels = [];
    let palette = null;

    const end = 8 + 12 + mainSize + mainChildren;
    while (o < end){
      const id = _readString(dv, o, 4); o += 4;
      const chunkSize = _u32(dv, o); o += 4;
      const childSize = _u32(dv, o); o += 4;
      const dataStart = o;

      if (id === "SIZE"){
        size.x = _i32(dv, o); o += 4;
        size.y = _i32(dv, o); o += 4;
        size.z = _i32(dv, o); o += 4;
      } else if (id === "XYZI"){
        const n = _i32(dv, o); o += 4;
        voxels = new Array(n);
        for (let i = 0; i < n; i++){
          const x = dv.getUint8(o++), y = dv.getUint8(o++), z = dv.getUint8(o++), c = dv.getUint8(o++);
          voxels[i] = { x, y, z, c };
        }
      } else if (id === "RGBA"){
        palette = new Uint32Array(256);
        for (let i = 0; i < 256; i++){
          const r = dv.getUint8(o++), g = dv.getUint8(o++), b = dv.getUint8(o++), a = dv.getUint8(o++);
          palette[i] = (a << 24) | (r << 16) | (g << 8) | (b);
        }
      }

      o = dataStart + chunkSize;
      o += childSize;
    }

    if (!palette) palette = _defaultPalette();
    return { size, voxels, palette };
  } catch(e){
    return null;
  }
}

function makeFaces(voxelSize){
  const hs = voxelSize * 0.5;
  return [
    // +X
    { n: [ 1, 0, 0], v: [[ hs, -hs, -hs], [ hs,  hs, -hs], [ hs,  hs,  hs], [ hs, -hs,  hs]] },
    // -X
    { n: [-1, 0, 0], v: [[-hs, -hs,  hs], [-hs,  hs,  hs], [-hs,  hs, -hs], [-hs, -hs, -hs]] },
    // +Y
    { n: [ 0, 1, 0], v: [[-hs,  hs, -hs], [-hs,  hs,  hs], [ hs,  hs,  hs], [ hs,  hs, -hs]] },
    // -Y
    { n: [ 0, -1, 0], v: [[ hs, -hs, -hs], [ hs, -hs,  hs], [-hs, -hs,  hs], [-hs, -hs, -hs]] },
    // +Z
    { n: [ 0, 0, 1], v: [[ hs, -hs,  hs], [ hs,  hs,  hs], [-hs,  hs,  hs], [-hs, -hs,  hs]] },
    // -Z
    { n: [ 0, 0, -1], v: [[-hs, -hs, -hs], [-hs,  hs, -hs], [ hs,  hs, -hs], [ hs, -hs, -hs]] },
  ];
}

function createVoxelGeometry(voxels, pivotX, pivotY, pivotZ, palette, faces){
  const positions = [];
  const normals = [];
  const colors = [];

  for (let i = 0; i < voxels.length; i++){
    const v = voxels[i];
    const col = palette[v.c] >>> 0;
    const r = ((col >> 16) & 255) / 255;
    const g = ((col >>  8) & 255) / 255;
    const b = ((col >>  0) & 255) / 255;

    // Coordinate relative to joint pivot
    const rx = v.px - pivotX;
    const ry = v.py - pivotY;
    const rz = v.pz - pivotZ;

    for (let f = 0; f < 6; f++){
      const face = faces[f];
      const n = face.n;
      const vv = face.v;
      const tri = [0, 1, 2, 0, 2, 3];
      for (let k = 0; k < 6; k++){
        const q = vv[tri[k]];
        positions.push(rx + q[0], ry + q[1], rz + q[2]);
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
  return geo;
}

function buildMesh(parsed, opts){
  const voxelSize = opts?.voxelSize ?? 0.08;
  const scale = opts?.scale ?? 1.0;
  const pivot = opts?.pivot ?? ((opts?.center === false) ? "origin" : "bottom_center");

  const { voxels, palette } = parsed;
  if (!voxels || voxels.length === 0) return null;

  // Compute active voxel bounding box
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const v of voxels){
    if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
    if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
  }

  const spanY = maxY - minY + 1;
  const spanZ = maxZ - minZ + 1;
  const upAxis = opts?.upAxis ? opts.upAxis.toLowerCase() : (spanZ >= spanY ? "z" : "y");
  const isZUp = (upAxis === "z");

  const midX = (minX + maxX + 1) * 0.5;
  const midY = (minY + maxY + 1) * 0.5;
  const midZ = (minZ + maxZ + 1) * 0.5;

  // Compute Three.js world-aligned positions (px, py, pz) for each voxel
  // Face points along +Z (towards player), character's right is +X, character's left is -X
  const pts = new Array(voxels.length);
  for (let i = 0; i < voxels.length; i++){
    const v = voxels[i];
    let px, py, pz;
    if (isZUp){
      if (pivot === "bottom_center"){
        px = (midX - (v.x + 0.5)) * voxelSize;
        py = (v.z - minZ) * voxelSize;
        pz = (midY - (v.y + 0.5)) * voxelSize;
      } else if (pivot === "center"){
        px = (midX - (v.x + 0.5)) * voxelSize;
        py = (v.z + 0.5 - midZ) * voxelSize;
        pz = (midY - (v.y + 0.5)) * voxelSize;
      } else {
        px = -(v.x + 0.5) * voxelSize;
        py = (v.z + 0.5) * voxelSize;
        pz = -(v.y + 0.5) * voxelSize;
      }
    } else {
      if (pivot === "bottom_center"){
        px = (v.x + 0.5 - midX) * voxelSize;
        py = (v.y - minY) * voxelSize;
        pz = (midZ - (v.z + 0.5)) * voxelSize;
      } else if (pivot === "center"){
        px = (v.x + 0.5 - midX) * voxelSize;
        py = (v.y + 0.5 - midY) * voxelSize;
        pz = (midZ - (v.z + 0.5)) * voxelSize;
      } else {
        px = (v.x + 0.5) * voxelSize;
        py = (v.y + 0.5) * voxelSize;
        pz = (v.z + 0.5) * voxelSize;
      }
    }
    pts[i] = { px, py, pz, c: v.c };
  }

  // Anatomical partition thresholds
  const legCut = isZUp ? 22.0 * voxelSize : 8.0 * voxelSize;
  const armCut = isZUp ? 52.0 * voxelSize : 18.0 * voxelSize;
  const armX   = isZUp ? 5.5 * voxelSize  : 3.0 * voxelSize;

  const headVoxels = [];
  const torsoVoxels = [];
  const armLVoxels = [];
  const armRVoxels = [];
  const legLVoxels = [];
  const legRVoxels = [];

  for (let i = 0; i < pts.length; i++){
    const p = pts[i];
    if (p.py <= legCut){
      if (p.px < 0) legLVoxels.push(p);
      else legRVoxels.push(p);
    } else if (p.py > armCut){
      headVoxels.push(p);
    } else {
      if (p.px < -armX) armLVoxels.push(p);
      else if (p.px > armX) armRVoxels.push(p);
      else torsoVoxels.push(p);
    }
  }

  // Joint pivot calculator
  function calcPivot(arr, isTop){
    if (!arr || arr.length === 0) return { x: 0, y: 0, z: 0 };
    if (isTop){
      let maxY = -Infinity;
      for (let i = 0; i < arr.length; i++) if (arr[i].py > maxY) maxY = arr[i].py;
      const topLimit = maxY - 2.0 * voxelSize;
      let sx = 0, sz = 0, count = 0;
      for (let i = 0; i < arr.length; i++){
        const p = arr[i];
        if (p.py >= topLimit){
          sx += p.px;
          sz += p.pz;
          count++;
        }
      }
      return { x: count ? sx / count : 0, y: maxY, z: count ? sz / count : 0 };
    } else {
      let minY = Infinity;
      for (let i = 0; i < arr.length; i++) if (arr[i].py < minY) minY = arr[i].py;
      const botLimit = minY + 2.0 * voxelSize;
      let sx = 0, sz = 0, count = 0;
      for (let i = 0; i < arr.length; i++){
        const p = arr[i];
        if (p.py <= botLimit){
          sx += p.px;
          sz += p.pz;
          count++;
        }
      }
      return { x: count ? sx / count : 0, y: minY, z: count ? sz / count : 0 };
    }
  }

  const pHead = calcPivot(headVoxels, false); // Neck joint at bottom of head
  const pArmL = calcPivot(armLVoxels, true);  // Left shoulder at top of armL
  const pArmR = calcPivot(armRVoxels, true);  // Right shoulder at top of armR
  const pLegL = calcPivot(legLVoxels, true);  // Left hip at top of legL
  const pLegR = calcPivot(legRVoxels, true);  // Right hip at top of legR

  const faces = makeFaces(voxelSize);
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.85,
    metalness: 0.1,
  });

  const rig = new THREE.Group();
  rig.scale.setScalar(scale);

  function makeLimbGroup(name, voxArr, p){
    if (!voxArr || voxArr.length === 0) return null;
    const grp = new THREE.Group();
    grp.name = name;
    grp.position.set(p.x, p.y, p.z);
    const geo = createVoxelGeometry(voxArr, p.x, p.y, p.z, palette, faces);
    const m = new THREE.Mesh(geo, mat.clone());
    m.name = `${name}_mesh`;
    m.castShadow = true;
    m.receiveShadow = true;
    grp.add(m);
    return grp;
  }

  if (torsoVoxels.length > 0){
    const geo = createVoxelGeometry(torsoVoxels, 0, 0, 0, palette, faces);
    const torsoMesh = new THREE.Mesh(geo, mat.clone());
    torsoMesh.name = "torso";
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    rig.torso = torsoMesh;
    rig.add(torsoMesh);
  }

  rig.head = makeLimbGroup("head", headVoxels, pHead);
  if (rig.head) rig.add(rig.head);

  rig.armL = makeLimbGroup("armL", armLVoxels, pArmL);
  if (rig.armL) rig.add(rig.armL);

  rig.armR = makeLimbGroup("armR", armRVoxels, pArmR);
  if (rig.armR) rig.add(rig.armR);

  rig.legL = makeLimbGroup("legL", legLVoxels, pLegL);
  if (rig.legL) rig.add(rig.legL);

  rig.legR = makeLimbGroup("legR", legRVoxels, pLegR);
  if (rig.legR) rig.add(rig.legR);

  return rig;
}

function cloneRig(template){
  if (!template) return null;
  const rig = new THREE.Group();
  rig.name = template.name;
  rig.scale.copy(template.scale);

  function cloneNode(node){
    if (!node) return null;
    let res;
    if (node.isMesh){
      res = new THREE.Mesh(node.geometry.clone(), node.material.clone());
      res.castShadow = node.castShadow;
      res.receiveShadow = node.receiveShadow;
    } else {
      res = new THREE.Group();
      for (const ch of node.children){
        res.add(cloneNode(ch));
      }
    }
    res.name = node.name;
    res.position.copy(node.position);
    res.rotation.copy(node.rotation);
    res.scale.copy(node.scale);
    return res;
  }

  if (template.torso){
    rig.torso = cloneNode(template.torso);
    rig.add(rig.torso);
  }
  if (template.head){
    rig.head = cloneNode(template.head);
    rig.add(rig.head);
  }
  if (template.armL){
    rig.armL = cloneNode(template.armL);
    rig.add(rig.armL);
  }
  if (template.armR){
    rig.armR = cloneNode(template.armR);
    rig.add(rig.armR);
  }
  if (template.legL){
    rig.legL = cloneNode(template.legL);
    rig.add(rig.legL);
  }
  if (template.legR){
    rig.legR = cloneNode(template.legR);
    rig.add(rig.legR);
  }

  if (!template.torso && template.isMesh){
    const m = new THREE.Mesh(template.geometry.clone(), template.material.clone());
    m.scale.copy(template.scale);
    rig.add(m);
  }

  return rig;
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

    return cloneRig(template);
  } catch(e){
    return null;
  }
}
