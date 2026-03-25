import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getDb } from "../../../db/database.js";
import type { DrugInfo } from "../../../types/index.js";

export function createGetDrugInfoTool() {
  return new DynamicStructuredTool({
    name: "get_drug_info",
    description: "약물의 효능, 부작용, 주의사항 정보를 데이터베이스에서 조회합니다. 저장된 약물 정보가 있을 때 사용하세요.",
    schema: z.object({
      drugName: z.string().describe("조회할 약물명"),
    }),
    func: async (input) => {
      const db = getDb();
      const info = db
        .prepare(
          `SELECT id, name, efficacy, side_effects as sideEffects, precautions, interactions
           FROM drug_info WHERE name LIKE ?`
        )
        .get(`%${input.drugName}%`) as DrugInfo | undefined;

      if (!info) {
        return `데이터베이스에 '${input.drugName}'에 대한 저장된 정보가 없습니다. 일반적인 의학 지식을 바탕으로 답변해주세요.`;
      }

      return [
        `약물명: ${info.name}`,
        `효능: ${info.efficacy}`,
        `부작용: ${info.sideEffects}`,
        `주의사항: ${info.precautions}`,
        info.interactions ? `상호작용: ${info.interactions}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    },
  });
}
