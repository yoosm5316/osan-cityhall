// Upstage 임베딩 · Supabase 벡터 검색 · OpenAI 답변 생성
// 외부 라이브러리 없이 fetch 만 사용합니다.

const UPSTAGE_URL = "https://api.upstage.ai/v1/embeddings";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
export const CHAT_MODEL = "gpt-5-mini";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`환경변수 ${name} 가 설정되지 않았습니다.`);
  return value;
}

// Supabase REST 호출 헤더. 새 형식 키(sb_...)는 apikey 헤더만, 예전 JWT 키는 Authorization 도 함께 보냄
function supabaseHeaders(key) {
  const headers = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function checkedJson(res, label) {
  const body = await res.text();
  if (!res.ok) throw new Error(`${label} 요청 실패 (${res.status}): ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : null; // 삭제·저장 요청은 본문 없이 성공을 알려 줌
}

// kind: "passage"(저장할 문서) | "query"(사용자 질문)
export async function embed(texts, kind) {
  const res = await fetch(UPSTAGE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireEnv("UPSTAGE_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: `embedding-${kind}`, input: texts }),
  });
  const json = await checkedJson(res, "Upstage 임베딩");
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

// 질문 임베딩과 가장 비슷한 청크 찾기 (공개 키로 읽기 전용 함수만 호출)
export async function searchChunks(queryEmbedding, { count = 5, minSimilarity = 0.2 } = {}) {
  const url = requireEnv("SUPABASE_URL");
  const res = await fetch(`${url}/rest/v1/rpc/match_osan_chunks`, {
    method: "POST",
    headers: supabaseHeaders(requireEnv("SUPABASE_ANON_KEY")),
    body: JSON.stringify({
      query_embedding: JSON.stringify(queryEmbedding),
      match_count: count,
      min_similarity: minSimilarity,
    }),
  });
  return checkedJson(res, "Supabase 검색");
}

// 청크 저장 (관리자 키 필요 - 로컬 ingest 스크립트에서만 사용)
export async function replaceChunks(rows) {
  const url = requireEnv("SUPABASE_URL");
  const headers = supabaseHeaders(requireEnv("SUPABASE_SERVICE_ROLE_KEY"));

  await checkedJson(
    await fetch(`${url}/rest/v1/osan_chunks?id=not.is.null`, { method: "DELETE", headers }),
    "Supabase 기존 청크 삭제"
  );
  await checkedJson(
    await fetch(`${url}/rest/v1/osan_chunks`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(rows.map((r) => ({ ...r, embedding: JSON.stringify(r.embedding) }))),
    }),
    "Supabase 청크 저장"
  );
}

const SYSTEM_PROMPT = `너는 '오산시청 홈페이지(실습용)'의 안내 챗봇이야.
- 아래 [참고 자료]에 있는 내용만 근거로 답해. 자료에 없는 내용은 지어내지 말고 "홈페이지 자료에서는 찾을 수 없어요"라고 말한 뒤, 관련 있어 보이는 부서나 민원실 문의를 권해.
- 어르신과 어린이도 이해하도록 쉬운 말과 존댓말로, 3~6문장 정도로 짧게 답해.
- 어느 부서의 정보인지 부서 이름을 꼭 밝혀.
- 이 홈페이지의 부서·활동 정보는 학습용 예시라는 점을 기억해. 실제 신청이나 급한 민원은 오산시 공식 창구에서 확인하라고 안내해.
- 개인정보(주민등록번호, 전화번호 등)를 묻거나 받지 마.`;

export async function generateAnswer(question, history, chunks) {
  const context = chunks.length
    ? chunks.map((c, i) => `(${i + 1}) ${c.content}`).join("\n\n")
    : "(관련 자료를 찾지 못함)";

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      reasoning_effort: "low",
      max_completion_tokens: 2000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
        { role: "user", content: `[참고 자료]\n${context}\n\n[질문]\n${question}` },
      ],
    }),
  });
  const json = await checkedJson(res, "OpenAI 답변");
  return json.choices[0]?.message?.content?.trim() || "죄송해요, 답변을 만들지 못했어요. 다시 한번 물어봐 주세요.";
}
