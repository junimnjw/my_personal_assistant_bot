import { describe, it, expect, beforeAll, beforeEach } from "vitest";

// 테스트용 in-memory DB 사용
process.env.DB_PATH = ":memory:";

import { getHistory, addToHistory, clearHistory } from "../src/memory/memory.js";

describe("Memory (per-agent sliding window, SQLite)", () => {
  beforeEach(() => {
    clearHistory(1001);
    clearHistory(1001, "doctor");
    clearHistory(1001, "finance");
    clearHistory(1002);
    clearHistory(1002, "doctor");
  });

  it("윈도우 크기를 초과하면 오래된 메시지가 제거되어야 한다", () => {
    for (let i = 0; i < 25; i++) {
      addToHistory(1001, `질문 ${i}`, `답변 ${i}`, "doctor");
    }

    const history = getHistory(1001, "doctor");
    expect(history.length).toBe(40);
    expect(history[0].content).toBe("질문 5");
  });

  it("사용자별로 독립적인 메모리를 유지해야 한다", () => {
    addToHistory(1001, "사용자1 질문", "사용자1 답변", "doctor");
    addToHistory(1002, "사용자2 질문", "사용자2 답변", "doctor");

    expect(getHistory(1001, "doctor")).toHaveLength(2);
    expect(getHistory(1002, "doctor")).toHaveLength(2);
    expect(getHistory(1001, "doctor")[0].content).toBe("사용자1 질문");
  });

  it("에이전트별로 독립적인 메모리를 유지해야 한다", () => {
    addToHistory(1001, "건강 질문", "건강 답변", "doctor");
    addToHistory(1001, "재무 질문", "재무 답변", "finance");

    expect(getHistory(1001, "doctor")).toHaveLength(2);
    expect(getHistory(1001, "finance")).toHaveLength(2);
    expect(getHistory(1001, "doctor")[0].content).toBe("건강 질문");
    expect(getHistory(1001, "finance")[0].content).toBe("재무 질문");
  });

  it("에이전트 없이 글로벌 메모리를 사용할 수 있어야 한다", () => {
    addToHistory(1001, "일반 질문", "일반 답변");
    expect(getHistory(1001)).toHaveLength(2);
    expect(getHistory(1001, "doctor")).toHaveLength(0);
  });

  it("clearHistory 후 히스토리가 비어야 한다", () => {
    addToHistory(1001, "질문", "답변", "doctor");
    expect(getHistory(1001, "doctor")).toHaveLength(2);

    clearHistory(1001, "doctor");
    expect(getHistory(1001, "doctor")).toHaveLength(0);
  });
});
