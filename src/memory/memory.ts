import { HumanMessage, AIMessage, type BaseMessage } from "@langchain/core/messages";

const memoryStore = new Map<string, BaseMessage[]>();
const WINDOW_SIZE = parseInt(process.env.MEMORY_WINDOW_SIZE || "20", 10);

function makeKey(userId: number, agentId?: string): string {
  return agentId ? `${userId}:${agentId}` : `${userId}:global`;
}

export function getHistory(userId: number, agentId?: string): BaseMessage[] {
  return memoryStore.get(makeKey(userId, agentId)) || [];
}

export function addToHistory(userId: number, human: string, ai: string, agentId?: string): void {
  const key = makeKey(userId, agentId);
  const history = memoryStore.get(key) || [];
  history.push(new HumanMessage(human));
  history.push(new AIMessage(ai));

  const maxMessages = WINDOW_SIZE * 2;
  if (history.length > maxMessages) {
    history.splice(0, history.length - maxMessages);
  }
  memoryStore.set(key, history);
}

export function clearHistory(userId: number, agentId?: string): void {
  memoryStore.delete(makeKey(userId, agentId));
}
