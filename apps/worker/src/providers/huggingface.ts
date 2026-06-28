import type { Logger } from 'pino';
import { env } from '../lib/env.js';

// Llama-3.2-11B-Vision-Instruct has no providers left (inferenceProviderMapping:{}).
// Qwen3-VL-8B-Instruct is live on Novita (image-text-to-text, 571ms TTFT).
const HF_CHAT_URL = 'https://router.huggingface.co/v1/chat/completions';
const VLM_MODEL = 'Qwen/Qwen3-VL-8B-Instruct:novita';
const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function captionImage(imageBuffer: Buffer, log: Logger): Promise<string> {
  log.info('Calling HuggingFace VLM captioning API');

  // resizeForAI already normalizes to JPEG — safe to hardcode the MIME type
  const base64 = imageBuffer.toString('base64');

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(HF_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VLM_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
              { type: 'text', text: 'Describe this image in one concise sentence.' },
            ],
          },
        ],
        max_tokens: 100,
      }),
    });

    if (response.status === 503 || response.status === 429) {
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(`HuggingFace captioning failed after ${MAX_ATTEMPTS} attempts`);
      }

      let sleepMs = 5_000;
      try {
        const body = (await response.json()) as { estimated_time?: number };
        if (body.estimated_time) sleepMs = Math.max(body.estimated_time * 1000, 1_000);
      } catch {
        // ignore parse errors — use default sleep
      }

      log.warn({ attempt, sleepMs }, 'HuggingFace returned 503/429 — retrying');
      await sleep(sleepMs);
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown');
      throw new Error(`HuggingFace captioning failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as { choices: { message: { content: string } }[] };
    const caption = data.choices?.[0]?.message?.content?.trim();

    if (!caption) throw new Error('HuggingFace VLM returned empty caption');

    log.info({ caption: caption.substring(0, 80) }, 'Caption generated');
    return caption;
  }

  throw new Error(`HuggingFace captioning failed after ${MAX_ATTEMPTS} attempts`);
}
