-- 챗봇 RAG 용 청크 저장 테이블과 유사도 검색 함수
create extension if not exists vector with schema extensions;

create table if not exists public.osan_chunks (
  id text primary key,                         -- 예: s4-1-0 (안내서 4-1 섹션의 첫 번째 청크)
  doc_id text not null,                        -- 안내서 섹션 id (예: s4-1)
  title text not null,                         -- 섹션 제목 (예: 행정·소통 분야 부서 > 기획예산과)
  content text not null,                       -- 앞뒤가 겹치게 자른 청크
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(4096) not null,  -- Upstage embedding-passage (4096차원)
  created_at timestamptz not null default now()
);

-- 홈페이지에 공개된 내용이라 누구나 읽을 수 있지만, 쓰기는 관리자 키(service role)만 가능
alter table public.osan_chunks enable row level security;

drop policy if exists "osan chunks are publicly readable" on public.osan_chunks;
create policy "osan chunks are publicly readable"
  on public.osan_chunks for select
  to anon, authenticated
  using (true);

-- 청크 수가 적어서 인덱스 없이 전체 비교(정확한 검색)로 충분합니다.
create or replace function public.match_osan_chunks(
  query_embedding extensions.vector(4096),
  match_count int default 5,
  min_similarity float default 0.2
)
returns table (id text, doc_id text, title text, content text, metadata jsonb, similarity float)
language sql
stable
security invoker
set search_path = ''
as $$
  select d.id, d.doc_id, d.title, d.content, d.metadata,
         1 - (d.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.osan_chunks d
  where 1 - (d.embedding operator(extensions.<=>) query_embedding) >= min_similarity
  order by d.embedding operator(extensions.<=>) query_embedding
  limit least(match_count, 10);
$$;

grant execute on function public.match_osan_chunks(extensions.vector, int, float) to anon, authenticated;
