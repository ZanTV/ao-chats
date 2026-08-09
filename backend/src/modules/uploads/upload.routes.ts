import { Router } from 'express';
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

router.post(
  '/',
  authenticate,
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res) => {
    const file = req.file;
    if (!file) throw new AppError(400, 'No file uploaded.');

    const width = req.body?.width ? parseInt(String(req.body.width), 10) : undefined;
    const height = req.body?.height ? parseInt(String(req.body.height), 10) : undefined;

    try {
      const attachment = await uploadService.saveLocalUpload({
        uploaderId: req.userId!,
        buffer: file.buffer,
        originalName: file.originalname || 'file',
        mimeType: file.mimetype,
        width: Number.isFinite(width) ? width : undefined,
        height: Number.isFinite(height) ? height : undefined,
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

router.get(
  '/files/:storageKey',
  authenticate,
  asyncHandler(async (req: AuthRequest, res) => {
    const storageKey = decodeURIComponent(String(req.params.storageKey || ''));
    if (!storageKey) throw new AppError(400, 'Missing file key');

    await uploadService.assertCanAccessFile(req.userId!, storageKey);
    const { stream, size, mimeType, fileName } = uploadService.getFileStream(storageKey);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', String(size));
    res.setHeader('Content-Disposition', `inline; filename="${fileName.replace(/"/g, '')}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    stream.pipe(res);
  })
);

export default router;
