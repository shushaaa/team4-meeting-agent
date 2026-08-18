// web 화면에서 career-verify 담당자를 실제로 호출하는 자리.
//
// 정적 파일(web/index.html, app.js, style.css)과 POST /api/verify 를
// 같은 로컬 서버에서 함께 서비스해서 브라우저-서버 간 CORS 문제가 생기지 않는다.
//
// - 지시문: .claude/agents/verify.md(역할) + docs/record-format.md(확인·미확인 판정 기준)를
//   이어붙여 그대로 system prompt로 사용한다.
// - 입력: 화면에서 넘어온 업무 기록 텍스트 한 덩어리.
// - 출력: 확인 항목 / 미확인 항목 / 이력서 사용 가능 항목 / 추가 확인 질문 + 입출력 글자 수.
// - 열쇠: 저장소 최상위 .env 의 ANTHROPIC_API_KEY만 서버 쪽에서 읽는다.
//   이 파일 안에는 값을 적지 않고, 응답 JSON·로그·브라우저 쪽 코드 어디에도 노출하지 않는다.
//
// 실행: node web/call-agent-server.mjs
// 접속: http://localhost:8787

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const WEB_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(WEB_DIR, "..");
const ENV_PATH = path.join(REPO_ROOT, ".env");
const AGENT_PROMPT_PATH = path.join(REPO_ROOT, ".claude", "agents", "verify.md");
const RECORD_FORMAT_PATH = path.join(REPO_ROOT, "docs", "record-format.md");

const PORT = Number(process.env.PORT) || 8787;
const MODEL = process.env.AGENT_MODEL || "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";
const MAX_BODY_BYTES = 200_000; // 업무 기록 한 덩어리치고 충분히 넉넉한 상한

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const SECTION_LABELS = ["확인 항목", "미확인 항목", "이력서 사용 가능 항목", "추가 확인 질문"];

/** .env 파일에서 KEY=VALUE 줄을 읽어 값을 돌려준다. (외부 패키지 없이 직접 파싱) */
async function readEnvValue(key) {
  const text = await readFile(ENV_PATH, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() === key) return trimmed.slice(eq + 1).trim();
  }
  return "";
}

/** 모델이 낸 텍스트를 4개 항목(확인/미확인/이력서 사용 가능/추가 확인 질문)으로 나눈다. */
function parseVerifyResult(rawText) {
  const sections = Object.fromEntries(SECTION_LABELS.map((label) => [label, ""]));
  let current = null;

  for (const rawLine of rawText.split(/\r?\n/)) {
    const line = rawLine.replace(/^[-*]\s*/, "").trim();
    const label = SECTION_LABELS.find((l) => line === `${l}:` || line.startsWith(`${l}:`));
    if (label) {
      current = label;
      sections[current] = line.slice(label.length + 1).trim();
      continue;
    }
    if (current && rawLine.trim()) {
      sections[current] = sections[current] ? `${sections[current]}\n${rawLine.trim()}` : rawLine.trim();
    }
  }

  return sections;
}

/** career-verify 담당자를 실제로 호출해서 구조화된 검증 결과를 돌려준다. */
async function callVerifyAgent(inputText) {
  const [agentPrompt, recordFormat, apiKey] = await Promise.all([
    readFile(AGENT_PROMPT_PATH, "utf8"),
    readFile(RECORD_FORMAT_PATH, "utf8"),
    readEnvValue("ANTHROPIC_API_KEY"),
  ]);

  if (!apiKey) {
    throw new Error("서버에 API 키가 설정되지 않았습니다. 최상위 .env 파일의 ANTHROPIC_API_KEY 값을 채워주세요.");
  }

  const systemPrompt = [
    agentPrompt.trim(),
    "---",
    "다음은 확인·미확인 판정 기준과 검증 결과 형식입니다.",
    recordFormat.trim(),
  ].join("\n\n");

  const userMessage = [
    "아래 업무 기록을 검증하고, 반드시 다음 네 항목만 이 순서와 이름 그대로 답하십시오.",
    "(각 줄은 '레이블: 내용' 형식이며, 다른 설명은 덧붙이지 마십시오.)",
    "",
    "확인 항목:",
    "미확인 항목:",
    "이력서 사용 가능 항목:",
    "추가 확인 질문:",
    "",
    "[업무 기록]",
    inputText,
  ].join("\n");

  let res;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
  } catch {
    throw new Error("AI 서버에 연결하지 못했습니다. 네트워크 상태를 확인해 주세요.");
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error?.message ?? "";
    } catch {
      /* 응답 본문을 읽지 못해도 상태 코드만으로 안내한다 */
    }
    throw new Error(`AI 호출에 실패했습니다 (${res.status}).${detail ? ` ${detail}` : ""}`);
  }

  const data = await res.json();
  const rawText = (data.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!rawText) {
    throw new Error("AI 응답이 비어 있습니다. 잠시 후 다시 시도해 주세요.");
  }

  return { sections: parseVerifyResult(rawText), rawText };
}

async function handleVerify(req, res) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      sendJson(res, 413, { ok: false, error: "업무 기록이 너무 깁니다. 조금 줄여서 다시 시도해 주세요." });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    sendJson(res, 400, { ok: false, error: "요청 형식이 올바르지 않습니다." });
    return;
  }

  const inputText = typeof payload.text === "string" ? payload.text.trim() : "";
  if (!inputText) {
    sendJson(res, 400, { ok: false, error: "검증할 업무 기록 글이 비어 있습니다." });
    return;
  }

  try {
    const { sections, rawText } = await callVerifyAgent(inputText);
    sendJson(res, 200, {
      ok: true,
      ...sections,
      inputLength: inputText.length,
      outputLength: rawText.length,
    });
  } catch (err) {
    console.error("[verify] 호출 실패:", err.message);
    sendJson(res, 500, { ok: false, error: err.message || "알 수 없는 오류가 발생했습니다." });
  }
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(data);
}

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const relPath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const filePath = path.resolve(WEB_DIR, relPath);

  // 경로 조작(directory traversal)으로 web/ 밖의 파일에 접근하는 것을 막는다.
  if (!filePath.startsWith(WEB_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const info = await stat(filePath);
    const target = info.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const body = await readFile(target);
    const ext = path.extname(target);
    res.writeHead(200, { "content-type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("파일을 찾을 수 없습니다.");
  }
}

const server = createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/verify") {
    handleVerify(req, res);
    return;
  }
  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }
  res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
  res.end("허용되지 않는 요청입니다.");
});

server.listen(PORT, () => {
  console.log(`career-verify 호출 서버 실행 중: http://localhost:${PORT}`);
});
