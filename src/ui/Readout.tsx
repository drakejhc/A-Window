import { useWindowSummary } from "./use-window";

/** The window city's name, time and weather, quietly in the top-left corner. */
export function Readout() {
  const s = useWindowSummary();
  return (
    <header className="readout">
      <h1>{s.city}</h1>
      <p className="readout-line">
        {s.clock}
        <span className="sep">·</span>
        {s.conditions}
      </p>
      <p className="readout-meta">{s.sun}</p>
      <p className="readout-meta source">
        <span className="dot" data-state={s.status} />
        {s.source}
      </p>
    </header>
  );
}
