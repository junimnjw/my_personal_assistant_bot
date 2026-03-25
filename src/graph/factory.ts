import { StateGraph, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage } from "@langchain/core/messages";
import type { AgentConfig } from "../types/index.js";
import { GraphState, type GraphStateType } from "./state.js";
import { getHistory, addToHistory } from "../memory/memory.js";

export function createSubAgentGraph(config: AgentConfig) {
  function createModel() {
    return new ChatOpenAI({
      modelName: config.modelName,
      configuration: {
        baseURL: config.baseUrl,
        apiKey: "not-needed",
      },
      temperature: config.temperature,
    });
  }

  async function agentNode(state: GraphStateType) {
    const model = createModel();
    const tools = config.createTools(state.userId);
    const modelWithTools = tools.length > 0 ? model.bindTools(tools) : model;

    // 에이전트별 대화 히스토리 주입
    const agentHistory = getHistory(state.userId, config.id);

    const response = await modelWithTools.invoke([
      { role: "system", content: config.systemPrompt },
      ...agentHistory,
      ...state.messages,
    ]);

    return { messages: [response] };
  }

  async function toolNode(state: GraphStateType) {
    const tools = config.createTools(state.userId);
    const node = new ToolNode(tools);
    return node.invoke(state);
  }

  function shouldContinue(state: GraphStateType): string {
    const lastMsg = state.messages[state.messages.length - 1];
    if (
      lastMsg instanceof AIMessage &&
      lastMsg.tool_calls &&
      lastMsg.tool_calls.length > 0
    ) {
      return "tools";
    }
    return END;
  }

  const subgraph = new StateGraph(GraphState)
    .addNode("agent", agentNode)
    .addNode("tools", toolNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shouldContinue, {
      tools: "tools",
      [END]: END,
    })
    .addEdge("tools", "agent");

  return subgraph.compile();
}
