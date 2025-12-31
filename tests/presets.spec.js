const { test, expect } = require('./fixtures');

test.describe('Preset Management', () => {
  test('should display preset categories', async ({ page }) => {
    await page.waitForTimeout(2000);
    const categories = await page.locator('.preset-category').count();
    expect(categories).toBeGreaterThan(0);
  });

  test('should toggle category visibility', async ({ page }) => {
    await page.waitForTimeout(2000);
    const firstCategory = page.locator('.preset-category').first();

    const isOpenBefore = await firstCategory.evaluate(el => el.open);
    expect(isOpenBefore).toBe(true);

    await firstCategory.locator('summary').click();
    await page.waitForTimeout(100);

    const isOpenAfter = await firstCategory.evaluate(el => el.open);
    expect(isOpenAfter).toBe(false);

    await firstCategory.locator('summary').click();
    await page.waitForTimeout(100);

    const isOpenAgain = await firstCategory.evaluate(el => el.open);
    expect(isOpenAgain).toBe(true);
  });

  test('should show strength slider', async ({ page }) => {
    const strengthSlider = page.locator('#presetStrengthSlider');
    await expect(strengthSlider).toBeVisible();

    const strengthValue = await strengthSlider.inputValue();
    expect(Number(strengthValue)).toBe(100);
  });
});
