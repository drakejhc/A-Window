/** Small stroke icons drawn to one 16px grid, so the app needs no icon library. */
import type { SVGProps } from "react";

const PATHS = {
  left: "M10 3.5 5.5 8l4.5 4.5",
  right: "M6 3.5 10.5 8 6 12.5",
  plus: "M8 3v10M3 8h10",
  check: "M3.5 8.5 6.5 11.5 12.5 4.5",
  x: "M4 4l8 8M12 4l-8 8",
  clock: "M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM8 5v3.2l2.2 1.4",
  schedule: "M7.5 2.5a5.5 5.5 0 1 0 5.4 6.5M8 5v3.2l2 1.3M12 1.8v3.4M10.3 3.5h3.4",
  sound: "M2.5 6v4h2.5l3.5 3V3L5 6zM11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.6a6 6 0 0 1 0 8.8",
  mute: "M2.5 6v4h2.5l3.5 3V3L5 6zM11 6l3.5 4M14.5 6 11 10",
  expand: "M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10",
  sliders: "M3 4.5h6M12 4.5h1M3 11.5h1M7 11.5h6M10.5 3v3M5.5 10v3",
  timer: "M8 4a5 5 0 1 0 0 10A5 5 0 0 0 8 4ZM8 6.5V9l1.6 1M6.5 1.5h3",
  panel: "M2.5 3h11v10h-11zM9.5 3v10",
  trash: "M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5",
  pause: "M5.5 3.5v9M10.5 3.5v9",
  play: "M5 3.2v9.6L12.5 8z",
  coffee: "M3 6h8v3.5a3.5 3.5 0 0 1-7 0zM11 7h1a1.5 1.5 0 0 1 0 3h-1.2M5.5 2.5v1.5M8.5 2.5v1.5",
  pin: "M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14ZM8 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  calendar: "M2.5 4h11v9.5h-11zM2.5 7h11M5.5 2.5v3M10.5 2.5v3",
  replan: "M2.5 8a5.5 5.5 0 0 1 9.6-3.6M13.5 8a5.5 5.5 0 0 1-9.6 3.6M12.5 2v2.8H9.7M3.5 14v-2.8h2.8",
  chevronDown: "M4 6l4 4 4-4",
  undo: "M5 3.5 2.5 6 5 8.5M2.5 6H10a3.5 3.5 0 0 1 0 7H6",
  gear: "M8 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM8 1.8v1.6M8 12.6v1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M1.8 8h1.6M12.6 8h1.6M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d={PATHS[name]} />
    </svg>
  );
}
