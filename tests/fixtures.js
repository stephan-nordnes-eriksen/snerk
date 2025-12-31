const { test: base, _electron: electron } = require('@playwright/test');
const path = require('path');

exports.test = base.extend({
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: [path.join(__dirname, '..', 'main.js')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    await use(app);
    await app.close();
  },

  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await use(page);
  },
});

exports.expect = base.expect;
