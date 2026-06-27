/**
 * Generates a valid, non-interlaced 48x48 RGBA PNG favicon (solid navy #1E3A5F).
 * Run with: node apps/mobile/scripts/generate-favicon.js
 * Fixes jimp-compact CRC errors caused by the previous interlaced favicon.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const WIDTH = 48;
const HEIGHT = 48;
// Brand navy #1E3A5F -> R=30 G=58 B=95 A=255
const R = 0x1e, G = 0x3a, B = 0x5f, A = 0xff;

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 6;   // color type RGBA
ihdr[10] = 0;  // compression
ihdr[11] = 0;  // filter
ihdr[12] = 0;  // interlace = 0 (non-interlaced)

// Raw image data: each row prefixed with filter byte 0, then WIDTH RGBA pixels
const rowBytes = WIDTH * 4;
const raw = Buffer.alloc((rowBytes + 1) * HEIGHT);
for (let y = 0; y < HEIGHT; y++) {
  const rowStart = y * (rowBytes + 1);
  raw[rowStart] = 0; // filter: None
  for (let x = 0; x < WIDTH; x++) {
    const off = rowStart + 1 + x * 4;
    raw[off] = R;
    raw[off + 1] = G;
    raw[off + 2] = B;
    raw[off + 3] = A;
  }
}
const idatData = zlib.deflateSync(raw);

const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', idatData),
  chunk('IEND', Buffer.alloc(0)),
]);

const outPath = path.join(__dirname, '..', 'assets', 'favicon.png');
fs.writeFileSync(outPath, png);
console.log(`Wrote valid PNG favicon (${png.length} bytes) -> ${outPath}`);