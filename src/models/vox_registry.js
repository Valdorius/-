import * as THREE from "three";
import { loadVOX } from "./vox_loader.js?v=20261029_4";

/**
 * VOX registry.
 * Important: never "blank" a character until VOX is actually loaded.
 * This prevents invisible enemies when a VOX fails to parse/load.
 */
const V = "20261029_4";

export const VOX_MODELS = {
  // 32x32x32 models → voxelSize 0.056 = ~1.8m tall
  player:   { url: `./assets/models/player.vox?v=${V}`,   voxelSize: 0.056, scale: 1.0, pivot: "bottom_center" },
  ranged:   { url: `./assets/models/ranged.vox?v=${V}`,   voxelSize: 0.056, scale: 1.0, pivot: "bottom_center" },
  sprinter: { url: `./assets/models/sprinter.vox?v=${V}`, voxelSize: 0.050, scale: 1.0, pivot: "bottom_center" },
  shielder: { url: `./assets/models/shielder.vox?v=${V}`, voxelSize: 0.056, scale: 1.0, pivot: "bottom_center" },

  // 80x80x80 models → voxelSize 0.022 = ~1.75m tall
  bot:      { url: `./assets/models/bot.vox?v=${V}`,      voxelSize: 0.022, scale: 1.0, pivot: "bottom_center" },
  bomber:   { url: `./assets/models/bomber.vox?v=${V}`,   voxelSize: 0.022, scale: 1.0, pivot: "bottom_center" },
  brute:    { url: `./assets/models/brute.vox?v=${V}`,    voxelSize: 0.026, scale: 1.0, pivot: "bottom_center" },
  sniper:   { url: `./assets/models/sniper.vox?v=${V}`,   voxelSize: 0.022, scale: 1.0, pivot: "bottom_center" },
  summoner: { url: `./assets/models/summoner.vox?v=${V}`, voxelSize: 0.022, scale: 1.0, pivot: "bottom_center" },
  boss:     { url: `./assets/models/boss.vox?v=${V}`,     voxelSize: 0.030, scale: 1.0, pivot: "bottom_center" },
};

function makeMissing() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.35,0.35,0.35),
    new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0x220000, roughness: 0.9 })
  );
  m.position.y = 0.2;
  g.add(m);
  return g;
}

/**
 * Attach VOX mesh to an existing group.
 * - keepExisting=true keeps current visuals until VOX successfully loads.
 * - replace=true (default) removes existing Mesh/Group visuals after VOX loads.
 */
export function attachVOXSkin(group, key, opts={}) {
  const cfg = VOX_MODELS[key];
  if (!cfg || !group) return;

  const keepExisting = opts.keepExisting !== undefined ? !!opts.keepExisting : true;
  const replace = opts.replace !== undefined ? !!opts.replace : true;

  loadVOX(cfg.url, cfg).then((mesh) => {
    if (!mesh) {
      // If it failed to load, keep existing visuals (never make invisible).
      if (!keepExisting) {
        const ph = makeMissing();
        ph.name = `${key}_VOX_MISSING`;
        group.add(ph);
      }
      return;
    }

    mesh.name = `${key}_VOX`;
    // Inherit layers and visibility of target group
    mesh.layers.mask = group.layers.mask;
    if (group.visible === false) mesh.visible = false;

    if (replace) {
      const toRemove = [];
      for (const ch of [...group.children]) {
        if (!ch) continue;
        if (ch.isMesh || ch.isGroup) toRemove.push(ch);
      }
      for (const ch of toRemove) group.remove(ch);
    }

    group.add(mesh);
    group.voxMesh = mesh;
  }).catch(() => {
    // Silent fail: keep current visuals; add a small placeholder only if caller wanted replace.
    if (!keepExisting) {
      const ph = makeMissing();
      ph.name = `${key}_VOX_MISSING`;
      group.add(ph);
    }
  });
}

/**
 * Preload all VOX models on game launch to prevent pop-in / mid-game model transformations.
 */
export function preloadVOXModels() {
  for (const cfg of Object.values(VOX_MODELS)) {
    loadVOX(cfg.url, cfg).catch(() => {});
  }
}
