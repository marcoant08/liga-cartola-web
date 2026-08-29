"use client";

import { ThemeToggle } from "@/components/theme-toggle";

const FLOAT_BTN =
  "bg-white/90 shadow-sm backdrop-blur dark:bg-zinc-950/90";

const FLOAT_BTN_BASE =
  `inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900 ${FLOAT_BTN}`;

function scrollToCharts() {
  document.getElementById("graficos")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function StatsPageFloatControls() {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      <ThemeToggle className={FLOAT_BTN} />
      <button
        type="button"
        onClick={scrollToCharts}
        aria-label="Ir para os gráficos"
        title="Gráficos"
        className={FLOAT_BTN_BASE}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
          <path
            d="M4 19V9M10 19V5M16 19v-6M22 19H2"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
