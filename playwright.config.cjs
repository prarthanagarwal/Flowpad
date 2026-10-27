const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests', testMatch: '**/*.spec.cjs', workers: 1, timeout: 30000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { trace: 'retain-on-failure' }
});
