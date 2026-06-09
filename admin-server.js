"use strict";

const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const rootDir = __dirname;
const port = Number(process.env.ADMIN_PORT || 4315);
const contentFile = path.join(rootDir, "site-content.json");
const deployDir = path.join(rootDir, ".deploy-personal-site");
const netlifyProductionUrl = "https://flourishing-sprite-5edd07.netlify.app/";

const publicFiles = [
  "index.html",
  "styles.css",
  "script.js",
  "site-content.json",
  "admin.html",
  ".nojekyll",
];

const mimeTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
};

const ensureInsideRoot = (targetPath) => {
  const resolvedRoot = path.resolve(rootDir);
  const resolvedTarget = path.resolve(targetPath);

  if (!resolvedTarget.startsWith(resolvedRoot)) {
    throw new Error(`拒绝访问项目目录外的路径：${resolvedTarget}`);
  }

  return resolvedTarget;
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

const runCommand = (command, args, options = {}) =>
  new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        HTTP_PROXY: "",
        HTTPS_PROXY: "",
        ALL_PROXY: "",
        http_proxy: "",
        https_proxy: "",
        all_proxy: "",
      },
      ...options,
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

const runGit = (args) => runCommand("git", args);

const prepareDeployDirectory = () => {
  const target = ensureInsideRoot(deployDir);

  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }

  fs.mkdirSync(target, { recursive: true });

  publicFiles.forEach((file) => {
    const source = path.join(rootDir, file);

    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(target, file));
    }
  });

  const assetsSource = path.join(rootDir, "assets", "images");
  const assetsTarget = path.join(target, "assets", "images");

  if (fs.existsSync(assetsSource)) {
    fs.mkdirSync(path.dirname(assetsTarget), { recursive: true });
    fs.cpSync(assetsSource, assetsTarget, { recursive: true });
  }

  return target;
};

const cleanupDeployDirectory = () => {
  const target = ensureInsideRoot(deployDir);

  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
};

const publishToGitHub = async () => {
  const steps = [];

  const add = await runGit(["add", "site-content.json", "script.js", "admin.html", "admin-server.js"]);
  steps.push(`git add\n${add.output || "(无输出)"}`);
  if (add.code !== 0) {
    return { ok: false, steps, message: add.output || "Git 暂存失败。" };
  }

  const diff = await runGit(["diff", "--cached", "--quiet"]);
  steps.push(`git diff --cached --quiet\n${diff.output || "(无输出)"}`);

  if (diff.code !== 0) {
    const commit = await runGit(["commit", "-m", "Update homepage content"]);
    steps.push(`git commit -m "Update homepage content"\n${commit.output || "(无输出)"}`);
    if (commit.code !== 0) {
      return { ok: false, steps, message: commit.output || "Git 提交失败。" };
    }
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

  return { ok: true, steps, message: "已提交并推送到 GitHub。" };
};

const deployToNetlify = async () => {
  const steps = [];
  const deployScript = path.join(rootDir, "scripts", "deploy-netlify-production.ps1");

  if (!fs.existsSync(deployScript)) {
    return {
      ok: false,
      steps,
      message: "没有找到 Netlify 部署脚本 scripts/deploy-netlify-production.ps1。",
    };
  }

  const preparedDir = prepareDeployDirectory();

  try {
    const result = await runCommand("powershell", [
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      deployScript,
      "-DeployDir",
      preparedDir,
    ]);
    steps.push(`Netlify deploy\n${result.output || "(无输出)"}`);

    if (result.code !== 0) {
      return { ok: false, steps, message: result.output || "Netlify 部署失败。" };
    }

    return {
      ok: true,
      steps,
      message: `Netlify 生产站已更新：${netlifyProductionUrl}`,
      url: netlifyProductionUrl,
    };
  } finally {
    cleanupDeployDirectory();
  }
};

const publishSite = async () => {
  const github = await publishToGitHub();

  if (!github.ok) {
    return github;
  }

  const netlify = await deployToNetlify();
  const steps = [...(github.steps || []), ...(netlify.steps || [])];

  if (!netlify.ok) {
    return {
      ok: false,
      steps,
      message: `${github.message}\n但 Netlify 同步失败：${netlify.message}`,
    };
  }

  return {
    ok: true,
    steps,
    url: netlify.url,
    message: `${github.message}\n${netlify.message}`,
  };
};

const isAllowedStaticPath = (relativePath) =>
  publicFiles.includes(relativePath) ||
  relativePath.startsWith(path.join("assets", "images"));

const serveStatic = (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  const pathname = url.pathname === "/" ? "/admin.html" : url.pathname;
  const relativePath = path.normalize(decodeURIComponent(pathname).replace(/^\/+/, ""));

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath) || !isAllowedStaticPath(relativePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("未找到页面。");
    return;
  }

  const filePath = ensureInsideRoot(path.join(rootDir, relativePath));
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || "application/octet-stream";

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
    const result = await publishSite();
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
