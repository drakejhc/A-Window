import { useState } from "react";

import { CATEGORIES, formatDuration, formatHour, fromKey } from "@/planner/model";
import { parseQuickAdd } from "@/planner/quickadd";

/** The ⌘K palette: type a phrase, see what it understood, press Enter. */
export function QuickAddDialog({ todayKey, onAdd, onClose }: { todayKey: string; onAdd: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const p = text.trim() ? parseQuickAdd(text) : null;
  const when = (key: string) => (key === todayKey ? "Today" : fromKey(key).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }));
  return (
    <div className="modal-scrim" onClick={onClose}>
      <form
        className="modal palette"
        role="dialog"
        aria-modal="true"
        aria-label="Quick add"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!p?.title) return;
          onAdd(text);
          onClose();
        }}
      >
        <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Gym tomorrow 7am 45m #health" aria-label="What to add" />
        <div className="quick-preview" aria-live="polite">
          {p ? (
            <>
              <span>{p.title || "…"}</span>
              {p.date && <span>{when(p.date)}</span>}
              {p.start !== undefined && <span>{formatHour(p.start)}</span>}
              {p.duration && <span>{formatDuration(p.duration)}</span>}
              {p.category && <span data-cat={p.category}>{CATEGORIES.find((c) => c.value === p.category)?.label}</span>}
              {p.bucket && <span>{p.bucket === "This Week" ? "This week" : p.bucket}</span>}
              <span className="quick-enter">Enter to add</span>
            </>
          ) : (
            <span className="quick-enter">Try a day (tomorrow, fri), a time (7am), a length (45m) and a category (#study, #health, #personal, #life)</span>
          )}
        </div>
      </form>
    </div>
  );
}
