/** The bridge to the desktop app (electron/preload.cjs). Null in a browser, where these features are hidden. */
export type NowPlaying = {
  app: "Spotify" | "Music";
  state: "playing" | "paused";
  title: string;
  artist: string;
  album?: string;
  /** Album art as a data: URL, when it could be found. */
  artwork?: string;
  /** Seconds into the track and its length, when the player reports them. */
  position?: number;
  duration?: number;
  /** When this reading was taken (ms since epoch), so progress can be extrapolated. */
  at: number;
};

export type DesktopSettings = {
  wallpaper: boolean;
  wallpaperStyle: "room" | "view";
  openAtLogin: boolean;
  /** Use with Claude: the local bridge that lets the user's own Claude read and change the plan. */
  claude: boolean;
  /** How Claude starts the app's MCP server. */
  claudeLaunch?: { command: string; args: string[]; env: Record<string, string> };
};

/** A tool call from Claude (see electron/bridge.cjs), and the page's answer. */
export type PlannerRequest = { id: number; tool: string; args: unknown };
export type PlannerReply = { id: number; ok: true; result: unknown } | { id: number; ok: false; error: string };

export type DesktopBridge = {
  platform: "darwin" | "win32" | "linux";
  version: string;
  getSettings(): Promise<DesktopSettings>;
  setSettings(patch: Partial<Omit<DesktopSettings, "claudeLaunch">>): Promise<DesktopSettings & { error?: string }>;
  watchMusic(on: boolean): void;
  musicControl(command: "playpause" | "next" | "previous"): void;
  onNowPlaying(cb: (np: NowPlaying | null) => void): () => void;
  /** Commands sent from the tray menu, e.g. "focus" or "planner". */
  onCommand(cb: (command: string) => void): () => void;
  /** Brings the window back from the tray. */
  show(): void;
  /** Saves today's copy of the plan in the app's backups folder. */
  backup(json: string): void;
  openBackups(): void;
  onPlannerRequest(cb: (request: PlannerRequest) => void): () => void;
  plannerReply(reply: PlannerReply): void;
};

export const desktop: DesktopBridge | null = (window as unknown as { aWindow?: DesktopBridge }).aWindow ?? null;

/** True in the wallpaper window the desktop app puts behind your desktop icons. */
export const isWallpaper = new URLSearchParams(window.location.search).get("mode") === "wallpaper";
