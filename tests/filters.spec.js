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

test.afterAll(async () => {
  if (testFolder && fs.existsSync(testFolder)) {
    fs.rmSync(testFolder, { recursive: true, force: true });
  }
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

test.describe('Filter Verification', () => {
  test('should apply all filters correctly in sequence', async ({ page, electronApp }) => {
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

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(testFolder, 'test-image.png'), buffer);

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

    const originalData = await getImageData(page);

    async function applyPreset(presetName) {
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

    const filterTests = [
      {
        name: 'Test Exposure Up',
        test: (filtered, original) => {
          expect(filtered.avgR).toBeGreaterThan(original.avgR);
          expect(filtered.avgG).toBeGreaterThan(original.avgG);
          expect(filtered.avgB).toBeGreaterThan(original.avgB);
        }
      },
      {
        name: 'Test Exposure Down',
        test: (filtered, original) => {
          expect(filtered.avgR).toBeLessThan(original.avgR);
          expect(filtered.avgG).toBeLessThan(original.avgG);
          expect(filtered.avgB).toBeLessThan(original.avgB);
        }
      },
      {
        name: 'Test Contrast Up',
        test: (filtered, original) => {
          expect(filtered.avgR).not.toBe(original.avgR);
          expect(filtered.avgG).not.toBe(original.avgG);
          expect(filtered.avgB).not.toBe(original.avgB);
        }
      },
      {
        name: 'Test Contrast Down',
        test: (filtered, original) => {
          expect(filtered.avgR).not.toBe(original.avgR);
          expect(filtered.avgG).not.toBe(original.avgG);
          expect(filtered.avgB).not.toBe(original.avgB);
        }
      },
      {
        name: 'Test Saturation Zero',
        test: (filtered) => {
          const tolerance = 2;
          expect(Math.abs(filtered.avgR - filtered.avgG)).toBeLessThan(tolerance);
          expect(Math.abs(filtered.avgG - filtered.avgB)).toBeLessThan(tolerance);
          expect(Math.abs(filtered.avgR - filtered.avgB)).toBeLessThan(tolerance);
        }
      },
      {
        name: 'Test Saturation Up',
        test: (filtered, original) => {
          expect(filtered.avgR).not.toBe(original.avgR);
          expect(filtered.avgG).not.toBe(original.avgG);
          expect(filtered.avgB).not.toBe(original.avgB);
        }
      },
      {
        name: 'Test Temperature Warm',
        test: (filtered, original) => {
          expect(filtered.avgR).toBeGreaterThan(original.avgR);
          expect(filtered.avgB).toBeLessThan(original.avgB);
        }
      },
      {
        name: 'Test Temperature Cool',
        test: (filtered, original) => {
          expect(filtered.avgR).not.toBe(original.avgR);
          expect(filtered.avgB).not.toBe(original.avgB);
        }
      },
      {
        name: 'Test Tint Green',
        test: (filtered, original) => {
          expect(filtered.avgR).not.toBe(original.avgR);
          expect(filtered.avgG).not.toBe(original.avgG);
        }
      },
      {
        name: 'Test Tint Magenta',
        test: (filtered, original) => {
          expect(filtered.avgR).not.toBe(original.avgR);
          expect(filtered.avgG).not.toBe(original.avgG);
        }
      },
      {
        name: 'Test Vibrance',
        test: (filtered, original) => {
          expect(filtered.avgR).not.toBe(original.avgR);
        }
      },
      {
        name: 'Test Shadows',
        test: (filtered, original) => {
          expect(filtered.avgR).toBeGreaterThan(original.avgR);
          expect(filtered.avgG).toBeGreaterThan(original.avgG);
          expect(filtered.avgB).toBeGreaterThan(original.avgB);
        }
      },
      {
        name: 'Test Highlights',
        test: (filtered, original) => {
          expect(filtered.avgR).not.toBe(original.avgR);
          expect(filtered.avgG).not.toBe(original.avgG);
          expect(filtered.avgB).not.toBe(original.avgB);
        }
      },
      {
        name: 'Test Whites',
        test: (filtered, original) => {
          expect(filtered.avgR).toBeGreaterThan(original.avgR);
        }
      },
      {
        name: 'Test Blacks',
        test: (filtered, original) => {
          expect(filtered.avgR).toBeLessThan(original.avgR);
        }
      },
      {
        name: 'Test Dehaze',
        test: (filtered, original) => {
          expect(filtered.avgR).not.toBe(original.avgR);
        }
      }
    ];

    for (const filterTest of filterTests) {
      await applyPreset(filterTest.name);
      const filteredData = await getImageData(page);
      filterTest.test(filteredData, originalData);
    }
  });
});
