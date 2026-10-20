import { mkdirSync, writeFileSync, existsSync, cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lambdaDir = join(root, "dist/lambda");
const staticDir = join(root, "dist/static");

mkdirSync(lambdaDir, { recursive: true });
mkdirSync(join(lambdaDir, ".next"), { recursive: true });
mkdirSync(staticDir, { recursive: true });

if (!existsSync(join(lambdaDir, "server.js"))) {
  writeFileSync(
    join(lambdaDir, "server.js"),
    `const http = require("node:http");
const port = Number(process.env.PORT || 8080);
http
  .createServer((req, res) => {
    if ((req.url || "").startsWith("/api/health")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, stub: true }));
      return;
    }
    res.writeHead(503, { "content-type": "text/plain" });
    res.end("Run npm run lambda:build before deploy.");
  })
  .listen(port);
`,
  );
}

writeFileSync(
  join(lambdaDir, "run.sh"),
  `#!/bin/bash
set -euo pipefail
exec node server.js
`,
  { mode: 0o755 },
);

writeFileSync(join(staticDir, ".keep"), "");

const publicDir = join(root, "public");
if (existsSync(publicDir)) {
  cpSync(publicDir, staticDir, { recursive: true });
}
