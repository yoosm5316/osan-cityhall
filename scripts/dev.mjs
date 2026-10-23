// 로컬 테스트용 서버: 정적 파일 + /api/chat (배포 전에 챗봇을 확인할 때 사용)
//   npm run dev  ->  http://localhost:3000
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import handler from "../api/chat.js";

// 어느 폴더에서 실행해도 프로젝트 폴더의 파일과 .env 를 쓰도록 함
const ROOT = fileURLToPath(new URL("..", import.meta.url)).replace(/[\\/]$/, "");
const ENV_FILE = join(ROOT, ".env");
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const PORT = Number(process.env.PORT || 3000);
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg" };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/chat") {
    let raw = "";
    for await (const part of req) raw += part;
    req.body = raw ? JSON.parse(raw) : {};
    res.status = (code) => ((res.statusCode = code), res);
    res.json = (data) => {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(data));
    };
    return handler(req, res);
  }

  const path = normalize(join(ROOT, url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname)));
  if (!path.startsWith(ROOT) || !existsSync(path) || !statSync(path).isFile() || path.includes(".env")) {
    res.statusCode = 404;
    return res.end("Not found");
  }
  res.setHeader("Content-Type", `${TYPES[extname(path)] || "application/octet-stream"}; charset=utf-8`);
  res.end(readFileSync(path));
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
