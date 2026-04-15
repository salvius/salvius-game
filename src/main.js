import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { Level1Scene } from './scenes/Level1Scene.js';
import { Level2Scene } from './scenes/Level2Scene.js';
import { Level3Scene } from './scenes/Level3Scene.js';
import { UIScene } from './ui/UIScene.js';

// BootScene is always first — it shows the loading bar, handles hash routing,
// and provides the user gesture needed to unlock Web Audio + haptics.
const scenes = [BootScene, Level1Scene, Level2Scene, Level3Scene, UIScene];

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 1200 }, debug: false },
  },
  scene: scenes,
});

// On mobile browsers (particularly iOS Safari) the orientationchange event
// fires before the browser has finished updating the layout viewport.
// Phaser's built-in handler therefore reads stale dimensions and skips the
// resize, leaving the canvas locked at the previous orientation's size.
// Forcing a refresh after a short delay guarantees Phaser re-reads the
// settled dimensions once the browser has caught up.
const forceResize = () => setTimeout(() => game.scale.refresh(), 200);
window.addEventListener('orientationchange', forceResize);
screen.orientation?.addEventListener('change', forceResize);
