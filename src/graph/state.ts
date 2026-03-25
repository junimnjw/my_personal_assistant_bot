import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import type { RouteResult } from "../types/index.js";

export const GraphState = Annotation.Root({
  ...MessagesAnnotation.spec,
  userId: Annotation<number>,
  userName: Annotation<string>,
  currentAgent: Annotation<string | null>,
  routeResult: Annotation<RouteResult | null>,
});

export type GraphStateType = typeof GraphState.State;
