// The MCP server Claude launches to read and change the plan (see docs/claude-connector.md). It speaks MCP's
// JSON-RPC over stdin and stdout, and passes each tool call to the running app's bridge on 127.0.0.1 with the
// token the app wrote to mcp.json. It runs as plain Node (the app's own, via ELECTRON_RUN_AS_NODE; main.cjs starts
// it for `--mcp`), uses only Node's built-in modules, and never writes anything but protocol messages to stdout.
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const NOT_RUNNING = "A Window isn't open, or “Use with Claude” is off in its Settings. Open A Window, turn it on, and try again.";

/** Where the app keeps mcp.json: passed in by main.cjs, or Electron's usual userData folder for "A Window". */
function dataDir() {
  if (process.env.A_WINDOW_DATA) return process.env.A_WINDOW_DATA;
  const home = os.homedir();
  if (process.platform === "win32") return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "A Window");
  if (process.platform === "darwin") return path.join(home, "Library", "Application Support", "A Window");
  return path.join(process.env.XDG_CONFIG_HOME || path.join(home, ".config"), "A Window");
}

const date = { type: "string", description: "A date, YYYY-MM-DD." };
const time = { type: "string", description: "A local 24-hour time, HH:MM (e.g. 17:30). Snapped to quarter hours." };
const minutes = { type: "number", description: "Length in minutes." };
const category = { type: "string", enum: ["study", "health", "personal", "life"] };
const list = { type: "string", enum: ["Today", "This Week", "Later"], description: "The task list." };
const id = { type: "string", description: "The item's id, from get_today, get_day or list_tasks." };
const read = { readOnlyHint: true, openWorldHint: false };
const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
const destroy = { readOnlyHint: false, destructiveHint: true, openWorldHint: false };

const TOOLS = [
  {
    name: "get_today",
    description:
      "Today's date, weekday, the time now and the user's time zone, today's schedule (events and scheduled tasks, with ids) and the open tasks in the Today list. Call this first to resolve words like “tomorrow” or “this afternoon”.",
    inputSchema: { type: "object", properties: {} },
    annotations: read,
  },
  {
    name: "get_day",
    description: "The schedule for a day (or up to 14 days from it): events and scheduled tasks with ids, start and end times.",
    inputSchema: { type: "object", properties: { date, days: { type: "number", description: "How many days from `date`, 1–14. Defaults to 1." } } },
    annotations: read,
  },
  {
    name: "list_tasks",
    description: "Tasks with their list (Today, This Week, Later), length, category and, if scheduled, when. Open tasks only unless include_done.",
    inputSchema: { type: "object", properties: { list, include_done: { type: "boolean" } } },
    annotations: read,
  },
  {
    name: "add_task",
    description:
      "Adds a task (flexible work). With a time it goes on the timeline, and is refused if something is already there. With a date but no time it takes that day's next free slot. Otherwise it goes to a list (Today unless `list` says otherwise).",
    inputSchema: { type: "object", properties: { title: { type: "string" }, duration_minutes: { ...minutes, description: "Defaults to 30." }, date, time, list, category, notes: { type: "string" } }, required: ["title"] },
    annotations: write,
  },
  {
    name: "add_event",
    description: "Adds an event (a fixed commitment such as a class, meeting or appointment) at a date and time. Events may overlap other blocks; the result says if it does.",
    inputSchema: {
      type: "object",
      properties: { title: { type: "string" }, date: { ...date, description: "YYYY-MM-DD. Defaults to today." }, time, duration_minutes: { ...minutes, description: "Defaults to 60." }, category, where: { type: "string" }, notes: { type: "string" }, repeat: { type: "string", enum: ["daily", "weekdays", "weekly"] } },
      required: ["title", "time"],
    },
    annotations: write,
  },
  {
    name: "move_item",
    description:
      "Moves a task or event to a new time, and optionally a new date. A task is refused if the new time is taken. A daily or weekday repeating event moves to the new time on all its days; a weekly one moves its whole series.",
    inputSchema: { type: "object", properties: { id, date, time }, required: ["id", "time"] },
    annotations: write,
  },
  {
    name: "update_item",
    description: "Changes a task's or event's title, length, category or notes; a task's list; an event's place or repeat (\"none\" stops it repeating).",
    inputSchema: {
      type: "object",
      properties: { id, title: { type: "string" }, duration_minutes: minutes, category, notes: { type: "string" }, list, where: { type: "string" }, repeat: { type: "string", enum: ["daily", "weekdays", "weekly", "none"] } },
      required: ["id"],
    },
    annotations: write,
  },
  {
    name: "complete_task",
    description: "Marks a task done, or not done with done: false.",
    inputSchema: { type: "object", properties: { id, done: { type: "boolean" } }, required: ["id"] },
    annotations: write,
  },
  {
    name: "unschedule_task",
    description: "Takes a task off the timeline and back into its list.",
    inputSchema: { type: "object", properties: { id }, required: ["id"] },
    annotations: write,
  },
  {
    name: "delete_item",
    description:
      "Deletes a task or event. For a repeating event, pass `date` to remove just that day; without it, every repeat is deleted. The result says exactly what was removed. The user can undo it in the app.",
    inputSchema: { type: "object", properties: { id, date }, required: ["id"] },
    annotations: destroy,
  },
  {
    name: "find_free_slot",
    description: "The first free stretch of `duration_minutes` on a day: from now on today, from 7:00 on other days, or from `after`.",
    inputSchema: { type: "object", properties: { date, duration_minutes: minutes, after: time }, required: ["duration_minutes"] },
    annotations: read,
  },
  {
    name: "replan_today",
    description: "Moves today's tasks that fell behind (still open, and their time has passed) into the free time left today; ones that no longer fit go to This Week. The result lists every move.",
    inputSchema: { type: "object", properties: {} },
    annotations: destroy,
  },
];

/** Sends one tool call to the app's bridge. Resolves to { ok, result } or { ok: false, error }. */
function callApp(tool, args) {
  let conn;
  try {
    conn = JSON.parse(fs.readFileSync(path.join(dataDir(), "mcp.json"), "utf8"));
  } catch {
    return Promise.resolve({ ok: false, error: NOT_RUNNING });
  }
  const body = JSON.stringify({ tool, args: args ?? {} });
  return new Promise((resolve) => {
    const req = http.request(
      { host: "127.0.0.1", port: conn.port, path: "/call", method: "POST", timeout: 15_000, headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body), authorization: `Bearer ${conn.token}` } },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (text += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(text));
          } catch {
            resolve({ ok: false, error: `A Window answered with an error (${res.statusCode}).` });
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", () => resolve({ ok: false, error: NOT_RUNNING }));
    req.end(body);
  });
}

function send(message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
}

async function handle(msg) {
  const { id, method, params } = msg;
  const reply = (result) => id !== undefined && send({ id, result });
  const fail = (code, message) => id !== undefined && send({ id, error: { code, message } });
  switch (method) {
    case "initialize": {
      const asked = params?.protocolVersion;
      return reply({
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "a-window", title: "A Window", version: "1.0.0" },
        instructions:
          "Tools for the user's A Window day planner. Call get_today first for the date, time and time zone. Times are local 24-hour HH:MM. Events are fixed commitments; tasks are flexible work that may sit in a list or on the timeline. Every change shows in the app at once and can be undone there.",
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = params?.name;
      if (!TOOLS.some((t) => t.name === name)) return fail(-32602, `Unknown tool: ${name}`);
      const out = await callApp(name, params?.arguments);
      return reply(
        out.ok
          ? { content: [{ type: "text", text: JSON.stringify(out.result, null, 2) }] }
          : { content: [{ type: "text", text: out.error || "Something went wrong." }], isError: true },
      );
    }
    default:
      // Notifications (no id) such as notifications/initialized need no answer.
      if (id !== undefined) fail(-32601, `Method not found: ${method}`);
  }
}

function run() {
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        send({ id: null, error: { code: -32700, message: "Parse error" } });
        continue;
      }
      for (const m of Array.isArray(msg) ? msg : [msg]) void handle(m);
    }
  });
  process.stdin.on("end", () => process.exit(0));
}

if (require.main === module) run();
module.exports = { TOOLS, handle, dataDir };
