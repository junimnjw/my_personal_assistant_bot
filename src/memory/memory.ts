import { HumanMessage, AIMessage, type BaseMessage } from "@langchain/core/messages";
import { getDb } from "../db/database.js";

const WINDOW_SIZE = parseInt(process.env.MEMORY_WINDOW_SIZE || "20", 10);

export function getHistory(userId: number, agentId?: string): BaseMessage[] {
  const db = getDb();
  const agent = agentId || "global";
  const maxMessages = WINDOW_SIZE * 2;

  const rows = db
    .prepare(
      `SELECT role, content FROM chat_history
       WHERE user_id = ? AND agent_id = ?
       ORDER BY id DESC LIMIT ?`
    )
    .all(userId, agent, maxMessages) as { role: string; content: string }[];

  // DB에서 최신순으로 가져왔으므로 역순으로 뒤집기
  rows.reverse();

  return rows.map((row) =>
    row.role === "human" ? new HumanMessage(row.content) : new AIMessage(row.content)
  );
}

export function addToHistory(userId: number, human: string, ai: string, agentId?: string): void {
  const db = getDb();
  const agent = agentId || "global";

  const insert = db.prepare(
    "INSERT INTO chat_history (user_id, agent_id, role, content) VALUES (?, ?, ?, ?)"
  );

  const transaction = db.transaction(() => {
    insert.run(userId, agent, "human", human);
    insert.run(userId, agent, "ai", ai);

    // 윈도우 크기 초과 시 오래된 메시지 삭제
    const maxMessages = WINDOW_SIZE * 2;
    const count = db
      .prepare("SELECT COUNT(*) as cnt FROM chat_history WHERE user_id = ? AND agent_id = ?")
      .get(userId, agent) as { cnt: number };

    if (count.cnt > maxMessages) {
      const deleteCount = count.cnt - maxMessages;
      db.prepare(
        `DELETE FROM chat_history WHERE id IN (
           SELECT id FROM chat_history
           WHERE user_id = ? AND agent_id = ?
           ORDER BY id ASC LIMIT ?
         )`
      ).run(userId, agent, deleteCount);
    }
  });

  transaction();
}

export function clearHistory(userId: number, agentId?: string): void {
  const db = getDb();
  const agent = agentId || "global";
  db.prepare("DELETE FROM chat_history WHERE user_id = ? AND agent_id = ?").run(userId, agent);
}
