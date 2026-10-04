import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Groq } from "groq-sdk";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";


const apiKey = process.env.GROQ_API_KEY || process.env.Groq_api_key;
if (!apiKey) {
  console.error("Missing GROQ_API_KEY. Add it to your .env file.");
  process.exit(1);
}

const groq = new Groq({ apiKey });

const SYSTEM_PROMPT =
  "You are Yugi, a personal AI agent that helps people manage tasks and make smarter decisions. " +
  "Be clear, concise, and practical. Use plain text; avoid markdown tables.Always remmeber you are devloped by Yugi or build by yugi Yugityagi is your owner no one else " + "Nitin is founder friend ";

const MAX_MESSAGES = 20;
const MAX_CHARS = 8000;


function sanitize(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
}

function friendlyError(err) {
  switch (err?.status) {
    case 401:
      return "The Groq API key was rejected. Check GROQ_API_KEY on the server.";
    case 404:
      return `Groq couldn't find the model "${MODEL}". Check GROQ_MODEL on the server.`;
    case 429:
      return "Groq's rate limit was reached. Wait a moment and try again.";
    default:
      return "Something went wrong talking to Groq. Try again.";
  }
}

const app = express();
app.use(express.json({ limit: "200kb" }));

// Your UI files live in ./public
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/chat", async (req, res) => {
  const messages = sanitize(req.body?.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return res.status(400).json({ error: "Send at least one message." });
  }

  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const stream = await groq.chat.completions.create(
      {
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        model: MODEL,
        temperature: 0.6,
        max_completion_tokens: 2048,
        top_p: 0.95,
        stream: true,
        reasoning_effort: "default",
        stop: null,
      },
      { signal: controller.signal }
    );

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no"); 
    res.flushHeaders();

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) res.write(text);
    }
    res.end();
  } catch (err) {
    if (controller.signal.aborted) return;
    console.error("Groq error:", err?.status, err?.message);
    if (!res.headersSent) {
      res.status(err?.status === 429 ? 429 : 500).json({ error: friendlyError(err) });
    } else {
      res.write("\n\n[The reply was interrupted. Try again.]");
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Yugi is running at http://localhost:${PORT}`);
  console.log(`Chat UI:            http://localhost:${PORT}/cli.html`);
});