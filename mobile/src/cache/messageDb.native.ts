import * as SQLite from 'expo-sqlite';
import type { ChatMessage } from '../utils/messages';
import { mergeMessageFields } from '../utils/messageMerge';

const DB_NAME = 'ao_chats_messages.db';
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT NOT NULL,
          conversation_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL,
          PRIMARY KEY (conversation_id, id)
        );
        CREATE INDEX IF NOT EXISTS idx_messages_conv_created
          ON messages (conversation_id, created_at DESC);
      `);
      return db;
    });
  }
  return dbPromise;
}

function serializeMessage(message: ChatMessage): string {
  return JSON.stringify(message);
}

function parseMessage(raw: string): ChatMessage | null {
  try {
    return JSON.parse(raw) as ChatMessage;
  } catch {
    return null;
  }
}

export async function sqliteGetMessages(
  conversationId: string,
  limit?: number
): Promise<ChatMessage[]> {
  const db = await getDb();
  const sql = limit
    ? `SELECT payload FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?`
    : `SELECT payload FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`;
  const rows = limit
    ? await db.getAllAsync<{ payload: string }>(sql, conversationId, limit)
    : await db.getAllAsync<{ payload: string }>(sql, conversationId);

  return rows
    .map((r) => parseMessage(r.payload))
    .filter((m): m is ChatMessage => m !== null);
}

export async function sqliteGetLatestMessages(
  conversationId: string,
  limit: number
): Promise<ChatMessage[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ payload: string }>(
    `SELECT payload FROM messages
     WHERE conversation_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    conversationId,
    limit
  );
  return rows
    .map((r) => parseMessage(r.payload))
    .filter((m): m is ChatMessage => m !== null)
    .reverse();
}

export async function sqliteUpsertMessages(
  conversationId: string,
  messages: ChatMessage[]
): Promise<void> {
  if (messages.length === 0) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const msg of messages) {
      const row = await db.getFirstAsync<{ payload: string }>(
        `SELECT payload FROM messages WHERE conversation_id = ? AND id = ?`,
        conversationId,
        msg.id
      );
      const prev = row?.payload ? parseMessage(row.payload) : null;
      const next = prev ? mergeMessageFields(prev, msg) : msg;
      await db.runAsync(
        `INSERT OR REPLACE INTO messages (id, conversation_id, payload, created_at)
         VALUES (?, ?, ?, ?)`,
        next.id,
        conversationId,
        serializeMessage(next),
        next.createdAt
      );
    }
  });
}

export async function sqliteDeleteMessages(
  conversationId: string,
  messageIds: string[]
): Promise<void> {
  if (messageIds.length === 0) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const id of messageIds) {
      await db.runAsync(
        `DELETE FROM messages WHERE conversation_id = ? AND id = ?`,
        conversationId,
        id
      );
    }
  });
}

export async function sqliteDeleteConversation(conversationId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM messages WHERE conversation_id = ?`, conversationId);
}

export async function sqliteMessageCount(conversationId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?`,
    conversationId
  );
  return row?.count ?? 0;
}

export async function sqliteClearAll(): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM messages`);
}
