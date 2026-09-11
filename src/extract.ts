import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import type { Article } from './types.js';

export function extractArticle(html: string, url: string): Article {
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();
  if (!article?.textContent?.trim()) throw new Error('Could not extract the main article content');

  return {
    title: article.title?.trim() || dom.window.document.title || '',
    text: cleanText(article.textContent),
  };
}

function cleanText(text: string): string {
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}