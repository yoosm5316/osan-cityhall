// Vercel 서버리스 함수: POST /api/chat  { message, history }
import { embed, searchChunks, generateAnswer } from "../lib/rag.js";

const MAX_MESSAGE = 500;
const MAX_HISTORY = 6;

// 같은 IP에서 1분에 20번까지 (서버 인스턴스별, 최소한의 과금 보호용)
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 20;
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST 요청만 받을 수 있어요." });
  }

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
  if (rateLimited(ip)) {
    return res.status(429).json({ error: "질문이 너무 많아요. 잠시 후 다시 시도해 주세요." });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return res.status(400).json({ error: "질문을 입력해 주세요." });
  if (message.length > MAX_MESSAGE) {
    return res.status(400).json({ error: `질문은 ${MAX_MESSAGE}자 이내로 입력해 주세요.` });
  }

  try {
    const [queryEmbedding] = await embed([message], "query");
    const chunks = await searchChunks(queryEmbedding);
    const answer = await generateAnswer(message, cleanHistory(body.history), chunks);

    // 같은 부서의 청크가 여러 개 나오면 출처는 한 번만 표시
    const sources = [...new Map(chunks.map((c) => [c.doc_id, { id: c.doc_id, title: c.title }])).values()];
    return res.status(200).json({ answer, sources });
  } catch (err) {
    console.error("[chat]", err);
    return res.status(500).json({ error: "답변을 만드는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요." });
  }
}
