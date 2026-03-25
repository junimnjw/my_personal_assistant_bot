import { getDb } from "../database.js";
import type { User } from "../../types/index.js";

export function ensureUser(telegramId: number, name: string): User {
  const db = getDb();

  const existing = db
    .prepare("SELECT id, telegram_id as telegramId, name, created_at as createdAt FROM users WHERE telegram_id = ?")
    .get(telegramId) as User | undefined;

  if (existing) return existing;

  const result = db
    .prepare("INSERT INTO users (telegram_id, name) VALUES (?, ?)")
    .run(telegramId, name);

  return {
    id: result.lastInsertRowid as number,
    telegramId,
    name,
    createdAt: new Date().toISOString(),
  };
}
