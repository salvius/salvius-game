import Phaser from 'phaser';
import { GameSettings } from '../settings/GameSettings.js';

// ── Color constants (matches UIScene palette) ────────────────────────────────
const BG_COLOR   = '#050A05';
const GREEN_HEX  = 0x00FF41;
const GREEN_STR  = '#00FF41';
const DIM_STR    = '#1A4A1A';

// Determine which level scene to boot into based on the URL hash.
function resolveTargetScene() {
  const hash = window.location.hash.toLowerCase();
  if (hash === '#level2') return 'Level2Scene';
  if (hash === '#level3') return 'Level3Scene';
  return 'Level1Scene';
}

// Asset lists per scene — mirrors each level's preload() exactly so the level
// cache-guards become no-ops and the assets are available instantly.
function assetsForScene(sceneKey) {
  switch (sceneKey) {
    case 'Level2Scene':
      return {
        spritesheets: [
          { key: 'salvius', src: '/images/salvius-sprite.png', frameConfig: { frameWidth: 340, frameHeight: 450 } },
        ],
        images: [
          { key: 'item_battery',     src: '/images/level-1/battery.png' },
          { key: 'junkpile_large',   src: '/images/level-2/junkpile-large.png' },
          { key: 'junkpile_medium',  src: '/images/level-2/junkpile-medium.png' },
          { key: 'junkpile_wide',    src: '/images/level-2/junkpile-wide.png' },
          { key: 'rat',              src: '/images/level-2/rat.png' },
          { key: 'rat_spark',        src: '/images/level-2/rat-spark.png' },
        ],
        audio: [
          { key: 'rat_squeak',  src: '/audio/rat-squeak.wav' },
          { key: 'music_level2', src: '/music/02-city-of-scrap.wav' },
        ],
      };

    case 'Level3Scene':
      return {
        spritesheets: [
          { key: 'salvius', src: '/images/salvius-sprite.png', frameConfig: { frameWidth: 340, frameHeight: 450 } },
        ],
        images: [],
        audio: [
          { key: 'jump_start',   src: '/audio/jump-start.wav' },
          { key: 'jump_land',    src: '/audio/jump-land.wav' },
          { key: 'music_level3', src: '/music/03-frequency-of-the-forgotten.wav' },
        ],
      };

    default: // Level1Scene
      return {
        spritesheets: [
          { key: 'salvius', src: '/images/salvius-sprite.png', frameConfig: { frameWidth: 340, frameHeight: 450 } },
        ],
        images: [
          { key: 'item_battery',      src: '/images/level-1/battery.png' },
          { key: 'item_motor',        src: '/images/level-1/motor.png' },
          { key: 'item_wire',         src: '/images/level-1/wire.png' },
          { key: 'item_gear',         src: '/images/level-1/gear.png' },
          { key: 'item_circuit_board',src: '/images/level-1/circuit-board.png' },
          { key: 'rock_small',        src: '/images/level-1/rock-small.png' },
          { key: 'rock_medium',       src: '/images/level-1/rock-medium.png' },
          { key: 'rock_large',        src: '/images/level-1/rock-large.png' },
          { key: 'cactus_short',      src: '/images/level-1/cactus-short.png' },
          { key: 'cactus_tall',       src: '/images/level-1/cactus-tall.png' },
        ],
        audio: [
          { key: 'pick_up_object', src: '/audio/pick-up-object.wav' },
          { key: 'music_level1',   src: '/music/01-alkali-plains.wav' },
        ],
      };
  }
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
    this._targetScene = resolveTargetScene();
    this._barGraphics = null;
    this._barW = 0;
  }

  preload() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(BG_COLOR);

    // ── Loading bar layout ──────────────────────────────────────────────────
    const barW    = Math.round(Math.min(width * 0.5, 400));
    const barH    = 18;
    const barX    = Math.round((width - barW) / 2);
    const barY    = Math.round(height * 0.58);
    this._barW    = barW;

    // Title
    this.add.text(width / 2, height * 0.38, 'RESOURCE RESCUE', {
      fontFamily: 'monospace',
      fontSize:   Math.min(40, Math.round(width / 14)) + 'px',
      color:      GREEN_STR,
    }).setOrigin(0.5);

    // Bar border
    const border = this.add.graphics();
    border.lineStyle(1, GREEN_HEX, 0.9);
    border.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);

    // Bar fill (drawn on progress)
    this._barGraphics = this.add.graphics();

    // "LOADING…" label
    this._loadingText = this.add.text(width / 2, barY + barH + 14, 'LOADING\u2026', {
      fontFamily: 'monospace',
      fontSize:   '13px',
      color:      GREEN_STR,
      alpha:      0.7,
    }).setOrigin(0.5);

    // Progress callback
    this.load.on('progress', (value) => {
      this._barGraphics.clear();
      this._barGraphics.fillStyle(GREEN_HEX, 0.85);
      this._barGraphics.fillRect(barX, barY, Math.round(barW * value), barH);
    });

    // Queue assets for the target level
    const { spritesheets, images, audio } = assetsForScene(this._targetScene);

    for (const s of spritesheets) {
      if (!this.textures.exists(s.key)) {
        this.load.spritesheet(s.key, s.src, s.frameConfig);
      }
    }
    for (const img of images) {
      if (!this.textures.exists(img.key)) {
        this.load.image(img.key, img.src);
      }
    }
    for (const sfx of audio) {
      if (!this.cache.audio.exists(sfx.key)) {
        this.load.audio(sfx.key, sfx.src);
      }
    }
  }

  create() {
    // Ensure bar shows 100% (handles the edge case where nothing was loaded)
    this._barGraphics.clear();
    this._barGraphics.fillStyle(GREEN_HEX, 0.85);
    const barW = this._barW;
    const { width, height } = this.scale;
    const barX = Math.round((width - barW) / 2);
    const barY = Math.round(height * 0.58);
    this._barGraphics.fillRect(barX, barY, barW, 18);

    // Swap "LOADING…" label for the start prompt
    this._loadingText.destroy();

    const prompt = this.add.text(width / 2, barY + 18 + 20, '[ TAP / PRESS ENTER TO START ]', {
      fontFamily: 'monospace',
      fontSize:   '14px',
      color:      GREEN_STR,
    }).setOrigin(0.5);

    // Blinking tween on the prompt
    this.tweens.add({
      targets:  prompt,
      alpha:    0.15,
      duration: 600,
      ease:     'Sine.easeInOut',
      yoyo:     true,
      repeat:   -1,
    });

    // Single-fire handler so it only triggers once
    const startGame = () => {
      // Provide the first haptic feedback so the user knows it's working
      if (GameSettings.haptics) navigator.vibrate?.(20);

      // Resume Web Audio — browsers suspend the AudioContext until a user
      // gesture; resolving it here means music plays immediately in the scene.
      const ctx = this.sound.context;
      if (ctx?.state === 'suspended') ctx.resume();

      this.scene.start(this._targetScene);
    };

    this.input.once('pointerdown', startGame);
    this.input.keyboard.once('keydown-ENTER', startGame);
    this.input.keyboard.once('keydown-SPACE', startGame);
  }
}
