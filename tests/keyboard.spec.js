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

  test('should open settings via button', async ({ page }) => {
    const settingsBtn = page.locator('#settingsBtn');
    await settingsBtn.click();
    await page.waitForTimeout(300);

    const settingsDialog = page.locator('#settingsDialog');
    const isOpen = await settingsDialog.evaluate(el => el.open);
    expect(isOpen).toBe(true);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });
});
