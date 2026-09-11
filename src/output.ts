import { Actor } from 'apify';
import type { SuccessOutput } from './types.js';

export async function pushSuccess(output: SuccessOutput): Promise<void> {
  await Actor.pushData({
    url: output.url,
    status: 'success',
    title: output.title,
    summary: output.summary,
    wordCount: output.wordCount,
    processingTimeMs: output.processingTimeMs,
    llm: { model: output.model, usage: output.usage },
    fetchSource: output.fetchSource,
  });
}

export async function pushError({ url, errorMessage, processingTimeMs }: { url: string | null; errorMessage: string; processingTimeMs: number }): Promise<void> {
  await Actor.pushData({ url, status: 'error', errorMessage, processingTimeMs });
}