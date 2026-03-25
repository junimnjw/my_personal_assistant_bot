import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

const visionModel = new ChatOpenAI({
  modelName: process.env.LM_STUDIO_VISION_MODEL || "Qwen2.5-VL-7B-Instruct-GGUF",
  configuration: {
    baseURL: process.env.LM_STUDIO_BASE_URL || "http://host.docker.internal:1234/v1",
    apiKey: "not-needed",
  },
  temperature: 0,
});

export async function analyzeImage(
  base64Image: string,
  mimeType: string = "image/jpeg",
  caption?: string
): Promise<string> {
  const prompt = caption
    ? `이 이미지를 분석해주세요. 사용자 메시지: "${caption}"\n\n이미지에 있는 모든 텍스트를 추출하고, 의약품 이름, 용량, 복용 방법 등 의료 관련 정보를 정리해주세요. 한국어로 답변해주세요.`
    : "이 이미지에 있는 모든 텍스트를 추출하고, 의약품 이름, 용량, 복용 방법 등 의료 관련 정보를 정리해주세요. 한국어로 답변해주세요.";

  const message = new HumanMessage({
    content: [
      { type: "text", text: prompt },
      {
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64Image}` },
      },
    ],
  });

  const response = await visionModel.invoke([message]);
  return typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);
}
