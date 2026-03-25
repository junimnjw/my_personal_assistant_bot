import { getDb } from "../database.js";
import type { Disease } from "../../types/index.js";

export function saveDisease(
  userId: number,
  data: {
    name: string;
    diagnosedAt: string;
    status?: "active" | "cured";
    notes?: string;
  }
): Disease {
  const db = getDb();
  const status = data.status ?? "active";
  const result = db
    .prepare(
      `INSERT INTO diseases (user_id, name, diagnosed_at, status, notes)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(userId, data.name, data.diagnosedAt, status, data.notes ?? null);

  return {
    id: result.lastInsertRowid as number,
    userId,
    name: data.name,
    diagnosedAt: data.diagnosedAt,
    status,
    notes: data.notes ?? null,
  };
}

export function getDiseasesByUser(userId: number): Disease[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, user_id as userId, name, diagnosed_at as diagnosedAt, status, notes
       FROM diseases WHERE user_id = ? ORDER BY diagnosed_at DESC`
    )
    .all(userId) as Disease[];
}

export function updateDiseaseStatus(diseaseId: number, status: "active" | "cured"): void {
  const db = getDb();
  db.prepare("UPDATE diseases SET status = ? WHERE id = ?").run(status, diseaseId);
}
