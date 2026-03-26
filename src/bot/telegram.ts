import { Bot, type Context } from "grammy";
import { hydrateFiles, type FileFlavor } from "@grammyjs/files";
import { HumanMessage } from "@langchain/core/messages";
import { ensureUser } from "../db/repositories/userRepo.js";
import { analyzeImage } from "../agents/doctor/tools/vision.js";

type MyContext = FileFlavor<Context>;

const TELEGRAM_MAX_LENGTH = 4096;

function splitMessage(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_LENGTH) return [text];

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= TELEGRAM_MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf("\n", TELEGRAM_MAX_LENGTH);
    if (splitAt <= 0) splitAt = TELEGRAM_MAX_LENGTH;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  return chunks;
}

// 사용자별 currentAgent 추적
const userCurrentAgent = new Map<number, string | null>();

export function createBot(token: string, graph: { invoke: Function }) {
  const bot = new Bot<MyContext>(token);
  bot.api.config.use(hydrateFiles(bot.token));

  bot.command("start", async (ctx) => {
    await ctx.reply(
      "안녕하세요! 저는 나만의 개인 비서입니다.\n\n" +
        "다음과 같은 전문가들이 대기하고 있어요:\n" +
        "• 주치의 - 질병 관리, 처방전, 약물 정보\n" +
        "• 재무 설계사 - 자산 관리, 투자, 세금\n\n" +
        "무엇이든 편하게 물어보세요!\n\n" +
        "⚠️ 이 서비스는 정보 참고용이며, 전문 상담을 대체하지 않습니다."
    );
  });

  bot.on("message:text", async (ctx) => {
    if (!ctx.from) return;

    const user = ensureUser(ctx.from.id, ctx.from.first_name);

    try {
      await ctx.replyWithChatAction("typing");

      const result = await graph.invoke({
        messages: [new HumanMessage(ctx.message.text)],
        userId: user.id,
        userName: user.name,
        currentAgent: userCurrentAgent.get(user.id) ?? null,
        routeResult: null,
      });

      // 디버그: 그래프 결과 로깅
      console.log("=== Graph Result ===");
      console.log("currentAgent:", result.currentAgent);
      console.log("routeResult:", JSON.stringify(result.routeResult));
      console.log("messages count:", result.messages.length);
      for (const m of result.messages) {
        const type = m._getType?.() || "unknown";
        const content = typeof m.content === "string" ? m.content.slice(0, 100) : JSON.stringify(m.content)?.slice(0, 100);
        console.log(`  [${type}] ${content}`);
      }
      console.log("===================");

      // currentAgent 상태 업데이트
      if (result.currentAgent !== undefined) {
        userCurrentAgent.set(user.id, result.currentAgent);
      }

      // 마지막 AI 메시지 추출 (content가 있는 것만)
      const aiMessages = result.messages.filter(
        (m: { _getType?: () => string; content?: unknown }) =>
          m._getType?.() === "ai" && m.content && String(m.content).trim() !== ""
      );
      const lastAiMsg = aiMessages[aiMessages.length - 1];
      const response =
        typeof lastAiMsg?.content === "string" && lastAiMsg.content.trim()
          ? lastAiMsg.content
          : String(lastAiMsg?.content || "죄송합니다, 응답을 생성할 수 없었습니다.");

      for (const chunk of splitMessage(response)) {
        if (chunk.trim()) await ctx.reply(chunk);
      }
    } catch (error) {
      console.error("Graph error:", error instanceof Error ? error.message : error);
      console.error("Full error:", error);
      await ctx.reply("죄송합니다, 일시적인 오류가 발생했습니다. 다시 시도해주세요.");
    }
  });

  bot.on("message:photo", async (ctx) => {
    if (!ctx.from) return;

    const user = ensureUser(ctx.from.id, ctx.from.first_name);

    try {
      await ctx.replyWithChatAction("typing");

      const photo = ctx.message.photo.at(-1)!;
      const file = await ctx.api.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      const response = await fetch(fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      const base64 = buffer.toString("base64");

      const mimeType = file.file_path?.endsWith(".png") ? "image/png" : "image/jpeg";
      const caption = ctx.message.caption;

      await ctx.replyWithChatAction("typing");
      console.log(`[Vision] Analyzing image: ${mimeType}, size: ${buffer.length} bytes`);
      const extractedText = await analyzeImage(base64, mimeType, caption);
      console.log(`[Vision] Result: ${extractedText.slice(0, 300)}`);

      const combinedInput = `[이미지 분석 결과]\n${extractedText}\n\n${caption || "이 처방전/의료 문서를 분석하고, 약물명/용량/복용법을 정리해주세요."}`;

      const result = await graph.invoke({
        messages: [new HumanMessage(combinedInput)],
        userId: user.id,
        userName: user.name,
        currentAgent: "doctor",
        routeResult: {
          targetAgent: "doctor",
          confidence: 1.0,
          fallbackResponse: null,
        },
      });

      if (result.currentAgent !== undefined) {
        userCurrentAgent.set(user.id, result.currentAgent);
      }

      const aiMessages = result.messages.filter(
        (m: { _getType?: () => string; content?: unknown }) =>
          m._getType?.() === "ai" && m.content && String(m.content).trim() !== ""
      );
      const lastAiMsg = aiMessages[aiMessages.length - 1];
      const agentResponse =
        typeof lastAiMsg?.content === "string" && lastAiMsg.content.trim()
          ? lastAiMsg.content
          : String(lastAiMsg?.content || "죄송합니다, 이미지 분석 결과를 처리할 수 없었습니다.");

      for (const chunk of splitMessage(agentResponse)) {
        if (chunk.trim()) await ctx.reply(chunk);
      }
    } catch (error) {
      console.error("Vision/Graph error:", error);
      await ctx.reply("죄송합니다, 이미지 분석 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  });

  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  return bot;
}
