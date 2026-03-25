import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { saveDisease, getDiseasesByUser, updateDiseaseStatus } from "../../../db/repositories/diseaseRepo.js";

export function createSaveDiseaseTool(userId: number) {
  return new DynamicStructuredTool({
    name: "save_disease",
    description: "사용자의 질병 이력을 저장합니다. 새로운 진단을 받았다고 말하면 이 도구를 사용하세요.",
    schema: z.object({
      name: z.string().describe("질병명 (예: 고혈압, 당뇨병)"),
      diagnosedAt: z.string().describe("진단일 (YYYY-MM-DD)"),
      status: z.enum(["active", "cured"]).optional().describe("상태: active(활성) 또는 cured(완치)"),
      notes: z.string().optional().describe("메모"),
    }),
    func: async (input) => {
      const result = saveDisease(userId, input);
      return `질병 이력이 저장되었습니다: ${result.name} (${result.status === "active" ? "활성" : "완치"})`;
    },
  });
}

export function createGetDiseasesTool(userId: number) {
  return new DynamicStructuredTool({
    name: "get_diseases",
    description: "사용자의 질병 이력을 조회합니다. 현재 앓고 있는 질병이나 과거 병력을 확인할 때 사용하세요.",
    schema: z.object({}),
    func: async () => {
      const diseases = getDiseasesByUser(userId);
      if (diseases.length === 0) {
        return "저장된 질병 이력이 없습니다.";
      }
      return diseases
        .map(
          (d) =>
            `- ${d.name} (${d.status === "active" ? "활성" : "완치"}) [진단일: ${d.diagnosedAt}]${d.notes ? ` 메모: ${d.notes}` : ""}`
        )
        .join("\n");
    },
  });
}

export function createUpdateDiseaseStatusTool() {
  return new DynamicStructuredTool({
    name: "update_disease_status",
    description: "질병의 상태를 변경합니다 (활성 → 완치 또는 완치 → 활성).",
    schema: z.object({
      diseaseId: z.number().describe("질병 ID"),
      status: z.enum(["active", "cured"]).describe("변경할 상태"),
    }),
    func: async (input) => {
      updateDiseaseStatus(input.diseaseId, input.status);
      return `질병 상태가 ${input.status === "active" ? "활성" : "완치"}(으)로 변경되었습니다.`;
    },
  });
}
