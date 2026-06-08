"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const rootDir = __dirname;
const port = Number(process.env.ADMIN_PORT || 4315);
const contentFile = path.join(rootDir, "site-content.json");
const allowedFiles = new Set(["/", "/admin.html", "/site-content.json"]);

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
};

const readRequestBody = (request) =>
  new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1024 * 1024) {
        reject(new Error("请求内容过大。"));
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });

const runGit = (args) =>
  new Promise((resolve) => {
    const child = spawn("git", args, {
      cwd: rootDir,
      shell: false,
      windowsHide: true,
    });
    let output = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });
    child.stderr.on("data", (data) => {
      output += data.toString();
    });
    child.on("close", (code) => {
      resolve({ code, output: output.trim() });
    });
  });

const publishToGitHub = async () => {
  const steps = [];

  for (const args of [
    ["add", "site-content.json", "script.js", "admin.html", "admin-server.js"],
    ["diff", "--cached", "--quiet"],
  ]) {
    const result = await runGit(args);
    steps.push(`git ${args.join(" ")}\n${result.output || "(无输出)"}`);

    if (args[0] === "diff" && result.code === 0) {
      return { ok: true, skipped: true, steps, message: "没有检测到需要提交的内容。" };
    }

    if (args[0] !== "diff" && result.code !== 0) {
      return { ok: false, steps, message: result.output || "Git 暂存失败。" };
    }
  }

  const commit = await runGit(["commit", "-m", "Update homepage content"]);
  steps.push(`git commit -m "Update homepage content"\n${commit.output || "(无输出)"}`);
  if (commit.code !== 0) {
    return { ok: false, steps, message: commit.output || "Git 提交失败。" };
  }

  const pushMaster = await runGit(["push", "origin", "master"]);
  steps.push(`git push origin master\n${pushMaster.output || "(无输出)"}`);
  if (pushMaster.code !== 0) {
    return { ok: false, steps, message: pushMaster.output || "推送 master 失败。" };
  }

  const pushPages = await runGit(["push", "origin", "master:gh-pages"]);
  steps.push(`git push origin master:gh-pages\n${pushPages.output || "(无输出)"}`);
  if (pushPages.code !== 0) {
    return { ok: false, steps, message: pushPages.output || "推送 gh-pages 失败。" };
  }

  return { ok: true, skipped: false, steps, message: "已提交并推送到 GitHub Pages。" };
};

const serveStatic = (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  const pathname = url.pathname === "/" ? "/admin.html" : url.pathname;

  if (!allowedFiles.has(pathname)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("未找到页面。");
    return;
  }

  const filePath = path.join(rootDir, pathname.slice(1));
  const ext = path.extname(filePath);
  const contentType = ext === ".json" ? "application/json" : "text/html";

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("读取文件失败。");
      return;
    }

    response.writeHead(200, {
      "Content-Type": `${contentType}; charset=utf-8`,
      "Cache-Control": "no-store",
    });
    response.end(data);
  });
};

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url.startsWith("/api/content")) {
    try {
      const content = JSON.parse(fs.readFileSync(contentFile, "utf8"));
      sendJson(response, 200, { ok: true, content });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message });
    }
    return;
  }

  if (request.method === "POST" && request.url.startsWith("/api/content")) {
    try {
      const body = await readRequestBody(request);
      const payload = JSON.parse(body);

      if (!payload || typeof payload.content !== "object") {
        sendJson(response, 400, { ok: false, message: "请提交合法的站点内容 JSON。" });
        return;
      }

      fs.writeFileSync(contentFile, `${JSON.stringify(payload.content, null, 2)}\n`, "utf8");
      sendJson(response, 200, { ok: true, message: "内容已保存到 site-content.json。" });
    } catch (error) {
      sendJson(response, 500, { ok: false, message: error.message });
    }
    return;
  }

  if (request.method === "POST" && request.url.startsWith("/api/publish")) {
    const result = await publishToGitHub();
    sendJson(response, result.ok ? 200 : 500, result);
    return;
  }

  if (request.method === "GET") {
    serveStatic(request, response);
    return;
  }

  sendJson(response, 405, { ok: false, message: "不支持的请求方法。" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`个人主页后台已启动：http://127.0.0.1:${port}/admin.html`);
});
