import type { DynamicStructuredTool } from "@langchain/core/tools";
import { createSavePrescriptionTool, createGetPrescriptionsTool } from "./tools/prescription.js";
import { createSaveDiseaseTool, createGetDiseasesTool, createUpdateDiseaseStatusTool } from "./tools/disease.js";
import { createGetDrugInfoTool } from "./tools/drugInfo.js";

export function createDoctorTools(userId: number): DynamicStructuredTool[] {
  return [
    createSavePrescriptionTool(userId),
    createGetPrescriptionsTool(userId),
    createSaveDiseaseTool(userId),
    createGetDiseasesTool(userId),
    createUpdateDiseaseStatusTool(),
    createGetDrugInfoTool(),
  ];
}
