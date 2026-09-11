import { Actor } from 'apify';
import { extractArticle } from './extract.js';
import { fetchPage } from './fetch.js';
import { pushError, pushSuccess } from './output.js';
import { summarizeArticle } from './summarize.js';
import type { ActorInput } from './types.js';

const DEFAULTS: Omit<ActorInput, 'url'> = { summaryLength: 'medium', language: 'auto', outputFormat: 'paragraph' };

await Actor.init();
const startedAt = Date.now();
const input = { ...DEFAULTS, ...(await Actor.getInput<Partial<ActorInput>>() || {}) };
let url: string | null = input.url || null;

try {
  url = validateUrl(url);
  const page = await fetchPage(url);
  const article = extractArticle(page.html, url);
  const result = await summarizeArticle({ ...article, ...input });
  await pushSuccess({
    url,
    title: article.title,
    summary: result.summary,
    wordCount: article.text.split(/\s+/).filter(Boolean).length,
    processingTimeMs: Date.now() - startedAt,
    usage: result.usage,
    model: result.model,
    fetchSource: page.source,
  });
} catch (error: unknown) {
  console.error(error);
  await pushError({ url, errorMessage: getErrorMessage(error), processingTimeMs: Date.now() - startedAt });
} finally {
  await Actor.exit();
}

function validateUrl(value: string | null): string {
  if (!value?.trim()) throw new Error('Input url is required');
  const parsed = new URL(value);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('URL must use http or https');
  return parsed.toString();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}