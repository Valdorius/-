// textures.js
// Procedural pixel-art CanvasTextures for Retro Voxel / Minecraft Aesthetic.
// Zero external asset downloads, 100% offline, razor-sharp via THREE.NearestFilter.

import * as THREE from "three";

/**
 * Procedural Pixel-Art Stone Bricks (128x128)
 */
export function createPixelStoneBrickTexture(opts = {}) {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");

  // Mortar background
  g.fillStyle = opts.mortarColor || "#101622";
  g.fillRect(0, 0, size, size);

  const brickH = 32;
  const mortar = 2;
  const palette = opts.palette || [
    "#263246",
    "#2d3b52",
    "#202b3c",
    "#34445e",
    "#28354a"
  ];

  // Deterministic seeded random for consistent tile appearance
  let seed = 42;
  function pseudoRand() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  for (let row = 0; row < 4; row++) {
    const y0 = row * brickH + mortar;
    const y1 = (row + 1) * brickH - mortar;
    const offset = (row % 2 === 1) ? 32 : 0;
    for (let col = -1; col < 3; col++) {
      const x0 = col * 64 + offset + mortar;
      const x1 = x0 + 64 - 2 * mortar;
      const baseHex = palette[Math.floor(pseudoRand() * palette.length)];

      g.fillStyle = baseHex;
      g.fillRect(x0, y0, x1 - x0, y1 - y0);

      // 1px top & left bevel highlight
      g.fillStyle = "rgba(255, 255, 255, 0.15)";
      g.fillRect(x0, y0, x1 - x0, 1);
      g.fillRect(x0, y0, 1, y1 - y0);

      // 1px bottom & right bevel shadow
      g.fillStyle = "rgba(0, 0, 0, 0.28)";
      g.fillRect(x0, y1 - 1, x1 - x0, 1);
      g.fillRect(x1 - 1, y0, 1, y1 - y0);
    }
  }

  // Stone pixel grain noise
  const imgData = g.getImageData(0, 0, size, size);
  for (let i = 0; i < imgData.data.length; i += 4) {
    if (imgData.data[i] > 20) { // skip deep mortar lines
      const n = (pseudoRand() - 0.5) * 16;
      imgData.data[i]     = Math.max(0, Math.min(255, imgData.data[i] + n));
      imgData.data[i + 1] = Math.max(0, Math.min(255, imgData.data[i + 1] + n));
      imgData.data[i + 2] = Math.max(0, Math.min(255, imgData.data[i + 2] + n));
    }
  }
  g.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Vertical Glowing Voxel Rune Overlay (128x128)
 */
export function createPixelRuneEmissiveTexture(opts = {}) {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");

  // Black background = no emission
  g.fillStyle = "#000000";
  g.fillRect(0, 0, size, size);

  const runes = [
    // Glyph 1: Diamond crown
    [[64, 12], [64, 24], [58, 16], [70, 16], [60, 22], [68, 22]],
    // Glyph 2: Ancient hour-glass rune
    [[64, 40], [60, 46], [68, 46], [64, 52], [58, 58], [70, 58]],
    // Glyph 3: Trident glyph
    [[64, 72], [64, 86], [58, 76], [70, 76]],
    // Glyph 4: Zig-zag lightning rune
    [[66, 102], [62, 108], [66, 108], [62, 116]]
  ];

  const color = opts.color || "#39c7ff";
  const glow = opts.glowColor || "rgba(20, 110, 180, 0.45)";

  // Outer glow
  for (const glyph of runes) {
    for (const [px, py] of glyph) {
      g.fillStyle = glow;
      g.fillRect(px - 3, py - 3, 7, 7);
    }
  }

  // Core bright pixels
  for (const glyph of runes) {
    for (const [px, py] of glyph) {
      g.fillStyle = color;
      g.fillRect(px - 1, py - 1, 3, 3);
      g.fillStyle = "#ffffff";
      g.fillRect(px, py, 1, 1);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Modular Pixel-Art Cobblestone Floor (128x128)
 */
export function createPixelFloorTextures() {
  const size = 128;

  // 1. Color Map
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");

  // Mortar
  g.fillStyle = "#0c121c";
  g.fillRect(0, 0, size, size);

  const tilePalette = [
    "#1c2738",
    "#223046",
    "#182232",
    "#26364e",
    "#1f2c40"
  ];

  let seed = 137;
  function rand() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  const tileSize = 32;
  for (let ty = 0; ty < 4; ty++) {
    for (let tx = 0; tx < 4; tx++) {
      const x0 = tx * tileSize + 2;
      const y0 = ty * tileSize + 2;
      const w = tileSize - 4;
      const h = tileSize - 4;

      const baseHex = tilePalette[Math.floor(rand() * tilePalette.length)];
      g.fillStyle = baseHex;
      g.fillRect(x0, y0, w, h);

      // Top/Left bevel highlight
      g.fillStyle = "rgba(255, 255, 255, 0.14)";
      g.fillRect(x0, y0, w, 1);
      g.fillRect(x0, y0, 1, h);

      // Bottom/Right bevel shadow
      g.fillStyle = "rgba(0, 0, 0, 0.32)";
      g.fillRect(x0, y0 + h - 1, w, 1);
      g.fillRect(x0 + w - 1, y0, 1, h);
    }
  }

  // Stone grain noise
  const imgData = g.getImageData(0, 0, size, size);
  for (let i = 0; i < imgData.data.length; i += 4) {
    if (imgData.data[i] > 16) {
      const n = (rand() - 0.5) * 14;
      imgData.data[i]     = Math.max(0, Math.min(255, imgData.data[i] + n));
      imgData.data[i + 1] = Math.max(0, Math.min(255, imgData.data[i + 1] + n));
      imgData.data[i + 2] = Math.max(0, Math.min(255, imgData.data[i + 2] + n));
    }
  }
  g.putImageData(imgData, 0, 0);

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.minFilter = THREE.NearestFilter;
  map.magFilter = THREE.NearestFilter;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  // 2. Emissive Map: Crisp neon grid lines around arena quads
  const ec = document.createElement("canvas");
  ec.width = size;
  ec.height = size;
  const eg = ec.getContext("2d");

  eg.fillStyle = "#000000";
  eg.fillRect(0, 0, size, size);

  // Outer square perimeter border
  eg.strokeStyle = "#00b4d8";
  eg.lineWidth = 2;
  eg.strokeRect(1, 1, size - 2, size - 2);

  // Inner subtle sub-grid lines
  eg.strokeStyle = "rgba(0, 150, 200, 0.45)";
  eg.lineWidth = 1;
  eg.beginPath();
  eg.moveTo(size * 0.5, 0);
  eg.lineTo(size * 0.5, size);
  eg.moveTo(0, size * 0.5);
  eg.lineTo(size, size * 0.5);
  eg.stroke();

  const emissiveMap = new THREE.CanvasTexture(ec);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.minFilter = THREE.NearestFilter;
  emissiveMap.magFilter = THREE.NearestFilter;
  emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;

  return { map, emissiveMap };
}

/**
 * Pixel-Art Wood Texture for Weapons (64x64)
 */
export function createPixelWoodTexture() {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");

  g.fillStyle = "#5a3a24";
  g.fillRect(0, 0, size, size);

  const bands = ["#6b452a", "#4e321e", "#7a5032", "#452c1b"];
  for (let y = 0; y < size; y += 4) {
    const col = bands[(y / 4) % bands.length];
    g.fillStyle = col;
    g.fillRect(0, y, size, 4);
    // highlight grain line
    g.fillStyle = "rgba(255, 255, 255, 0.08)";
    g.fillRect(0, y, size, 1);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
