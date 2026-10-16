import { formatTemp, useSettings } from "@/settings";

import { useWindowSummary } from "./use-window";

/** The window city's name, time and weather, quietly in the top-left corner. */
export function Readout() {
  const s = useWindowSummary();
  const { settings } = useSettings();
  return (
    <header className="readout">
      <h1>{s.city}</h1>
      <p className="readout-line">
        {s.clock}
        {s.weather && (
          <>
            <span className="sep">·</span>
            {s.weather.label} · {formatTemp(s.weather.tempC, settings.units)}
          </>
        )}
      </p>
      <p className="readout-meta">{s.sun}</p>
      {s.source && (
        <p className="readout-meta source">
          <span className="dot" data-state={s.status} />
          {s.source}
        </p>
      )}
    </header>
  );
}
