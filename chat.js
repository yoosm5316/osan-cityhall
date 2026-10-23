// 오른쪽 아래 안내 챗봇 (서버의 /api/chat 사용)
(() => {
  const SUGGESTIONS = ["예방접종은 어느 부서에서 해요?", "글씨를 크게 보고 싶어요", "시청 민원 시간이 언제예요?", "아동보육과는 무슨 일을 해요?"];
  const history = [];
  let busy = false;

  const root = document.createElement("div");
  root.className = "chatbot";
  root.innerHTML = `
    <button class="chat-toggle" aria-expanded="false" aria-controls="chat-panel">💬 <span>물어보세요</span></button>
    <section class="chat-panel" id="chat-panel" role="dialog" aria-label="오산시청 안내 챗봇" hidden>
      <header class="chat-head">
        <div>
          <strong>오산시청 안내 챗봇</strong>
          <small>홈페이지 안내서를 바탕으로 답해 드려요</small>
        </div>
        <button class="chat-close" aria-label="챗봇 닫기">✕</button>
      </header>
      <div class="chat-log" aria-live="polite"></div>
      <div class="chat-suggest"></div>
      <form class="chat-form">
        <label for="chat-input" class="sr-only">질문 입력</label>
        <input id="chat-input" maxlength="500" placeholder="궁금한 것을 적어 주세요" autocomplete="off" />
        <button type="submit">보내기</button>
      </form>
      <p class="chat-note">개인정보(주민등록번호, 전화번호 등)는 적지 마세요.</p>
    </section>`;
  document.body.appendChild(root);

  const toggle = root.querySelector(".chat-toggle");
  const panel = root.querySelector(".chat-panel");
  const log = root.querySelector(".chat-log");
  const input = root.querySelector("#chat-input");
  const suggest = root.querySelector(".chat-suggest");

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function addMessage(role, text, sources = []) {
    const el = document.createElement("div");
    el.className = `msg ${role}`;
    const chips = sources.length
      ? `<div class="msg-sources">참고: ${sources.map((s) => `<span>${escapeHtml(s.title.split(" > ").pop())}</span>`).join("")}</div>`
      : "";
    el.innerHTML = `<p>${escapeHtml(text).replace(/\n/g, "<br />")}</p>${chips}`;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", open);
    if (open) input.focus();
  }

  async function ask(question) {
    if (busy || !question.trim()) return;
    busy = true;
    suggest.hidden = true;
    addMessage("user", question);
    input.value = "";
    const waiting = addMessage("bot", "답변을 찾고 있어요…");
    waiting.classList.add("waiting");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, history }),
      });
      const data = await res.json().catch(() => ({}));
      waiting.remove();
      if (!res.ok) throw new Error(data.error || "잠시 후 다시 시도해 주세요.");
      addMessage("bot", data.answer, data.sources);
      history.push({ role: "user", content: question }, { role: "assistant", content: data.answer });
    } catch (err) {
      waiting.remove();
      addMessage("bot error", `⚠️ ${err.message}`);
    } finally {
      busy = false;
      input.focus();
    }
  }

  suggest.innerHTML = SUGGESTIONS.map((q) => `<button type="button">${escapeHtml(q)}</button>`).join("");
  addMessage("bot", "안녕하세요! 오산시청 안내 챗봇이에요. 어떤 부서가 무슨 일을 하는지, 홈페이지를 어떻게 쓰는지 물어보세요.");

  toggle.addEventListener("click", () => setOpen(panel.hidden));
  root.querySelector(".chat-close").addEventListener("click", () => {
    setOpen(false);
    toggle.focus();
  });
  suggest.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (btn) ask(btn.textContent);
  });
  root.querySelector(".chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    ask(input.value);
  });
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      toggle.focus();
    }
  });
})();
