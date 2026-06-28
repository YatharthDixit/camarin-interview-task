import { describe, it, expect, vi } from 'vitest';

// Mock env
vi.mock('../lib/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    HF_API_KEY: 'test-key',
    GOOGLE_VISION_API_KEY: 'test-api-key',
    R2_ACCOUNT_ID: 'test',
    R2_ACCESS_KEY_ID: 'test',
    R2_SECRET_ACCESS_KEY: 'test',
    R2_BUCKET: 'test',
    R2_ENDPOINT: 'https://test.r2.cloudflarestorage.com',
    BLIP_FALLBACK_MAX_CONCURRENT: 2,
  },
}));

// Mock logger
vi.mock('../lib/logger.js', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return {
    logger: mockLogger,
    createJobLogger: vi.fn().mockReturnValue(mockLogger),
  };
});

// Mock db services
vi.mock('@camarin/db', () => ({
  markProcessing: vi.fn(),
  markFailed: vi.fn(),
  markFlaggedCompleted: vi.fn().mockResolvedValue({ id: 'job-1' }),
  markCaptionedCompleted: vi.fn().mockResolvedValue({ id: 'job-1' }),
}));

// Mock R2
vi.mock('../lib/r2.js', () => ({
  downloadFromR2: vi.fn().mockResolvedValue(Buffer.from('fake-image')),
}));

// Mock resize
vi.mock('../lib/resize.js', () => ({
  resizeForAI: vi.fn().mockImplementation((buf: Buffer) => Promise.resolve(buf)),
}));

// Mock publisher
vi.mock('../lib/publisher.js', () => ({
  publishJobUpdate: vi.fn(),
  closePublisher: vi.fn(),
}));

import { analyzeImage } from '../providers/google-vision.js';
import { captionImage } from '../providers/huggingface.js';

describe('Google Vision provider', () => {
  it('should detect flagged content when LIKELY', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        responses: [
          {
            labelAnnotations: [
              { description: 'person', score: 0.95 },
              { description: 'photo', score: 0.8 },
            ],
            safeSearchAnnotation: {
              adult: 'LIKELY',
              spoof: 'UNLIKELY',
              medical: 'UNLIKELY',
              violence: 'UNLIKELY',
              racy: 'UNLIKELY',
            },
          },
        ]
      }),
    });

    const { createJobLogger } = await import('../lib/logger.js');
    const log = createJobLogger('test-job');

    const result = await analyzeImage(Buffer.from('test'), log);

    expect(result.safeSearch.isFlagged).toBe(true);
    expect(result.safeSearch.flaggedCategory).toBe('adult');
    expect(result.labels).toHaveLength(2);
    expect(result.labels[0]?.description).toBe('person');
  });

  it('should pass safe content', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        responses: [
          {
            labelAnnotations: [{ description: 'cat', score: 0.99 }],
            safeSearchAnnotation: {
              adult: 'VERY_UNLIKELY',
              spoof: 'UNLIKELY',
              medical: 'UNLIKELY',
              violence: 'VERY_UNLIKELY',
              racy: 'UNLIKELY',
            },
          },
        ]
      }),
    });

    const { createJobLogger } = await import('../lib/logger.js');
    const log = createJobLogger('test-job');

    const result = await analyzeImage(Buffer.from('test'), log);

    expect(result.safeSearch.isFlagged).toBe(false);
    expect(result.safeSearch.flaggedCategory).toBeNull();
  });
});

describe('HuggingFace provider', () => {
  it('should return caption on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ choices: [{ message: { content: 'a cat sitting on a mat' } }] }),
    });

    const { createJobLogger } = await import('../lib/logger.js');
    const log = createJobLogger('test-job');

    const caption = await captionImage(Buffer.from('test'), log);
    expect(caption).toBe('a cat sitting on a mat');
  });

  it('should retry on 503 and succeed on 3rd attempt', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 2) {
        return Promise.resolve({
          ok: false,
          status: 503,
          // estimated_time: 0.001 → 1ms sleep so test stays fast
          json: () => Promise.resolve({ error: 'Model loading', estimated_time: 0.001 }),
          text: () => Promise.resolve('503'),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ choices: [{ message: { content: 'test caption' } }] }),
      });
    });

    const { createJobLogger } = await import('../lib/logger.js');
    const log = createJobLogger('test-job');

    const caption = await captionImage(Buffer.from('test'), log);
    expect(caption).toBe('test caption');
    expect(callCount).toBe(3);
  });

  it('should throw after 3 failed attempts', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: 'Model loading', estimated_time: 0.001 }),
      text: () => Promise.resolve('503'),
    });

    const { createJobLogger } = await import('../lib/logger.js');
    const log = createJobLogger('test-job');

    await expect(captionImage(Buffer.from('test'), log)).rejects.toThrow(
      /failed after 3 attempts/,
    );
  });
});
