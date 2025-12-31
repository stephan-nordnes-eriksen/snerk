# Snerk Testing Guide

## Overview

This directory contains automated UI tests for Snerk using Playwright with Electron support.

## Running Tests

```bash
npm test              # Run all tests
npm run test:headed   # Run tests with visible browser
npm run test:debug    # Run tests in debug mode
npm run test:report   # Open HTML test report
```

## Test Structure

```
tests/
├── fixtures.js           # Electron app fixtures for launching app
├── helpers.js            # Test utilities (folder/file creation)
├── app.spec.js           # App launch and basic UI tests
├── presets.spec.js       # Preset management tests
├── keyboard.spec.js      # Keyboard shortcut tests
└── README.md            # This file
```

## Writing Tests

### Basic Test Structure

```javascript
const { test, expect } = require('./fixtures');

test.describe('Feature Name', () => {
  test('should do something', async ({ page, electronApp }) => {
    // Test code here
    await expect(page.locator('#someElement')).toBeVisible();
  });
});
```

### Available Fixtures

- `electronApp` - The Electron app instance
- `page` - The main window page

### Common Patterns

**Wait for element:**
```javascript
await expect(page.locator('#element')).toBeVisible();
```

**Click element:**
```javascript
await page.locator('#button').click();
```

**Check text content:**
```javascript
const text = await page.locator('#element').textContent();
expect(text).toBe('Expected Text');
```

**Keyboard shortcuts:**
```javascript
await page.keyboard.press('ArrowRight');
await page.keyboard.press('Meta+Comma'); // Cmd+,
```

**Evaluate in main process:**
```javascript
const value = await electronApp.evaluate(async ({ app }) => {
  return app.getPath('userData');
});
```

## Test Categories

### app.spec.js
Tests app launch, window creation, and basic UI elements.

### presets.spec.js
Tests preset loading, category toggling, search, and strength slider.

### keyboard.spec.js
Tests keyboard shortcuts and their effects.

## Best Practices

1. **Use waitForTimeout sparingly** - Prefer `waitForSelector` or `expect().toBeVisible()`
2. **Clean up test data** - Use helpers to create/cleanup test folders
3. **One assertion per test** - Keep tests focused and clear
4. **Use descriptive names** - Test names should explain what they verify
5. **Avoid brittle selectors** - Use IDs or data-testid attributes

## Debugging Tests

### View test run in browser:
```bash
npm run test:headed
```

### Debug specific test:
```bash
npx playwright test tests/app.spec.js --debug
```

### View test report:
```bash
npm run test:report
```

## CI/CD Integration

Tests are configured for CI environments with:
- 2 retries on failure
- Screenshot on failure
- Trace on first retry
- HTML report generation

Set `CI=true` environment variable to enable CI mode.

## Adding New Tests

1. Create new `.spec.js` file in tests directory
2. Import fixtures: `const { test, expect } = require('./fixtures')`
3. Write test cases using `test.describe()` and `test()`
4. Run tests to verify they pass
5. Commit test files

## Limitations

- Tests require Electron app to launch successfully
- No mock data - tests use actual preset files
- Image processing tests limited without real image files
- WebGPU tests may require GPU access

## Future Improvements

- Add visual regression testing
- Mock IPC communication for isolated tests
- Add performance benchmarks
- Test batch export functionality
- Add image comparison utilities
