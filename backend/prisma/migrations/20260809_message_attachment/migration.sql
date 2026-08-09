-- Attachment metadata JSON on messages (binary files live in object/local storage)
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachment" JSONB;
