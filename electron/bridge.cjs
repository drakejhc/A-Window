// The app's side of "Use with Claude": a tiny HTTP server on 127.0.0.1 that the MCP server (mcp.cjs) calls. Each
// tool call goes to the page over IPC ("planner-request"), where src/planner/actions.ts runs it against the live
// plan, and the page's answer ("planner-reply") goes back. Only requests with the random token from mcp.json are
// accepted, browsers are turned away, and nothing about the plan is logged.
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");

const TIMEOUT_MS = 10_000;
const MAX_BODY = 1_000_000;

/**
 * @param {{ file: () => string, page: () => { send(channel: string, value: unknown): void, isLoading(): boolean, once(event: string, cb: () => void): void } }} opts
 *   `file` is where to write { port, token } for the MCP server; `page` is the main window's webContents.
 */
function createBridge({ file, page }) {
  let server = null;
  let token = "";
  let port = 0;
  let next = 1;
  const pending = new Map();

  const json = (res, status, body) => {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(body));
  };

  const authorized = (req) => {
    const given = Buffer.from(String(req.headers.authorization ?? ""));
    const want = Buffer.from(`Bearer ${token}`);
    return given.length === want.length && crypto.timingSafeEqual(given, want);
  };

  function handle(req, res) {
    // A page in a browser could reach 127.0.0.1 too; it would send an Origin, or a Host other than ours.
    const host = String(req.headers.host ?? "");
    if (req.headers.origin || (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`)) return json(res, 403, { ok: false, error: "Forbidden" });
    if (req.method !== "POST" || req.url !== "/call") return json(res, 404, { ok: false, error: "Not found" });
    if (!authorized(req)) return json(res, 401, { ok: false, error: "A Window didn't recognise this connection. Turn “Use with Claude” off and on in its Settings." });
    let body = "";
    let size = 0;
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) req.destroy();
      else body += chunk;
    });
    req.on("end", () => {
      let call;
      try {
        call = JSON.parse(body);
      } catch {
        return json(res, 400, { ok: false, error: "Bad request" });
      }
      if (!call || typeof call.tool !== "string") return json(res, 400, { ok: false, error: "Bad request" });
      const id = next++;
      const timer = setTimeout(() => {
        pending.delete(id);
        json(res, 504, { ok: false, error: "A Window didn't answer in time. Try again in a moment." });
      }, TIMEOUT_MS);
      pending.set(id, { res, timer });
      const message = { id, tool: call.tool, args: call.args ?? {} };
      try {
        const wc = page();
        if (wc.isLoading()) wc.once("did-finish-load", () => wc.send("planner-request", message));
        else wc.send("planner-request", message);
      } catch {
        clearTimeout(timer);
        pending.delete(id);
        json(res, 503, { ok: false, error: "A Window's planner isn't ready. Try again in a moment." });
      }
    });
  }

  return {
    get running() {
      return !!server;
    },
    /** Opens the bridge on a random local port and writes the connection file. */
    async start() {
      if (server) return;
      token = crypto.randomBytes(32).toString("hex");
      const s = http.createServer(handle);
      await new Promise((resolve, reject) => {
        s.once("error", reject);
        s.listen(0, "127.0.0.1", resolve);
      });
      server = s;
      port = s.address().port;
      fs.writeFileSync(file(), JSON.stringify({ port, token }), { mode: 0o600 });
    },
    /** Closes the bridge, fails anything waiting and removes the connection file. */
    stop() {
      for (const [id, { res, timer }] of pending) {
        clearTimeout(timer);
        pending.delete(id);
        json(res, 503, { ok: false, error: "A Window closed its connection to Claude." });
      }
      server?.close();
      server = null;
      try {
        fs.rmSync(file(), { force: true });
      } catch {
        /* already gone */
      }
    },
    /** The page's answer to a request: { id, ok, result } or { id, ok: false, error }. */
    reply(reply) {
      const waiting = reply && pending.get(reply.id);
      if (!waiting) return;
      clearTimeout(waiting.timer);
      pending.delete(reply.id);
      json(waiting.res, 200, reply.ok ? { ok: true, result: reply.result ?? null } : { ok: false, error: String(reply.error || "Something went wrong.") });
    },
  };
}

module.exports = { createBridge };
