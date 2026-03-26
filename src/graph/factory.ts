import { StateGraph, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage } from "@langchain/core/messages";
import type { AgentConfig } from "../types/index.js";
import { GraphState, type GraphStateType } from "./state.js";
import { getHistory } from "../memory/memory.js";

export function createSubAgentGraph(config: AgentConfig) {
  function createModel() {
    return new ChatOpenAI({
      modelName: config.modelName,
      configuration: {
        baseURL: config.baseUrl,
        apiKey: "not-needed",
      },
      temperature: config.temperature,
      modelKwargs: { thinking: false },
    });
  }

  // 도구가 있는지 확인 (userId=0으로 테스트)
  const hasTools = config.createTools(0).length > 0;

  async function agentNode(state: GraphStateType) {
    const model = createModel();
    const tools = config.createTools(state.userId);
    const modelWithTools = tools.length > 0 ? model.bindTools(tools) : model;

    const agentHistory = getHistory(state.userId, config.id);

    console.log(`[${config.id}] invoking model: ${config.modelName}`);

    const response = await modelWithTools.invoke([
      { role: "system", content: config.systemPrompt },
      ...agentHistory,
      ...state.messages,
    ]);

    console.log(`[${config.id}] response content:`, typeof response.content === "string" ? response.content.slice(0, 100) : response.content);

    return { messages: [response] };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = new StateGraph(GraphState) as any;
  builder.addNode("agent", agentNode);
  builder.addEdge("__start__", "agent");

  if (hasTools) {
    // 도구가 있으면 ReAct 루프 구성
    builder.addNode("tools", async (state: GraphStateType) => {
      const tools = config.createTools(state.userId);
      const node = new ToolNode(tools);
      return node.invoke(state);
    });

    builder.addConditionalEdges(
      "agent",
      (state: GraphStateType) => {
        const lastMsg = state.messages[state.messages.length - 1];
        if (
          lastMsg instanceof AIMessage &&
          lastMsg.tool_calls &&
          lastMsg.tool_calls.length > 0
        ) {
          return "tools";
        }
        return END;
      },
      { tools: "tools", [END]: END }
    );

    builder.addEdge("tools", "agent");
  } else {
    // 도구가 없으면 바로 종료
    builder.addEdge("agent", END);
  }

  return builder.compile();
}
