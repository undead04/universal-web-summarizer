import 'dotenv/config';
import type { Article, Language, LlmResult, OutputFormat, SummaryLength } from './types.js';

const LENGTH_INSTRUCTIONS = {
  short: 'Summarize in 2-4 concise sentences.',
  medium: 'Summarize in 1-2 focused paragraphs, covering the main claims and important details.',
  long: 'Summarize in 4-7 paragraphs with enough detail to preserve the argument, evidence, and conclusions.',
} as const;



const LANGUAGE_NAMES: Record<Language, string> = { vi: 'Vietnamese', en: 'English', auto: 'the source language' };

export async function summarizeArticle({ title, text, summaryLength, language, outputFormat }: Article & {
  summaryLength: SummaryLength;
  language: Language;
  outputFormat: OutputFormat;
}): Promise<LlmResult> {
  const content = limitText(text, 40_000);
  const prompt = [
    `Summarize the following web article in ${LANGUAGE_NAMES[language]}.`,
    LENGTH_INSTRUCTIONS[summaryLength],
    outputFormat === 'bullet_points' ? 'Use bullet points, with one idea per line.' : 'Use plain paragraphs.',
    'Do not invent facts. Return only the summary.',
    `Title: ${title}\n\nArticle:\n${content}`,
  ].join('\n');

  return summarizeWithOpenRouter(prompt);
}

async function summarizeWithOpenRouter(prompt: string): Promise<LlmResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  const model = process.env.OPENROUTER_MODEL || 'openrouter/free';
  const endpoint = 'https://openrouter.ai/api/v1/chat/completions';

  const data = await requestWithRetry(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'http-referer': process.env.OPENROUTER_SITE_URL || 'https://apify.com',
      'x-title': process.env.OPENROUTER_APP_NAME || 'Universal Web Summarizer',
    },
    body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: 'user', content: prompt }] }),
  });
  const summary = data.choices?.[0]?.message?.content?.trim();
  if (!summary) throw new Error('OpenRouter returned an empty summary');
  return { summary, usage: data.usage || null, model };
}

interface ProviderResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: Record<string, unknown>;
  error?: { message?: string; status?: string };
}

async function requestWithRetry(endpoint: string, options: RequestInit): Promise<ProviderResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(endpoint, options);
      const data = await response.json() as ProviderResponse;
      if (!response.ok) {
        const message = data.error?.message || data.error?.status || `LLM request failed (${response.status})`;
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt === 0) {
          const retryAfter = Number(response.headers.get('retry-after') || 0);
          const delayMs = retryAfter > 0 ? retryAfter * 1000 : 2_000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        throw new Error(`OpenRouter ${response.status}: ${message}${response.status === 429 ? ' (free model is rate-limited; try again later or set OPENROUTER_MODEL to another free model)' : ''}`);
      }
      return data;
    } catch (error: unknown) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function limitText(text: string, maxCharacters: number): string {
  if (text.length <= maxCharacters) return text;
  return `${text.slice(0, maxCharacters)}\n\n[Article truncated to fit the model context.]`;
}