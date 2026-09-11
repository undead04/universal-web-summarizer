import { gotScraping } from 'got-scraping';
import { chromium } from 'playwright';
import type { FetchedPage } from './types.js';

const FETCH_TIMEOUT_MS = 15_000;

export async function fetchPage(url: string): Promise<FetchedPage> {
  try {
    const response = await gotScraping({
      url,
      timeout: { request: FETCH_TIMEOUT_MS },
      retry: { limit: 1 },
      headers: { accept: 'text/html,application/xhtml+xml' },
    });

    if (isUsableHtml(response.body)) return { html: response.body, source: 'http' };
  } catch (error: unknown) {
    console.warn(`HTTP fetch failed: ${getErrorMessage(error)}`);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: FETCH_TIMEOUT_MS });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
    const html = await page.content();
    if (!isUsableHtml(html)) throw new Error('Rendered page contains no usable HTML');
    return { html, source: 'playwright' };
  } finally {
    await browser.close();
  }
}

function isUsableHtml(html: string): boolean {
  return html.length > 200 && /<body[\s>]/i.test(html);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}