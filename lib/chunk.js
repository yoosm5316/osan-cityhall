// 안내 문서(knowledge/site-guide.md)를 제목 단위로 나눈 뒤, 앞뒤가 10~20% 겹치도록 청크로 자릅니다.
// 겹치는 부분이 있으면 청크 경계에서 끊긴 문장의 앞뒤 문맥을 챗봇이 함께 볼 수 있습니다.

export const CHUNK_SIZE = 220; // 청크 한 개의 목표 글자 수 (섹션 제목은 따로 붙음)
export const OVERLAP_RATIO = 0.15; // 앞 청크 끝부분을 다음 청크 앞에 붙이는 비율 (10~20% 사이)

// 마크다운 -> 섹션 목록. "## 4. 행정·소통 분야 부서" 아래 "### 4-1. 기획예산과" 는
// 제목 "행정·소통 분야 부서 > 기획예산과" 인 섹션 하나가 됩니다.
export function parseSections(markdown) {
  const sections = [];
  let h2 = "";
  let current = null;

  const flush = () => {
    if (current && current.lines.join("").trim()) {
      sections.push({ id: current.id, title: current.title, text: current.lines.join("\n").trim() });
    }
    current = null;
  };

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (!heading) {
      current?.lines.push(line);
      continue;
    }
    flush();
    const [, hashes, raw] = heading;
    const num = raw.match(/^(\d+(?:-\d+)?)\.\s*/);
    const name = num ? raw.slice(num[0].length) : raw;
    if (hashes.length === 2) h2 = name;
    const title = hashes.length === 3 && h2 ? `${h2} > ${name}` : name;
    const id = num ? `s${num[1]}` : `s${sections.length}-intro`;
    current = { id, title, lines: [] };
  }
  flush();
  return sections;
}

// 문장 단위로 나누기 (줄바꿈, 마침표·물음표·느낌표 뒤)
function splitSentences(text) {
  return text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// 겹침이 완성된 청크 길이의 ratio(기본 15%)가 되도록 앞 청크 끝에서 가져올 글자 수 계산
// overlap / (overlap + body) = ratio  ->  overlap = body * ratio / (1 - ratio)
// 단어 중간에서 시작하지 않도록 공백에 맞추되, 겹침이 청크의 10~20% 를 벗어나지 않게 함
function tailOverlap(prev, body, ratio) {
  const len = (o) => o / (o + 1 + body.length);
  const target = Math.min(Math.round((body.length * ratio) / (1 - ratio)), Math.floor(prev.length / 2));
  const start = prev.length - target;

  const after = prev.indexOf(" ", start);
  if (after !== -1 && len(prev.length - after - 1) >= 0.1) return prev.slice(after + 1);
  const before = prev.lastIndexOf(" ", start);
  if (before !== -1 && len(prev.length - before - 1) <= 0.2) return prev.slice(before + 1);
  return prev.slice(start);
}

// 너무 긴 문장은 글자 수로 잘라 둠
function hardSplit(sentence, size) {
  const parts = [];
  for (let i = 0; i < sentence.length; i += size) parts.push(sentence.slice(i, i + size));
  return parts;
}

export function chunkText(text, { size = CHUNK_SIZE, overlapRatio = OVERLAP_RATIO } = {}) {
  const sentences = splitSentences(text).flatMap((s) => (s.length > size ? hardSplit(s, size) : [s]));

  // 1) 문장을 끊지 않고 묶되, 마지막 청크만 짧게 남지 않도록 비슷한 길이로 나누기
  const total = sentences.join(" ").length;
  const limit = Math.min(size, Math.ceil(total / Math.ceil(total / size)) + 30);
  const bodies = [];
  let current = "";
  for (const s of sentences) {
    if (current && current.length + 1 + s.length > limit) {
      bodies.push(current);
      current = s;
    } else {
      current = current ? `${current} ${s}` : s;
    }
  }
  if (current) bodies.push(current);

  // 2) 두 번째 청크부터 앞 청크 끝부분을 붙여 겹치게 만들기
  return bodies.map((body, i) => {
    if (i === 0) return { content: body, overlap: 0 };
    const overlap = tailOverlap(bodies[i - 1], body, overlapRatio);
    return { content: `${overlap} ${body}`, overlap: overlap.length };
  });
}

// 섹션 목록 -> DB에 넣을 청크 목록 (청크마다 섹션 제목을 붙여 어떤 내용인지 잃지 않게 함)
export function buildChunks(sections, options) {
  return sections.flatMap((section) =>
    chunkText(section.text, options).map((c, i, all) => ({
      id: `${section.id}-${i}`,
      doc_id: section.id,
      title: section.title,
      content: `[${section.title}] ${c.content}`,
      metadata: { chunk_index: i, chunk_count: all.length, overlap_chars: c.overlap },
    }))
  );
}
