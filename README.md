# 오산시청 홈페이지 (실습용) + RAG 안내 챗봇

학습용으로 만든 오산시청 안내 홈페이지입니다. 오산시의 공식 누리집이 아니며, 부서·활동 정보는 예시입니다.

- 부서 안내: 4개 분야 13개 부서, 부서별 주요 임무와 팀
- 활동 사진: 부서별 활동 갤러리와 크게 보기
- 누구나 쉬운 이용: 글자 크기 조절, 고대비 모드, 키보드 이용
- 안내 챗봇: 홈페이지 안내서를 근거로 답하는 RAG 챗봇

## 챗봇 구조

```
knowledge/site-guide.md  ──(청킹: 220자, 앞뒤 15% 겹침)──▶  Upstage embedding-passage (4096차원)
                                                               │
                                                               ▼
                                                 Supabase  public.osan_chunks (pgvector)
                                                               ▲
질문 ─▶ /api/chat ─▶ Upstage embedding-query ─▶ match_osan_chunks (코사인 유사도 상위 5개)
                          └──────────────▶ OpenAI gpt-5-mini (참고 자료로 답변) ─▶ 답변 + 출처
```

| 파일 | 역할 |
| --- | --- |
| `knowledge/site-guide.md` | 챗봇이 참고하는 홈페이지 안내서 (내용을 바꾸면 다시 `npm run ingest`) |
| `lib/chunk.js` | 섹션 나누기, 겹치는 청크 만들기 |
| `lib/rag.js` | Upstage 임베딩, Supabase 검색·저장, OpenAI 답변 |
| `api/chat.js` | Vercel 서버리스 함수 `POST /api/chat` |
| `scripts/ingest.mjs` | 안내서를 청크로 잘라 임베딩 후 Supabase 에 저장 |
| `supabase/migrations/` | 테이블과 검색 함수 SQL |
| `chat.js`, `chat.css` | 화면 오른쪽 아래 챗봇 창 |

## 처음 설정

1. `.env.example` 을 `.env` 로 복사하고 키를 채웁니다.
2. 안내서를 청크로 잘라 저장합니다.

   ```bash
   npm run ingest -- --dry   # 저장 없이 청크와 겹침 비율만 확인
   npm run ingest            # Supabase 에 저장
   ```

3. 로컬에서 확인: `npm run dev` 후 http://localhost:3000
4. 테스트: `npm test`

## 배포 (Vercel)

GitHub 저장소를 Vercel 에 연결하고 환경변수 4개를 등록합니다.

| 이름 | 값 |
| --- | --- |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | Supabase 공개 키 (publishable) |
| `UPSTAGE_API_KEY` | Upstage API 키 |
| `OPENAI_API_KEY` | OpenAI API 키 |

`SUPABASE_SERVICE_ROLE_KEY` 는 청크 저장용이라 Vercel 에 넣지 않습니다.
