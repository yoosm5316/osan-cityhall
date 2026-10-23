import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSections, chunkText, buildChunks, CHUNK_SIZE } from "../lib/chunk.js";

const guide = readFileSync(new URL("../knowledge/site-guide.md", import.meta.url), "utf8");

test("안내 문서의 모든 부서가 섹션으로 나뉜다", () => {
  const titles = parseSections(guide).map((s) => s.title);
  for (const name of ["기획예산과", "복지정책과", "보건소 건강증진과", "안전정책과"]) {
    assert.ok(titles.some((t) => t.endsWith(`> ${name}`)), `${name} 섹션이 없음`);
  }
});

test("겹치는 부분은 청크 길이의 10~20% 이고, 앞 청크의 끝부분과 같다", () => {
  const sections = parseSections(guide);
  let checked = 0;
  for (const s of sections) {
    const chunks = chunkText(s.text);
    for (let i = 1; i < chunks.length; i++) {
      const { content, overlap } = chunks[i];
      const ratio = overlap / content.length;
      assert.ok(ratio >= 0.1 && ratio <= 0.2, `${s.title} #${i}: ${Math.round(ratio * 100)}%`);
      assert.ok(chunks[i - 1].content.endsWith(content.slice(0, overlap)), `${s.title} #${i}: 앞 청크 끝과 다름`);
      checked++;
    }
  }
  assert.ok(checked > 0, "겹침을 확인할 청크가 하나도 없음");
});

test("청크가 목표 크기를 크게 넘지 않는다", () => {
  for (const c of buildChunks(parseSections(guide))) {
    const body = c.content.length - c.title.length - 3;
    assert.ok(body <= CHUNK_SIZE * 1.25, `${c.id}: ${body}자`);
  }
});

test("모든 청크 id 가 겹치지 않는다", () => {
  const ids = buildChunks(parseSections(guide)).map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});
