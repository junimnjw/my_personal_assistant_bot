import type { DynamicStructuredTool } from "@langchain/core/tools";

// === 도메인 타입 (기존) ===

export interface User {
  id: number;
  telegramId: number;
  name: string;
  createdAt: string;
}

export interface Disease {
  id: number;
  userId: number;
  name: string;
  diagnosedAt: string;
  status: "active" | "cured";
  notes: string | null;
}

export interface Prescription {
  id: number;
  userId: number;
  drugName: string;
  dosage: string;
  frequency: string;
  prescribedAt: string;
  duration: string | null;
  doctor: string | null;
}

export interface DrugInfo {
  id: number;
  name: string;
  efficacy: string;
  sideEffects: string;
  precautions: string;
  interactions: string | null;
}

// === 에이전트 시스템 타입 ===

export interface AgentConfig {
  id: string;
  label: string;
  description: string;
  modelName: string;
  baseUrl: string;
  temperature: number;
  maxIterations: number;
  systemPrompt: string;
  createTools: (userId: number) => DynamicStructuredTool[];
  loadUserContext?: (userId: number) => string;
}

export interface RouteResult {
  targetAgent: string | null;
  confidence: number;
  fallbackResponse: string | null;
}
