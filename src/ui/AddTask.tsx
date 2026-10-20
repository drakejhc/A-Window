import { useState, type RefObject } from "react";

import { CATEGORIES, formatDuration, formatHour, fromKey, type Bucket } from "@/planner/model";
import { parseQuickAdd, splitLines } from "@/planner/quickadd";

import { Icon } from "./icons";

const bucketLabel = (b: Bucket) => (b === "This Week" ? "This week" : b);

export const dayLabel = (key: string, todayKey: string) => {
  const diff = Math.round((fromKey(key).getTime() - fromKey(todayKey).getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return fromKey(key).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

/** What a quick-add phrase was understood as, in chips. `bucket` is the list it goes to when the phrase names none. */
export function QuickPreview({ text, todayKey, bucket, title }: { text: string; todayKey: string; bucket?: Bucket | undefined; title?: boolean }) {
  const p = parseQuickAdd(text);
  const list = p.bucket ?? (p.date ? undefined : bucket);
  return (
    <div className="quick-preview" aria-live="polite">
      {title && <span>{p.title || "…"}</span>}
      {p.date && <span>{dayLabel(p.date, todayKey)}</span>}
      {p.start !== undefined && <span>{formatHour(p.start)}</span>}
      {p.duration && <span>{formatDuration(p.duration)}</span>}
      {p.category && <span data-cat={p.category}>{CATEGORIES.find((c) => c.value === p.category)?.label}</span>}
      {list && <span>{bucketLabel(list)}</span>}
      <span className="quick-enter">Enter to add</span>
    </div>
  );
}

type Props = {
  todayKey: string;
  /** Adds the phrase, or several phrases one per line when a list was pasted. */
  onAdd: (text: string, bucket?: Bucket) => void;
  /** The list a task goes to when the phrase doesn't name a day or list. */
  bucket?: Bucket;
  placeholder?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  compact?: boolean;
};

/** A field that adds a task as you press Enter, and stays focused for the next one. Pasting a list adds a task
 *  per line. */
export function AddTask({ todayKey, onAdd, bucket, placeholder = "Add a task, e.g. Gym tomorrow 7am 45m #health", inputRef, compact }: Props) {
  const [text, setText] = useState("");
  const has = !!parseQuickAdd(text).title;
  return (
    <form
      className="quick"
      data-compact={compact || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        if (!has) return;
        onAdd(text, bucket);
        setText("");
      }}
    >
      <Icon name="plus" className="quick-icon" />
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && (setText(""), e.currentTarget.blur())}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          if (splitLines(pasted).length < 2) return;
          e.preventDefault();
          onAdd(text.trim() ? `${text}\n${pasted}` : pasted, bucket);
          setText("");
        }}
        placeholder={placeholder}
        aria-label="Add a task"
      />
      {text.trim() && <QuickPreview text={text} todayKey={todayKey} bucket={bucket} />}
    </form>
  );
}
