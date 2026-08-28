import fs from "fs";
import path from "path";

// Generate 32x32 ICO file with dark background and emerald 'W'
function generateIco() {
  const width = 32;
  const height = 32;
  const numPixels = width * height;
  const pixelDataSize = numPixels * 4; // 32-bit BGRA
  const maskDataSize = (width * height) / 8; // 1 bit per pixel mask
  const biSizeImage = pixelDataSize + maskDataSize;
  const biHeight = height * 2; // For ICO, height in BMP header is 2x height

  const headerSize = 6;
  const entrySize = 16;
  const bmpHeaderSize = 40;
  const imageDataOffset = headerSize + entrySize;
  const totalImageSize = bmpHeaderSize + biSizeImage;
  const totalFileSize = imageDataOffset + totalImageSize;

  const buf = Buffer.alloc(totalFileSize);

  // ICONDIR
  buf.writeUInt16LE(0, 0); // reserved
  buf.writeUInt16LE(1, 2); // type 1 = icon
  buf.writeUInt16LE(1, 4); // count 1

  // ICONDIRENTRY
  buf.writeUInt8(width, 6);
  buf.writeUInt8(height, 7);
  buf.writeUInt8(0, 8); // color palette count
  buf.writeUInt8(0, 9); // reserved
  buf.writeUInt16LE(1, 10); // color planes
  buf.writeUInt16LE(32, 12); // bpp
  buf.writeUInt32LE(totalImageSize, 14); // image data size
  buf.writeUInt32LE(imageDataOffset, 18); // offset

  // BITMAPINFOHEADER
  let offset = imageDataOffset;
  buf.writeUInt32LE(40, offset); // biSize
  buf.writeInt32LE(width, offset + 4); // biWidth
  buf.writeInt32LE(biHeight, offset + 8); // biHeight (64)
  buf.writeUInt16LE(1, offset + 12); // biPlanes
  buf.writeUInt16LE(32, offset + 14); // biBitCount
  buf.writeUInt32LE(0, offset + 16); // biCompression (BI_RGB)
  buf.writeUInt32LE(biSizeImage, offset + 20); // biSizeImage
  buf.writeInt32LE(0, offset + 24); // biXPelsPerMeter
  buf.writeInt32LE(0, offset + 28); // biYPelsPerMeter
  buf.writeUInt32LE(0, offset + 32); // biClrUsed
  buf.writeUInt32LE(0, offset + 36); // biClrImportant

  // Pixels (Bottom-Up)
  offset += bmpHeaderSize;
  for (let y = 0; y < height; y++) {
    const row = height - 1 - y; // bottom-up row
    for (let x = 0; x < width; x++) {
      const pOffset = offset + (row * width + x) * 4;

      // Check if pixel is within rounded rect (radius 6)
      const inBounds = x >= 2 && x <= 29 && y >= 2 && y <= 29;
      // Corner checks
      const isCorner =
        (x < 5 && y < 5 && Math.hypot(x - 5, y - 5) > 3.5) ||
        (x > 26 && y < 5 && Math.hypot(x - 26, y - 5) > 3.5) ||
        (x < 5 && y > 26 && Math.hypot(x - 5, y - 26) > 3.5) ||
        (x > 26 && y > 26 && Math.hypot(x - 26, y - 26) > 3.5);

      if (!inBounds || isCorner) {
        // Transparent
        buf[pOffset] = 0;
        buf[pOffset + 1] = 0;
        buf[pOffset + 2] = 0;
        buf[pOffset + 3] = 0;
      } else {
        // Dark background #101014
        let b = 0x14;
        let g = 0x10;
        let r = 0x10;
        let a = 0xff;

        // Draw Calendar header line at y=9
        if (y === 9 && x >= 6 && x <= 25) {
          r = 0x50;
          g = 0x50;
          b = 0x55;
        }

        // Draw Calendar pins at (10, 6) and (21, 6)
        if (
          ((x >= 9 && x <= 11) && (y >= 5 && y <= 7)) ||
          ((x >= 20 && x <= 22) && (y >= 5 && y <= 7))
        ) {
          // Emerald
          r = 0x10;
          g = 0xb9;
          b = 0x81;
        }

        // Draw Emerald 'W' Checkmark for WhenFree
        // Lines: (8,15) -> (11,23) -> (14,18) -> (17,23) -> (23,13)
        const isW =
          (x === 8 && y >= 14 && y <= 16) ||
          (x === 9 && y >= 16 && y <= 18) ||
          (x === 10 && y >= 18 && y <= 21) ||
          (x === 11 && y >= 20 && y <= 23) ||
          (x === 12 && y >= 21 && y <= 23) ||
          (x === 13 && y >= 18 && y <= 21) ||
          (x === 14 && y >= 16 && y <= 19) ||
          (x === 15 && y >= 18 && y <= 21) ||
          (x === 16 && y >= 20 && y <= 23) ||
          (x === 17 && y >= 21 && y <= 23) ||
          (x === 18 && y >= 19 && y <= 22) ||
          (x === 19 && y >= 17 && y <= 20) ||
          (x === 20 && y >= 15 && y <= 18) ||
          (x === 21 && y >= 13 && y <= 16) ||
          (x === 22 && y >= 11 && y <= 14) ||
          (x === 23 && y >= 10 && y <= 13);

        if (isW) {
          r = 0x10;
          g = 0xb9;
          b = 0x81;
        }

        buf[pOffset] = b;
        buf[pOffset + 1] = g;
        buf[pOffset + 2] = r;
        buf[pOffset + 3] = a;
      }
    }
  }

  // Mask bytes (all 0 for transparent handling via 32-bit alpha)
  // already 0 initialized

  return buf;
}

const icoBuffer = generateIco();
fs.writeFileSync(path.join(process.cwd(), "public/favicon.ico"), icoBuffer);
fs.writeFileSync(path.join(process.cwd(), "src/app/favicon.ico"), icoBuffer);
console.log("✓ Successfully generated public/favicon.ico and src/app/favicon.ico (Size:", icoBuffer.length, "bytes)");
