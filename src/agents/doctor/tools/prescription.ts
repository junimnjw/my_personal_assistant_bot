import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { savePrescription, getPrescriptionsByUser } from "../../../db/repositories/prescriptionRepo.js";

export function createSavePrescriptionTool(userId: number) {
  return new DynamicStructuredTool({
    name: "save_prescription",
    description: "새로운 처방전 정보를 저장합니다. 사용자가 새 약을 처방받았다고 말하면 이 도구를 사용하세요.",
    schema: z.object({
      drugName: z.string().describe("약물명"),
      dosage: z.string().describe("용량 (예: 500mg)"),
      frequency: z.string().describe("복용 방법 (예: 하루 3회 식후)"),
      prescribedAt: z.string().describe("처방일 (YYYY-MM-DD)"),
      duration: z.string().optional().describe("처방 기간 (예: 14일)"),
      doctor: z.string().optional().describe("담당 의사"),
    }),
    func: async (input) => {
      const result = savePrescription(userId, input);
      return `처방전이 저장되었습니다: ${result.drugName} ${result.dosage}, ${result.frequency}`;
    },
  });
}

export function createGetPrescriptionsTool(userId: number) {
  return new DynamicStructuredTool({
    name: "get_prescriptions",
    description: "사용자의 처방전 목록을 조회합니다. 현재 복용 중인 약물을 확인할 때 사용하세요.",
    schema: z.object({}),
    func: async () => {
      const prescriptions = getPrescriptionsByUser(userId);
      if (prescriptions.length === 0) {
        return "저장된 처방전이 없습니다.";
      }
      return prescriptions
        .map(
          (p) =>
            `- ${p.drugName} ${p.dosage} (${p.frequency}) [처방일: ${p.prescribedAt}]${p.doctor ? ` 담당의: ${p.doctor}` : ""}`
        )
        .join("\n");
    },
  });
}
