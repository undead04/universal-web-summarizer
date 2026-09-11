export type SummaryLength = 'short' | 'medium' | 'long';
export type Language = 'vi' | 'en' | 'auto';
export type OutputFormat = 'paragraph' | 'bullet_points';

export interface ActorInput {
  url: string;
  summaryLength: SummaryLength;
  language: Language;
  outputFormat: OutputFormat;
}

export interface FetchedPage {
  html: string;
  source: 'http' | 'playwright';
}

export interface Article {
  title: string;
  text: string;
}

export interface LlmResult {
  summary: string;
  usage: Record<string, unknown> | null;
  model: string;
}

export interface SuccessOutput {
  url: string;
  title: string;
  summary: string;
  wordCount: number;
  processingTimeMs: number;
  usage: Record<string, unknown> | null;
  model: string;
  fetchSource: FetchedPage['source'];
}