import { useCallback, useEffect, useRef, useState } from "react";

import { blocksOn, currentBlock, END_HOUR, formatHour, fromKey, nowHour, parseTime, snap, START_HOUR, toKey, addDays, clamp, type Kind } from "@/planner/model";
import { findOpenSlot, isSlipped, isSlotFree, planReplan, type ReplanResult } from "@/planner/planning";
import { parseQuickAdd } from "@/planner/quickadd";
import { usePlanner, type PlannerState } from "@/planner/store";
import { Dock, FOCUS_LENGTHS } from "@/ui/Dock";
import { draftFor, Editor, newDraft, type Draft } from "@/ui/Editor";
import { FocusCard, type FocusTarget } from "@/ui/FocusCard";
import { Icon } from "@/ui/icons";
import { QuickAddDialog } from "@/ui/QuickAddDialog";
import { Readout } from "@/ui/Readout";
import { Replan } from "@/ui/Replan";
import { Scene } from "@/ui/Scene";
import { Sheet } from "@/ui/Sheet";
import { useWindow } from "@/ui/use-window";
import { desktop } from "@/desktop";
import { useMusic, watchMusic } from "@/music";
import { SettingsContext, useSettingsState } from "@/settings";
import { SettingsPanel } from "@/ui/SettingsPanel";
import { Welcome } from "@/ui/Welcome";
import { Workspace, type Mode, type View } from "@/ui/Workspace";
import type { Bucket } from "@/planner/model";

const SIDE_W = 400;

/** A small UI preference kept in this browser (open panels, focus length). */
function usePref<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(`a-window:ui-${key}`);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(`a-window:ui-${key}`, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

export type Layout = "full" | "side";

/** Keeps an element mounted while it fades out, and lets it fade in after mounting. */
function useFade(open: boolean, ms = 450) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => (inner = requestAnimationFrame(() => setVisible(true))));
      return () => (cancelAnimationFrame(outer), cancelAnimationFrame(inner));
    }
    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), ms);
    return () => window.clearTimeout(t);
  }, [open, ms]);
  return { mounted, visible };
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest("input, textarea, select, [contenteditable]");

export function App() {
  const settingsApi = useSettingsState();
  const { settings } = settingsApi;
  const planner = usePlanner();
  const { state } = planner;
  const { engine } = useWindow();

  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 20_000);
    return () => window.clearInterval(t);
  }, []);
  const todayKey = toKey(clock), now = nowHour(clock);

  const [selected, setSelected] = useState(todayKey);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const [replan, setReplan] = useState<ReplanResult | null>(null);
  const [toast, setToast] = useState<{ message: string; undo?: () => void; key: number } | null>(null);
  const [sheetOpen, setSheetOpen] = usePref("sheet", true);
  const [layout, setLayout] = usePref<Layout>("layout", "full");
  const [view, setView] = usePref<View>("view", "day");
  const [mode, setMode] = useState<Mode>("calendar");
  const [bucket, setBucket] = useState<Bucket>("Today");
  const [palette, setPalette] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const music = useMusic();
  const [trayOpen, setTrayOpen] = usePref("tray", true);
  const [focusMinutes, setFocusMinutes] = usePref("focus", 25);
  const [idle, setIdle] = useState(false);
  const [width, setWidth] = useState(() => window.innerWidth);
  const quickAddRef = useRef<HTMLInputElement>(null);

  const current = currentBlock(state, todayKey, now);
  const behind = state.tasks.filter((t) => isSlipped(t, todayKey, now)).length;
  const full = layout === "full";
  // Full layout: the workspace fades in over the window, and fades out for Focus.
  const ws = useFade(full && sheetOpen && !focus);
  const sideOpen = (!full && sheetOpen) || !!focus;
  const wide = width >= 1100;
  // With the sheet open, the window moves left so the two sit side by side.
  const align = sideOpen && wide ? clamp((width - SIDE_W - 40) / 2 / width, 0.3, 0.5) : 0.5;

  const notify = useCallback((message: string, undo?: () => void) => {
    setToast({ message, ...(undo ? { undo } : {}), key: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.undo ? 7000 : 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const withUndo = (message: string, before: PlannerState) => notify(message, () => planner.restore(before));
  const dayName = (key: string) => (key === todayKey ? "today" : fromKey(key).toLocaleDateString(undefined, { weekday: "long" }));

  function open(kind: Kind, id: string, date?: string) {
    setDraft(draftFor(state, kind, id, selected, date ?? selected));
    setSheetOpen(true);
  }

  const newEvent = () => setDraft(newDraft("event", selected, selected === todayKey ? `${String(Math.min(22, Math.ceil(now))).padStart(2, "0")}:00` : "09:00"));

  function saveDraft() {
    if (!draft) return;
    const d = draft, title = d.title.trim(), start = d.time ? snap(parseTime(d.time)) : undefined;
    if (!title) return;
    const others = blocksOn(state, d.date).filter((b) => !(b.kind === d.kind && b.id === d.id));
    const clash = start !== undefined && !isSlotFree(others, start, d.duration);
    const shared = { title, duration: d.duration, category: d.category, notes: d.notes || undefined, subtasks: d.subtasks.length ? d.subtasks : undefined, actual: d.actual || undefined };
    if (d.kind === "task") {
      const fields = { ...shared, bucket: d.bucket, date: start !== undefined ? d.date : undefined, start };
      if (d.id) planner.updateTask(d.id, fields);
      else planner.addTask(fields);
    } else {
      const fields = { ...shared, date: d.date, start: start ?? 9, meta: d.meta || undefined, repeat: d.repeat || undefined };
      if (d.id) planner.updateEvent(d.id, fields);
      else planner.addEvent(fields);
    }
    setDraft(null);
    if (start !== undefined && d.date !== selected) setSelected(d.date);
    notify(clash ? `Saved. It overlaps something else at ${formatHour(start!)}` : d.id ? "Saved" : `Added “${title}”`);
  }

  function deleteDraft(onlyThisDay = false) {
    if (!draft?.id) return;
    const before = state;
    setDraft(null);
    if (onlyThisDay && draft.kind === "event") {
      planner.skipOccurrence(draft.id, draft.occurrence);
      return withUndo(`Removed “${draft.title}” from ${dayName(draft.occurrence)}`, before);
    }
    planner.remove(draft.kind, draft.id);
    withUndo(`Deleted “${draft.title}”${draft.repeat ? " and its repeats" : ""}`, before);
  }

  function quickAdd(text: string) {
    const p = parseQuickAdd(text, clock);
    if (!p.title) return;
    const duration = p.duration ?? 30;
    let date = p.date ?? (p.start !== undefined ? selected : undefined);
    let start: number | undefined;
    if (date && p.start !== undefined) {
      start = clamp(snap(p.start), START_HOUR, END_HOUR - duration / 60);
      if (!isSlotFree(blocksOn(state, date), start, duration)) {
        planner.addTask({ title: p.title, duration, category: p.category ?? "personal", bucket: p.bucket ?? "Today" });
        return notify(`${formatHour(start)} is taken, so “${p.title}” went to your list instead`);
      }
    } else if (date) start = findOpenSlot(blocksOn(state, date), duration, date === todayKey ? now : START_HOUR, END_HOUR);
    if (start === undefined) date = undefined;
    const bucket = p.bucket ?? (!p.date || p.date === todayKey ? "Today" : "This Week");
    planner.addTask({ title: p.title, duration, category: p.category ?? "personal", bucket, date, start });
    if (date && start !== undefined) {
      setSelected(date);
      notify(`“${p.title}” is on ${dayName(date)} at ${formatHour(start)}`);
    } else notify(`Added “${p.title}” to ${bucket === "This Week" ? "this week" : bucket.toLowerCase()}`);
  }

  function scheduleNext(id: string) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    const start = findOpenSlot(blocksOn(state, selected), task.duration, selected === todayKey ? now : START_HOUR, END_HOUR);
    if (start === undefined) return notify(`No free slot left ${dayName(selected) === "today" ? "today" : `on ${dayName(selected)}`}`);
    planner.place("task", id, selected, start);
    notify(`“${task.title}” is at ${formatHour(start)}`);
  }

  function openReplan() {
    const plan = planReplan(state.tasks, state.events, todayKey, now, END_HOUR);
    if (!plan.moves.length && !plan.unfit.length) return notify("You’re on track. Nothing to replan");
    setReplan(plan);
  }

  function startFocus() {
    if (focus) return;
    setDraft(null);
    setFocus({ block: current ?? null, minutes: FOCUS_LENGTHS.includes(focusMinutes) ? focusMinutes : 25 });
  }

  function endFocus(seconds: number, complete: boolean) {
    const b = focus?.block;
    const minutes = Math.round(seconds / 60);
    if (b && minutes >= 1) planner.recordFocus(b.kind, b.id, minutes);
    if (b && complete) {
      if (b.kind === "task" && !b.completed) planner.toggleTask(b.id);
      notify(`Nice work. “${b.title}” is done`);
    } else if (minutes >= 1) notify(`${minutes} ${minutes === 1 ? "minute" : "minutes"} of focus`);
    setFocus(null);
  }

  // Keyboard shortcuts, ignored while typing.
  const keys = useRef({ startFocus, openReplan, todayKey, selected, focusing: false, editing: false, full, workspace: false, modal: false });
  keys.current = { startFocus, openReplan, todayKey, selected, focusing: !!focus, editing: !!draft, full, workspace: ws.visible, modal: palette || !!replan || settingsOpen || !settings.onboarded };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current;
      if (e.key === "Escape") {
        if (k.modal || k.focusing) return;
        if (k.editing) setDraft(null);
        else if (k.workspace && !isTyping(e.target)) setSheetOpen(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!k.focusing) setPalette(true);
        return;
      }
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey || k.modal) return;
      const key = e.key.toLowerCase();
      if (key === "/" || key === "n") {
        e.preventDefault();
        setDraft(null);
        if (k.full) setPalette(true);
        else {
          setSheetOpen(true);
          window.setTimeout(() => quickAddRef.current?.focus(), 0);
        }
      } else if (k.full && k.workspace && (key === "d" || key === "w" || key === "m")) {
        setMode("calendar");
        setView(key === "d" ? "day" : key === "w" ? "week" : "month");
      } else if (key === "r" && !k.focusing) k.openReplan();
      else if (key === "f" && !k.focusing) k.startFocus();
      else if (key === "p" && !k.focusing) setSheetOpen((v) => !v);
      else if (key === "t") setSelected(k.todayKey);
      else if (e.key === "ArrowLeft" && !k.focusing) setSelected(toKey(addDays(fromKey(k.selected), -1)));
      else if (e.key === "ArrowRight" && !k.focusing) setSelected(toKey(addDays(fromKey(k.selected), 1)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSheetOpen, setView]);

  // Reminders: a notification five minutes before each block on today's plan.
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    if (!settings.notify || !("Notification" in window)) return;
    const sent = new Set<string>();
    const check = () => {
      if (Notification.permission !== "granted") return;
      const n = new Date(), today = toKey(n), h = nowHour(n);
      for (const b of blocksOn(stateRef.current, today)) {
        const key = `${b.kind}-${b.id}-${today}-${b.start}`;
        const ahead = b.start - h;
        if (b.completed || ahead <= 0 || ahead > 5 / 60 || sent.has(key)) continue;
        sent.add(key);
        const note = new Notification(`${b.title} at ${formatHour(b.start)}`, { body: b.meta ? `${b.meta} · in ${Math.round(ahead * 60)} minutes` : `Starts in ${Math.round(ahead * 60)} minutes`, tag: key });
        note.onclick = () => window.focus();
      }
    };
    check();
    const t = window.setInterval(check, 20_000);
    return () => window.clearInterval(t);
  }, [settings.notify]);

  // Music from Spotify or Apple Music (desktop app): watch it, and turn the ambience down while it plays.
  useEffect(() => watchMusic(settings.music), [settings.music]);
  useEffect(() => engine.audio.setDuck(music.np?.state === "playing" ? 0.3 : 1), [engine, music.np?.state]);

  // Commands from the desktop app's menu bar icon.
  const commands = useRef({ startFocus });
  commands.current = { startFocus };
  useEffect(
    () =>
      desktop?.onCommand((cmd) => {
        if (cmd === "focus") commands.current.startFocus();
        else if (cmd === "planner") setSheetOpen(true);
        else if (cmd === "settings") setSettingsOpen(true);
      }),
    [setSheetOpen],
  );

  // The bottom controls fade away when you stop moving, leaving the window and the day.
  useEffect(() => {
    let timer = 0;
    const wake = () => {
      setIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!document.activeElement?.closest(".dock, .adjust")) setIdle(true);
      }, 4500);
    };
    const resize = () => setWidth(window.innerWidth);
    wake();
    const events = ["pointermove", "pointerdown", "keydown", "focusin"] as const;
    for (const ev of events) window.addEventListener(ev, wake);
    window.addEventListener("resize", resize);
    return () => {
      window.clearTimeout(timer);
      for (const ev of events) window.removeEventListener(ev, wake);
      window.removeEventListener("resize", resize);
    };
  }, []);

  const editor = draft && (
    <Editor
      draft={draft}
      onChange={setDraft}
      onSave={saveDraft}
      onCancel={() => setDraft(null)}
      onDelete={deleteDraft}
      onUnschedule={() => {
        if (!draft.id) return;
        planner.unschedule(draft.id);
        setDraft(null);
        notify(`“${draft.title}” is back in your list`);
      }}
    />
  );
  const startFresh = () => {
    const before = state;
    planner.startFresh();
    withUndo("Cleared the example plan", before);
  };
  // Moving a repeating event moves the whole series: a weekly one to the new weekday, a daily one to the new time.
  const place = (kind: Kind, id: string, date: string, start: number) => {
    const e = kind === "event" ? state.events.find((x) => x.id === id) : undefined;
    if (e?.repeat === "daily" || e?.repeat === "weekdays") planner.updateEvent(id, { start });
    else planner.place(kind, id, date, start);
  };

  return (
    <SettingsContext.Provider value={settingsApi}>
    <div className="app" data-idle={idle || undefined} data-side={sideOpen || undefined} data-workspace={ws.visible || undefined} style={{ "--side-w": `${SIDE_W}px` } as React.CSSProperties}>
      <Scene align={align} />
      <Readout />

      {focus && (
        <div className="focus-wrap">
          <FocusCard target={focus} now={now} onChime={() => engine.audio.chime()} onExit={(s) => endFocus(s, false)} onComplete={(s) => endFocus(s, true)} />
        </div>
      )}

      {full && ws.mounted && (
        <Workspace
          state={state}
          visible={ws.visible}
          selected={selected}
          todayKey={todayKey}
          now={now}
          currentId={current?.id}
          behind={behind}
          view={view}
          mode={mode}
          bucket={bucket}
          trayOpen={trayOpen}
          drawer={editor}
          onView={setView}
          onMode={setMode}
          onBucket={setBucket}
          onTrayOpen={setTrayOpen}
          onSelect={setSelected}
          onOpen={open}
          onToggle={planner.toggleTask}
          onPlace={place}
          onSchedule={scheduleNext}
          onBlocked={() => notify("That time is taken")}
          onReplan={openReplan}
          onFocus={startFocus}
          onQuickAdd={() => setPalette(true)}
          onNewEvent={newEvent}
          onStartFresh={startFresh}
          onSettings={() => setSettingsOpen(true)}
        />
      )}

      {!full &&
        !focus &&
        sheetOpen &&
        (draft ? (
          <aside className="sheet" aria-label={draft.id ? "Edit item" : "New item"}>
            {editor}
          </aside>
        ) : (
          <Sheet
            state={state}
            selected={selected}
            todayKey={todayKey}
            now={now}
            currentId={current?.id}
            behind={behind}
            trayOpen={trayOpen}
            onTrayOpen={setTrayOpen}
            onSelect={setSelected}
            onQuickAdd={quickAdd}
            onNewEvent={newEvent}
            onOpen={open}
            onToggle={planner.toggleTask}
            onPlace={place}
            onSchedule={scheduleNext}
            onBlocked={() => notify("That time is taken")}
            onReplan={openReplan}
            onStartFresh={startFresh}
            quickAddRef={quickAddRef}
          />
        ))}

      <Dock sheetOpen={sheetOpen && !focus} onToggleSheet={() => (focus ? undefined : setSheetOpen((v) => !v))} focusing={!!focus} onFocus={startFocus} onSettings={() => setSettingsOpen(true)} />

      {settingsOpen && (
        <SettingsPanel
          layout={layout}
          onLayout={(l) => {
            setLayout(l);
            setDraft(null);
          }}
          focusMinutes={focusMinutes}
          onFocusMinutes={setFocusMinutes}
          onStartFresh={startFresh}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {!settings.onboarded && (
        <Welcome
          onDone={(keepExample) => {
            if (!keepExample) planner.startFresh();
            settingsApi.update({ onboarded: true });
          }}
        />
      )}

      {palette && <QuickAddDialog todayKey={todayKey} onAdd={quickAdd} onClose={() => setPalette(false)} />}

      {toast && (
        <div className="toast" role="status" key={toast.key}>
          {toast.message}
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                toast.undo?.();
                setToast(null);
              }}
            >
              <Icon name="undo" /> Undo
            </button>
          )}
        </div>
      )}

      {replan && (
        <Replan
          plan={replan}
          tasks={state.tasks}
          onCancel={() => setReplan(null)}
          onApply={() => {
            const before = state;
            planner.applyReplan(replan.moves, replan.unfit);
            setReplan(null);
            withUndo("Replanned the rest of today", before);
          }}
        />
      )}
    </div>
    </SettingsContext.Provider>
  );
}
