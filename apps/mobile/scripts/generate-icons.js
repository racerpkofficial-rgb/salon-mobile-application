const fs = require('fs');
const path = require('path');
const { PNG } = require(path.resolve(__dirname, '../../../node_modules/pngjs'));

const srcOriginal = path.resolve(__dirname, '../assets/images/bookmy-salon-icon-original.png');
const mobileAssetsImages = path.resolve(__dirname, '../assets/images');
const mobileAssets = path.resolve(__dirname, '../assets');
const rootAssetsImages = path.resolve(__dirname, '../../../assets/images');
const rootAssets = path.resolve(__dirname, '../../../assets');

fs.createReadStream(srcOriginal)
  .pipe(new PNG())
  .on('parsed', function () {
    const src = this;
    const W = 1024;
    const H = 1024;

    // Optical center of the gold logo in original image
    const srcCenterX = 512;
    const srcCenterY = 512;
    const dstCenterX = 512;
    const dstCenterY = 512;

    // Scale factor: 0.77 scales the 593x540 bounding box so max radius is ~290px,
    // comfortably inside the 338px safe circle (66% of 1024)
    const scale = 0.77;

    // Destination 1: Standard square icon with #0B0907 background
    const dstStandard = new PNG({ width: W, height: H });

    // Destination 2: Android Adaptive Foreground with transparent background
    const dstAdaptiveForeground = new PNG({ width: W, height: H });

    for (let dy = 0; dy < H; dy++) {
      for (let dx = 0; dx < W; dx++) {
        const dstIdx = (dy * W + dx) << 2;

        // Default standard icon background: #0B0907 (R: 11, G: 9, B: 7, A: 255)
        dstStandard.data[dstIdx] = 11;
        dstStandard.data[dstIdx + 1] = 9;
        dstStandard.data[dstIdx + 2] = 7;
        dstStandard.data[dstIdx + 3] = 255;

        // Default adaptive foreground: Transparent (R: 0, G: 0, B: 0, A: 0)
        dstAdaptiveForeground.data[dstIdx] = 0;
        dstAdaptiveForeground.data[dstIdx + 1] = 0;
        dstAdaptiveForeground.data[dstIdx + 2] = 0;
        dstAdaptiveForeground.data[dstIdx + 3] = 0;

        // Map dst (dx, dy) back to src
        const sx = (dx - dstCenterX) / scale + srcCenterX;
        const sy = (dy - dstCenterY) / scale + srcCenterY;

        // Outside bounding box containing gold logo
        if (sx < 205 || sx > 820 || sy < 235 || sy > 795) {
          continue;
        }

        const x0 = Math.floor(sx);
        const x1 = Math.min(1023, x0 + 1);
        const y0 = Math.floor(sy);
        const y1 = Math.min(1023, y0 + 1);
        const fx = sx - x0;
        const fy = sy - y0;

        const getP = (x, y) => {
          const idx = (y * 1024 + x) << 2;
          return [src.data[idx], src.data[idx + 1], src.data[idx + 2]];
        };

        const [r00, g00, b00] = getP(x0, y0);
        const [r10, g10, b10] = getP(x1, y0);
        const [r01, g01, b01] = getP(x0, y1);
        const [r11, g11, b11] = getP(x1, y1);

        const r = (r00 * (1 - fx) + r10 * fx) * (1 - fy) + (r01 * (1 - fx) + r11 * fx) * fy;
        const g = (g00 * (1 - fx) + g10 * fx) * (1 - fy) + (g01 * (1 - fx) + g11 * fx) * fy;
        const b = (b00 * (1 - fx) + b10 * fx) * (1 - fy) + (b01 * (1 - fx) + b11 * fx) * fy;

        // Gold tone chromatic test
        const warmDiff = (r - b) + (g - b) * 0.5;

        if (warmDiff > 10 && r > 45 && g > 35) {
          let alpha = Math.min(1, Math.max(0, (warmDiff - 10) / 35));
          if (r > 80) {
            alpha = Math.max(alpha, Math.min(1, (r - 40) / 60));
          }

          // Anti-aliased Adaptive Foreground
          dstAdaptiveForeground.data[dstIdx] = Math.round(r);
          dstAdaptiveForeground.data[dstIdx + 1] = Math.round(g);
          dstAdaptiveForeground.data[dstIdx + 2] = Math.round(b);
          dstAdaptiveForeground.data[dstIdx + 3] = Math.round(alpha * 255);

          // Anti-aliased Standard Icon on #0B0907
          dstStandard.data[dstIdx] = Math.round(r * alpha + 11 * (1 - alpha));
          dstStandard.data[dstIdx + 1] = Math.round(g * alpha + 9 * (1 - alpha));
          dstStandard.data[dstIdx + 2] = Math.round(b * alpha + 7 * (1 - alpha));
          dstStandard.data[dstIdx + 3] = 255;
        }
      }
    }

    const bufStandard = PNG.sync.write(dstStandard);
    const bufAdaptive = PNG.sync.write(dstAdaptiveForeground);

    fs.writeFileSync(path.join(mobileAssetsImages, 'bookmy-salon-icon.png'), bufStandard);
    fs.writeFileSync(path.join(mobileAssetsImages, 'bookmy-salon-adaptive-foreground.png'), bufAdaptive);
    fs.writeFileSync(path.join(mobileAssets, 'icon.png'), bufStandard);
    fs.writeFileSync(path.join(mobileAssets, 'adaptive-icon.png'), bufAdaptive);
    fs.writeFileSync(path.join(rootAssetsImages, 'bookmy-salon-icon.png'), bufStandard);
    fs.writeFileSync(path.join(rootAssetsImages, 'bookmy-salon-adaptive-foreground.png'), bufAdaptive);
    fs.writeFileSync(path.join(rootAssets, 'icon.png'), bufStandard);
    fs.writeFileSync(path.join(rootAssets, 'adaptive-icon.png'), bufAdaptive);

    console.log('All icons generated successfully!');
  });
