// 안내 문서(knowledge/site-guide.md)를 청크로 자르고 Upstage 로 임베딩해서 Supabase 에 저장합니다.
//   npm run ingest            -> 저장
//   npm run ingest -- --dry   -> 저장하지 않고 청크만 확인
import { existsSync, readFileSync } from "node:fs";
import { parseSections, buildChunks } from "../lib/chunk.js";
import { embed, replaceChunks } from "../lib/rag.js";

if (existsSync(".env")) process.loadEnvFile(".env");
const dryRun = process.argv.includes("--dry");
const verbose = process.argv.includes("--show");

const guide = readFileSync(new URL("../knowledge/site-guide.md", import.meta.url), "utf8");
const sections = parseSections(guide);
const chunks = buildChunks(sections);

console.log(`섹션 ${sections.length}개 -> 청크 ${chunks.length}개`);
for (const c of chunks) {
  const { overlap_chars: o } = c.metadata;
  const body = c.content.length - c.title.length - 3; // "[제목] " 제외
  const info = o ? ` (앞 청크와 ${o}자 겹침, 청크의 ${Math.round((o / body) * 100)}%)` : "";
  console.log(`- ${c.id} ${c.title}: ${c.content.length}자${info}`);
  if (verbose) console.log(`    ${c.content}\n`);
}

if (dryRun) {
  console.log("\n--dry: 저장하지 않고 끝냅니다.");
  process.exit(0);
}

// Upstage 는 한 번에 최대 100개까지 받음
const BATCH = 50;
const rows = [];
for (let i = 0; i < chunks.length; i += BATCH) {
  const batch = chunks.slice(i, i + BATCH);
  const vectors = await embed(batch.map((c) => c.content), "passage");
  batch.forEach((c, j) => rows.push({ ...c, embedding: vectors[j] }));
  console.log(`임베딩 ${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
}

await replaceChunks(rows);
console.log(`Supabase 에 ${rows.length}개 청크를 저장했습니다. (벡터 차원: ${rows[0].embedding.length})`);
