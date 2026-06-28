import { UnrecoverableError } from 'bullmq';
import type { Logger } from 'pino';
import { env } from '../lib/env.js';

export interface SafeSearchResult {
  isFlagged: boolean;
  flaggedCategory: string | null;
  raw: Record<string, string>;
}

export interface LabelResult {
  description: string;
  score: number;
}

export interface VisionAnalysis {
  labels: LabelResult[];
  safeSearch: SafeSearchResult;
}

const FLAGGED_THRESHOLDS = new Set(['LIKELY', 'VERY_LIKELY']);

const SAFE_SEARCH_CATEGORIES = [
  'adult',
  'spoof',
  'medical',
  'violence',
  'racy',
] as const;

/**
 * Single combined Vision API call: LABEL_DETECTION + SAFE_SEARCH_DETECTION.
 * One call instead of two — saves latency and cost.
 */
export async function analyzeImage(
  imageBuffer: Buffer,
  log: Logger,
): Promise<VisionAnalysis> {
  log.info('Calling Google Vision REST API (labels + safeSearch)');

  if (!env.GOOGLE_VISION_API_KEY) {
    throw new Error('GOOGLE_VISION_API_KEY is not set');
  }

  const url = `https://vision.googleapis.com/v1/images:annotate?key=${env.GOOGLE_VISION_API_KEY}`;
  
  const payload = {
    requests: [
      {
        image: { content: imageBuffer.toString('base64') },
        features: [
          { type: 'LABEL_DETECTION', maxResults: 15 },
          { type: 'SAFE_SEARCH_DETECTION' },
        ],
      },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error({ errorText, status: response.status }, 'Vision API call failed');
    if (response.status === 403 || response.status === 401) {
      throw new UnrecoverableError(`Google Vision API auth/billing error (${response.status}) — retrying won't help`);
    }
    throw new Error(`Google Vision API failed: ${response.statusText}`);
  }

  const data = (await response.json()) as any;
  const result = data.responses?.[0];

  if (!result) {
    throw new Error('Google Vision API returned no responses');
  }

  if (result.error) {
    const errorMsg = result.error.message || JSON.stringify(result.error);
    log.error({ error: result.error }, 'Vision API returned an error inside response');
    throw new Error(`Google Vision API error: ${errorMsg}`);
  }

  // Parse labels
  const labels: LabelResult[] = (result.labelAnnotations ?? []).map((l: any) => ({
    description: l.description ?? 'unknown',
    score: l.score ?? 0,
  }));

  // Parse SafeSearch
  const safeSearch = result.safeSearchAnnotation ?? {};
  const raw: Record<string, string> = {};
  let isFlagged = false;
  let flaggedCategory: string | null = null;

  for (const category of SAFE_SEARCH_CATEGORIES) {
    const value = String(safeSearch[category] ?? 'UNKNOWN');
    raw[category] = value;

    if (FLAGGED_THRESHOLDS.has(value) && !isFlagged) {
      isFlagged = true;
      flaggedCategory = category;
    }
  }

  log.info(
    { labelCount: labels.length, isFlagged, flaggedCategory },
    'Vision analysis complete',
  );

  return {
    labels,
    safeSearch: { isFlagged, flaggedCategory, raw },
  };
}
