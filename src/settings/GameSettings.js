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

function readInt(key, defaultValue) {
  const raw = localStorage.getItem(key);
  if (raw === null) return defaultValue;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : defaultValue;
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
  musicVolume:   readInt('musicVolume', 40),
  musicPlaying:  readBool('musicPlaying', true),

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

  setMusicVolume(value) {
    this.musicVolume = Math.max(0, Math.min(100, Math.round(Number(value))));
    localStorage.setItem('musicVolume', String(this.musicVolume));
  },

  setMusicPlaying(value) {
    this.musicPlaying = Boolean(value);
    localStorage.setItem('musicPlaying', String(this.musicPlaying));
  },
};
