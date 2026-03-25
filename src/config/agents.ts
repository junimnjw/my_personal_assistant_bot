import type { AgentConfig } from "../types/index.js";
import { DOCTOR_SYSTEM_PROMPT } from "../agents/doctor/prompt.js";
import { createDoctorTools } from "../agents/doctor/index.js";
import { FINANCE_SYSTEM_PROMPT } from "../agents/finance/prompt.js";
import { createFinanceTools } from "../agents/finance/index.js";

const DEFAULT_BASE_URL = "http://host.docker.internal:1234/v1";
const DEFAULT_MODEL = "Qwen2.5-14B-Instruct-GGUF";

export function getAgentRegistry(): Record<string, AgentConfig> {
  const baseUrl = process.env.LM_STUDIO_BASE_URL || DEFAULT_BASE_URL;

  return {
    doctor: {
      id: "doctor",
      label: "주치의",
      description: "의료 상담, 질병 관리, 처방전 관리, 약물 정보, 건강 관련 질문",
      modelName: process.env.DOCTOR_MODEL || "hari-14b-i1",
      baseUrl: process.env.DOCTOR_MODEL_URL || baseUrl,
      temperature: 0.3,
      maxIterations: 5,
      systemPrompt: DOCTOR_SYSTEM_PROMPT,
      createTools: createDoctorTools,
    },
    finance: {
      id: "finance",
      label: "재무 설계사",
      description: "재무 계획, 자산 관리, 투자 조언, 지출/수입 관리, 세금, 보험 관련 질문",
      modelName: process.env.FINANCE_MODEL || "FinGPT-MT-Llama-3-8B-LoRA",
      baseUrl: process.env.FINANCE_MODEL_URL || baseUrl,
      temperature: 0.3,
      maxIterations: 5,
      systemPrompt: FINANCE_SYSTEM_PROMPT,
      createTools: createFinanceTools,
    },
  };
}

export function getAgentIds(): string[] {
  return Object.keys(getAgentRegistry());
}

export function getSupervisorModelConfig() {
  return {
    modelName: process.env.SUPERVISOR_MODEL || DEFAULT_MODEL,
    baseUrl: process.env.SUPERVISOR_MODEL_URL || process.env.LM_STUDIO_BASE_URL || DEFAULT_BASE_URL,
  };
}
