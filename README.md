# Universal Web Summarizer

Apify Actor v1 that accepts one URL, extracts its main article content, and returns an LLM summary in the Apify Dataset.

## Local setup

```powershell
npm install
$env:OPENROUTER_API_KEY = "your-key"
npm start
```

`npm start` builds the TypeScript source into `dist/` before starting the Actor. Use `npm run dev` for a direct local TypeScript run.

For Playwright fallback, install its browser once with `npx playwright install chromium`.

The input is read from Apify Actor input. For local runs, create `storage/key_value_stores/default/INPUT.json`:

```json
{
  "url": "https://example.com/article",
  "summaryLength": "short",
  "language": "vi",
  "outputFormat": "bullet_points"
}
```

The Actor uses your OpenRouter account key from `OPENROUTER_API_KEY`. The default model is `openrouter/free`; override it with `OPENROUTER_MODEL`. Free routing still has provider rate limits and availability limits, but the user does not need to enter an API key.

## Pipeline

`src/fetch.ts` tries `got-scraping` first and falls back to Playwright. `src/extract.ts` uses Mozilla Readability. `src/summarize.ts` handles the prompt and retry policy. `src/output.ts` writes a stable success or error record to the Dataset.

`wordCount` is the number of words extracted from the source article. LLM usage is included under `llm` for cost tracking.

## Deploy to Apify

1. Create an Actor and connect this repository, or build it from the project directory.
2. Set the Actor build/start commands to `npm install` and `npm start`; `npm start` runs the TypeScript build before starting `dist/main.js`.
3. Set `OPENROUTER_API_KEY` as a secret environment variable and keep it private.
4. Optionally set `OPENROUTER_MODEL` (default: `openrouter/free`).
5. Set the Actor input schema to `.actor/input_schema.json`.
6. Run the five smoke cases in the plan: static article, blog, news page, SPA, and a blocked or invalid URL.