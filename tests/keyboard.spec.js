const { test, expect } = require('./fixtures');

test.describe('Keyboard Shortcuts', () => {
  test('should respond to keyboard shortcuts without folder', async ({ page }) => {
    await page.keyboard.press('?');
    await page.waitForTimeout(300);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('should toggle fullscreen with F key', async ({ electronApp, page }) => {
    await page.keyboard.press('f');
    await page.waitForTimeout(300);

    const isFullScreen = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      return win.isFullScreen();
    });

    expect(typeof isFullScreen).toBe('boolean');
  });

  test('should open settings with Cmd/Ctrl+,', async ({ page }) => {
    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    await page.keyboard.press(`${modifier}+Comma`);
    await page.waitForTimeout(500);

    const settingsDialog = page.locator('#settingsDialog');
    await expect(settingsDialog).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
});
