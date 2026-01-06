const { test, expect } = require('./fixtures');
const path = require('path');
const fs = require('fs');
const os = require('os');

let testFolder;
let consoleErrors = [];
let consoleWarnings = [];

test.beforeEach(async ({ page }) => {
  testFolder = path.join(os.tmpdir(), `snerk-test-${Date.now()}`);
  fs.mkdirSync(testFolder, { recursive: true });

  // Create a minimal valid JPEG image (1x1 pixel)
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

  // Create multiple test images
  fs.writeFileSync(path.join(testFolder, 'test1.jpg'), imageData);
  fs.writeFileSync(path.join(testFolder, 'test2.jpg'), imageData);
  fs.writeFileSync(path.join(testFolder, 'test3.jpg'), imageData);

  // Reset console tracking
  consoleErrors = [];
  consoleWarnings = [];

  // Capture console messages
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();

    if (type === 'error') {
      consoleErrors.push(text);
      console.log(`[Browser Error] ${text}`);
    } else if (type === 'warning') {
      consoleWarnings.push(text);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    consoleErrors.push(error.message);
    console.log(`[Page Error] ${error.message}`);
  });
});

test.afterEach(async () => {
  if (testFolder && fs.existsSync(testFolder)) {
    fs.rmSync(testFolder, { recursive: true, force: true });
  }
});

test.describe('Image Loading', () => {
  test('should load images without WebGPU errors', async ({ page, electronApp }) => {
    // Mock the file dialog
    await electronApp.evaluate(async ({ dialog }, folderPath) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [folderPath]
      });
    }, testFolder);

    // Open folder
    await page.locator('#openFolder').click();

    // Wait for WebGPU to initialize and image to render
    await page.waitForFunction(() => {
      const canvas = document.getElementById('mainImage');
      return canvas && canvas.width > 0 && canvas.height > 0;
    }, {}, { timeout: 10000 });

    // Check that image counter shows we loaded images
    const imageCounter = await page.locator('#imageCounter').textContent();
    expect(imageCounter).toContain('1 / 3');

    // Wait a bit more to ensure all GPU operations complete
    await page.waitForTimeout(1000);

    // Check for WebGPU-related errors
    const webgpuErrors = consoleErrors.filter(err =>
      err.includes('WebGPU') ||
      err.includes('copyExternalImageToTexture') ||
      err.includes('Copy rect is out of bounds') ||
      err.includes('Failed to copy bitmap to texture')
    );

    // Log all errors for debugging
    if (consoleErrors.length > 0) {
      console.log('\n=== All Console Errors ===');
      consoleErrors.forEach(err => console.log(err));
      console.log('=========================\n');
    }

    // Assert no WebGPU errors occurred
    expect(webgpuErrors).toEqual([]);

    // Also check that we don't have a general error state showing
    const emptyState = page.locator('#emptyState');
    await expect(emptyState).not.toBeVisible();
  });

  test('should navigate between images without errors', async ({ page, electronApp }) => {
    // Mock the file dialog
    await electronApp.evaluate(async ({ dialog }, folderPath) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [folderPath]
      });
    }, testFolder);

    // Open folder
    await page.locator('#openFolder').click();

    // Wait for WebGPU to initialize and image to render
    await page.waitForFunction(() => {
      const canvas = document.getElementById('mainImage');
      return canvas && canvas.width > 0 && canvas.height > 0;
    }, {}, { timeout: 10000 });

    // Navigate through images
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(500);
    }

    // Wait for GPU operations to complete
    await page.waitForTimeout(1000);

    // Check for WebGPU-related errors during navigation
    const webgpuErrors = consoleErrors.filter(err =>
      err.includes('WebGPU') ||
      err.includes('copyExternalImageToTexture') ||
      err.includes('Copy rect is out of bounds') ||
      err.includes('Failed to copy bitmap to texture')
    );

    // Log all errors for debugging
    if (consoleErrors.length > 0) {
      console.log('\n=== All Console Errors (Navigation) ===');
      consoleErrors.forEach(err => console.log(err));
      console.log('=======================================\n');
    }

    // Assert no WebGPU errors occurred during navigation
    expect(webgpuErrors).toEqual([]);
  });
});
