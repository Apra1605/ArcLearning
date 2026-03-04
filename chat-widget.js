import { apiCandidates, getApiBase } from "./api-base.js";

const STORE_KEY = "arclearn_chat_v1";

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function nowHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getContext() {
  const h1 = document.querySelector("h1");
  return {
    title: document.title || "",
    h1: h1 ? (h1.textContent || "").trim() : "",
    url: window.location.href,
  };
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") return { open: false, messages: [] };
    const msgs = Array.isArray(parsed.messages) ? parsed.messages : [];
    return {
      open: Boolean(parsed.open),
      messages: msgs
        .filter((m) => m && typeof m === "object")
        .map((m) => ({ role: String(m.role || ""), content: String(m.content || ""), ts: Number(m.ts || 0) }))
        .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim())
        .slice(-40),
    };
  } catch {
    return { open: false, messages: [] };
  }
}

function saveStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

function mount() {
  // Avoid duplicate mounts if multiple scripts are included.
  if (document.getElementById("arclearnChatFab")) return;

  const store = loadStore();

  const fab = el("button", "arclearn-chat-fab");
  fab.id = "arclearnChatFab";
  fab.type = "button";
  fab.title = "Ask ArcLearn";
  fab.setAttribute("aria-label", "Open ArcLearn chat");
  fab.textContent = "?";

  const panel = el("section", "arclearn-chat-panel");
  panel.id = "arclearnChatPanel";
  panel.setAttribute("aria-label", "ArcLearn chat panel");

  const head = el("div", "arclearn-chat-head");
  const title = el("div", "arclearn-chat-title");
  title.appendChild(el("span", "arclearn-chat-pill", "Help"));
  title.appendChild(el("span", "", "Ask ArcLearn"));

  const actions = el("div", "arclearn-chat-actions");
  const clearBtn = el("button", "arclearn-chat-iconbtn", "Clear");
  clearBtn.type = "button";
  clearBtn.title = "Clear chat";
  const closeBtn = el("button", "arclearn-chat-iconbtn", "Close");
  closeBtn.type = "button";
  closeBtn.title = "Close chat";
  actions.appendChild(clearBtn);
  actions.appendChild(closeBtn);

  head.appendChild(title);
  head.appendChild(actions);

  const body = el("div", "arclearn-chat-body");
  const meta = el("div", "arclearn-chat-meta", "Tip: paste your question or the problem you are stuck on.");
  body.appendChild(meta);

  const foot = el("div", "arclearn-chat-foot");
  const row = el("div", "arclearn-chat-row");
  const input = el("textarea", "arclearn-chat-input");
  input.placeholder = "Ask a question…";
  input.rows = 1;
  const sendBtn = el("button", "arclearn-chat-send", "Send");
  sendBtn.type = "button";
  row.appendChild(input);
  row.appendChild(sendBtn);

  const hint = el("div", "arclearn-chat-hint", "Enter to send. Shift+Enter for a new line.");
  foot.appendChild(row);
  foot.appendChild(hint);

  panel.appendChild(head);
  panel.appendChild(body);
  panel.appendChild(foot);

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  function setOpen(open) {
    panel.classList.toggle("open", open);
    store.open = open;
    saveStore(store);
    if (open) {
      setTimeout(() => input.focus(), 0);
      scrollToBottom();
    }
  }

  function scrollToBottom() {
    body.scrollTop = body.scrollHeight;
  }

  function render() {
    // Keep meta at top, then messages.
    body.innerHTML = "";
    body.appendChild(meta);
    for (const m of store.messages) {
      const bubble = el("div", `arclearn-chat-msg ${m.role}`);
      bubble.textContent = m.content;
      body.appendChild(bubble);
    }
    scrollToBottom();
  }

  function addMsg(role, content) {
    store.messages.push({ role, content: String(content || "").trim(), ts: Date.now() });
    store.messages = store.messages.slice(-40);
    saveStore(store);
    render();
  }

  function clearAll() {
    store.messages = [];
    saveStore(store);
    render();
  }

async function send() {
    const text = String(input.value || "").trim();
    if (!text) return;

    input.value = "";
    input.style.height = "auto";
    addMsg("user", text);

    sendBtn.disabled = true;
    input.disabled = true;
    addMsg("assistant", "Thinking...");

    // Replace the last assistant placeholder with the real reply.
    const placeholderIndex = store.messages.length - 1;

    async function postJson(url) {
      return await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: getContext(),
          messages: store.messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role, content: m.content }))
            // Don't send huge histories.
            .slice(-18)
            // Avoid sending the placeholder
            .filter((m) => m.content !== "Thinking..."),
        }),
      });
    }

    try {
      const candidates = apiCandidates("/api/chat");
      if (!candidates.length) {
        store.messages[placeholderIndex] = {
          role: "assistant",
          content:
            "Error: No API base set. Set window.ARCLEARN_API_BASE (or localStorage arclearn_api_base_v1) to your Cloudflare Worker URL.",
          ts: Date.now(),
        };
        saveStore(store);
        render();
        return;
      }
      let lastResp = null;
      for (const url of candidates) {
        try {
          const resp = await postJson(url);
          lastResp = resp;
          if (resp.status === 404) continue;
          const json = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            const errMsg = json?.error || `Request failed (${resp.status})`;
            store.messages[placeholderIndex] = { role: "assistant", content: `Error: ${errMsg}`, ts: Date.now() };
            saveStore(store);
            render();
            return;
          }
          const reply = String(json?.reply || "").trim() || "No reply.";
          store.messages[placeholderIndex] = { role: "assistant", content: reply, ts: Date.now() };
          saveStore(store);
          render();
          return;
        } catch {
          // try next candidate
        }
      }

      store.messages[placeholderIndex] = {
        role: "assistant",
        content:
          lastResp && lastResp.status === 404
            ? "Error: Chat API not found."
            : getApiBase()
              ? "Error: Could not reach the chat server."
              : "Error: No API base set for Cloudflare Worker.",
        ts: Date.now(),
      };
      saveStore(store);
      render();
    } catch (e) {
      store.messages[placeholderIndex] = { role: "assistant", content: `Error: ${String(e?.message || e)}`, ts: Date.now() };
      saveStore(store);
      render();
    } finally {
      sendBtn.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  fab.addEventListener("click", () => setOpen(!panel.classList.contains("open")));
  closeBtn.addEventListener("click", () => setOpen(false));
  clearBtn.addEventListener("click", () => clearAll());
  sendBtn.addEventListener("click", () => send());

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${clamp(input.scrollHeight, 38, 120)}px`;
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  // Initial render/open state.
  render();
  setOpen(Boolean(store.open));
  if (store.messages.length === 0) {
    addMsg(
      "assistant",
      `Hi! I can help explain concepts, walk through problems, or check your work.\n\nWhat are you working on right now? (${nowHHMM()})`
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
