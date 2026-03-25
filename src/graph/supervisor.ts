import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { AIMessage } from "@langchain/core/messages";
import type { GraphStateType } from "./state.js";
import { getAgentRegistry, getSupervisorModelConfig } from "../config/agents.js";

const CONFIDENCE_THRESHOLD = 0.6;

function buildRouteSchema() {
  const agentIds = Object.keys(getAgentRegistry());
  return z.object({
    targetAgent: z
      .enum(agentIds as [string, ...string[]])
      .nullable()
      .describe("The sub-agent to route to, or null if no agent matches"),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .describe("Confidence in the routing decision (0.0 to 1.0)"),
  });
}

function buildRoutingPrompt(): string {
  const registry = getAgentRegistry();
  const agentDescriptions = Object.values(registry)
    .map((a) => `- ${a.id} (${a.label}): ${a.description}`)
    .join("\n");

  return `You are a router that classifies user intent and picks the best agent.

Available agents:
${agentDescriptions}

Analyze the user's message and respond with:
- targetAgent: the best matching agent ID, or null if nothing matches
- confidence: your confidence level (0.0 to 1.0)

Be decisive. If the message clearly relates to an agent's domain, set confidence >= 0.7.
If the message is ambiguous or could match multiple agents, set confidence lower.
If the message is completely unrelated to any agent, set targetAgent to null.`;
}

export async function supervisorNode(state: GraphStateType) {
  const config = getSupervisorModelConfig();

  const supervisorModel = new ChatOpenAI({
    modelName: config.modelName,
    configuration: {
      baseURL: config.baseUrl,
      apiKey: "not-needed",
    },
    temperature: 0,
  });

  const RouteSchema = buildRouteSchema();
  const structuredModel = supervisorModel.withStructuredOutput(RouteSchema);

  const lastMessage = state.messages[state.messages.length - 1];
  const userInput =
    typeof lastMessage.content === "string" ? lastMessage.content : String(lastMessage.content);

  let routeResult: z.infer<typeof RouteSchema>;

  try {
    routeResult = await structuredModel.invoke([
      { role: "system", content: buildRoutingPrompt() },
      { role: "user", content: userInput },
    ]);
  } catch {
    // structured output 실패 시 fallback
    routeResult = { targetAgent: null, confidence: 0 };
  }

  let finalTarget = routeResult.targetAgent;
  let fallbackResponse: string | null = null;

  if (routeResult.confidence < CONFIDENCE_THRESHOLD) {
    if (state.currentAgent) {
      // 모호하지만 이전 에이전트 맥락이 있으면 유지
      finalTarget = state.currentAgent;
    } else {
      // 맥락도 없고 확신도 낮으면 → 슈퍼바이저가 직접 응답
      finalTarget = null;
      try {
        const generalResponse = await supervisorModel.invoke([
          {
            role: "system",
            content:
              "당신은 '나만의 개인 비서'입니다. 한국어로 대답합니다. 사용자에게 도움이 될 수 있는 서비스(건강 관리, 재무 상담 등)를 안내하고, 일반적인 질문에는 친절하게 답변해주세요.",
          },
          { role: "user", content: userInput },
        ]);
        fallbackResponse =
          typeof generalResponse.content === "string"
            ? generalResponse.content
            : String(generalResponse.content);
      } catch {
        fallbackResponse = "안녕하세요! 저는 나만의 개인 비서입니다. 건강 관리나 재무 상담에 대해 물어보세요.";
      }
    }
  }

  return {
    routeResult: {
      targetAgent: finalTarget,
      confidence: routeResult.confidence,
      fallbackResponse,
    },
    currentAgent: finalTarget,
  };
}
