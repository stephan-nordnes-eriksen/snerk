const { test, expect } = require('./fixtures');

test.describe('Preset Management', () => {
  test('should display preset categories', async ({ page }) => {
    await page.waitForTimeout(1000);
    const categories = await page.locator('.preset-category').count();
    expect(categories).toBeGreaterThan(0);
  });

  test('should toggle category visibility', async ({ page }) => {
    await page.waitForTimeout(1000);
    const firstCategory = page.locator('.preset-category').first();
    const categoryName = await firstCategory.locator('.category-name').textContent();

    await firstCategory.locator('.toggle-category-btn').click();

    const presetsVisible = await firstCategory.locator('.category-presets').isVisible();
    expect(presetsVisible).toBe(false);

    await firstCategory.locator('.toggle-category-btn').click();
    const presetsVisibleAgain = await firstCategory.locator('.category-presets').isVisible();
    expect(presetsVisibleAgain).toBe(true);
  });

  test('should search presets', async ({ page }) => {
    await page.waitForTimeout(1000);
    const searchInput = page.locator('#presetSearch');
    await searchInput.fill('modern');

    await page.waitForTimeout(500);

    const visiblePresets = await page.locator('.preset-item:visible').count();
    expect(visiblePresets).toBeGreaterThan(0);

    const allPresets = await page.locator('.preset-item').count();
    expect(visiblePresets).toBeLessThanOrEqual(allPresets);
  });

  test('should show strength slider', async ({ page }) => {
    const strengthSlider = page.locator('#presetStrength');
    await expect(strengthSlider).toBeVisible();

    const strengthValue = await strengthSlider.inputValue();
    expect(Number(strengthValue)).toBe(100);
  });
});
