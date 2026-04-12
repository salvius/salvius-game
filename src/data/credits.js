/**
 * Shared credits list used by the in-game Credits panel (UIScene) and the
 * victory screen scroll (Level3Scene).
 *
 * Each entry is one of:
 *   { label: string, value: string, pad?: number }  — a key/value row
 *   { label: null, value?: string }                 — blank spacer or
 *                                                     continuation value row
 *
 * `pad` (optional, default 11) controls how many characters the label column
 * is padded to before the value begins.
 */
export const CREDITS = [
  { label: 'GAME',        value: 'RESOURCE RESCUE  v1.0' },
  { label: null },
  { label: 'GAME DESIGN', value: 'GUNTHER COX', pad: 12 },
  { label: 'AUDIO FX',    value: 'GUNTHER COX', pad: 12 },
  { label: null },
  { label: 'BASED ON',    value: 'SALVIUS ROBOT' },
  { label: null,          value: 'OPEN-SOURCE PROJECT' },
  { label: null },
  { label: 'BETA TEST',   value: 'BETH COX' },
];
