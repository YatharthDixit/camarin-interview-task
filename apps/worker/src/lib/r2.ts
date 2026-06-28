import {
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { env } from './env.js';

const s3 = new S3Client({
  region: 'auto',
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});



/** Download a file from R2 and return it as a Buffer */
export async function downloadFromR2(key: string): Promise<Buffer> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
  );

  if (!response.Body) {
    throw new Error(`R2: empty response body for key ${key}`);
  }

  // response.Body is a Readable stream — collect into buffer
  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
