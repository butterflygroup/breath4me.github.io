import { test, expect } from '@playwright/test';

/** Matches `DEFAULT_PAGE_TITLE` in app.js — keep tests in sync with product copy. */
const DEFAULT_PAGE_TITLE = 'Breathed with Daniel';

test.describe('Presets', () => {
  test('Box breathing loads 16s cycle', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('button', { name: /Load pattern: Box breathing/i })
      .click();
    await expect(page.locator('#cycle-total')).toContainText(/16/);
    await expect(page.locator('#session-timer-minutes')).toHaveValue('5');
    await expect(page.locator('#session-timer-seconds')).toHaveValue('0');
  });
});

test.describe('Pattern title & URL payload', () => {
  test('edited title syncs header and document title', async ({ page }) => {
    await page.goto('/');
    const custom = 'My Custom Pattern Title';
    await page.locator('#session-title').fill(custom);
    await page.locator('#session-title').blur();
    await expect(page.locator('#header-site-title')).toHaveText(custom);
    await expect(page).toHaveTitle(custom);
  });

  test('reset restores default rhythm and clears title and pattern details', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('button', { name: /Load pattern: Box breathing/i })
      .click();
    await expect(page.locator('#session-title')).toHaveValue('Box breathing');
    await page.locator('#share-description').fill('Note before reset.');
    await page.locator('#btn-reset-pattern').click();
    await expect(page.locator('#session-title')).toHaveValue('');
    await expect(page.locator('#share-description')).toHaveValue('');
    await expect(page.locator('#header-site-title')).toHaveText(
      DEFAULT_PAGE_TITLE,
    );
    await expect(page).toHaveTitle(DEFAULT_PAGE_TITLE);
    await expect(page.locator('#session-timer-minutes')).toHaveValue('5');
    await expect(page.locator('#session-timer-seconds')).toHaveValue('0');
  });

  test('URL q with t and d populates fields and header', async ({ page }) => {
    const payload = {
      v: 1,
      s: [['in', 3]],
      t: 'Deep link title',
      d: 'Deep link description.',
    };
    const q = encodeURIComponent(JSON.stringify(payload));
    await page.goto(`/?q=${q}`);
    await expect(page.locator('#session-title')).toHaveValue('Deep link title');
    await expect(page.locator('#share-description')).toHaveValue(
      'Deep link description.',
    );
    await expect(page.locator('#header-site-title')).toHaveText(
      'Deep link title',
    );
    await expect(page.locator('#session-timer-minutes')).toHaveValue('5');
    await expect(page.locator('#session-timer-seconds')).toHaveValue('0');
  });

  test('URL q with g sets session goal', async ({ page }) => {
    const payload = {
      v: 1,
      s: [['in', 3]],
      g: 125,
    };
    const q = encodeURIComponent(JSON.stringify(payload));
    await page.goto(`/?q=${q}`);
    await expect(page.locator('#session-timer-minutes')).toHaveValue('2');
    await expect(page.locator('#session-timer-seconds')).toHaveValue('5');
  });
});
