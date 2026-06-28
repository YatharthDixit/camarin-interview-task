import sharp from 'sharp';

const MAX_DIMENSION = 1568;

/**
 * Resize image for AI API consumption.
 * Caps the long edge at 1568px — smaller payload, faster upload to Vision/HF.
 * The full-resolution original stays untouched in R2.
 */
export async function resizeForAI(buffer: Buffer): Promise<Buffer> {
  // Always output JPEG — caps dimensions AND normalizes format so callers
  // can rely on a consistent MIME type (image/jpeg) without inspecting the buffer.
  return sharp(buffer)
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}
