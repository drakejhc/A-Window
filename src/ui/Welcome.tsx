import { CityPicker } from "./CityPicker";
import { useWindow } from "./use-window";

/** First run: choose where the window looks out, and whether to start from the example plan. */
export function Welcome({ onDone }: { onDone: (keepExample: boolean) => void }) {
  const { snap } = useWindow();
  return (
    <div className="modal-scrim welcome-scrim">
      <div className="modal welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <p className="eyebrow">Welcome</p>
        <h2 id="welcome-title">A window for your day</h2>
        <p className="welcome-lead">
          Outside is a real city, right now: its weather, its light, its season. Inside is your plan for the day. Where should the window look out?
        </p>
        <CityPicker autoFocus={false} />
        <p className="hint">You can change the city, the scene and everything else later in Settings.</p>
        <div className="modal-foot">
          <button type="button" className="ghost-btn" onClick={() => onDone(false)}>
            Start with a clear plan
          </button>
          <button type="button" className="primary-btn" onClick={() => onDone(true)}>
            Look out over {snap.city.name}
          </button>
        </div>
      </div>
    </div>
  );
}
