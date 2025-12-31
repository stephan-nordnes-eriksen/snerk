const { test, expect } = require('./fixtures');
const path = require('path');
const fs = require('fs');
const os = require('os');

let testFolder;

test.beforeEach(async () => {
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

  fs.writeFileSync(path.join(testFolder, 'test1.jpg'), imageData);
  fs.writeFileSync(path.join(testFolder, 'test2.jpg'), imageData);
  fs.writeFileSync(path.join(testFolder, 'test3.jpg'), imageData);
});

test.afterEach(async () => {
  if (testFolder && fs.existsSync(testFolder)) {
    fs.rmSync(testFolder, { recursive: true, force: true });
  }
});

test.describe('Folder Operations', () => {
  test('should open folder and load images', async ({ page, electronApp }) => {
    await electronApp.evaluate(async ({ dialog }, folderPath) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [folderPath]
      });
    }, testFolder);

    await page.locator('#openFolder').click();
    await page.waitForTimeout(1000);

    const imageCounter = await page.locator('#imageCounter').textContent();
    expect(imageCounter).toContain('1 / 3');

    const emptyState = page.locator('#emptyState');
    await expect(emptyState).not.toBeVisible();
  });

  test('should navigate between images with arrow keys', async ({ page, electronApp }) => {
    await electronApp.evaluate(async ({ dialog }, folderPath) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [folderPath]
      });
    }, testFolder);

    await page.locator('#openFolder').click();
    await page.waitForTimeout(1000);

    let imageCounter = await page.locator('#imageCounter').textContent();
    expect(imageCounter).toContain('1 / 3');

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);

    imageCounter = await page.locator('#imageCounter').textContent();
    expect(imageCounter).toContain('2 / 3');

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(500);

    imageCounter = await page.locator('#imageCounter').textContent();
    expect(imageCounter).toContain('1 / 3');
  });

  test('should navigate with prev/next buttons', async ({ page, electronApp }) => {
    await electronApp.evaluate(async ({ dialog }, folderPath) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [folderPath]
      });
    }, testFolder);

    await page.locator('#openFolder').click();
    await page.waitForTimeout(1000);

    const nextBtn = page.locator('#nextImage');
    await nextBtn.click();
    await page.waitForTimeout(500);

    let imageCounter = await page.locator('#imageCounter').textContent();
    expect(imageCounter).toContain('2 / 3');

    const prevBtn = page.locator('#prevImage');
    await prevBtn.click();
    await page.waitForTimeout(500);

    imageCounter = await page.locator('#imageCounter').textContent();
    expect(imageCounter).toContain('1 / 3');
  });
});
