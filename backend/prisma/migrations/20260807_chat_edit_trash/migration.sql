-- Add message edit fields and trash archive table
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "is_edited" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "edited_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "message_trash" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "deleted_by_id" TEXT NOT NULL,
    "for_everyone" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_trash_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "message_trash_message_id_idx" ON "message_trash"("message_id");
CREATE INDEX IF NOT EXISTS "message_trash_conversation_id_idx" ON "message_trash"("conversation_id");
CREATE INDEX IF NOT EXISTS "message_trash_deleted_by_id_idx" ON "message_trash"("deleted_by_id");
