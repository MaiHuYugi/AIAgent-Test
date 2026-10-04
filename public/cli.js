/**
 * YUGI CLI — full-page chat client.
 * Sends the conversation to POST /api/chat and streams the plain-text reply
 * into the terminal as it arrives. No API key or model details live here.
 */
(function () {
  "use strict";

  var scroller = document.getElementById("scroller");
  var thread = document.getElementById("thread");
  var form = document.getElementById("chatForm");
  var input = document.getElementById("chatInput");
  var sendBtn = document.getElementById("sendBtn");
  var statusEl = document.getElementById("status");
  var newChatBtn = document.getElementById("newChat");
  if (!scroller || !thread || !form || !input || !sendBtn) return;

  var API_URL = "/api/chat";
  var MAX_CONTEXT = 20; // most recent messages sent with each request

  var messages = [];   // { role: "user" | "assistant", content: string }
  var sent = [];       // prompts you've sent, for Arrow Up recall
  var sentPos = 0;
  var busy = false;
  var controller = null;

  /* ---------- small helpers ---------- */
  function setStatus(text) { if (statusEl) statusEl.textContent = text; }

  function nearBottom() {
    return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
  }

  function scrollToEnd() { scroller.scrollTop = scroller.scrollHeight; }

  function autoGrow() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
  }

  // Some reasoning models wrap their thinking in <think>…</think>.
  // Hide it (including a half-streamed block) and show only the answer.
  function clean(raw) {
    var t = raw.replace(/<think>[\s\S]*?<\/think>/g, "");
    var open = t.indexOf("<think>");
    if (open !== -1) t = t.slice(0, open);
    t = t.replace(/<(?:\/?(?:t(?:h(?:i(?:n(?:k)?)?)?)?)?)?$/, "");
    return t.replace(/^\s+/, "");
  }

  function setBusy(on) {
    busy = on;
    scroller.setAttribute("aria-busy", on ? "true" : "false");
    sendBtn.textContent = on ? "Stop" : "Send";
    sendBtn.classList.toggle("btn-solid", !on);
    sendBtn.classList.toggle("btn-outline", on);
    if (!on) setStatus("ready");
  }

  /* ---------- rendering ---------- */
  function renderWelcome() {
    var banner = document.createElement("div");
    banner.className = "term-banner";
    banner.textContent = "YUGI";
    var intro = document.createElement("p");
    intro.className = "term-intro";
    intro.textContent = "Your personal AI agent. Ask a question or describe what you're working on.";
    thread.appendChild(banner);
    thread.appendChild(intro);
  }

  function addMessage(role, text) {
    var row = document.createElement("div");
    row.className = "msg msg-" + (role === "user" ? "user" : role === "error" ? "err" : "ai");

    var label = document.createElement("span");
    label.className = "msg-label";
    label.textContent = role === "user" ? "you ›" : "yugi ›";

    var body = document.createElement("div");
    body.className = "msg-body";
    body.textContent = text || "";

    row.appendChild(label);
    row.appendChild(body);
    thread.appendChild(row);
    return { row: row, body: body };
  }

  function resetThread() {
    if (controller) controller.abort();
    messages = [];
    while (thread.firstChild) thread.removeChild(thread.firstChild);
    renderWelcome();
    setBusy(false);
    input.value = "";
    autoGrow();
    input.focus({ preventScroll: true });
  }

  /* ---------- talking to the server ---------- */
  function readError(res) {
    return res.json().then(
      function (data) { return (data && data.error) || "The server returned an error (" + res.status + ")."; },
      function () { return "The server returned an error (" + res.status + ")."; }
    );
  }

  function send(text) {
    text = text.trim();
    if (!text || busy) return;

    if (sent[sent.length - 1] !== text) sent.push(text);
    sentPos = sent.length;

    messages.push({ role: "user", content: text });
    addMessage("user", text);

    var reply = addMessage("ai", "");
    reply.body.classList.add("is-streaming");
    scrollToEnd();

    controller = new AbortController();
    var raw = "";
    var stopped = false;
    setBusy(true);
    setStatus("thinking…");

    function render() {
      var stick = nearBottom();
      var visible = clean(raw);
      reply.body.textContent = visible;
      if (visible) setStatus("replying…");
      if (stick) scrollToEnd();
    }

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.slice(-MAX_CONTEXT) }),
      signal: controller.signal
    })
      .then(function (res) {
        if (!res.ok) {
          return readError(res).then(function (msg) { throw new Error(msg); });
        }
        if (!res.body || !res.body.getReader) {
          return res.text().then(function (t) { raw = t; render(); });
        }
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) return;
            raw += decoder.decode(r.value, { stream: true });
            render();
            return pump();
          });
        }
        return pump();
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") { stopped = true; return; }
        var msg = err && err.message && err.message !== "Failed to fetch"
          ? err.message
          : "Couldn't reach the server. Start it with `node index.js` and open this page from it, not as a file.";
        reply.row.parentNode.removeChild(reply.row);
        var e = addMessage("error", msg);
        e.row.classList.add("msg-err");
        // Roll back so the failed prompt can be sent again.
        messages.pop();
        input.value = text;
        autoGrow();
        raw = "";
        scrollToEnd();
      })
      .then(function () {
        reply.body.classList.remove("is-streaming");
        var answer = clean(raw).trim();
        if (answer) {
          messages.push({ role: "assistant", content: answer });
          if (stopped) {
            var note = document.createElement("span");
            note.className = "term-muted";
            note.textContent = "\n(stopped)";
            reply.body.appendChild(note);
          }
        } else if (stopped) {
          reply.row.parentNode.removeChild(reply.row);
          messages.pop();
          input.value = text;
          autoGrow();
        } else if (reply.row.parentNode) {
          reply.body.textContent = "(no reply)";
          reply.body.classList.add("term-muted");
          messages.pop();
        }
        controller = null;
        setBusy(false);
        scrollToEnd();
        input.focus({ preventScroll: true });
      });
  }

  function stop() { if (controller) controller.abort(); }

  /* ---------- events ---------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) { stop(); return; }
    var text = input.value;
    input.value = "";
    autoGrow();
    send(text);
  });

  input.addEventListener("input", autoGrow);

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    } else if (e.key === "Escape" && busy) {
      e.preventDefault();
      stop();
    } else if (e.key === "ArrowUp" && input.value.indexOf("\n") === -1 && sentPos > 0) {
      e.preventDefault();
      sentPos--;
      input.value = sent[sentPos];
      autoGrow();
    } else if (e.key === "ArrowDown" && input.value.indexOf("\n") === -1 && sentPos < sent.length) {
      e.preventDefault();
      sentPos++;
      input.value = sentPos < sent.length ? sent[sentPos] : "";
      autoGrow();
    }
  });

  scroller.addEventListener("click", function () {
    var sel = window.getSelection && window.getSelection().toString();
    if (!sel) input.focus({ preventScroll: true });
  });

  if (newChatBtn) newChatBtn.addEventListener("click", resetThread);

  /* ---------- start ---------- */
  renderWelcome();
  var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  if (!coarse) input.focus({ preventScroll: true });
})();
