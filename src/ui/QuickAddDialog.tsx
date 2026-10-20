import { useState } from "react";

import { parseQuickAdd, splitLines } from "@/planner/quickadd";

import { QuickPreview } from "./AddTask";

/** The ⌘K palette: type a task, see what it understood, press Enter. Pasting a list adds a task per line. */
export function QuickAddDialog({ todayKey, onAdd, onNewEvent, onClose }: { todayKey: string; onAdd: (text: string) => void; onNewEvent: () => void; onClose: () => void }) {
  const [text, setText] = useState("");
  return (
    <div className="modal-scrim" onClick={onClose}>
      <form
        className="modal palette"
        role="dialog"
        aria-modal="true"
        aria-label="Add a task"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!parseQuickAdd(text).title) return;
          onAdd(text);
          onClose();
        }}
      >
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (splitLines(pasted).length < 2) return;
            e.preventDefault();
            onAdd(text.trim() ? `${text}\n${pasted}` : pasted);
            onClose();
          }}
          placeholder="Add a task, e.g. Gym tomorrow 7am 45m #health"
          aria-label="Add a task"
        />
        {text.trim() ? (
          <QuickPreview text={text} todayKey={todayKey} title />
        ) : (
          <div className="quick-preview">
            <span className="quick-enter">
              Try a day (tomorrow, fri), a time (7am), a length (45m), a category (#study, #health, #personal, #life) or a list (this week, later). Paste a
              list to add a task per line.
            </span>
          </div>
        )}
        <button type="button" className="link-btn palette-event" onClick={() => (onClose(), onNewEvent())}>
          New event instead
        </button>
      </form>
    </div>
  );
}
