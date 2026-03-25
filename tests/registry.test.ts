import { describe, it, expect } from "vitest";
import { getAgentRegistry, getAgentIds, getSupervisorModelConfig } from "../src/config/agents.js";

describe("Agent Registry", () => {
  it("레지스트리에 doctor와 finance가 등록되어 있어야 한다", () => {
    const registry = getAgentRegistry();
    expect(registry.doctor).toBeDefined();
    expect(registry.finance).toBeDefined();
  });

  it("각 에이전트에 필수 설정이 있어야 한다", () => {
    const registry = getAgentRegistry();

    for (const config of Object.values(registry)) {
      expect(config.id).toBeTruthy();
      expect(config.label).toBeTruthy();
      expect(config.description).toBeTruthy();
      expect(config.modelName).toBeTruthy();
      expect(config.baseUrl).toBeTruthy();
      expect(config.systemPrompt).toBeTruthy();
      expect(typeof config.createTools).toBe("function");
    }
  });

  it("getAgentIds가 등록된 에이전트 ID 목록을 반환해야 한다", () => {
    const ids = getAgentIds();
    expect(ids).toContain("doctor");
    expect(ids).toContain("finance");
  });

  it("슈퍼바이저 모델 설정을 반환해야 한다", () => {
    const config = getSupervisorModelConfig();
    expect(config.modelName).toBeTruthy();
    expect(config.baseUrl).toBeTruthy();
  });

  it("doctor 도구 팩토리가 도구 목록을 반환해야 한다", () => {
    const registry = getAgentRegistry();
    const tools = registry.doctor.createTools(1);
    expect(tools.length).toBeGreaterThan(0);
  });
});
