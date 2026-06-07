const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const repoRoot = path.resolve(__dirname, "..");
const downloadsDir = path.resolve(process.env.USERPROFILE || process.env.HOME || ".", "Downloads");

const ships = {
  falcon: {
    files: ["falcon1.webp", "falcon2.webp", "falcon3.webp"]
  },
  bison: {
    files: ["bison1.webp", "bison2.webp", "bison3.webp"]
  },
  monolith: {
    files: ["monolith1.webp", "monolith2.webp", "monolith3.webp", "monolith4.webp"]
  }
};

const sizes = {
  master: null,
  large: 960,
  medium: 480,
  small: 180
};

function getInputFiles(files) {
  return files
    .map(file => path.join(downloadsDir, file))
    .filter(file => fs.existsSync(file));
}

async function getImageInfo(page, filePath) {
  const dataUrl = `data:image/webp;base64,${fs.readFileSync(filePath).toString("base64")}`;
  return page.evaluate(async src => {
    const image = new Image();
    image.src = src;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  }, dataUrl);
}

async function prepareShip(page, shipKey, inputPath) {
  const dataUrl = `data:image/webp;base64,${fs.readFileSync(inputPath).toString("base64")}`;
  const outputDir = path.join(repoRoot, "assets", "ships", shipKey);
  fs.mkdirSync(outputDir, { recursive: true });

  const variants = await page.evaluate(async ({ src, shipKey, sizes }) => {
    const image = new Image();
    image.src = src;
    await image.decode();

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = image.naturalWidth;
    sourceCanvas.height = image.naturalHeight;
    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    sourceContext.drawImage(image, 0, 0);
    const imageData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const { data, width, height } = imageData;
    const pixelCount = width * height;
    const background = new Uint8Array(pixelCount);
    const queue = [];

    function indexOf(x, y) {
      return y * width + x;
    }

    function isEdgeCheckerPixel(index) {
      const offset = index * 4;
      const alpha = data[offset + 3];
      if (alpha < 12) return true;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const chroma = max - min;
      return alpha > 220 && min >= 205 && chroma <= 24;
    }

    function enqueue(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const index = indexOf(x, y);
      if (background[index] || !isEdgeCheckerPixel(index)) return;
      background[index] = 1;
      queue.push(index);
    }

    for (let x = 0; x < width; x += 1) {
      enqueue(x, 0);
      enqueue(x, height - 1);
    }
    for (let y = 0; y < height; y += 1) {
      enqueue(0, y);
      enqueue(width - 1, y);
    }

    for (let head = 0; head < queue.length; head += 1) {
      const index = queue[head];
      const x = index % width;
      const y = Math.floor(index / width);
      enqueue(x + 1, y);
      enqueue(x - 1, y);
      enqueue(x, y + 1);
      enqueue(x, y - 1);
    }

    const shipMask = new Uint8Array(pixelCount);
    for (let index = 0; index < pixelCount; index += 1) {
      shipMask[index] = background[index] ? 0 : 1;
    }

    for (let index = 0; index < pixelCount; index += 1) {
      if (!background[index]) continue;
      data[index * 4 + 3] = 0;
    }

    // Feather only the mask edge. This keeps internal light panels intact while
    // softening antialias pixels that touch the removed checkerboard.
    for (let index = 0; index < pixelCount; index += 1) {
      if (!shipMask[index]) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      let touchesBackground = false;
      for (let dy = -1; dy <= 1 && !touchesBackground; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || background[indexOf(nx, ny)]) {
            touchesBackground = true;
            break;
          }
        }
      }
      if (!touchesBackground) continue;
      const offset = index * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (min >= 205 && max - min <= 30) {
        data[offset + 3] = Math.min(data[offset + 3], 90);
      }
    }

    sourceContext.putImageData(imageData, 0, 0);

    async function toWebp(canvas) {
      return canvas.toDataURL("image/webp", 0.94);
    }

    const entries = {};
    for (const [label, maxSize] of Object.entries(sizes)) {
      const scale = maxSize ? Math.min(1, maxSize / Math.max(width, height)) : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext("2d");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
      entries[`${shipKey}-${label}.webp`] = await toWebp(canvas);
    }
    return entries;
  }, { src: dataUrl, shipKey, sizes });

  for (const [fileName, dataUrl] of Object.entries(variants)) {
    const base64 = dataUrl.replace(/^data:image\/webp;base64,/, "");
    fs.writeFileSync(path.join(outputDir, fileName), Buffer.from(base64, "base64"));
  }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    for (const [shipKey, config] of Object.entries(ships)) {
      const candidates = getInputFiles(config.files);
      if (!candidates.length) throw new Error(`No source files found for ${shipKey}`);
      const infos = [];
      for (const filePath of candidates) {
        const info = await getImageInfo(page, filePath);
        infos.push({ filePath, ...info, area: info.width * info.height });
      }
      infos.sort((a, b) => b.area - a.area);
      await prepareShip(page, shipKey, infos[0].filePath);
      console.log(`${shipKey}: ${path.basename(infos[0].filePath)} -> assets/ships/${shipKey}/`);
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
