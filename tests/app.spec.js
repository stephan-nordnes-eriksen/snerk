const { test, expect } = require('./fixtures');

test.describe('App Launch', () => {
  test('should launch app successfully', async ({ electronApp }) => {
    expect(electronApp).toBeTruthy();
    const isPackaged = await electronApp.evaluate(async ({ app }) => {
      return app.isPackaged;
    });
    expect(isPackaged).toBe(false);
  });

  test('should show main window', async ({ page }) => {
    expect(page).toBeTruthy();
    const title = await page.title();
    expect(title).toBe('Snerk - Color Studio');
  });

  test('should have main UI elements', async ({ page }) => {
    await expect(page.locator('#openFolder')).toBeVisible();
    await expect(page.locator('#imageContainer')).toBeVisible();
    await expect(page.locator('#presetList')).toBeVisible();
  });

  test('should load default presets', async ({ page }) => {
    await page.waitForTimeout(1000);
    const presetCount = await page.locator('.preset-item').count();
    expect(presetCount).toBeGreaterThan(0);
  });

  test('should show empty state when no folder opened', async ({ page }) => {
    const emptyState = page.locator('#emptyState');
    await expect(emptyState).toBeVisible();
  });
});
