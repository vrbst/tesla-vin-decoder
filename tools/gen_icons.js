// Generates PWA PNG icons by rasterizing the Tesla emblem (3 polygons) onto a red rounded square.
// Pure Node: hand-rolled PNG encoder (zlib + CRC32), supersampled polygon fill. No deps.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = process.argv[2] || '.';
const SS = 4; // supersample factor for anti-aliasing

// Emblem polygons in the original 120x120 SVG viewBox.
const POLYS = [
  [[53,8],[67,8],[64,26],[56,26]],
  [[12,26],[108,26],[100,40],[20,40]],
  [[52,40],[68,40],[64,104],[56,104]],
];
const EMB_CX = 60, EMB_CY = 56, EMB_SPAN = 96; // emblem center + bounding span

const RED = [232, 33, 39];
const WHITE = [255, 255, 255];

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    const hit = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (hit) inside = !inside;
  }
  return inside;
}

function renderIcon(S, { maskable }) {
  const bigW = S * SS;
  const buf = new Uint8Array(bigW * bigW * 4); // transparent
  const radius = maskable ? 0 : bigW * 0.22;   // maskable = full bleed, OS applies mask
  const embFrac = maskable ? 0.46 : 0.60;      // emblem size within safe zone
  const scale = (embFrac * bigW) / EMB_SPAN;

  function inRounded(x, y) {
    if (radius <= 0) return true;
    const r = radius;
    const minx = r, maxx = bigW - r, miny = r, maxy = bigW - r;
    let cx = x, cy = y;
    if (x < minx) cx = minx; else if (x > maxx) cx = maxx;
    if (y < miny) cy = miny; else if (y > maxy) cy = maxy;
    const dx = x - cx, dy = y - cy;
    return (dx * dx + dy * dy) <= r * r;
  }

  // Pre-map polygons into big-pixel space.
  const mapped = POLYS.map(p => p.map(([ex, ey]) => [
    bigW / 2 + (ex - EMB_CX) * scale,
    bigW / 2 + (ey - EMB_CY) * scale,
  ]));

  for (let y = 0; y < bigW; y++) {
    for (let x = 0; x < bigW; x++) {
      const i = (y * bigW + x) * 4;
      const px = x + 0.5, py = y + 0.5;
      if (!inRounded(px, py)) continue;
      let col = RED;
      for (const poly of mapped) {
        if (pointInPoly(px, py, poly)) { col = WHITE; break; }
      }
      buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]; buf[i + 3] = 255;
    }
  }

  // Downsample SSxSS -> S with simple box average (handles AA on edges + emblem).
  const out = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const bi = ((y * SS + sy) * bigW + (x * SS + sx)) * 4;
          r += buf[bi]; g += buf[bi + 1]; b += buf[bi + 2]; a += buf[bi + 3];
        }
      }
      const n = SS * SS;
      const oi = (y * S + x) * 4;
      out[oi] = Math.round(r / n); out[oi + 1] = Math.round(g / n);
      out[oi + 2] = Math.round(b / n); out[oi + 3] = Math.round(a / n);
    }
  }
  return out;
}

// ---- minimal PNG encoder ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(S, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // raw scanlines with filter byte 0
  const stride = S * 4;
  const raw = Buffer.alloc((stride + 1) * S);
  for (let y = 0; y < S; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

fs.mkdirSync(OUT, { recursive: true });
const jobs = [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['icon-maskable-512.png', 512, { maskable: true }],
];
for (const [name, size, opts] of jobs) {
  const rgba = renderIcon(size, opts);
  fs.writeFileSync(path.join(OUT, name), encodePNG(size, rgba));
  console.log('wrote', name, size + 'x' + size);
}
