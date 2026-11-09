import { expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function noHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw, 'page should not scroll sideways').toBeLessThanOrEqual(cw + 1);
}

async function makeBill(page: Page, token: string) {
  const res = await page.request.post('/api/bills', {
    headers: { 'x-device-token': token },
    data: {
      title: 'Playwright dinner',
      currency: 'INR',
      hostName: 'Asha',
      hostUpiId: 'asha.test@okaxis',
      source: 'receipt',
      items: [
        { name: 'Paneer Tikka', amountMinor: 32000 },
        { name: 'Dal Makhani', amountMinor: 28000 },
        { name: 'Butter Naan', amountMinor: 16000, qty: 4 },
      ],
      charges: [{ type: 'tax', label: 'GST 5%', amountMinor: 3800 }],
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).bill.slug as string;
}

test('home, download and 404 pages render cleanly', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole('link', { name: 'Get the app' }).click();
  await expect(page).toHaveURL(/\/download/);
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible();
  await noHorizontalScroll(page);
  const res = await page.goto('/b/zzzzzz');
  expect(res?.status()).toBe(404);
  await expect(page.getByText('We couldn’t find that page')).toBeVisible();
  expect(errors.filter((e) => !/404/.test(e))).toEqual([]);
});

test('guest joins, claims, sees UPI and marks paid; host confirms', async ({ page }) => {
  const errors = trackErrors(page);
  const host = `pw-host-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const slug = await makeBill(page, host);
  try {
    await page.goto(`/b/${slug}`);
    await noHorizontalScroll(page);
    await page.getByPlaceholder('Your name').fill('Meena');
    await page.getByRole('button', { name: 'Start claiming' }).click();
    await expect(page.getByText(/Hi Meena/)).toBeVisible();

    await page.getByRole('button', { name: /Paneer Tikka/ }).click();
    await expect(page.getByRole('button', { name: /Paneer Tikka/ })).toHaveAttribute('aria-pressed', 'true');
    // ₹320 plus its share of tax: 3800 * 320/760 = 1600 paise
    await expect(page.getByText('₹336.00').first()).toBeVisible({ timeout: 8000 });

    const pay = page.getByRole('link', { name: /Pay ₹336.00 via UPI/ });
    await expect(pay).toHaveAttribute('href', /^upi:\/\/pay\?pa=asha\.test%40okaxis&pn=Asha&am=336\.00&cu=INR/);
    await page.getByRole('button', { name: 'Pay from another phone' }).click();
    await expect(page.getByRole('img', { name: /UPI QR code/ })).toBeVisible();

    await page.getByRole('button', { name: 'I’ve paid' }).click();
    await expect(page.getByText('Marked paid').first()).toBeVisible();

    // The host (another device) sees the claim and confirms the payment.
    const view = await (await page.request.get(`/api/bills/${slug}`, { headers: { 'x-device-token': host } })).json();
    const meena = view.bill.participants.find((p: { name: string }) => p.name === 'Meena');
    expect(view.bill.items[0].claimedBy).toContain(meena.id);
    const ok = await page.request.patch(`/api/settlements/${meena.settlementId}`, { headers: { 'x-device-token': host }, data: { status: 'confirmed' } });
    expect(ok.ok()).toBeTruthy();
    await expect(page.getByText('Confirmed').first()).toBeVisible({ timeout: 8000 });
    await noHorizontalScroll(page);
    expect(errors).toEqual([]);
  } finally {
    await page.request.delete(`/api/bills/${slug}`, { headers: { 'x-device-token': host } });
  }
});

test('demo trip shows balances, settle-up and the timeline', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/t/goa26');
  await expect(page.getByRole('heading', { name: 'Goa, Dec 2026' })).toBeVisible();
  await expect(page.getByText('Demo data')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Settle up' })).toBeVisible();
  await expect(page.getByText(/pays/).first()).toBeVisible();
  await expect(page.getByText('Already paid (1)')).toBeVisible();
  await expect(page.getByText('Zomato biryani run')).toBeVisible();
  await expect(page.getByText('Parasailing at Calangute')).toBeVisible();
  await noHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('USD bill formats dollars and hides UPI; JPY has no decimals', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/b/tacos26');
  await expect(page.getByText('$16.00').first()).toBeVisible();
  await expect(page.getByText('Not claimed yet')).toBeVisible();
  await expect(page.getByText(/via UPI/)).toHaveCount(0);
  await page.goto('/b/sushi26');
  await expect(page.getByText('¥4,800').first()).toBeVisible();
  await expect(page.getByText('Not claimed yet')).toHaveCount(0);
  await noHorizontalScroll(page);
  expect(errors).toEqual([]);
});

test('assetlinks lists the release certificate', async ({ request }) => {
  const res = await request.get('/.well-known/assetlinks.json');
  expect(res.ok()).toBeTruthy();
  const j = await res.json();
  expect(j[0].target.package_name).toBe('app.tabby.split');
  expect(j[0].target.sha256_cert_fingerprints[0]).toMatch(/^2F:D6:EE/);
});
