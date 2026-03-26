import type { DynamicStructuredTool } from "@langchain/core/tools";
import { createSavePrescriptionTool, createGetPrescriptionsTool } from "./tools/prescription.js";
import { createSaveDiseaseTool, createGetDiseasesTool, createUpdateDiseaseStatusTool } from "./tools/disease.js";
import { createGetDrugInfoRagTool } from "./tools/drugInfoRAG.js";
import { getPrescriptionsByUser } from "../../db/repositories/prescriptionRepo.js";
import { getDiseasesByUser } from "../../db/repositories/diseaseRepo.js";

export function createDoctorTools(userId: number): DynamicStructuredTool[] {
  return [
    createSavePrescriptionTool(userId),
    createGetPrescriptionsTool(userId),
    createSaveDiseaseTool(userId),
    createGetDiseasesTool(userId),
    createUpdateDiseaseStatusTool(),
    createGetDrugInfoRagTool(),
  ];
}

export function loadDoctorUserContext(userId: number): string {
  const diseases = getDiseasesByUser(userId);
  const prescriptions = getPrescriptionsByUser(userId);

  const parts: string[] = [];

  if (diseases.length > 0) {
    parts.push("## 사용자 질병 이력");
    for (const d of diseases) {
      parts.push(`- ${d.name} (${d.status === "active" ? "활성" : "완치"}, 진단일: ${d.diagnosedAt})${d.notes ? ` 메모: ${d.notes}` : ""}`);
    }
  }

  if (prescriptions.length > 0) {
    parts.push("## 사용자 처방전");
    for (const p of prescriptions) {
      parts.push(`- ${p.drugName} ${p.dosage} (${p.frequency}, 처방일: ${p.prescribedAt})${p.doctor ? ` 담당의: ${p.doctor}` : ""}`);
    }
  }

  return parts.length > 0
    ? "\n\n## 현재 사용자의 저장된 의료 정보\n" + parts.join("\n")
    : "";
}
