const fs = require("fs");
const path = require("path");
const { chromium } = require("@playwright/test");

const repoRoot = path.resolve(__dirname, "..");
const downloadsDir = path.resolve(process.env.USERPROFILE || process.env.HOME || ".", "Downloads");

const ships = {
  "pioneer-hunter": { source: path.join(downloadsDir, "hunter.png") },
  "pioneer-destroyer": {
    source: path.join(repoRoot, "assets", "ships", "pioneer-destroyer", "pioneer-destroyer-source.png")
  },
  "pioneer-moth": { source: path.join(downloadsDir, "moth.png") },
  "pioneer-freighter": { source: path.join(downloadsDir, "freighter.png") }
};

const sizes = {
  master: 1254,
  large: 960,
  medium: 480,
  small: 180
};

async function prepareShip(page, shipId, sourcePath, mattePath = sourcePath) {
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing source image: ${sourcePath}`);
  if (!fs.existsSync(mattePath)) throw new Error(`Missing matte image: ${mattePath}`);
  const dataUrl = `data:image/png;base64,${fs.readFileSync(sourcePath).toString("base64")}`;
  const matteDataUrl = `data:image/png;base64,${fs.readFileSync(mattePath).toString("base64")}`;
  const variants = await page.evaluate(async ({ src, matteSrc, shipId, sizes }) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    const matteImage = new Image();
    matteImage.src = matteSrc;
    await matteImage.decode();

    const source = document.createElement("canvas");
    source.width = image.naturalWidth;
    source.height = image.naturalHeight;
    const context = source.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, source.width, source.height);
    const { data, width, height } = imageData;
    const matte = document.createElement("canvas");
    matte.width = width;
    matte.height = height;
    const matteContext = matte.getContext("2d", { willReadFrequently: true });
    matteContext.drawImage(matteImage, 0, 0, width, height);
    const matteData = matteContext.getImageData(0, 0, width, height).data;
    const usesAlphaMatte = matteData[3] < 250;
    const pixelCount = width * height;
    const background = new Uint8Array(pixelCount);
    const queue = new Int32Array(pixelCount);
    let head = 0;
    let tail = 0;

    function isRemovable(index) {
      const offset = index * 4;
      if (usesAlphaMatte) return matteData[offset + 3] <= 12;
      const r = matteData[offset];
      const g = matteData[offset + 1];
      const b = matteData[offset + 2];
      const luminance = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      return luminance <= 76 && chroma <= 42;
    }

    function enqueue(index) {
      if (index < 0 || index >= pixelCount || background[index] || !isRemovable(index)) return;
      background[index] = 1;
      queue[tail] = index;
      tail += 1;
    }

    for (let x = 0; x < width; x += 1) {
      enqueue(x);
      enqueue(((height - 1) * width) + x);
    }
    for (let y = 0; y < height; y += 1) {
      enqueue(y * width);
      enqueue((y * width) + width - 1);
    }

    while (head < tail) {
      const index = queue[head];
      head += 1;
      const x = index % width;
      if (x > 0) enqueue(index - 1);
      if (x < width - 1) enqueue(index + 1);
      if (index >= width) enqueue(index - width);
      if (index < pixelCount - width) enqueue(index + width);
    }

    for (let index = 0; index < pixelCount; index += 1) {
      if (background[index]) data[(index * 4) + 3] = 0;
    }
    context.putImageData(imageData, 0, 0);

    const entries = {};
    for (const [label, maxSize] of Object.entries(sizes)) {
      const scale = Math.min(1, maxSize / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const resized = canvas.getContext("2d");
      resized.imageSmoothingEnabled = true;
      resized.imageSmoothingQuality = "high";
      resized.drawImage(source, 0, 0, canvas.width, canvas.height);
      entries[`${shipId}-${label}.webp`] = canvas.toDataURL("image/webp", 0.95);
    }
    return entries;
  }, { src: dataUrl, matteSrc: matteDataUrl, shipId, sizes });

  const outputDir = path.join(repoRoot, "assets", "ships", shipId);
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [fileName, outputDataUrl] of Object.entries(variants)) {
    const base64 = outputDataUrl.replace(/^data:image\/webp;base64,/, "");
    fs.writeFileSync(path.join(outputDir, fileName), Buffer.from(base64, "base64"));
    console.log(`${shipId}: ${fileName}`);
  }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    for (const [shipId, paths] of Object.entries(ships)) {
      await prepareShip(page, shipId, paths.source, paths.matte || paths.source);
    }
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
