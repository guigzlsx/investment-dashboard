type IconName =
  | "dashboard"
  | "portfolio"
  | "health"
  | "watchlist"
  | "discover"
  | "analysis"
  | "assistant"
  | "search"
  | "settings"
  | "plus"
  | "arrow"
  | "database"
  | "spark";

const paths: Record<IconName, string> = {
  dashboard: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  portfolio: "M4 19V9m5 10V5m5 14v-7m5 7V3",
  health: "M12 21s-7-4.4-7-10.2A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 2.8C19 16.6 12 21 12 21Z",
  watchlist: "m12 3 2.78 5.63 6.22.9-4.5 4.4 1.06 6.2L12 17.2l-5.56 2.93 1.06-6.2L3 9.53l6.22-.9z",
  discover: "M10.5 18.5a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm5.2-5.2L21 18.6",
  analysis: "M4 4h16v12H4zM8 20h8M12 16v4M8 8h8M8 11h5",
  assistant: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16v5m2.5-2.5h-5",
  search: "m20 20-4.5-4.5M10.8 17a6.2 6.2 0 1 1 0-12.4 6.2 6.2 0 0 1 0 12.4Z",
  settings: "M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm0-12v2m0 13.6v2M4.5 4.5l1.4 1.4m12.2 12.2 1.4 1.4M2 12h2m16 0h2M4.5 19.5l1.4-1.4M18.1 5.9l1.4-1.4",
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h13m-5-5 5 5-5 5",
  database: "M4 6c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2Zm0 0v6c0 1.1 3.6 2 8 2s8-.9 8-2V6m-16 6v6c0 1.1 3.6 2 8 2s8-.9 8-2v-6",
  spark: "m12 3 1.3 5.7L19 10l-5.7 1.3L12 17l-1.3-5.7L5 10l5.7-1.3z",
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
      <path d={paths[name]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}
