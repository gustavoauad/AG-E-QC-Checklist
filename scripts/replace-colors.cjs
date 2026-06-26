/**
 * Replace hardcoded hex colors with CSS custom-property references
 * across all component and page source files.
 *
 * Run with: node scripts/replace-colors.js
 */
const fs = require("fs");
const path = require("path");

// Map: hex string (lowercase, no quotes) → CSS variable reference string
const MAP = [
  // ── Backgrounds / surfaces ────────────────────────────────────────────────
  ["#0f172a",  "var(--c-bg)"],
  ["#1e293b",  "var(--c-surface)"],
  ["#0c1a2e",  "var(--c-surface-alt)"],
  ["#0c1a28",  "var(--c-surface-alt)"],   // near-identical shade in editor
  ["#1a2a3a",  "var(--c-surface-item)"],  // item rows in editor
  ["#0d2340",  "var(--c-surface-alt)"],   // drag-over variant
  ["#060d1a",  "var(--c-surface-deep)"],
  ["#011a3d",  "var(--c-accent-dk)"],     // info-toast bg
  // ── Borders ───────────────────────────────────────────────────────────────
  ["#334155",  "var(--c-border)"],
  ["#243044",  "var(--c-border-sub)"],
  ["#1e293b",  "var(--c-surface)"],       // duplicate guard (already first entry, but keep)
  // ── Text ──────────────────────────────────────────────────────────────────
  ["#f1f5f9",  "var(--c-text)"],
  ["#e2e8f0",  "var(--c-text)"],          // slightly lighter text variant → same token
  ["#94a3b8",  "var(--c-text-2)"],
  ["#64748b",  "var(--c-text-3)"],
  ["#475569",  "var(--c-text-4)"],
  ["#cbd5e1",  "var(--c-text-4)"],        // another light muted text
  // ── Accent / brand blue ───────────────────────────────────────────────────
  ["#0095da",  "var(--c-accent)"],
  ["#012d5a",  "var(--c-accent-dk)"],
  ["#33bdef",  "var(--c-accent-lt)"],
  ["#4da8da",  "var(--c-accent-lt)"],     // close variant
  ["#7dd3fc",  "var(--c-accent-lt)"],     // sky-blue used in editor labels
  ["#29439b",  "var(--c-accent-2)"],
  ["#c7d7ff",  "var(--c-accent-lt)"],     // light blue text on accent-2 bg
  // ── Success / green ───────────────────────────────────────────────────────
  ["#4da447",  "var(--c-ok)"],
  ["#1a3318",  "var(--c-ok-bg)"],
  ["#7ecb7b",  "var(--c-ok-text)"],
  // ── Warning / amber ───────────────────────────────────────────────────────
  ["#f59e0b",  "var(--c-warn)"],
  ["#fbbf24",  "var(--c-warn-text)"],
  ["#451a03",  "var(--c-warn-bg)"],
  // ── Error / red ───────────────────────────────────────────────────────────
  ["#ef4444",  "var(--c-err)"],
  ["#dc2626",  "var(--c-err)"],
  ["#2d0a0a",  "var(--c-err-bg)"],
  ["#450a0a",  "var(--c-err-bg)"],        // toast error bg
  ["#7f1d1d",  "var(--c-err-border)"],
  ["#fca5a5",  "var(--c-err-text)"],
  // ── Neutral / stone ───────────────────────────────────────────────────────
  ["#1c1917",  "var(--c-neutral-bg)"],
  ["#78716c",  "var(--c-neutral)"],
  ["#a8a29e",  "var(--c-neutral-text)"],
  // ── Purple ────────────────────────────────────────────────────────────────
  ["#a78bfa",  "var(--c-purple)"],
  ["#2e1065",  "var(--c-purple-bg)"],
];

// Files to process (relative to repo root)
const FILES = [
  "src/App.jsx",
  "src/components/OrgShell.jsx",
  "src/components/OrgSelector.jsx",
  "src/components/AuthScreen.jsx",
  "src/components/OrgDashboard.jsx",
  "src/components/OrgSettings.jsx",
  "src/components/ProjectsDashboard.jsx",
  "src/components/CreateProjectModal.jsx",
  "src/components/ProjectSetupModal.jsx",
  "src/components/ChecklistView.jsx",
  "src/components/NotificationBell.jsx",
  "src/components/DashboardView.jsx",
];

const root = path.resolve(__dirname, "..");

let totalReplacements = 0;

FILES.forEach((rel) => {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) { console.log(`SKIP (not found): ${rel}`); return; }

  let src = fs.readFileSync(file, "utf8");
  let count = 0;

  MAP.forEach(([hex, varRef]) => {
    // Match hex inside JS string literals (both single and double quotes)
    // and also template literals and JSX attribute values.
    // We match the hex as a standalone token surrounded by quotes/backtick.
    const lc = hex.toLowerCase();
    const uc = hex.toUpperCase();

    // Replace "hex" and 'hex' with "var(...)"  — keep the surrounding quotes
    [
      new RegExp(`"${lc}"`, "g"),
      new RegExp(`'${lc}'`, "g"),
      new RegExp(`"${uc}"`, "g"),
      new RegExp(`'${uc}'`, "g"),
    ].forEach((re) => {
      const next = src.replace(re, `"${varRef}"`);
      if (next !== src) { count += (src.match(re) || []).length; src = next; }
    });
  });

  fs.writeFileSync(file, src, "utf8");
  console.log(`${rel}: ${count} replacements`);
  totalReplacements += count;
});

console.log(`\nTotal replacements: ${totalReplacements}`);
