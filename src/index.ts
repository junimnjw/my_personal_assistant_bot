import "dotenv/config";
import { createBot } from "./bot/telegram.js";
import { buildGraph } from "./graph/graph.js";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN 환경 변수가 설정되지 않았습니다.");
  process.exit(1);
}

const graph = buildGraph();
const bot = createBot(token, graph);

bot.start({
  onStart: () => {
    console.log("나만의 개인 비서 봇이 시작되었습니다.");
  },
});
