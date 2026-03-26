# My Personal Assistant (나만의 개인 비서 에이전트)

## 프로젝트 개요
LangGraph 기반 계층적 멀티 에이전트 텔레그램 봇.
슈퍼바이저가 사용자 의도를 분류하고 전문가 하위 에이전트에게 위임한다.

> **면책**: 정보 참고용이며 전문 상담을 대체하지 않습니다.

## 아키텍처
```
텔레그램 → Supervisor(의도분류) → Doctor/Finance/Fallback → 응답
각 Sub-agent: ReAct 패턴 (model → tool → model → ... → 답변)
```

**라우팅 전략**:
- confidence ≥ 0.6 → 해당 에이전트
- confidence < 0.6 + currentAgent 있음 → 맥락 유지
- confidence < 0.6 + 맥락 없음 → fallback (일반 응답)

## 기술 스택
| 구성 요소 | 기술 |
|-----------|------|
| 런타임 | Node.js 20+ (TypeScript, ESM) |
| 그래프 | LangGraph.js (StateGraph, Annotation) |
| LLM | LM Studio 로컬 (OpenAI 호환 API) |
| 메시징 | Telegram Bot API (grammY) |
| 메모리 | userId:agentId 복합키 슬라이딩 윈도우 |
| DB | SQLite (better-sqlite3) |
| 배포 | Docker / Docker Compose |

## LLM 모델 (LM Studio)
| 용도 | 모델 | 환경변수 |
|------|------|----------|
| 슈퍼바이저 (라우팅) | qwen3-vl-4b-instruct | SUPERVISOR_MODEL |
| 주치의 에이전트 | qwen3-vl-4b-instruct | DOCTOR_MODEL |
| 자산관리 에이전트 | qwen3-vl-4b-instruct | FINANCE_MODEL |
| 이미지 분석 (비전) | qwen3-vl-4b-instruct | LM_STUDIO_VISION_MODEL |

각 에이전트별 모델/URL 독립 설정 가능 (`*_MODEL`, `*_MODEL_URL`).

## 프로젝트 구조
```
src/
├── index.ts                    # 엔트리포인트
├── config/agents.ts            # 에이전트 레지스트리 (모델/프롬프트/도구)
├── bot/telegram.ts             # 텔레그램 봇
├── graph/
│   ├── state.ts                # LangGraph State 정의
│   ├── supervisor.ts           # 슈퍼바이저 (의도분류 + 라우팅)
│   ├── factory.ts              # Sub-agent subgraph 팩토리
│   └── graph.ts                # 전체 그래프 조립
├── agents/
│   ├── doctor/{index,prompt,tools/*}   # 주치의 에이전트
│   └── finance/{index,prompt}          # 자산관리 에이전트 (스캐폴드)
├── memory/memory.ts            # 복합키 슬라이딩 윈도우 메모리
├── db/{database,schema,repositories/*} # SQLite
└── types/index.ts
```

## 새 에이전트 추가 방법
1. `src/agents/<name>/` 폴더 생성 (prompt.ts, tools/, index.ts)
2. `config/agents.ts`의 레지스트리에 등록
3. 끝. graph/supervisor/telegram 코드 변경 불필요.

## 환경 변수 (.env)
```
TELEGRAM_BOT_TOKEN=
LM_STUDIO_BASE_URL=http://host.docker.internal:1234/v1
LM_STUDIO_VISION_MODEL=qwen3-vl-4b-instruct
MEMORY_WINDOW_SIZE=20
DB_PATH=./data/assistant.db
SUPERVISOR_MODEL=qwen3-vl-4b-instruct
DOCTOR_MODEL=qwen3-vl-4b-instruct
FINANCE_MODEL=qwen3-vl-4b-instruct
```

## 개발 컨벤션
- TypeScript strict mode, ESM
- 함수형 스타일, 클래스는 필요시에만
- 에러 메시지는 한국어
- `.env` 절대 커밋하지 않음

## 빌드 & 실행
```bash
npm run dev              # 개발 모드
npm run build && npm start  # 프로덕션
docker-compose up --build   # Docker
npm test                 # 테스트
```
