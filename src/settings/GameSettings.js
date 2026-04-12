/**
 * GameSettings - persistent user preferences.
 *
 * Backed by localStorage so settings survive page reloads.
 * Import this module wherever sounds or haptics need to be gated.
 *
 * Usage:
 *   import { GameSettings } from '../settings/GameSettings.js';
 *   if (GameSettings.sounds)  this.sound.play('sfx');
 *   if (GameSettings.haptics) navigator.vibrate(15);
 *
 *   GameSettings.setSounds(false);   // persists immediately
 *   GameSettings.setHaptics(false);
 */

function readBool(key, defaultValue) {
  const raw = localStorage.getItem(key);
  if (raw === null) return defaultValue;
  return raw === 'true';
}

function detectReducedMotion() {
  return typeof window !== 'undefined' &&
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
}

export const GameSettings = {
  sounds:        readBool('sfx', true),
  haptics:       readBool('haptics', true),
  // Defaults to the OS prefers-reduced-motion preference when no saved value exists.
  reducedMotion: readBool('reducedMotion', detectReducedMotion()),

  setSounds(value) {
    this.sounds = Boolean(value);
    localStorage.setItem('sfx', String(this.sounds));
  },

  setHaptics(value) {
    this.haptics = Boolean(value);
    localStorage.setItem('haptics', String(this.haptics));
  },

  setReducedMotion(value) {
    this.reducedMotion = Boolean(value);
    localStorage.setItem('reducedMotion', String(this.reducedMotion));
  },
};
