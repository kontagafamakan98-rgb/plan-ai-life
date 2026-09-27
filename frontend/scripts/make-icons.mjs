#!/usr/bin/env node
/**
 * Draws the ARCADIA-9 icon set. The mark is drawn from mathematics here, in
 * this repository, so the project owns its application icon and favicon
 * outright: a ring (the iteration) with a tail (the ninth one), and one amber
 * pixel marking the Watcher's position.
 *
 * Run with: npm run icons
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const VOID = [0x0b, 0x0d, 0x10];
const ACCENT = [0x4e, 0x9d, 0xb4];
const AMBER = [0xc9, 0x9a, 0x45];

/* ------------------------------------------------------------------ */
/* PNG writing                                                         */
/* ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ */
/* The mark                                                            */
/* ------------------------------------------------------------------ */

/** True when a point falls inside the ring-plus-tail that forms the nine. */
function insideMark(x, y, size) {
  const cx = size * 0.5;
  const cy = size * 0.42;
  const outer = size * 0.27;
  const inner = outer * 0.52;
  const dx = x - cx;
  const dy = y - cy;
  const distance = Math.hypot(dx, dy);

  // The ring.
  if (distance <= outer && distance >= inner) return 'ring';

  // The tail: a bar that continues the right side of the ring downwards.
  const tailLeft = cx + outer * 0.42;
  const tailRight = cx + outer;
  const tailBottom = cy + outer * 1.42;
  if (x >= tailLeft && x <= tailRight && y >= cy && y <= tailBottom) return 'ring';

  return null;
}

function render(size, { background, scale = 1 }) {
  const pixels = Buffer.alloc(size * size * 4);
  const samples = 3;
  const base = background ?? [0, 0, 0];
  const baseAlpha = background ? 255 : 0;
  const markSize = size * scale;
  const offset = (size - markSize) / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let cover = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const py = y + (sy + 0.5) / samples;
          if (insideMark(px - offset, py - offset, markSize)) cover += 1;
        }
      }
      cover /= samples * samples;

      // The single amber pixel: the Watcher sitting on the ring.
      const markerX = Math.round(offset + markSize * 0.5);
      const markerY = Math.round(offset + markSize * 0.42);
      const isMarker = Math.abs(x - markerX) <= size * 0.0 + 1 && Math.abs(y - markerY) <= 1;

      const ink = isMarker && cover > 0 ? AMBER : ACCENT;
      const alpha = cover;
      const index = (y * size + x) * 4;
      pixels[index] = Math.round(ink[0] * alpha + base[0] * (1 - alpha));
      pixels[index + 1] = Math.round(ink[1] * alpha + base[1] * (1 - alpha));
      pixels[index + 2] = Math.round(ink[2] * alpha + base[2] * (1 - alpha));
      pixels[index + 3] = Math.round(alpha * 255 + baseAlpha * (1 - alpha));
    }
  }
  return pixels;
}

/* ------------------------------------------------------------------ */

const targets = [
  ['assets/images/icon.png', 1024, { background: VOID, scale: 1 }],
  ['assets/images/adaptive-icon.png', 1024, { background: null, scale: 0.62 }],
  ['assets/images/splash-image.png', 512, { background: null, scale: 0.9 }],
  ['assets/images/favicon.png', 64, { background: VOID, scale: 1 }],
  ['public/favicon.png', 64, { background: VOID, scale: 1 }],
  ['public/icon-192.png', 192, { background: VOID, scale: 1 }],
  ['public/icon-512.png', 512, { background: VOID, scale: 1 }],
];

for (const [path, size, options] of targets) {
  const full = join(ROOT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, encodePng(size, size, render(size, options)));
  console.log(`${path} (${size}x${size})`);
}
