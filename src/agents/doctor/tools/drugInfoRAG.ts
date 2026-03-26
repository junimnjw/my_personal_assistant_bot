import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getDb } from "../../../db/database.js";

const API_BASE = "https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList";
const CACHE_TTL_DAYS = 7;

interface DrugCacheRow {
  id: number;
  item_name: string;
  enterprise_name: string | null;
  efficacy: string | null;
  usage_info: string | null;
  precautions_warn: string | null;
  precautions: string | null;
  interactions: string | null;
  side_effects: string | null;
  storage: string | null;
  cached_at: string;
}

interface EasyDrugApiItem {
  itemName?: string;
  entpName?: string;
  efcyQesitm?: string;
  useMethodQesitm?: string;
  atpnWarnQesitm?: string;
  atpnQesitm?: string;
  intrcQesitm?: string;
  seQesitm?: string;
  depositMethodQesitm?: string;
}

function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function isCacheValid(cachedAt: string): boolean {
  const cached = new Date(cachedAt);
  const now = new Date();
  const diffDays = (now.getTime() - cached.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays < CACHE_TTL_DAYS;
}

async function fetchFromApi(drugName: string): Promise<EasyDrugApiItem[]> {
  const apiKey = process.env.DATA_GO_KR_API_KEY;
  if (!apiKey) {
    throw new Error("DATA_GO_KR_API_KEY 환경 변수가 설정되지 않았습니다.");
  }

  const params = new URLSearchParams({
    serviceKey: apiKey,
    itemName: drugName,
    pageNo: "1",
    numOfRows: "5",
    type: "json",
  });

  const url = `${API_BASE}?${params.toString()}`;
  console.log(`[RAG] Fetching: ${url.replace(apiKey, "***")}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API 호출 실패: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  // API 응답 구조: { header: {...}, body: { items: [...] } }
  const items = data?.body?.items;
  if (!items || !Array.isArray(items)) {
    return [];
  }

  return items;
}

function cacheResults(items: EasyDrugApiItem[]): void {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO drug_cache
     (item_name, enterprise_name, efficacy, usage_info, precautions_warn, precautions, interactions, side_effects, storage, cached_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );

  for (const item of items) {
    if (!item.itemName) continue;
    stmt.run(
      item.itemName,
      item.entpName || null,
      stripHtml(item.efcyQesitm),
      stripHtml(item.useMethodQesitm),
      stripHtml(item.atpnWarnQesitm),
      stripHtml(item.atpnQesitm),
      stripHtml(item.intrcQesitm),
      stripHtml(item.seQesitm),
      stripHtml(item.depositMethodQesitm),
    );
  }
}

function formatDrugInfo(row: DrugCacheRow): string {
  const parts: string[] = [];
  parts.push(`[식약처 공인 정보] ${row.item_name}`);
  if (row.enterprise_name) parts.push(`제조사: ${row.enterprise_name}`);
  if (row.efficacy) parts.push(`효능·효과: ${row.efficacy}`);
  if (row.usage_info) parts.push(`용법·용량: ${row.usage_info}`);
  if (row.precautions_warn) parts.push(`경고: ${row.precautions_warn}`);
  if (row.precautions) parts.push(`주의사항: ${row.precautions}`);
  if (row.interactions) parts.push(`상호작용: ${row.interactions}`);
  if (row.side_effects) parts.push(`부작용: ${row.side_effects}`);
  if (row.storage) parts.push(`보관법: ${row.storage}`);
  parts.push(`출처: 식약처 e약은요`);
  return parts.join("\n");
}

export function createGetDrugInfoRagTool() {
  return new DynamicStructuredTool({
    name: "get_drug_info_rag",
    description:
      "식약처 공인 의약품 데이터베이스(e약은요)에서 약물의 효능, 부작용, 주의사항, 복용법, 상호작용을 조회합니다. 약물에 대한 질문이 있을 때 반드시 이 도구를 사용하세요.",
    schema: z.object({
      drugName: z.string().describe("조회할 약물명 (예: 타이레놀, 아스피린)"),
    }),
    func: async (input) => {
      const db = getDb();

      // 1. 캐시 확인
      const cached = db
        .prepare("SELECT * FROM drug_cache WHERE item_name LIKE ? ORDER BY cached_at DESC LIMIT 1")
        .get(`%${input.drugName}%`) as DrugCacheRow | undefined;

      if (cached && isCacheValid(cached.cached_at)) {
        console.log(`[RAG] Cache hit: ${cached.item_name}`);
        return formatDrugInfo(cached);
      }

      // 2. API 호출
      try {
        const items = await fetchFromApi(input.drugName);

        if (items.length === 0) {
          return `식약처 데이터베이스에서 '${input.drugName}'에 대한 정보를 찾을 수 없습니다. 일반적인 의학 지식을 바탕으로 답변해주세요.`;
        }

        // 3. 캐시에 저장
        cacheResults(items);

        // 4. 첫 번째 결과 포맷팅
        const firstItem = items[0];
        const result: DrugCacheRow = {
          id: 0,
          item_name: firstItem.itemName || input.drugName,
          enterprise_name: firstItem.entpName || null,
          efficacy: stripHtml(firstItem.efcyQesitm),
          usage_info: stripHtml(firstItem.useMethodQesitm),
          precautions_warn: stripHtml(firstItem.atpnWarnQesitm),
          precautions: stripHtml(firstItem.atpnQesitm),
          interactions: stripHtml(firstItem.intrcQesitm),
          side_effects: stripHtml(firstItem.seQesitm),
          storage: stripHtml(firstItem.depositMethodQesitm),
          cached_at: new Date().toISOString(),
        };

        // 여러 결과가 있으면 목록도 알려줌
        let response = formatDrugInfo(result);
        if (items.length > 1) {
          const otherNames = items
            .slice(1)
            .map((i) => i.itemName)
            .filter(Boolean)
            .join(", ");
          response += `\n\n관련 약물: ${otherNames}`;
        }

        return response;
      } catch (error) {
        console.error("[RAG] API error:", error);

        // API 실패 시 만료된 캐시라도 사용
        if (cached) {
          return formatDrugInfo(cached) + "\n(캐시된 정보입니다)";
        }

        return `약물 정보 조회 중 오류가 발생했습니다. 일반적인 의학 지식을 바탕으로 답변해주세요.`;
      }
    },
  });
}
