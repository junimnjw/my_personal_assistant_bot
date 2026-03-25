import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { CREATE_TABLES } from "../src/db/schema.js";

function createTestDb() {
  const db = new Database(":memory:");
  db.exec(CREATE_TABLES);
  return db;
}

describe("Database Schema", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it("테이블이 정상적으로 생성되어야 한다", () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("diseases");
    expect(tableNames).toContain("prescriptions");
    expect(tableNames).toContain("drug_info");
  });

  it("사용자를 생성하고 조회할 수 있어야 한다", () => {
    db.prepare("INSERT INTO users (telegram_id, name) VALUES (?, ?)").run(12345, "테스트유저");
    const user = db
      .prepare("SELECT * FROM users WHERE telegram_id = ?")
      .get(12345) as Record<string, unknown>;

    expect(user).toBeDefined();
    expect(user.name).toBe("테스트유저");
  });

  it("처방전을 저장하고 조회할 수 있어야 한다", () => {
    db.prepare("INSERT INTO users (telegram_id, name) VALUES (?, ?)").run(12345, "테스트유저");
    db.prepare(
      "INSERT INTO prescriptions (user_id, drug_name, dosage, frequency, prescribed_at) VALUES (?, ?, ?, ?, ?)"
    ).run(1, "타이레놀", "500mg", "하루 3회 식후", "2026-03-25");

    const prescriptions = db
      .prepare("SELECT * FROM prescriptions WHERE user_id = ?")
      .all(1) as Record<string, unknown>[];

    expect(prescriptions).toHaveLength(1);
    expect(prescriptions[0].drug_name).toBe("타이레놀");
  });
});
