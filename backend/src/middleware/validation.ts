import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { formatValidationErrors } from '../modules/auth/auth.validation';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      res.status(400).json({
        error: formatValidationErrors(fieldErrors),
        code: 'VALIDATION_ERROR',
        details: fieldErrors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten().fieldErrors,
      });
      return;
    }
    req.query = result.data as typeof req.query;
    next();
  };
}

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, 5000);
}
