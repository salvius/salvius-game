/**
 * GameSettings — persistent user preferences.
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

export const GameSettings = {
  sounds:  readBool('sfx', true),
  haptics: readBool('haptics', true),

  setSounds(value) {
    this.sounds = Boolean(value);
    localStorage.setItem('sfx', String(this.sounds));
  },

  setHaptics(value) {
    this.haptics = Boolean(value);
    localStorage.setItem('haptics', String(this.haptics));
  },
};
