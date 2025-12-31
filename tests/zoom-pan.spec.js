const { test, expect } = require('./fixtures');
const path = require('path');
const fs = require('fs');
const os = require('os');

let testFolder;

test.beforeEach(async ({ page, electronApp }) => {
  testFolder = path.join(os.tmpdir(), `snerk-test-${Date.now()}`);
  fs.mkdirSync(testFolder, { recursive: true });

  const imageData = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x03, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
    0x37, 0xFF, 0xD9
  ]);

  fs.writeFileSync(path.join(testFolder, 'test.jpg'), imageData);

  await electronApp.evaluate(async ({ dialog }, folderPath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [folderPath]
    });
  }, testFolder);

  await page.locator('#openFolder').click();
  await page.waitForTimeout(1500);
});

test.afterEach(async () => {
  if (testFolder && fs.existsSync(testFolder)) {
    fs.rmSync(testFolder, { recursive: true, force: true });
  }
});

test.describe('Zoom Functionality', () => {
  test('should zoom in with + key', async ({ page }) => {
    const getZoomLevel = async () => {
      return await page.evaluate(() => {
        const transform = document.getElementById('mainImage').style.transform;
        const match = transform.match(/scale\(([0-9.]+)\)/);
        return match ? parseFloat(match[1]) : 1;
      });
    };

    const initialZoom = await getZoomLevel();

    await page.keyboard.press('+');
    await page.waitForTimeout(100);

    const afterZoom = await getZoomLevel();
    expect(afterZoom).toBeGreaterThan(initialZoom);
  });

  test('should zoom out with - key', async ({ page }) => {
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    await page.waitForTimeout(200);

    const getZoomLevel = async () => {
      return await page.evaluate(() => {
        const transform = document.getElementById('mainImage').style.transform;
        const match = transform.match(/scale\(([0-9.]+)\)/);
        return match ? parseFloat(match[1]) : 1;
      });
    };

    const zoomedInLevel = await getZoomLevel();

    await page.keyboard.press('-');
    await page.waitForTimeout(100);

    const zoomedOutLevel = await getZoomLevel();
    expect(zoomedOutLevel).toBeLessThan(zoomedInLevel);
  });

  test('should zoom to fit with button', async ({ page }) => {
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    await page.waitForTimeout(200);

    const zoomFitBtn = page.locator('#zoomFitBtn');
    await zoomFitBtn.click();
    await page.waitForTimeout(100);

    const transform = await page.evaluate(() => {
      return document.getElementById('mainImage').style.transform;
    });

    expect(transform).toContain('translate(0px, 0px)');
  });

  test('should zoom to 100% with button', async ({ page }) => {
    const zoom100Btn = page.locator('#zoom100Btn');
    await zoom100Btn.click();
    await page.waitForTimeout(100);

    const zoomLevel = await page.evaluate(() => {
      const transform = document.getElementById('mainImage').style.transform;
      const match = transform.match(/scale\(([0-9.]+)\)/);
      return match ? parseFloat(match[1]) : 1;
    });

    expect(zoomLevel).toBeGreaterThan(0);
  });

  test('should zoom to 100% with Z key', async ({ page }) => {
    await page.keyboard.press('z');
    await page.waitForTimeout(100);

    const zoomLevel = await page.evaluate(() => {
      const transform = document.getElementById('mainImage').style.transform;
      const match = transform.match(/scale\(([0-9.]+)\)/);
      return match ? parseFloat(match[1]) : 1;
    });

    expect(zoomLevel).toBeGreaterThan(0);
  });

  test('should reset zoom with R key', async ({ page }) => {
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    await page.waitForTimeout(200);

    await page.keyboard.press('r');
    await page.waitForTimeout(100);

    const transform = await page.evaluate(() => {
      return document.getElementById('mainImage').style.transform;
    });

    expect(transform).toContain('translate(0px, 0px)');
  });
});

test.describe('Pan Functionality', () => {
  test('should pan image when dragging', async ({ page }) => {
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    await page.waitForTimeout(500);

    const imageContainer = page.locator('#imageContainer');
    const box = await imageContainer.boundingBox();

    if (!box) {
      throw new Error('Could not get bounding box for image container');
    }

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 50, startY + 50, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(100);

    const transform = await page.evaluate(() => {
      return document.getElementById('mainImage').style.transform;
    });

    expect(transform).toMatch(/translate\([^0][^p]/);
  });

  test('should reset pan position when fitting to window', async ({ page }) => {
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    await page.waitForTimeout(300);

    const imageContainer = page.locator('#imageContainer');
    const box = await imageContainer.boundingBox();

    if (!box) {
      throw new Error('Could not get bounding box for image container');
    }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(100);

    await page.keyboard.press('r');
    await page.waitForTimeout(100);

    const transform = await page.evaluate(() => {
      return document.getElementById('mainImage').style.transform;
    });

    expect(transform).toContain('translate(0px, 0px)');
  });

  test('should maintain pan position when zooming', async ({ page }) => {
    await page.keyboard.press('+');
    await page.keyboard.press('+');
    await page.waitForTimeout(300);

    const imageContainer = page.locator('#imageContainer');
    const box = await imageContainer.boundingBox();

    if (!box) {
      throw new Error('Could not get bounding box for image container');
    }

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 30, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(100);

    const transformBefore = await page.evaluate(() => {
      return document.getElementById('mainImage').style.transform;
    });

    await page.keyboard.press('+');
    await page.waitForTimeout(100);

    const transformAfter = await page.evaluate(() => {
      return document.getElementById('mainImage').style.transform;
    });

    const extractTranslate = (transform) => {
      const match = transform.match(/translate\(([^)]+)\)/);
      return match ? match[1] : null;
    };

    expect(extractTranslate(transformAfter)).toBe(extractTranslate(transformBefore));
  });
});
