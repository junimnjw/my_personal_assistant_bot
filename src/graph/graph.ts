import { StateGraph, END } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { GraphState, type GraphStateType } from "./state.js";
import { supervisorNode } from "./supervisor.js";
import { createSubAgentGraph } from "./factory.js";
import { getAgentRegistry } from "../config/agents.js";
import { addToHistory } from "../memory/memory.js";

export function buildGraph() {
  const registry = getAgentRegistry();
  const agentIds = Object.keys(registry);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = new StateGraph(GraphState) as any;

  builder.addNode("supervisor", supervisorNode);

  // 각 하위 에이전트를 노드로 등록
  for (const [agentId, config] of Object.entries(registry)) {
    const subgraph = createSubAgentGraph(config);
    builder.addNode(agentId, async (state: GraphStateType) => {
      const result = await subgraph.invoke(state);

      // 에이전트별 메모리에 대화 기록 저장
      const userMsg = state.messages[state.messages.length - 1];
      const userInput =
        typeof userMsg.content === "string" ? userMsg.content : String(userMsg.content);

      const aiMessages = (result.messages as AIMessage[]).filter(
        (m) => m._getType?.() === "ai"
      );
      const lastAiMsg = aiMessages[aiMessages.length - 1];
      if (lastAiMsg) {
        const aiOutput =
          typeof lastAiMsg.content === "string"
            ? lastAiMsg.content
            : String(lastAiMsg.content);
        addToHistory(state.userId, userInput, aiOutput, agentId);
      }

      return result;
    });
  }

  // Fallback 노드: 슈퍼바이저가 직접 응답
  builder.addNode("fallback", async (state: GraphStateType) => {
    const response =
      state.routeResult?.fallbackResponse ||
      "안녕하세요! 저는 나만의 개인 비서입니다. 건강 관리나 재무 상담에 대해 물어보세요.";
    return {
      messages: [new AIMessage(response)],
    };
  });

  // 라우팅 분기 맵
  const routeMap: Record<string, string> = {};
  for (const id of agentIds) {
    routeMap[id] = id;
  }
  routeMap["fallback"] = "fallback";
  routeMap["supervisor"] = "supervisor";

  // 엔트리: routeResult가 이미 있으면 supervisor 건너뛰기
  builder.addConditionalEdges(
    "__start__",
    (state: GraphStateType) => {
      if (state.routeResult?.targetAgent) {
        const target = state.routeResult.targetAgent;
        if (target in registry) return target;
      }
      return "supervisor";
    },
    routeMap
  );

  // supervisor → 라우팅 결과에 따라 분기
  const supervisorRouteMap: Record<string, string> = {};
  for (const id of agentIds) {
    supervisorRouteMap[id] = id;
  }
  supervisorRouteMap["fallback"] = "fallback";

  builder.addConditionalEdges(
    "supervisor",
    (state: GraphStateType) => {
      const target = state.routeResult?.targetAgent;
      if (target && target in registry) return target;
      return "fallback";
    },
    supervisorRouteMap
  );

  // 모든 하위 에이전트와 fallback → END
  for (const agentId of agentIds) {
    builder.addEdge(agentId, END);
  }
  builder.addEdge("fallback", END);

  return builder.compile();
}
