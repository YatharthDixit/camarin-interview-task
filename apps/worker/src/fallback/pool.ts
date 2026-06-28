import { logger } from '../lib/logger.js';
import type { LabelResult } from '../providers/google-vision.js';

export function fallbackCaption(labels: LabelResult[]): string {
  logger.warn('HuggingFace unavailable — generating caption from Vision labels');

  const top = labels
    .filter((l) => l.score >= 0.7)
    .slice(0, 5)
    .map((l) => l.description.toLowerCase());

  if (top.length === 0) return 'an image';
  if (top.length === 1) return `an image of ${top[0]}`;

  const last = top.pop()!;
  return `an image of ${top.join(', ')}, and ${last}`;
}
