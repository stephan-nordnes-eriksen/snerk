const { test, expect } = require('./fixtures');
const path = require('path');
const fs = require('fs');
const os = require('os');

let testFolder;
let testPresetsFolder;

test.beforeAll(async () => {
  testPresetsFolder = path.join(os.homedir(), '.snerk', 'presets', 'test-filters');
  fs.mkdirSync(testPresetsFolder, { recursive: true });

  const presets = {
    'test-exposure-up.yaml': `name: "Test Exposure Up"
category: "test-filters"
adjustments:
  exposure: 1.0
`,
    'test-exposure-down.yaml': `name: "Test Exposure Down"
category: "test-filters"
adjustments:
  exposure: -1.0
`,
    'test-contrast-up.yaml': `name: "Test Contrast Up"
category: "test-filters"
adjustments:
  contrast: 1.5
`,
    'test-contrast-down.yaml': `name: "Test Contrast Down"
category: "test-filters"
adjustments:
  contrast: 0.5
`,
    'test-saturation-zero.yaml': `name: "Test Saturation Zero"
category: "test-filters"
adjustments:
  saturation: 0.0
`,
    'test-saturation-up.yaml': `name: "Test Saturation Up"
category: "test-filters"
adjustments:
  saturation: 2.0
`,
    'test-temperature-warm.yaml': `name: "Test Temperature Warm"
category: "test-filters"
adjustments:
  temperature: 50
`,
    'test-temperature-cool.yaml': `name: "Test Temperature Cool"
category: "test-filters"
adjustments:
  temperature: -50
`,
    'test-tint-green.yaml': `name: "Test Tint Green"
category: "test-filters"
adjustments:
  tint: 50
`,
    'test-tint-magenta.yaml': `name: "Test Tint Magenta"
category: "test-filters"
adjustments:
  tint: -50
`,
    'test-vibrance.yaml': `name: "Test Vibrance"
category: "test-filters"
adjustments:
  vibrance: 50
`,
    'test-shadows.yaml': `name: "Test Shadows"
category: "test-filters"
adjustments:
  shadows: 50
`,
    'test-highlights.yaml': `name: "Test Highlights"
category: "test-filters"
adjustments:
  highlights: -50
`,
    'test-whites.yaml': `name: "Test Whites"
category: "test-filters"
adjustments:
  whites: 50
`,
    'test-blacks.yaml': `name: "Test Blacks"
category: "test-filters"
adjustments:
  blacks: -50
`,
    'test-dehaze.yaml': `name: "Test Dehaze"
category: "test-filters"
adjustments:
  dehaze: 50
`,
  };

  for (const [filename, content] of Object.entries(presets)) {
    fs.writeFileSync(path.join(testPresetsFolder, filename), content);
  }
});

test.beforeEach(async ({ page, electronApp }) => {
  testFolder = path.join(os.tmpdir(), `snerk-test-${Date.now()}`);
  fs.mkdirSync(testFolder, { recursive: true });

  const Canvas = require('canvas');
  const canvas = Canvas.createCanvas(400, 300);
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, 400, 0);
  gradient.addColorStop(0, '#FF0000');
  gradient.addColorStop(0.25, '#00FF00');
  gradient.addColorStop(0.5, '#0000FF');
  gradient.addColorStop(0.75, '#FFFF00');
  gradient.addColorStop(1, '#FF00FF');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 400, 300);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(50, 50, 100, 100);

  ctx.fillStyle = '#808080';
  ctx.fillRect(200, 50, 100, 100);

  ctx.fillStyle = '#000000';
  ctx.fillRect(125, 150, 150, 100);

  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
  fs.writeFileSync(path.join(testFolder, 'test-image.jpg'), buffer);

  await electronApp.evaluate(async ({ dialog }, folderPath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [folderPath]
    });
  }, testFolder);

  await page.locator('#openFolder').click();
  await page.waitForTimeout(1200);

  await page.waitForFunction(() => {
    const img = document.getElementById('mainImage');
    return img && img.naturalWidth > 0 && img.naturalHeight > 0;
  }, {}, { timeout: 10000 });
});

test.afterEach(async () => {
  if (testFolder && fs.existsSync(testFolder)) {
    fs.rmSync(testFolder, { recursive: true, force: true });
  }
});

test.afterAll(async () => {
  if (testPresetsFolder && fs.existsSync(testPresetsFolder)) {
    fs.rmSync(testPresetsFolder, { recursive: true, force: true });
  }
});

async function getImageData(page) {
  await page.waitForFunction(() => {
    const img = document.getElementById('mainImage');
    return img && img.naturalWidth > 0 && img.naturalHeight > 0;
  }, {}, { timeout: 10000 });

  return await page.evaluate(() => {
    const img = document.getElementById('mainImage');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let rSum = 0, gSum = 0, bSum = 0;
    for (let i = 0; i < imageData.data.length; i += 4) {
      rSum += imageData.data[i];
      gSum += imageData.data[i + 1];
      bSum += imageData.data[i + 2];
    }
    const pixelCount = imageData.data.length / 4;

    return {
      avgR: rSum / pixelCount,
      avgG: gSum / pixelCount,
      avgB: bSum / pixelCount,
      width: canvas.width,
      height: canvas.height
    };
  });
}

async function applyPreset(page, presetName) {
  const testFiltersCategory = page.locator('.preset-category', { has: page.locator('summary:has-text("test filters")') });
  const isOpen = await testFiltersCategory.evaluate(el => el.open);

  if (!isOpen) {
    await testFiltersCategory.locator('summary').click();
  }

  const presetBtn = page.locator('.preset-btn', { hasText: presetName });
  await presetBtn.waitFor({ state: 'visible', timeout: 10000 });
  await presetBtn.click();
  await page.waitForTimeout(1500);

  await page.waitForFunction(() => {
    const img = document.getElementById('mainImage');
    return img && img.naturalWidth > 0 && img.naturalHeight > 0;
  }, {}, { timeout: 10000 });
}

test.describe('Filter Verification', () => {
  test('should apply exposure increase filter', async ({ page }) => {
    const originalData = await getImageData(page);

    await applyPreset(page, 'Test Exposure Up');

    const filteredData = await getImageData(page);

    expect(filteredData.avgR).toBeGreaterThan(originalData.avgR);
    expect(filteredData.avgG).toBeGreaterThan(originalData.avgG);
    expect(filteredData.avgB).toBeGreaterThan(originalData.avgB);

  });

  test('should apply exposure decrease filter', async ({ page }) => {
    const originalData = await getImageData(page);

    await applyPreset(page, 'Test Exposure Down');

    const filteredData = await getImageData(page);

    expect(filteredData.avgR).toBeLessThan(originalData.avgR);
    expect(filteredData.avgG).toBeLessThan(originalData.avgG);
    expect(filteredData.avgB).toBeLessThan(originalData.avgB);

  });

  test('should apply contrast increase filter', async ({ page }) => {
    const originalData = await getImageData(page);

    await applyPreset(page, 'Test Contrast Up');

    const filteredData = await getImageData(page);

    expect(filteredData.avgR).not.toBe(originalData.avgR);
    expect(filteredData.avgG).not.toBe(originalData.avgG);
    expect(filteredData.avgB).not.toBe(originalData.avgB);

  });

  test('should apply contrast decrease filter', async ({ page }) => {
    const originalData = await getImageData(page);

    await applyPreset(page, 'Test Contrast Down');

    const filteredData = await getImageData(page);

    expect(filteredData.avgR).not.toBe(originalData.avgR);
    expect(filteredData.avgG).not.toBe(originalData.avgG);
    expect(filteredData.avgB).not.toBe(originalData.avgB);

  });

  test('should apply saturation zero filter (black and white)', async ({ page }) => {
    const originalData = await getImageData(page);

    await applyPreset(page, 'Test Saturation Zero');

    const filteredData = await getImageData(page);

    const tolerance = 2;
    expect(Math.abs(filteredData.avgR - filteredData.avgG)).toBeLessThan(tolerance);
    expect(Math.abs(filteredData.avgG - filteredData.avgB)).toBeLessThan(tolerance);
    expect(Math.abs(filteredData.avgR - filteredData.avgB)).toBeLessThan(tolerance);

  });

  test('should apply saturation increase filter', async ({ page }) => {
    const originalData = await getImageData(page);

    await applyPreset(page, 'Test Saturation Up');

    const filteredData = await getImageData(page);

    expect(filteredData.avgR).not.toBe(originalData.avgR);
    expect(filteredData.avgG).not.toBe(originalData.avgG);
    expect(filteredData.avgB).not.toBe(originalData.avgB);

  });

  test('should apply temperature warm filter', async ({ page }) => {
    const originalData = await getImageData(page);

    await applyPreset(page, 'Test Temperature Warm');

    const filteredData = await getImageData(page);

    expect(filteredData.avgR).toBeGreaterThan(originalData.avgR);
    expect(filteredData.avgB).toBeLessThan(originalData.avgB);

  });

  test('should apply temperature cool filter', async ({ page }) => {
    const originalData = await getImageData(page);

    await applyPreset(page, 'Test Temperature Cool');

    const filteredData = await getImageData(page);

    expect(filteredData.avgR).not.toBe(originalData.avgR);
    expect(filteredData.avgB).not.toBe(originalData.avgB);

  });

  test('should apply tint green filter', async ({ page }) => {
    const originalData = await getImageData(page);

    await applyPreset(page, 'Test Tint Green');

    const filteredData = await getImageData(page);

    expect(filteredData.avgR).not.toBe(originalData.avgR);
    expect(filteredData.avgG).not.toBe(originalData.avgG);

  });

  test('should apply tint magenta filter', async ({ page }) => {
    const originalData = await getImageData(page);

    await applyPreset(page, 'Test Tint Magenta');

    const filteredData = await getImageData(page);

    expect(filteredData.avgR).not.toBe(originalData.avgR);
    expect(filteredData.avgG).not.toBe(originalData.avgG);

  });

  test('should apply vibrance filter', async ({ page }) => {
    const originalData = await getImageData(page);

    await applyPreset(page, 'Test Vibrance');

    const filteredData = await getImageData(page);

    expect(filteredData.avgR).not.toBe(originalData.avgR);

  });

  test('should apply shadows filter', async ({ page }) => {
    const originalData = await getImageData(page);

    await applyPreset(page, 'Test Shadows');

    const filteredData = await getImageData(page);

    expect(filteredData.avgR).toBeGreaterThan(originalData.avgR);
    expect(filteredData.avgG).toBeGreaterThan(originalData.avgG);
    expect(filteredData.avgB).toBeGreaterThan(originalData.avgB);

  });

  test('should apply highlights filter', async ({ page }) => {
    const originalData = await getImageData(page);

    await applyPreset(page, 'Test Highlights');

    const filteredData = await getImageData(page);

    expect(filteredData.avgR).not.toBe(originalData.avgR);
    expect(filteredData.avgG).not.toBe(originalData.avgG);
    expect(filteredData.avgB).not.toBe(originalData.avgB);

  });

  test('should apply whites filter', async ({ page }) => {
    const originalData = await getImageData(page);

    await applyPreset(page, 'Test Whites');

    const filteredData = await getImageData(page);

    expect(filteredData.avgR).toBeGreaterThan(originalData.avgR);

  });

  test('should apply blacks filter', async ({ page }) => {
    const originalData = await getImageData(page);

    await applyPreset(page, 'Test Blacks');

    const filteredData = await getImageData(page);

    expect(filteredData.avgR).toBeLessThan(originalData.avgR);

  });

  test('should apply dehaze filter', async ({ page }) => {
    const originalData = await getImageData(page);

    await applyPreset(page, 'Test Dehaze');

    const filteredData = await getImageData(page);

    expect(filteredData.avgR).not.toBe(originalData.avgR);

  });
});
