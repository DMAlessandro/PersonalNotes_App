// Writes public/icon-192.png and icon-512.png (blue square, white tick) with no image library.
// Run with `npm run icons` after changing the design; the PNGs are committed.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

// Distance from point p to segment ab, in icon units (0..64).
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

function png(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 64, v = ((y + 0.5) / size) * 64;
      // Full-bleed background so the maskable crop stays clean; tick kept inside the safe zone.
      const d = Math.min(segDist(u, v, 20, 33, 28, 41), segDist(u, v, 28, 41, 45, 23));
      const a = Math.max(0, Math.min(1, (3.2 - d) * (size / 64) + 0.5)); // stroke half-width 3.2, 1px antialiased edge
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = Math.round(0x2f + (255 - 0x2f) * a);
      raw[o + 1] = Math.round(0x6f + (255 - 0x6f) * a);
      raw[o + 2] = Math.round(0xde + (255 - 0xde) * a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const s of [192, 512]) writeFileSync(new URL(`../public/icon-${s}.png`, import.meta.url), png(s));
