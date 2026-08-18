// web/call-agent-server.mjs
//
// career-verify 에이전트를 실제로 호출하는 로컬 서버.
// - GET  *        : web/ 폴더 정적 파일 서빙 (index.html, app.js, style.css)
// - POST /api/verify : 업무 기록 텍스트를 받아 career-verify 지시문 + 판정 기준과 함께
//                        Anthropic API에 전달하고 검증 결과를 반환
//
// 같은 서버가 화면과 API를 함께 서빙하므로 CORS 문제가 없음.
// 외부 패키지 없이 Node.js 내장 모듈(http, fs, node:fetch)만 사용함.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");      // 프로젝트 최상위
const WEB_DIR = __dirname;                            // web/
const ENV_PATH = path.join(ROOT_DIR, ".env");
const VERIFY_AGENT_PATH = path.join(ROOT_DIR, ".claude", "agents", "verify.md");
const RECORD_FORMAT_PATH = path.join(ROOT_DIR, "docs", "record-format.md");

const PORT = Number(process.env.PORT) || 8787;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

// --- .env 파싱 (프로젝트 최상위 .env만 읽는다) ---
async function loadEnv(filePath) {
  const env = {};
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch {
    return env; // .env가 없으면 빈 값
  }
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

// verify.md가 지시한 "## 검증 결과" 형식(- 확인 항목: / - 미확인 항목: / ...)에서
// 각 항목 텍스트를 추출한다.
function parseVerifyResult(text) {
  const labels = [
    ["확인_항목", "확인 항목"],
    ["미확인_항목", "미확인 항목"],
    ["이력서_사용_가능_항목", "이력서 사용 가능 항목"],
    ["추가_확인_질문", "추가 확인 질문"],
  ];
  const result = {};
  for (let i = 0; i < labels.length; i++) {
    const [key, label] = labels[i];
    const nextLabel = labels[i + 1]?.[1];
    const startMatch = text.match(new RegExp(`-\\s*${label}\\s*:`));
    if (!startMatch) {
      result[key] = "";
      continue;
    }
    const startIdx = startMatch.index + startMatch[0].length;
    let endIdx = text.length;
    if (nextLabel) {
      const endMatch = text.slice(startIdx).match(new RegExp(`-\\s*${nextLabel}\\s*:`));
      if (endMatch) endIdx = startIdx + endMatch.index;
    }
    result[key] = text.slice(startIdx, endIdx).trim();
  }
  return result;
}

async function callVerifyAgent(recordText) {
  const env = await loadEnv(ENV_PATH);
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("최상위 .env에 ANTHROPIC_API_KEY 값이 없습니다.");
  }

  const [agentInstruction, recordFormat] = await Promise.all([
    readFile(VERIFY_AGENT_PATH, "utf8"),
    readFile(RECORD_FORMAT_PATH, "utf8"),
  ]);

  // .claude/agents/verify.md 역할 지시문을 그대로 시스템 지시문으로 사용
  const systemPrompt = agentInstruction;

  // docs/record-format.md의 확인·미확인 판정 기준 + 검증할 업무 기록 텍스트를 함께 전달
  const userPrompt = [
    "## 확인·미확인 판정 기준 (docs/record-format.md)",
    recordFormat,
    "",
    "## 검증할 업무 기록 텍스트",
    recordText,
  ].join("\n");

  const inputChars = recordText.length;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Anthropic API 호출 실패 (status ${response.status}): ${detail.slice(0, 200)}`);
  }

  const data = await response.json();
  const outputText = (data.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return {
    result: parseVerifyResult(outputText),
    usage: {
      inputChars,
      outputChars: outputText.length,
    },
  };
}

// --- 정적 파일 서빙 (web/ 하위만 허용) ---
async function serveStatic(req, res) {
  const urlPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const filePath = path.join(WEB_DIR, decodeURIComponent(urlPath));
  if (!filePath.startsWith(WEB_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const content = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/verify") {
    try {
      const bodyText = await readBody(req);
      const body = bodyText ? JSON.parse(bodyText) : {};
      const recordText = (body.recordText || "").trim();
      if (!recordText) {
        throw new Error("검증할 업무 기록 텍스트가 비어 있습니다.");
      }
      const { result, usage } = await callVerifyAgent(recordText);
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true, result, usage }));
    } catch (err) {
      // API 키·원문 등 민감정보는 절대 응답에 담지 않고, 화면 표시용 한글 메시지만 반환
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          ok: false,
          error: `검증 요청 처리 중 오류가 발생했습니다: ${err.message}`,
        })
      );
    }
    return;
  }

  if (req.method === "GET") {
    await serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method Not Allowed");
});

server.listen(PORT, () => {
  console.log(`career-verify 서버 실행 중: http://localhost:${PORT}`);
});
