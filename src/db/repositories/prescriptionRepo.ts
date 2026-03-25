import { getDb } from "../database.js";
import type { Prescription } from "../../types/index.js";

export function savePrescription(
  userId: number,
  data: {
    drugName: string;
    dosage: string;
    frequency: string;
    prescribedAt: string;
    duration?: string;
    doctor?: string;
  }
): Prescription {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO prescriptions (user_id, drug_name, dosage, frequency, prescribed_at, duration, doctor)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(userId, data.drugName, data.dosage, data.frequency, data.prescribedAt, data.duration ?? null, data.doctor ?? null);

  return {
    id: result.lastInsertRowid as number,
    userId,
    drugName: data.drugName,
    dosage: data.dosage,
    frequency: data.frequency,
    prescribedAt: data.prescribedAt,
    duration: data.duration ?? null,
    doctor: data.doctor ?? null,
  };
}

export function getPrescriptionsByUser(userId: number): Prescription[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, user_id as userId, drug_name as drugName, dosage, frequency,
              prescribed_at as prescribedAt, duration, doctor
       FROM prescriptions WHERE user_id = ? ORDER BY prescribed_at DESC`
    )
    .all(userId) as Prescription[];
}
