// The whole "Use with Claude" path except Electron itself: the MCP server (electron/mcp.cjs) runs as its own
// process, as Claude starts it, and talks to the app's bridge (electron/bridge.cjs), whose "page" here runs the
// real planner actions.
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { request } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runAction } from "@/planner/actions";
import type { PlannerData } from "@/planner/model";

const require = createRequire(import.meta.url);
const { createBridge } = require("../../electron/bridge.cjs") as { createBridge: (o: unknown) => { start(): Promise<void>; stop(): void; reply(r: unknown): void } };

const dir = mkdtempSync(join(tmpdir(), "a-window-mcp-"));
let data: PlannerData = { tasks: [], events: [{ id: "e1", title: "Statistics", date: "2026-10-21", start: 15, duration: 75, category: "study" }] };
const ctx = { today: "2026-10-21", now: 10, timeZone: "America/Vancouver" };

const bridge = createBridge({
  file: () => join(dir, "mcp.json"),
  page: () => ({
    isLoading: () => false,
    once: () => {},
    send: (_channel: string, { id, tool, args }: { id: number; tool: string; args: unknown }) => {
      // As App.tsx does: run it, keep the change, answer.
      try {
        const out = runAction(data, tool, args, ctx);
        if (out.data) data = out.data;
        bridge.reply({ id, ok: true, result: out.result });
      } catch (e) {
        bridge.reply({ id, ok: false, error: (e as Error).message });
      }
    },
  }),
});

let server: ChildProcessWithoutNullStreams;
let lines: string[] = [];
let wake = () => {};
const rpc = async (id: number, method: string, params: object = {}) => {
  server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  for (;;) {
    const hit = lines.map((l) => JSON.parse(l) as { id: number; result?: { content?: { text: string }[]; isError?: boolean } & Record<string, unknown>; error?: unknown }).find((m) => m.id === id);
    if (hit) return hit;
    await new Promise<void>((r) => (wake = r));
  }
};
const call = async (id: number, name: string, args: object = {}) => {
  const r = (await rpc(id, "tools/call", { name, arguments: args })).result!;
  return { error: !!r.isError, text: r.content![0]!.text };
};

beforeAll(async () => {
  await bridge.start();
  server = spawn(process.execPath, [resolve(__dirname, "../../electron/mcp.cjs")], { env: { ...process.env, A_WINDOW_DATA: dir } });
  let buf = "";
  server.stdout.setEncoding("utf8");
  server.stdout.on("data", (c: string) => {
    buf += c;
    const parts = buf.split("\n");
    buf = parts.pop()!;
    lines.push(...parts.filter(Boolean));
    wake();
  });
});

afterAll(() => {
  server.kill();
  bridge.stop();
  rmSync(dir, { recursive: true, force: true });
});

describe("Claude talking to A Window", () => {
  it("introduces itself and lists the planner's tools", async () => {
    const init = await rpc(1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
    expect(init.result).toMatchObject({ protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "a-window" } });
    server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    const tools = (await rpc(2, "tools/list")).result as unknown as { tools: { name: string }[] };
    expect(tools.tools.map((t) => t.name)).toEqual(["get_today", "get_day", "list_tasks", "add_task", "add_event", "move_item", "update_item", "complete_task", "unschedule_task", "delete_item", "find_free_slot", "replan_today"]);
  });

  it("reads today and adds a block that the app keeps", async () => {
    expect(JSON.parse((await call(3, "get_today")).text)).toMatchObject({ date: "2026-10-21", time_zone: "America/Vancouver" });
    const added = await call(4, "add_task", { title: "Walk", time: "17:00", duration_minutes: 30 });
    expect(added.error).toBe(false);
    expect(data.tasks[0]).toMatchObject({ title: "Walk", date: "2026-10-21", start: 17 });
  });

  it("passes the planner's refusals back as tool errors", async () => {
    const r = await call(5, "add_task", { title: "Gym", time: "15:30" });
    expect(r).toMatchObject({ error: true });
    expect(r.text).toMatch(/taken by “Statistics”/);
  });

  it("keeps the connection file private and refuses calls without its token", async () => {
    const conn = JSON.parse(readFileSync(join(dir, "mcp.json"), "utf8")) as { port: number; token: string };
    if (process.platform !== "win32") expect(statSync(join(dir, "mcp.json")).mode & 0o077).toBe(0);
    const status = (headers: Record<string, string>) =>
      new Promise<number>((done) => {
        const req = request({ host: "127.0.0.1", port: conn.port, path: "/call", method: "POST", headers: { "content-type": "application/json", ...headers } }, (res) => (res.resume(), done(res.statusCode!)));
        req.end(JSON.stringify({ tool: "get_today" }));
      });
    expect(await status({ authorization: "Bearer nope" })).toBe(401);
    expect(await status({ authorization: `Bearer ${conn.token}`, origin: "https://example.com" })).toBe(403);
    expect(await status({ authorization: `Bearer ${conn.token}` })).toBe(200);
  });

  it("says the app isn't open once the bridge is off", async () => {
    bridge.stop();
    const r = await call(6, "get_today");
    expect(r).toMatchObject({ error: true });
    expect(r.text).toMatch(/isn't open/);
  });
});
