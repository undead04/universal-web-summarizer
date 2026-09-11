const LENGTH_INSTRUCTIONS = {
  short: 'Summarize in 2-4 concise sentences.',
  medium: 'Summarize in 1-2 focused paragraphs, covering the main claims and important details.',
  long: 'Summarize in 4-7 paragraphs with enough detail to preserve the argument, evidence, and conclusions.',
} as const;

import type { Article, Language, LlmResult, OutputFormat, SummaryLength } from './types.js';

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

  if (process.env.GEMINI_API_KEY) return summarizeWithGemini(prompt);
  if (process.env.OPENAI_API_KEY) return summarizeWithOpenAi(prompt);
  throw new Error('GEMINI_API_KEY or OPENAI_API_KEY is required');
}

async function summarizeWithGemini(prompt: string): Promise<LlmResult> {
  const apiKey = process.env.GEMINI_API_KEY as string;
  const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const data = await requestWithRetry(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } }),
  });
  const summary = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
  if (!summary) throw new Error('Gemini returned an empty summary');
  return { summary, usage: data.usageMetadata || null, model };
}

async function summarizeWithOpenAi(prompt: string): Promise<LlmResult> {
  const apiKey = process.env.OPENAI_API_KEY as string;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const endpoint = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions';
  const data = await requestWithRetry(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0.2, messages: [{ role: 'user', content: prompt }] }),
  });
  const summary = data.choices?.[0]?.message?.content?.trim();
  if (!summary) throw new Error('OpenAI returned an empty summary');
  return { summary, usage: data.usage || null, model };
}

interface ProviderResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: Record<string, unknown>;
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
      if (!response.ok) throw new Error(data.error?.message || data.error?.status || `LLM request failed (${response.status})`);
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