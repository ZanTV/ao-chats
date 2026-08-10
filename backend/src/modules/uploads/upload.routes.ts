import { Router, Response } from 'express';
import multer from 'multer';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { asyncHandler, AppError } from '../../middleware/errorHandler';
import { uploadService } from './upload.service';
import { UPLOAD_LIMITS } from '../../utils/attachment';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Math.max(
      UPLOAD_LIMITS.maxImageBytes,
      UPLOAD_LIMITS.maxVideoBytes,
      UPLOAD_LIMITS.maxDocumentBytes
    ),
  },
});

async function streamStoredFile(req: AuthRequest, res: Response, storageKey: string) {
  await uploadService.assertCanAccessFile(req.userId!, storageKey);

  const rangeHeader =
    typeof req.headers.range === 'string' ? req.headers.range : undefined;

  const file = await uploadService.openStoredFile(storageKey, rangeHeader);

  res.status(file.statusCode);
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${file.fileName.replace(/"/g, '')}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  if (file.acceptRanges) {
    res.setHeader('Accept-Ranges', 'bytes');
  }
  if (file.contentLength) {
    res.setHeader('Content-Length', file.contentLength);
  } else if (file.size != null) {
    res.setHeader('Content-Length', String(file.size));
  }
  if (file.contentRange) {
    res.setHeader('Content-Range', file.contentRange);
  }

  file.stream.pipe(res);
}

router.post(
  '/',
  authenticate,
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res) => {
    const file = req.file;
    if (!file) throw new AppError(400, 'No file uploaded.');

    const width = req.body?.width ? parseInt(String(req.body.width), 10) : undefined;
    const height = req.body?.height ? parseInt(String(req.body.height), 10) : undefined;
    const conversationId = req.body?.conversationId
      ? String(req.body.conversationId).trim()
      : undefined;

    try {
      const attachment = await uploadService.saveLocalUpload({
        uploaderId: req.userId!,
        buffer: file.buffer,
        originalName: file.originalname || 'file',
        mimeType: file.mimetype,
        width: Number.isFinite(width) ? width : undefined,
        height: Number.isFinite(height) ? height : undefined,
        conversationId,
      });
      res.status(201).json({ attachment });
    } catch (err) {
      if (err instanceof AppError) throw err;
      if ((err as { code?: string })?.code === 'LIMIT_FILE_SIZE') {
        throw new AppError(400, 'This file is too large to upload.');
      }
      throw err;
    }
  })
);

/** Primary download route — slash-safe for Agrohub keys (media/…, documents/…). */
router.get(
  '/files',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const raw = req.query.key;
    const storageKey =
      typeof raw === 'string' ? decodeURIComponent(raw.trim()) : '';
    if (!storageKey) throw new AppError(400, 'Missing file key');
    await streamStoredFile(req, res, storageKey);
  })
);

/** Legacy path route for older attachment URLs without query param. */
router.get(
  '/files/:storageKey',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const storageKey = decodeURIComponent(String(req.params.storageKey || ''));
    if (!storageKey) throw new AppError(400, 'Missing file key');
    await streamStoredFile(req, res, storageKey);
  })
);

export default router;
