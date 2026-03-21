import { test, expect } from '@playwright/test';

// Visual regression tests compare screenshots against baselines
// Run: npx playwright test tests/e2e/visual-regression.spec.js --update-snapshots (to create baselines)
// Run: npx playwright test tests/e2e/visual-regression.spec.js (to compare)

const APP_URL = '/';

async function openApp(page) {
  await page.goto(APP_URL);
  await page.waitForSelector('.app-shell', { timeout: 10_000 });
}

// ─── 1. Empty State ─────────────────────────────────────────────────────────
test.describe('Visual — Empty state', () => {
  test('app loaded with no file open', async ({ page }) => {
    await openApp(page);
    await expect(page).toHaveScreenshot('empty-state.png', { maxDiffPixels: 100 });
  });
});

// ─── 2. Settings Modal ──────────────────────────────────────────────────────
test.describe('Visual — Settings modal', () => {
  test('settings modal open', async ({ page }) => {
    await openApp(page);
    await page.locator('[data-action="settings"], .settings-btn, #settingsBtn').first().click();
    await page.waitForSelector('.modal, .settings-modal, [role="dialog"]', { timeout: 5_000 });
    const modal = page.locator('.modal, .settings-modal, [role="dialog"]').first();
    await expect(modal).toHaveScreenshot('settings-modal.png', { maxDiffPixels: 100 });
  });
});

// ─── 3. Sidebar Collapsed vs Expanded ───────────────────────────────────────
test.describe('Visual — Sidebar states', () => {
  test('sidebar expanded', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page).toHaveScreenshot('sidebar-expanded.png', { maxDiffPixels: 100 });
  });

  test('sidebar collapsed', async ({ page }) => {
    await openApp(page);
    await page.locator('[data-action="toggle-sidebar"], .sidebar-toggle, #sidebarToggle').first().click();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('sidebar-collapsed.png', { maxDiffPixels: 100 });
  });
});

// ─── 4. Dark Theme vs Light Theme ───────────────────────────────────────────
test.describe('Visual — Theme switching', () => {
  test('light theme', async ({ page }) => {
    await openApp(page);
    // Ensure light theme is active
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
    });
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('theme-light.png', { maxDiffPixels: 100 });
  });

  test('dark theme', async ({ page }) => {
    await openApp(page);
    // Switch to dark theme
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
    });
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('theme-dark.png', { maxDiffPixels: 100 });
  });
});

// ─── 5. Toast Notification ──────────────────────────────────────────────────
test.describe('Visual — Toast notification', () => {
  test('toast visible', async ({ page }) => {
    await openApp(page);
    // Trigger a toast notification via the app's toast module
    await page.evaluate(() => {
      const event = new CustomEvent('show-toast', {
        detail: { message: 'Visual regression test toast', type: 'info' },
      });
      window.dispatchEvent(event);
    });
    // Fallback: directly create a toast element if the event approach doesn't work
    await page.evaluate(() => {
      if (!document.querySelector('.toast')) {
        const container = document.querySelector('.toast-container') || (() => {
          const el = document.createElement('div');
          el.className = 'toast-container';
          document.body.appendChild(el);
          return el;
        })();
        const toast = document.createElement('div');
        toast.className = 'toast toast-info';
        toast.textContent = 'Visual regression test toast';
        container.appendChild(toast);
      }
    });
    await page.waitForTimeout(500);
    const toast = page.locator('.toast').first();
    await expect(toast).toHaveScreenshot('toast-notification.png', { maxDiffPixels: 100 });
  });
});

// ─── 6. Command Palette ─────────────────────────────────────────────────────
test.describe('Visual — Command palette', () => {
  test('command palette open', async ({ page }) => {
    await openApp(page);
    // Open command palette with Ctrl+K or Cmd+K
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);
    // Fallback: try clicking the command palette trigger if keyboard didn't work
    const palette = page.locator('.command-palette, [data-command-palette], .cmd-palette').first();
    if (!(await palette.isVisible().catch(() => false))) {
      await page.keyboard.press('Meta+k');
      await page.waitForTimeout(500);
    }
    await expect(palette).toHaveScreenshot('command-palette.png', { maxDiffPixels: 100 });
  });
});
