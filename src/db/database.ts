import Database from "better-sqlite3";
import { CREATE_TABLES } from "./schema.js";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(process.env.DB_PATH || "./data/doctor.db");
    db.pragma("journal_mode = WAL");
    db.exec(CREATE_TABLES);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
