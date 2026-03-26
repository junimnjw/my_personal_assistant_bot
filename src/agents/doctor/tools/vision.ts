import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

const visionModel = new ChatOpenAI({
  modelName: process.env.LM_STUDIO_VISION_MODEL || "qwen3-vl-4b-instruct",
  configuration: {
    baseURL: process.env.LM_STUDIO_BASE_URL || "http://host.docker.internal:1234/v1",
    apiKey: "not-needed",
  },
  temperature: 0,
  maxTokens: 2048,
  modelKwargs: { thinking: false },
});

const DEFAULT_PROMPT = `이 이미지를 주의 깊게 살펴보고, 보이는 모든 텍스트를 그대로 추출해주세요.

특히 다음 정보를 찾아 정리해주세요:
- 약물명 (의약품 이름)
- 용량 (mg, ml 등)
- 복용 방법 (1일 몇 회, 식전/식후 등)
- 처방일
- 환자 정보
- 의사/병원 정보
- 기타 의료 관련 내용

이미지에서 읽을 수 있는 모든 텍스트를 빠짐없이 추출해주세요.
한국어로 답변해주세요.`;

export async function analyzeImage(
  base64Image: string,
  mimeType: string = "image/jpeg",
  caption?: string
): Promise<string> {
  const prompt = caption
    ? `사용자 요청: "${caption}"\n\n${DEFAULT_PROMPT}`
    : DEFAULT_PROMPT;

  const message = new HumanMessage({
    content: [
      { type: "text", text: prompt },
      {
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64Image}` },
      },
    ],
  });

  console.log("[Vision] Calling vision model...");
  const response = await visionModel.invoke([message]);
  const result = typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);
  console.log("[Vision] Model responded, length:", result.length);

  return result;
}
