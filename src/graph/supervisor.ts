import { ChatOpenAI } from "@langchain/openai";
import type { GraphStateType } from "./state.js";
import { getAgentRegistry, getSupervisorModelConfig } from "../config/agents.js";

const CONFIDENCE_THRESHOLD = 0.6;

function buildRoutingPrompt(): string {
  const registry = getAgentRegistry();
  const agentDescriptions = Object.values(registry)
    .map((a) => `- ${a.id} (${a.label}): ${a.description}`)
    .join("\n");

  return `You are a router that classifies user intent and picks the best agent.

Available agents:
${agentDescriptions}

Analyze the user's message and respond ONLY with a JSON object (no other text):
{"targetAgent": "<agent_id or null>", "confidence": <0.0 to 1.0>}

Rules:
- If the message clearly relates to an agent's domain, set confidence >= 0.7.
- If ambiguous, set confidence lower.
- If completely unrelated, set targetAgent to null.
- Respond ONLY with the JSON object, nothing else.`;
}

function parseRouteResult(content: string): { targetAgent: string | null; confidence: number } {
  try {
    // JSON 블록 추출 (```json ... ``` 또는 { ... })
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        targetAgent: parsed.targetAgent ?? null,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      };
    }
  } catch {
    // 파싱 실패
  }

  // 에이전트 ID가 텍스트에 언급되어 있는지 키워드 매칭
  const registry = getAgentRegistry();
  for (const id of Object.keys(registry)) {
    if (content.toLowerCase().includes(id)) {
      return { targetAgent: id, confidence: 0.7 };
    }
  }

  return { targetAgent: null, confidence: 0 };
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
    maxTokens: 128,
    modelKwargs: { thinking: false },
  });

  const lastMessage = state.messages[state.messages.length - 1];
  const userInput =
    typeof lastMessage.content === "string" ? lastMessage.content : String(lastMessage.content);

  let routeResult: { targetAgent: string | null; confidence: number };

  try {
    const response = await supervisorModel.invoke([
      { role: "system", content: buildRoutingPrompt() },
      { role: "user", content: userInput },
    ]);

    const responseText =
      typeof response.content === "string" ? response.content : String(response.content);
    console.log("[Supervisor] raw response:", responseText);

    routeResult = parseRouteResult(responseText);
  } catch (error) {
    console.error("[Supervisor] LLM call failed:", error);
    routeResult = { targetAgent: null, confidence: 0 };
  }

  console.log("[Supervisor] route result:", JSON.stringify(routeResult));

  let finalTarget = routeResult.targetAgent;
  let fallbackResponse: string | null = null;

  // 유효한 에이전트인지 검증
  const registry = getAgentRegistry();
  if (finalTarget && !(finalTarget in registry)) {
    finalTarget = null;
    routeResult.confidence = 0;
  }

  if (routeResult.confidence < CONFIDENCE_THRESHOLD) {
    if (state.currentAgent) {
      finalTarget = state.currentAgent;
    } else {
      finalTarget = null;
      try {
        const fallbackModel = new ChatOpenAI({
          modelName: config.modelName,
          configuration: {
            baseURL: config.baseUrl,
            apiKey: "not-needed",
          },
          temperature: 0.3,
          modelKwargs: { thinking: false },
        });
        const generalResponse = await fallbackModel.invoke([
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
        fallbackResponse =
          "안녕하세요! 저는 나만의 개인 비서입니다. 건강 관리나 재무 상담에 대해 물어보세요.";
      }
    }
  }

  console.log("[Supervisor] final target:", finalTarget);

  return {
    routeResult: {
      targetAgent: finalTarget,
      confidence: routeResult.confidence,
      fallbackResponse,
    },
    currentAgent: finalTarget,
  };
}
