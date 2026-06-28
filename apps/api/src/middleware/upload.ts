import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { fileTypeFromBuffer } from 'file-type';
import { ValidationError } from '../lib/errors.js';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Multer config: memory storage, 5MB limit, single file field 'image'
 */
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('image');

/**
 * Combined middleware: multer parsing + magic-byte validation.
 * Rejects renamed .exe or any non-image file regardless of claimed Content-Type.
 */
export function uploadMiddleware(req: Request, res: Response, next: NextFunction): void {
  multerUpload(req, res, async (err) => {
    if (err) {
      next(err);
      return;
    }

    if (!req.file) {
      next(new ValidationError('No image file provided'));
      return;
    }

    try {
      // Validate actual file content via magic bytes — never trust headers
      const fileType = await fileTypeFromBuffer(req.file.buffer);

      if (!fileType || !ALLOWED_MIME_TYPES.has(fileType.mime)) {
        next(
          new ValidationError(
            `Invalid file type. Accepted: JPG, PNG, WEBP. Detected: ${fileType?.mime ?? 'unknown'}`,
          ),
        );
        return;
      }

      // Override multer's MIME type with the verified one
      req.file.mimetype = fileType.mime;

      // Attach the verified extension for use in the controller
      (req.file as Express.Multer.File & { verifiedExt: string }).verifiedExt =
        MIME_TO_EXT[fileType.mime] ?? fileType.ext;

      next();
    } catch (parseErr) {
      next(parseErr);
    }
  });
}
