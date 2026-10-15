import { formatHour, type Task } from "@/planner/model";
import type { ReplanResult } from "@/planner/planning";

type Props = { plan: ReplanResult; tasks: Task[]; onApply: () => void; onCancel: () => void };

/** Confirms a replan before anything moves. */
export function Replan({ plan, tasks, onApply, onCancel }: Props) {
  const title = (id: string) => tasks.find((t) => t.id === id)?.title ?? "Task";
  return (
    <div className="modal-scrim" onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="replan-title" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && onCancel()}>
        <h2 id="replan-title">Replan the rest of today</h2>
        <p className="hint">Tasks whose time has passed move into the free time that’s left. Events stay where they are.</p>
        <ul className="replan-list">
          {plan.moves.map((m) => (
            <li key={m.id}>
              <span>{title(m.id)}</span>
              <span className="replan-time">
                {formatHour(m.from)} → {formatHour(m.to)}
              </span>
            </li>
          ))}
          {plan.unfit.map((id) => (
            <li key={id}>
              <span>{title(id)}</span>
              <span className="replan-time">No room today, moves to This week</span>
            </li>
          ))}
        </ul>
        <div className="modal-foot">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="primary-btn" autoFocus onClick={onApply}>
            Replan
          </button>
        </div>
      </div>
    </div>
  );
}
