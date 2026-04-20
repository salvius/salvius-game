import Phaser from 'phaser';
import { GameSettings } from '../settings/GameSettings.js';
import { CREDITS } from '../data/credits.js';

// ── HUD color palette ───────────────────────────────────────────────────────
const C = {
  GREEN:      0x00FF41,
  GREEN_DIM:  0x1A3A1A,
  CYAN:       0x00FFFF,
  BLACK:      0x000000,
  PANEL_BG:   0x050A05,
  // CSS strings for Phaser Text
  GREEN_S:    '#00FF41',
  GREEN_DIM_S:'#5AAA6A',
  CYAN_S:     '#00FFFF',
  DARK_S:     '#030803',
  WHITE_S:    '#CCFFCC',
};

// Panel dimensions
const PANEL_W         = 400;
const PANEL_H_CFG     = 454;
const PANEL_H_INFO    = 480;
const PANEL_H_CREDITS = 370;
const PANEL_H_MUSIC   = 650;

const TRACKS = [
  { key: 'music_level1', src: '/music/01-alkali-plains.wav',
    name: 'Alkali Plains',               num: '01', hue: 35  },  // amber – desert sand
  { key: 'music_level2', src: '/music/02-city-of-scrap.wav',
    name: 'City of Scrap',               num: '02', hue: 18  },  // rusty red-orange – industrial metal
  { key: 'music_level3', src: '/music/03-frequency-of-the-forgotten.wav',
    name: 'Frequency of the Forgotten',  num: '03', hue: 210 },  // electric blue – radio waves
  { key: 'music_level4', src: '/music/04-breath-of-a-dying-star.wav',
    name: 'Breath of a Dying Star',       num: '04', hue: 285 },  // magenta-violet – nebula
];
const PANEL_H_ABOUT   = 548;
const PAD             = 24;
const ICON_BAR_H  = 36;
const ICON_BAR_PAD= 8;

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene', active: false });
    this._modalObjects = [];
    this._focusItems = [];
    this._focusNavHandlers = [];
    this._modalPointerHandlers = [];
    this._recording = false;
    this._recordChunks = [];
  }

  preload() {
    this.load.image('cd', '/images/cd.png');
  }

  create() {
    this._recordMode = new URLSearchParams(window.location.search).get('record') === 'true';
    this._buildIconBar();

    // Close any open modal with Escape
    this.input.keyboard.on('keydown-ESC', () => {
      if (this._modalOpen) this._closeModal();
    });

    // Open Settings / Docs from gameplay
    this.input.keyboard.on('keydown-P', () => {
      if (!this._modalOpen) this._openSettings();
    });
    this.input.keyboard.on('keydown-H', () => {
      if (!this._modalOpen) this._openInfo();
    });

    // Re-build icon bar on resize so it stays anchored to top-right
    this.scale.on('resize', this._onResize, this);
    this.events.on('shutdown', () => {
      this.scale.off('resize', this._onResize, this);
      if (this._recording) this._stopRecording();
    });
  }

  // ── Persistent icon bar ───────────────────────────────────────────────────

  _buildIconBar() {
    // Clean up previous bar if rebuilding after resize
    if (this._barObjects) this._barObjects.forEach(o => o.destroy());
    this._barObjects = [];

    const { width } = this.scale;
    const barW  = 160;
    const barH  = ICON_BAR_H;
    const barX  = width - barW - ICON_BAR_PAD;
    const barY  = ICON_BAR_PAD;
    const depth = 30;

    // Bar backing - thin green-bordered rectangle
    const barBg = this.add.graphics()
      .setScrollFactor(0)
      .setDepth(depth);
    barBg.fillStyle(C.PANEL_BG, 0.88);
    barBg.fillRect(barX, barY, barW, barH);
    barBg.lineStyle(1, C.GREEN, 0.8);
    barBg.strokeRect(barX, barY, barW, barH);

    // Music play/pause button
    const musicZoneX = barX + 4, musicZoneY = barY + 2, musicZoneW = 46, musicZoneH = barH - 4;
    const musicBg = this.add.graphics().setScrollFactor(0).setDepth(depth);
    this._drawGlow(musicBg, musicZoneX, musicZoneY, musicZoneW, musicZoneH);
    musicBg.setInteractive(
      new Phaser.Geom.Rectangle(musicZoneX, musicZoneY, musicZoneW, musicZoneH),
      Phaser.Geom.Rectangle.Contains,
    );
    musicBg.input.cursor = 'pointer';

    const musicIcon = GameSettings.musicPlaying ? '⏸' : '▶';
    const musicBtn = this.add.text(barX + 27, barY + barH / 2, musicIcon, {
      fontSize: '18px', fill: C.GREEN_S, fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

    musicBg.on('pointerover',  () => musicBtn.setAlpha(0.7));
    musicBg.on('pointerout',   () => musicBtn.setAlpha(1));
    musicBg.on('pointerdown',  () => { this._haptic();
      const nowPlaying = !GameSettings.musicPlaying;
      GameSettings.setMusicPlaying(nowPlaying);
      const gameScene = this._getGameScene();
      if (gameScene?.music) {
        if (nowPlaying) {
          if (gameScene.music.isPaused) {
            gameScene.music.resume();
          } else {
            gameScene.music.play();
          }
        } else {
          gameScene.music.pause();
        }
      }
      this._buildIconBar();
    });

    // Divider 1
    const div1 = this.add.text(barX + 53, barY + barH / 2, '│', {
      fontSize: '18px', fill: C.GREEN_DIM_S, fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

    // Gear button - full hit zone on the background graphic
    const gearZoneX = barX + 57, gearZoneY = barY + 2, gearZoneW = 46, gearZoneH = barH - 4;
    const gearBg = this.add.graphics().setScrollFactor(0).setDepth(depth);
    this._drawGlow(gearBg, gearZoneX, gearZoneY, gearZoneW, gearZoneH);
    gearBg.setInteractive(
      new Phaser.Geom.Rectangle(gearZoneX, gearZoneY, gearZoneW, gearZoneH),
      Phaser.Geom.Rectangle.Contains,
    );
    gearBg.input.cursor = 'pointer';

    const gearBtn = this.add.text(barX + 80, barY + barH / 2, '⚙', {
      fontSize: '20px', fill: C.GREEN_S, fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

    gearBg.on('pointerover',  () => gearBtn.setAlpha(0.7));
    gearBg.on('pointerout',   () => gearBtn.setAlpha(1));
    gearBg.on('pointerdown',  () => {
      if (this._modalOpen) return;
      this._haptic();
      this._openSettings();
    });

    // Divider 2
    const div2 = this.add.text(barX + 106, barY + barH / 2, '│', {
      fontSize: '18px', fill: C.GREEN_DIM_S, fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

    let thirdBg, thirdBtn;
    if (this._recordMode) {
      // Record / Stop button in place of the book icon
      const recZoneX = barX + 110, recZoneY = barY + 2, recZoneW = 46, recZoneH = barH - 4;
      thirdBg = this.add.graphics().setScrollFactor(0).setDepth(depth);
      this._drawGlow(thirdBg, recZoneX, recZoneY, recZoneW, recZoneH);
      thirdBg.setInteractive(
        new Phaser.Geom.Rectangle(recZoneX, recZoneY, recZoneW, recZoneH),
        Phaser.Geom.Rectangle.Contains,
      );
      thirdBg.input.cursor = 'pointer';

      thirdBtn = this.add.text(barX + 133, barY + barH / 2, this._recording ? '⏹' : '⏺', {
        fontSize: '18px', fill: this._recording ? '#FF4444' : C.GREEN_S, fontFamily: 'monospace',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

      thirdBg.on('pointerover',  () => thirdBtn.setAlpha(0.7));
      thirdBg.on('pointerout',   () => thirdBtn.setAlpha(1));
      thirdBg.on('pointerdown',  () => { this._haptic(); this._toggleRecording(); });
    } else {
      // Book button - full hit zone on the background graphic
      const bookZoneX = barX + 110, bookZoneY = barY + 2, bookZoneW = 46, bookZoneH = barH - 4;
      thirdBg = this.add.graphics().setScrollFactor(0).setDepth(depth);
      this._drawGlow(thirdBg, bookZoneX, bookZoneY, bookZoneW, bookZoneH);
      thirdBg.setInteractive(
        new Phaser.Geom.Rectangle(bookZoneX, bookZoneY, bookZoneW, bookZoneH),
        Phaser.Geom.Rectangle.Contains,
      );
      thirdBg.input.cursor = 'pointer';

      thirdBtn = this.add.text(barX + 133, barY + barH / 2, '📖', {
        fontSize: '18px', fontFamily: 'monospace',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

      thirdBg.on('pointerover',  () => thirdBtn.setAlpha(0.7));
      thirdBg.on('pointerout',   () => thirdBtn.setAlpha(1));
      thirdBg.on('pointerdown',  () => {
        if (this._modalOpen) return;
        this._haptic();
        this._openInfo();
      });
    }

    this._barObjects = [barBg, musicBg, musicBtn, div1, gearBg, gearBtn, div2, thirdBg, thirdBtn];
  }

  _drawGlow(gfx, x, y, w, h) {
    gfx.fillStyle(C.GREEN, 0.06);
    gfx.fillRect(x, y, w, h);
  }

  _onResize() {
    this._buildIconBar();
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────

  _getGameScene() {
    // Pass false to get ALL scenes (active + paused) - a paused game scene
    // is not returned by getScenes(true), which would prevent it from ever
    // being resumed after a modal closes.
    return this.scene.manager
      .getScenes(false)
      .find(s => s.scene.key !== 'UIScene' && (s.scene.isActive() || s.scene.isPaused()));
  }

  _openModal(height) {
    this._modalOpen = true;
    this._modalObjects = [];

    const gameScene = this._getGameScene();
    gameScene?.scene.pause();

    const { width: sw, height: sh } = this.scale;
    const depth = 31;

    // Full-screen dim
    const dim = this.add.rectangle(0, 0, sw, sh, C.BLACK, 0.72)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(depth);
    this._modalObjects.push(dim);

    // Panel position - centered
    const px = (sw - PANEL_W) / 2;
    const py = (sh - height) / 2;

    // Panel background
    const panelBg = this.add.graphics().setScrollFactor(0).setDepth(depth + 1);
    panelBg.fillStyle(C.PANEL_BG, 0.96);
    panelBg.fillRect(px, py, PANEL_W, height);

    // Green border
    panelBg.lineStyle(1.5, C.GREEN, 1);
    panelBg.strokeRect(px, py, PANEL_W, height);

    // Outer corner brackets
    this._addCornerBrackets(panelBg, px, py, PANEL_W, height, depth + 2);

    // Scanline overlay
    const scanlines = this.add.graphics().setScrollFactor(0).setDepth(depth + 2);
    for (let ly = py + 2; ly < py + height; ly += 4) {
      scanlines.fillStyle(C.GREEN, 0.035);
      scanlines.fillRect(px + 1, ly, PANEL_W - 2, 1);
    }

    this._modalObjects.push(panelBg, scanlines);

    return { px, py, depth };
  }

  _addCornerBrackets(gfx, x, y, w, h, depth) {
    const L = 12;  // bracket arm length
    const corners = [
      // top-left
      [[x - 6, y + L, x - 6, y - 6, x + L, y - 6]],
      // top-right
      [[x + w - L, y - 6, x + w + 6, y - 6, x + w + 6, y + L]],
      // bottom-left
      [[x - 6, h + y - L, x - 6, y + h + 6, x + L, y + h + 6]],
      // bottom-right
      [[x + w - L, y + h + 6, x + w + 6, y + h + 6, x + w + 6, h + y - L]],
    ];
    corners.forEach(([pts]) => {
      gfx.lineStyle(1.5, C.GREEN, 1);
      gfx.strokePoints(
        pts.reduce((acc, _, i, a) => i % 2 === 0 ? [...acc, { x: a[i], y: a[i + 1] }] : acc, []),
        false,
      );
    });
  }

  _addSeparator(x, y, w, depth) {
    const sep = this.add.text(x + PAD, y, '─'.repeat(Math.floor((w - PAD * 2) / 6)), {
      fontSize: '10px', fill: C.GREEN_DIM_S, fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(depth);
    this._modalObjects.push(sep);
    return sep;
  }

  _closeModal() {
    this._stopMusicPreview();
    // Remove keyboard navigation handlers added by _initModalFocus
    for (const [event, fn] of this._focusNavHandlers) {
      this.input.keyboard.off(event, fn);
    }
    this._focusNavHandlers = [];
    this._focusItems = [];

    // Remove pointer handlers added by slider rows
    for (const [event, fn] of this._modalPointerHandlers) {
      this.input.off(event, fn);
    }
    this._modalPointerHandlers = [];

    this._modalObjects.forEach(o => o.destroy());
    this._modalObjects = [];
    this._modalOpen = false;

    const gameScene = this._getGameScene();
    gameScene?.scene.resume();
    if (this._musicModalWasPlaying) {
      gameScene?.music?.resume();
    }
    this._musicModalWasPlaying = undefined;
  }

  // ── Settings panel ────────────────────────────────────────────────────────

  _openSettings(restoreFocusIndex = 0) {
    this._focusItems = [];
    const { px, py, depth } = this._openModal(PANEL_H_CFG);
    const d = depth + 3;
    let y = py + PAD;

    // Title
    const title = this.add.text(px + PANEL_W / 2, y, '◈  SYSTEM CONFIG  ◈', {
      fontSize: '15px', fill: C.GREEN_S, fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(d);
    this._modalObjects.push(title);

    y += 30;
    this._addSeparator(px, y, PANEL_W, d);
    y += 18;

    // Music volume slider
    y = this._addSliderRow(px, y, PANEL_W, d, 'MUSIC VOLUME', GameSettings.musicVolume, (val) => {
      GameSettings.setMusicVolume(val);
      const gameScene = this._getGameScene();
      if (gameScene?.music) gameScene.music.setVolume(val / 100);
    });

    y += 14;
    this._addSeparator(px, y, PANEL_W, d);
    y += 18;

    // SFX row
    y = this._addToggleRow(px, y, PANEL_W, d, 'SFX AUDIO', GameSettings.sounds, (val) => {
      GameSettings.setSounds(val);
    });

    y += 14;
    this._addSeparator(px, y, PANEL_W, d);
    y += 18;

    // Haptics row
    y = this._addToggleRow(px, y, PANEL_W, d, 'HAPTIC FEEDBACK', GameSettings.haptics, (val) => {
      GameSettings.setHaptics(val);
    });

    y += 14;
    this._addSeparator(px, y, PANEL_W, d);
    y += 18;

    // Reduced motion row
    y = this._addToggleRow(px, y, PANEL_W, d, 'REDUCED MOTION', GameSettings.reducedMotion, (val) => {
      GameSettings.setReducedMotion(val);
    });

    y += 20;
    this._addSeparator(px, y, PANEL_W, d);
    y += 18;

    // Close button
    this._addCloseButton(px, y, PANEL_W, d);
    y += 38;
    this._addEscHint(px, y, PANEL_W, d);
    this._initModalFocus(restoreFocusIndex);
  }

  /**
   * Renders a horizontal drag slider row: label on left, value "XX%" on right.
   * The track spans the full panel width (minus padding). A filled green bar
   * and a square thumb show the current position. Pointer drag updates the
   * value live and calls onChange without rebuilding the panel.
   * Returns the new y cursor after the row.
   */
  _addSliderRow(px, startY, panelW, depth, label, currentValue, onChange) {
    const ROW_H    = 50;
    const trackX   = px + PAD;
    const trackW   = panelW - PAD * 2;
    const trackY   = startY + 30;
    const trackH   = 4;
    const thumbSz  = 14;

    // Label
    const lbl = this.add.text(px + PAD, startY + 6, label, {
      fontSize: '12px', fill: C.WHITE_S, fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(depth);
    this._modalObjects.push(lbl);

    // Percentage text (right-aligned)
    const pctTxt = this.add.text(px + panelW - PAD, startY + 6, `${currentValue}%`, {
      fontSize: '12px', fill: C.GREEN_S, fontFamily: 'monospace',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(depth);
    this._modalObjects.push(pctTxt);

    // Track background
    const trackGfx = this.add.graphics().setScrollFactor(0).setDepth(depth);
    const thumbGfx = this.add.graphics().setScrollFactor(0).setDepth(depth + 1);
    this._modalObjects.push(trackGfx, thumbGfx);

    const drawSlider = (val) => {
      const t = Math.max(0, Math.min(100, val)) / 100;
      const thumbX = trackX + t * trackW;

      trackGfx.clear();
      // Dim track
      trackGfx.fillStyle(C.GREEN_DIM, 0.6);
      trackGfx.fillRect(trackX, trackY, trackW, trackH);
      // Filled portion
      trackGfx.fillStyle(C.GREEN, 1);
      trackGfx.fillRect(trackX, trackY, t * trackW, trackH);

      thumbGfx.clear();
      thumbGfx.fillStyle(C.GREEN, 1);
      thumbGfx.fillRect(thumbX - thumbSz / 2, trackY - (thumbSz - trackH) / 2, thumbSz, thumbSz);
      thumbGfx.lineStyle(1, C.CYAN, 1);
      thumbGfx.strokeRect(thumbX - thumbSz / 2, trackY - (thumbSz - trackH) / 2, thumbSz, thumbSz);
    };

    drawSlider(currentValue);

    // Pointer interaction - transparent hit zone covering the track + thumb height
    const hitZone = this.add.graphics().setScrollFactor(0).setDepth(depth + 2);
    hitZone.fillStyle(0xffffff, 0.001);
    hitZone.fillRect(trackX, trackY - 10, trackW, trackH + 20);
    hitZone.setInteractive(
      new Phaser.Geom.Rectangle(trackX, trackY - 10, trackW, trackH + 20),
      Phaser.Geom.Rectangle.Contains,
    );
    hitZone.input.cursor = 'pointer';
    this._modalObjects.push(hitZone);

    let dragging = false;

    const applyPointerX = (x) => {
      const t = Math.max(0, Math.min(1, (x - trackX) / trackW));
      const val = Math.round(t * 100);
      drawSlider(val);
      pctTxt.setText(`${val}%`);
      onChange(val);
    };

    hitZone.on('pointerdown', (ptr) => {
      dragging = true;
      applyPointerX(ptr.x);
    });

    const onMove = (ptr) => {
      if (dragging) applyPointerX(ptr.x);
    };
    const onUp = () => { dragging = false; };

    this.input.on('pointermove', onMove);
    this.input.on('pointerup',   onUp);
    this._modalPointerHandlers.push(['pointermove', onMove], ['pointerup', onUp]);

    return startY + ROW_H;
  }

  /**
   * Renders a toggle row: label on left, [  ON ] [ OFF ] on right.
   * Clicking either option calls onChange(newBool) and redraws the row.
   * Returns the new y cursor after the row.
   */
  _addToggleRow(px, startY, panelW, depth, label, currentValue, onChange) {
    const ROW_H = 44;
    const halfD = depth;

    const lbl = this.add.text(px + PAD, startY + 10, label, {
      fontSize: '12px', fill: C.WHITE_S, fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(halfD);
    this._modalObjects.push(lbl);

    const makeToggle = (isOn, value) => {
      const btnW = 52;
      const btnH = 24;
      const btnX = px + panelW - PAD - (isOn ? btnW + 4 + btnW : btnW);
      const btnY = startY + 8;

      const bg = this.add.graphics().setScrollFactor(0).setDepth(halfD);
      if ((value && isOn) || (!value && !isOn)) {
        // Active state
        bg.fillStyle(isOn ? C.GREEN : C.BLACK, 1);
        bg.fillRect(btnX, btnY, btnW, btnH);
        bg.lineStyle(1, C.CYAN, 1);
        bg.strokeRect(btnX, btnY, btnW, btnH);
      } else {
        // Inactive state
        bg.fillStyle(C.BLACK, 1);
        bg.fillRect(btnX, btnY, btnW, btnH);
        bg.lineStyle(1, C.GREEN_DIM, 0.5);
        bg.strokeRect(btnX, btnY, btnW, btnH);
      }

      const activeText = (value && isOn) || (!value && !isOn);
      const txt = this.add.text(btnX + btnW / 2, btnY + btnH / 2, isOn ? 'ON' : 'OFF', {
        fontSize: '11px',
        fill: activeText ? (isOn ? C.DARK_S : C.CYAN_S) : C.GREEN_DIM_S,
        fontFamily: 'monospace',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(halfD + 1);

      bg.setInteractive(
        new Phaser.Geom.Rectangle(btnX, btnY, btnW, btnH),
        Phaser.Geom.Rectangle.Contains,
      );
      bg.on('pointerdown', () => {
        if (isOn === value) return; // already active
        onChange(isOn);
        // Rebuild the whole settings panel to reflect the new state
        this._closeModal();
        this._openSettings();
      });
      bg.on('pointerover',  () => txt.setAlpha(0.7));
      bg.on('pointerout',   () => txt.setAlpha(1));

      this._modalObjects.push(bg, txt);
    };

    // Render ON button then OFF button, right-aligned as a pair
    const btnW  = 52;
    const gap   = 4;
    const pairW = btnW * 2 + gap;
    const pairX = px + panelW - PAD - pairW;
    const btnY  = startY + 8;
    const btnH  = 24;

    const renderBtn = (isOn) => {
      const btnX   = isOn ? pairX : pairX + btnW + gap;
      const active = currentValue === isOn;

      const bg = this.add.graphics().setScrollFactor(0).setDepth(halfD);
      // Active ON → green fill; active OFF → vivid red fill; inactive → dark panel
      bg.fillStyle(active ? (isOn ? C.GREEN : 0x7A0000) : 0x0D180D, 1);
      bg.fillRect(btnX, btnY, btnW, btnH);
      // Active → cyan border; inactive → visible muted green border
      bg.lineStyle(1, active ? C.CYAN : 0x3A7A3A, active ? 1 : 0.85);
      bg.strokeRect(btnX, btnY, btnW, btnH);

      // Active ON → dark label; active OFF → cyan label; inactive → legible muted green
      const txtColor = active ? (isOn ? C.DARK_S : C.CYAN_S) : '#5AAA6A';
      const txt = this.add.text(btnX + btnW / 2, btnY + btnH / 2, isOn ? 'ON' : 'OFF', {
        fontSize: '11px', fill: txtColor, fontFamily: 'monospace',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(halfD + 1);

      bg.setInteractive(
        new Phaser.Geom.Rectangle(btnX, btnY, btnW, btnH),
        Phaser.Geom.Rectangle.Contains,
      );
      const focusIdx = this._focusItems.length;

      bg.on('pointerdown', () => {
        if (active) return;
        this._haptic();
        onChange(isOn);
        this._closeModal();
        this._openSettings(focusIdx);
      });
      bg.on('pointerover',  () => txt.setAlpha(0.7));
      bg.on('pointerout',   () => txt.setAlpha(1));

      this._modalObjects.push(bg, txt);
      this._focusItems.push({
        x: btnX, y: btnY, w: btnW, h: btnH,
        activate: () => {
          if (active) return;
          onChange(isOn);
          this._closeModal();
          this._openSettings(focusIdx);
        },
      });
    };

    renderBtn(true);   // ON
    renderBtn(false);  // OFF

    return startY + ROW_H;
  }

  _addCloseButton(px, y, panelW, depth) {
    this._addButton(px, y, panelW, depth, '[ ✕  CLOSE ]', () => this._closeModal());
  }

  /**
   * Renders a BACK button and a CLOSE button side-by-side, centered in the
   * panel. Used by sub-panels that navigate back to a parent panel.
   */
  _addBackAndCloseButtons(px, y, panelW, depth, backAction) {
    const btnW  = 130;
    const btnH  = 28;
    const gap   = 12;
    const totalW = btnW * 2 + gap;
    const startX = px + (panelW - totalW) / 2;
    this._addButtonAt(startX,          y, btnW, btnH, depth, '[ ← BACK ]',    backAction);
    this._addButtonAt(startX + btnW + gap, y, btnW, btnH, depth, '[ ✕  CLOSE ]', () => this._closeModal());
  }

  /**
   * Generic centred navigation button. Registers as a focusable item.
   */
  _addButton(px, y, panelW, depth, label, action) {
    const btnW = 120;
    const btnH = 28;
    const btnX = px + (panelW - btnW) / 2;
    this._addButtonAt(btnX, y, btnW, btnH, depth, label, action);
  }

  /** Renders a button at an explicit position and registers it as focusable. */
  _addButtonAt(btnX, y, btnW, btnH, depth, label, action) {
    const bg = this.add.graphics().setScrollFactor(0).setDepth(depth);
    bg.fillStyle(C.PANEL_BG, 1);
    bg.fillRect(btnX, y, btnW, btnH);
    bg.lineStyle(1.5, C.GREEN, 0.9);
    bg.strokeRect(btnX, y, btnW, btnH);

    const txt = this.add.text(btnX + btnW / 2, y + btnH / 2, label, {
      fontSize: '12px', fill: C.GREEN_S, fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

    bg.setInteractive(
      new Phaser.Geom.Rectangle(btnX, y, btnW, btnH),
      Phaser.Geom.Rectangle.Contains,
    );
    bg.on('pointerdown', () => { this._haptic(); action(); });
    bg.on('pointerover',  () => txt.setAlpha(0.65));
    bg.on('pointerout',   () => txt.setAlpha(1));

    this._modalObjects.push(bg, txt);
    this._focusItems.push({ x: btnX, y, w: btnW, h: btnH, activate: action });
  }

  async _acquireWakeLock() {
    if (this._wakeLock) return;

    // Register the visibility-change recovery handler regardless of whether the
    // lock request succeeds, so the retry mechanism is always in place.
    if (!this._wakeLockVisibilityHandler) {
      this._wakeLockVisibilityHandler = () => {
        if (document.visibilityState === 'visible' && this._currentPreviewTrackIdx >= 0) {
          console.log('[WakeLock] Page visible again — re-acquiring wake lock');
          this._acquireWakeLock();
        }
      };
      document.addEventListener('visibilitychange', this._wakeLockVisibilityHandler);
    }

    if (!navigator.wakeLock) return;
    try {
      this._wakeLock = await navigator.wakeLock.request('screen');
      this._wakeLock.addEventListener('release', () => { this._wakeLock = null; });
    } catch { /* wake lock not supported or denied — silent fail */ }
  }

  /** Fire a short vibration pulse when haptics are enabled. */
  _haptic(duration = 10) {
    if (GameSettings.haptics && navigator.vibrate) navigator.vibrate(duration);
  }

  _releaseWakeLock() {
    if (this._wakeLockVisibilityHandler) {
      document.removeEventListener('visibilitychange', this._wakeLockVisibilityHandler);
      this._wakeLockVisibilityHandler = null;
    }
    this._wakeLock?.release();
    this._wakeLock = null;
  }

  _stopMusicPreview() {
    // Visualizer cleanup — must happen before the timer and texture are gone
    this._vizTimer?.remove(false);
    this._vizTimer = null;
    if (this.textures.exists('__viz__')) this.textures.remove('__viz__');
    if (this._analyser) {
      try { this._analyser.disconnect(); } catch { /* already disconnected */ }
      this._analyser = null;
    }
    this._freqData = null;
    this._progressTimer?.remove(false);
    this._progressTimer = null;
    this._progressTimeTxt = null;
    (this._musicPreviewSounds ?? []).forEach(s => { s?.stop(); s?.destroy(); });
    this._musicPreviewSounds = [];
    this._cdSpinTween?.stop();
    this._cdSpinTween = null;
    this._currentPreviewTrackIdx = -1;
    this._releaseWakeLock();
  }

  /**
   * Tears down the current modal panel and focus state, ready to open a new
   * panel — without resuming the game scene (avoids a single-frame resume
   * flash when navigating between Info and Credits).
   */
  _swapModal() {
    this._stopMusicPreview();
    for (const [ev, fn] of this._focusNavHandlers) this.input.keyboard.off(ev, fn);
    this._focusNavHandlers = [];
    this._focusItems = [];
    for (const [ev, fn] of this._modalPointerHandlers) this.input.off(ev, fn);
    this._modalPointerHandlers = [];
    this._modalObjects.forEach(o => o.destroy());
    this._modalObjects = [];
    this._modalOpen = false;
  }

  // ── Info / manual panel ───────────────────────────────────────────────────

  _openInfo() {
    this._focusItems = [];
    const { px, py, depth } = this._openModal(PANEL_H_INFO);
    const d = depth + 3;
    let y = py + PAD;

    const title = this.add.text(px + PANEL_W / 2, y, '◈  SYSTEM MANUAL  v1.0  ◈', {
      fontSize: '14px', fill: C.GREEN_S, fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(d);
    this._modalObjects.push(title);

    y += 28;
    this._addSeparator(px, y, PANEL_W, d);
    y += 18;

    const lines = [
      { label: 'UNIT',     value: 'SALVIUS-7' },
      { label: 'MISSION',  value: 'RECOVER COMPONENTS' },
      { label: null },
      { label: 'CONTROLS', value: '← → / A D  MOVE  |  SHIFT  RUN' },
      { label: null,        value: '↑ / W / SPACE  JUMP' },
      { label: null },
      { label: 'LVL 1',   value: 'DESERT - COLLECT 5 PARTS' },
      { label: 'LVL 2',   value: 'JUNKYARD - REACH RADIO TOWER' },
      { label: 'LVL 3',   value: 'TOWER CLIMB - REACH BEACON' },
      { label: null },
      { label: 'TOUCH',   value: '◀ ▶ ▲ RUN | BUTTONS ON-SCREEN' },
    ];

    const lineH = 22;
    lines.forEach(({ label, value }) => {
      if (label === null && value === undefined) {
        y += 6;
        return;
      }
      const row = label
        ? `${label.padEnd(11, ' ')}${value ?? ''}`
        : `           ${value ?? ''}`;
      const t = this.add.text(px + PAD, y, row, {
        fontSize: '11px', fill: label ? C.GREEN_S : C.WHITE_S, fontFamily: 'monospace',
      }).setScrollFactor(0).setDepth(d);
      this._modalObjects.push(t);
      y += lineH;
    });

    // Nav links — taller rows for easy mobile tapping
    const navLinkH = 38;

    // Credits inline link
    y += 6;
    const creditsTxt = this.add.text(px + PAD, y + navLinkH / 2, '  >  CREDITS', {
      fontSize: '13px', fill: C.GREEN_DIM_S, fontFamily: 'monospace',
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(d);
    this._modalObjects.push(creditsTxt);
    creditsTxt.setInteractive(
      new Phaser.Geom.Rectangle(0, -navLinkH / 2, PANEL_W - PAD * 2, navLinkH),
      Phaser.Geom.Rectangle.Contains,
    );
    creditsTxt.input.cursor = 'pointer';
    creditsTxt.on('pointerdown', () => { this._haptic(); this._swapModal(); this._openCredits(); });
    creditsTxt.on('pointerover',  () => creditsTxt.setStyle({ fill: C.CYAN_S, fontStyle: 'bold' }));
    creditsTxt.on('pointerout',   () => {
      // Restore dim unless keyboard focus is currently on this item
      const focused = this._focusItems[this._focusIndex];
      if (focused?.creditsTxt !== creditsTxt) {
        creditsTxt.setStyle({ fill: C.GREEN_DIM_S, fontStyle: 'normal' });
      }
    });
    this._focusItems.push({
      creditsTxt,
      skipRing: true,
      x: px + PAD, y, w: PANEL_W - PAD * 2, h: navLinkH,
      onFocus: () => creditsTxt.setStyle({ fill: C.CYAN_S, fontStyle: 'bold' }),
      onBlur:  () => creditsTxt.setStyle({ fill: C.GREEN_DIM_S, fontStyle: 'normal' }),
      activate: () => { this._swapModal(); this._openCredits(); },
    });
    y += navLinkH;

    // About inline link
    const aboutInfoTxt = this.add.text(px + PAD, y + navLinkH / 2, '  >  ABOUT', {
      fontSize: '13px', fill: C.GREEN_DIM_S, fontFamily: 'monospace',
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(d);
    this._modalObjects.push(aboutInfoTxt);
    aboutInfoTxt.setInteractive(
      new Phaser.Geom.Rectangle(0, -navLinkH / 2, PANEL_W - PAD * 2, navLinkH),
      Phaser.Geom.Rectangle.Contains,
    );
    aboutInfoTxt.input.cursor = 'pointer';
    aboutInfoTxt.on('pointerdown', () => { this._haptic(); this._swapModal(); this._openAbout(); });
    aboutInfoTxt.on('pointerover',  () => aboutInfoTxt.setStyle({ fill: C.CYAN_S, fontStyle: 'bold' }));
    aboutInfoTxt.on('pointerout',   () => {
      const focused = this._focusItems[this._focusIndex];
      if (focused?.aboutInfoTxt !== aboutInfoTxt) {
        aboutInfoTxt.setStyle({ fill: C.GREEN_DIM_S, fontStyle: 'normal' });
      }
    });
    this._focusItems.push({
      aboutInfoTxt,
      skipRing: true,
      x: px + PAD, y, w: PANEL_W - PAD * 2, h: navLinkH,
      onFocus: () => aboutInfoTxt.setStyle({ fill: C.CYAN_S, fontStyle: 'bold' }),
      onBlur:  () => aboutInfoTxt.setStyle({ fill: C.GREEN_DIM_S, fontStyle: 'normal' }),
      activate: () => { this._swapModal(); this._openAbout(); },
    });
    y += navLinkH;

    // Music inline link
    const musicInfoTxt = this.add.text(px + PAD, y + navLinkH / 2, '  >  MUSIC', {
      fontSize: '13px', fill: C.GREEN_DIM_S, fontFamily: 'monospace',
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(d);
    this._modalObjects.push(musicInfoTxt);
    musicInfoTxt.setInteractive(
      new Phaser.Geom.Rectangle(0, -navLinkH / 2, PANEL_W - PAD * 2, navLinkH),
      Phaser.Geom.Rectangle.Contains,
    );
    musicInfoTxt.input.cursor = 'pointer';
    musicInfoTxt.on('pointerdown', () => { this._haptic(); this._swapModal(); this._openMusic(); });
    musicInfoTxt.on('pointerover',  () => musicInfoTxt.setStyle({ fill: C.CYAN_S, fontStyle: 'bold' }));
    musicInfoTxt.on('pointerout',   () => {
      const focused = this._focusItems[this._focusIndex];
      if (focused?.musicInfoTxt !== musicInfoTxt) {
        musicInfoTxt.setStyle({ fill: C.GREEN_DIM_S, fontStyle: 'normal' });
      }
    });
    this._focusItems.push({
      musicInfoTxt,
      skipRing: true,
      x: px + PAD, y, w: PANEL_W - PAD * 2, h: navLinkH,
      onFocus: () => musicInfoTxt.setStyle({ fill: C.CYAN_S, fontStyle: 'bold' }),
      onBlur:  () => musicInfoTxt.setStyle({ fill: C.GREEN_DIM_S, fontStyle: 'normal' }),
      activate: () => { this._swapModal(); this._openMusic(); },
    });
    y += navLinkH;

    y += 10;
    this._addSeparator(px, y, PANEL_W, d);
    y += 16;

    this._addCloseButton(px, y, PANEL_W, d);
    y += 38;
    this._addEscHint(px, y, PANEL_W, d);
    this._initModalFocus();
  }

  // ── Credits panel ─────────────────────────────────────────────────────────

  _openCredits() {
    this._focusItems = [];
    const { px, py, depth } = this._openModal(PANEL_H_CREDITS);
    const d = depth + 3;
    let y = py + PAD;

    const title = this.add.text(px + PANEL_W / 2, y, '◈  CREDITS  ◈', {
      fontSize: '15px', fill: C.GREEN_S, fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(d);
    this._modalObjects.push(title);

    y += 28;
    this._addSeparator(px, y, PANEL_W, d);
    y += 18;

    const lines = CREDITS;

    const lineH = 22;
    lines.forEach(({ label, value, pad = 11 }) => {
      if (label === null && value === undefined) { y += 6; return; }
      const row = label
        ? `${label.padEnd(pad, ' ')}${value ?? ''}`
        : `           ${value ?? ''}`;
      const t = this.add.text(px + PAD, y, row, {
        fontSize: '11px', fill: label ? C.GREEN_S : C.WHITE_S, fontFamily: 'monospace',
      }).setScrollFactor(0).setDepth(d);
      this._modalObjects.push(t);
      y += lineH;
    });

    y += 10;
    this._addSeparator(px, y, PANEL_W, d);
    y += 16;

    this._addBackAndCloseButtons(px, y, PANEL_W, d, () => {
      this._swapModal();
      this._openInfo();
    });
    y += 38;
    this._addEscHint(px, y, PANEL_W, d);
    this._initModalFocus();
  }

  // ── Accessibility helpers ──────────────────────────────────────────────

  /** Dim footnote below the close button reminding players to press ESC. */
  _addEscHint(px, y, panelW, depth) {
    const hint = this.add.text(px + panelW / 2, y, '[ ESC ]  CLOSE  |  ↑↓←→ / TAB  NAVIGATE', {
      fontSize: '10px', fill: C.GREEN_DIM_S, fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(depth);
    this._modalObjects.push(hint);
  }

  /**
   * Installs Tab / Shift+Tab / Enter / Space keyboard navigation for the
   * open modal. Call at the end of _openSettings / _openInfo after all
   * focusable items have been pushed to this._focusItems.
   */
  _initModalFocus(startIndex = 0) {
    this._focusIndex = Math.min(startIndex, Math.max(0, this._focusItems.length - 1));
    this._focusRingGfx = this.add.graphics().setScrollFactor(0).setDepth(40);
    this._modalObjects.push(this._focusRingGfx);
    this._drawFocusRing();

    const onTab = (e) => {
      if (e.shiftKey) {
        this._focusIndex = (this._focusIndex - 1 + this._focusItems.length) % this._focusItems.length;
      } else {
        this._focusIndex = (this._focusIndex + 1) % this._focusItems.length;
      }
      this._drawFocusRing();
    };

    // UP/DOWN always move focus; LEFT/RIGHT delegate to handleArrow when the
    // focused item is a slider (e.g. the seek bar), otherwise move focus.
    const onNext = () => {
      this._focusIndex = (this._focusIndex + 1) % this._focusItems.length;
      this._drawFocusRing();
    };

    const onPrev = () => {
      this._focusIndex = (this._focusIndex - 1 + this._focusItems.length) % this._focusItems.length;
      this._drawFocusRing();
    };

    const onRight = () => {
      const cur = this._focusItems[this._focusIndex];
      if (cur?.handleArrow?.('right')) return; // truthy = handled
      this._focusIndex = (this._focusIndex + 1) % this._focusItems.length;
      this._drawFocusRing();
    };

    const onLeft = () => {
      const cur = this._focusItems[this._focusIndex];
      if (cur?.handleArrow?.('left')) return; // truthy = handled
      this._focusIndex = (this._focusIndex - 1 + this._focusItems.length) % this._focusItems.length;
      this._drawFocusRing();
    };

    const onActivate = () => {
      this._focusItems[this._focusIndex]?.activate();
    };

    this.input.keyboard.on('keydown-TAB',   onTab);
    this.input.keyboard.on('keydown-DOWN',  onNext);
    this.input.keyboard.on('keydown-RIGHT', onRight);
    this.input.keyboard.on('keydown-UP',    onPrev);
    this.input.keyboard.on('keydown-LEFT',  onLeft);
    this.input.keyboard.on('keydown-ENTER', onActivate);
    this.input.keyboard.on('keydown-SPACE', onActivate);

    this._focusNavHandlers = [
      ['keydown-TAB',   onTab],
      ['keydown-DOWN',  onNext],
      ['keydown-RIGHT', onRight],
      ['keydown-UP',    onPrev],
      ['keydown-LEFT',  onLeft],
      ['keydown-ENTER', onActivate],
      ['keydown-SPACE', onActivate],
    ];
  }

  /** Draws the cyan focus ring around the currently focused item.
   * Items with `skipRing: true` use onFocus/onBlur callbacks for
   * their own visual state instead of the box outline. */
  _drawFocusRing() {
    if (!this._focusRingGfx || !this._focusItems.length) return;
    // Notify all items of focus/blur so text-style items can update themselves
    this._focusItems.forEach((item, i) => {
      if (i === this._focusIndex) item.onFocus?.();
      else item.onBlur?.();
    });
    this._focusRingGfx.clear();
    const item = this._focusItems[this._focusIndex];
    if (!item || item.skipRing) return;
    this._focusRingGfx.lineStyle(2, C.CYAN, 1);
    this._focusRingGfx.strokeRect(item.x - 3, item.y - 3, item.w + 6, item.h + 6);
  }

  // ── Music panel ────────────────────────────────────────────────────────

  _openMusic() {
    this._focusItems = [];
    this._musicPreviewSounds = [];
    this._currentPreviewTrackIdx = -1;
    if (this._shuffleEnabled === undefined) this._shuffleEnabled = false;

    // Set up Web Audio analyser as a side-tap on the master volume node.
    // The analyser output is intentionally left unconnected — it only reads
    // frequency data; the normal playback chain is unaffected.
    this._analyser = null;
    this._freqData = null;
    this._vizTimer  = null;
    try {
      const _audioCtx = this.sound.context;
      const _mvn      = this.sound.masterVolumeNode;
      if (_audioCtx && _mvn) {
        const _an = _audioCtx.createAnalyser();
        _an.fftSize = 128;                // 64 frequency bins, covers ~0–10 kHz
        _an.smoothingTimeConstant = 0.75; // gentle temporal averaging
        _mvn.connect(_an);                // side-tap — does not replace destination
        this._analyser = _an;
        this._freqData = new Uint8Array(_an.frequencyBinCount);
      }
    } catch { /* Web Audio API unavailable — visualizer will stay dark */ }

    // 4A: Save game music state — pause while modal is open.
    // Only capture on first entry; re-entering after Back would see
    // isPlaying=false because we already paused it, corrupting the flag.
    const gameScene = this._getGameScene();
    if (this._musicModalWasPlaying === undefined) {
      this._musicModalWasPlaying = gameScene?.music?.isPlaying ?? false;
      if (this._musicModalWasPlaying) gameScene.music.pause();
    }

    // 4B: Open panel
    const { px, py, depth } = this._openModal(PANEL_H_MUSIC);
    const d = depth + 3;
    let y = py + PAD;

    // 4C: Title + CD image
    const title = this.add.text(px + PAD, y, '◈  MUSIC  ◈', {
      fontSize: '15px', fill: C.GREEN_S, fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(d);
    this._modalObjects.push(title);

    const cdImage = this.add.image(
      px + PANEL_W - PAD - 28, py + PAD + 10, 'cd',
    ).setDisplaySize(48, 48).setScrollFactor(0).setDepth(d);
    this._modalObjects.push(cdImage);

    y += 36;
    y += 18;

    // 4D: Spinning CD tween (starts paused; driven by play/pause actions)
    this._cdSpinTween = this.tweens.add({
      targets: cdImage,
      angle: 360,
      duration: 4000,
      repeat: -1,
      ease: 'Linear',
      paused: true,
    });

    // 4E: "Now Playing" LCD display + shuffle button
    const lcdH = 36;
    const SHUF_BTN_W = 52;
    const SHUF_BTN_H = 28;
    const SHUF_GAP   = 8;
    const lcdW = PANEL_W - PAD * 2 - SHUF_BTN_W - SHUF_GAP;
    const lcdGfx = this.add.graphics().setScrollFactor(0).setDepth(d);
    lcdGfx.fillStyle(C.PANEL_BG, 1);
    lcdGfx.fillRect(px + PAD, y, lcdW, lcdH);
    lcdGfx.lineStyle(1, C.GREEN, 1);
    lcdGfx.strokeRect(px + PAD, y, lcdW, lcdH);
    this._modalObjects.push(lcdGfx);

    this._nowPlayingTxt = this.add.text(px + PAD + 8, y + lcdH / 2, '♪  -- no track selected --', {
      fontSize: '11px', fill: C.GREEN_S, fontFamily: 'monospace',
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(d + 1);
    this._modalObjects.push(this._nowPlayingTxt);

    // 4E2: Shuffle toggle button
    const shufBtnX = px + PAD + lcdW + SHUF_GAP;
    const shufBtnY = y + (lcdH - SHUF_BTN_H) / 2;
    const shufBtnGfx = this.add.graphics().setScrollFactor(0).setDepth(d);
    const _drawShufBtn = () => {
      const on = this._shuffleEnabled;
      shufBtnGfx.clear();
      shufBtnGfx.fillStyle(C.PANEL_BG, 1);
      shufBtnGfx.fillRect(shufBtnX, shufBtnY, SHUF_BTN_W, SHUF_BTN_H);
      shufBtnGfx.lineStyle(on ? 2 : 1, on ? C.CYAN : C.GREEN_DIM, 1);
      shufBtnGfx.strokeRect(shufBtnX, shufBtnY, SHUF_BTN_W, SHUF_BTN_H);
      shufLbl?.setStyle({ fill: on ? C.CYAN_S : C.GREEN_DIM_S });
    };
    this._modalObjects.push(shufBtnGfx);

    const shufLbl = this.add.text(
      shufBtnX + SHUF_BTN_W / 2, shufBtnY + SHUF_BTN_H / 2,
      '⤭',
      { fontSize: '16px', fill: this._shuffleEnabled ? C.CYAN_S : C.GREEN_DIM_S, fontFamily: 'monospace' },
    ).setOrigin(0.5).setScrollFactor(0).setDepth(d + 1);
    this._modalObjects.push(shufLbl);

    _drawShufBtn();

    const toggleShuffle = () => {
      this._shuffleEnabled = !this._shuffleEnabled;
      _drawShufBtn();
      this._haptic();
    };

    const shufFocusItem = {
      x: shufBtnX, y: shufBtnY, w: SHUF_BTN_W, h: SHUF_BTN_H,
      activate: toggleShuffle,
    };
    this._focusItems.push(shufFocusItem);

    shufBtnGfx.setInteractive(
      new Phaser.Geom.Rectangle(shufBtnX, shufBtnY, SHUF_BTN_W, SHUF_BTN_H),
      Phaser.Geom.Rectangle.Contains,
    );
    shufBtnGfx.input.cursor = 'pointer';
    shufBtnGfx.on('pointerdown', () => { this._focusIndex = this._focusItems.indexOf(shufFocusItem); this._drawFocusRing(); toggleShuffle(); });
    shufBtnGfx.on('pointerover',  () => shufLbl.setAlpha(0.65));
    shufBtnGfx.on('pointerout',   () => shufLbl.setAlpha(1));

    y += lcdH + 12;

    // 4F: Progress bar (seek) --------------------------------------------------
    const PROG_BAR_H = 52;
    const progTrackX = px + PAD;
    const progTrackW = PANEL_W - PAD * 2;
    const progTrackY = y + 32;
    const progTrackH = 4;
    const progThumbSz = 14;

    // Time readout label (right-aligned)
    const progTimeLbl = this.add.text(px + PAD, y + 10, 'SEEK', {
      fontSize: '10px', fill: C.GREEN_DIM_S, fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(d);
    this._modalObjects.push(progTimeLbl);

    this._progressTimeTxt = this.add.text(px + PANEL_W - PAD, y + 10, '--:-- / --:--', {
      fontSize: '10px', fill: C.GREEN_DIM_S, fontFamily: 'monospace',
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(d);
    this._modalObjects.push(this._progressTimeTxt);

    const progTrackGfx = this.add.graphics().setScrollFactor(0).setDepth(d);
    const progThumbGfx = this.add.graphics().setScrollFactor(0).setDepth(d + 1);
    this._modalObjects.push(progTrackGfx, progThumbGfx);

    const formatTime = (secs) => {
      if (!isFinite(secs) || secs < 0) return '--:--';
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      return `${m}:${String(s).padStart(2, '0')}`;
    };

    const drawProgress = (frac, elapsed, total) => {
      const t = Math.max(0, Math.min(1, frac));
      const thumbX = progTrackX + t * progTrackW;

      progTrackGfx.clear();
      progTrackGfx.fillStyle(C.GREEN_DIM, 0.6);
      progTrackGfx.fillRect(progTrackX, progTrackY, progTrackW, progTrackH);
      progTrackGfx.fillStyle(C.GREEN, 1);
      progTrackGfx.fillRect(progTrackX, progTrackY, t * progTrackW, progTrackH);

      progThumbGfx.clear();
      progThumbGfx.fillStyle(C.GREEN, 1);
      progThumbGfx.fillRect(
        thumbX - progThumbSz / 2,
        progTrackY - (progThumbSz - progTrackH) / 2,
        progThumbSz, progThumbSz,
      );
      progThumbGfx.lineStyle(1, C.CYAN, 1);
      progThumbGfx.strokeRect(
        thumbX - progThumbSz / 2,
        progTrackY - (progThumbSz - progTrackH) / 2,
        progThumbSz, progThumbSz,
      );

      if (this._progressTimeTxt) {
        const hasTrack = total > 0;
        this._progressTimeTxt.setText(
          hasTrack ? `${formatTime(elapsed)} / ${formatTime(total)}` : '--:-- / --:--',
        ).setStyle({ fill: hasTrack ? C.GREEN_S : C.GREEN_DIM_S });
      }
    };

    // Transparent hit zone for pointer drag
    const progHitZone = this.add.graphics().setScrollFactor(0).setDepth(d + 2);
    progHitZone.fillStyle(0xffffff, 0.001);
    progHitZone.fillRect(progTrackX, progTrackY - 10, progTrackW, progTrackH + 20);
    progHitZone.setInteractive(
      new Phaser.Geom.Rectangle(progTrackX, progTrackY - 10, progTrackW, progTrackH + 20),
      Phaser.Geom.Rectangle.Contains,
    );
    progHitZone.input.cursor = 'ew-resize';
    this._modalObjects.push(progHitZone);

    const getCurrentSound = () =>
      this._currentPreviewTrackIdx >= 0
        ? (this._musicPreviewSounds[this._currentPreviewTrackIdx] ?? null)
        : null;

    let progDragging = false;

    const applyProgressPointerX = (x) => {
      const sound = getCurrentSound();
      const frac = Math.max(0, Math.min(1, (x - progTrackX) / progTrackW));
      if (sound && sound.duration > 0) {
        sound.seek = frac * sound.duration;
        drawProgress(frac, frac * sound.duration, sound.duration);
      } else {
        drawProgress(frac, 0, 0);
      }
    };

    progHitZone.on('pointerdown', (ptr) => {
      progDragging = true;
      applyProgressPointerX(ptr.x);
    });

    const onProgMove = (ptr) => { if (progDragging) applyProgressPointerX(ptr.x); };
    const onProgUp   = () => { progDragging = false; };
    this.input.on('pointermove', onProgMove);
    this.input.on('pointerup',   onProgUp);
    this._modalPointerHandlers.push(['pointermove', onProgMove], ['pointerup', onProgUp]);

    // Periodic timer — updates fill/thumb and time readout while a track plays
    const updateProgress = () => {
      const sound = getCurrentSound();
      if (sound && sound.duration > 0) {
        const elapsed = sound.seek;
        drawProgress(elapsed / sound.duration, elapsed, sound.duration);
      }
    };
    this._progressTimer = this.time.addEvent({ delay: 250, loop: true, callback: updateProgress });

    // Initial draw (empty bar)
    drawProgress(0, 0, 0);

    // Focus item for keyboard seek (left/right arrows = ±1 second)
    const SEEK_STEP = 1;
    this._focusItems.push({
      x: progTrackX,
      y: progTrackY - (progThumbSz - progTrackH) / 2,
      w: progTrackW,
      h: progThumbSz,
      activate: () => {},
      handleArrow: (dir) => {
        const sound = getCurrentSound();
        if (!sound || sound.duration <= 0) return false;
        if (!sound.isPlaying && !sound.isPaused) return false;
        const newSeek = Math.max(0, Math.min(sound.duration,
          sound.seek + (dir === 'right' ? SEEK_STEP : -SEEK_STEP)));
        sound.seek = newSeek;
        drawProgress(newSeek / sound.duration, newSeek, sound.duration);
        return true;
      },
    });

    y += PROG_BAR_H;

    // 4F2: Waterfall spectrogram ──────────────────────────────────────────────
    // Newest frequency snapshot is painted at the top row; older rows scroll
    // downward, producing a classic waterfall/spectrogram effect.
    const VIZ_W    = PANEL_W - PAD * 2; // 352 px
    const VIZ_H    = 72;                // visible history: ~72 × 80 ms ≈ 5.8 s
    const VIZ_ROWS = 2;                 // px per time-snapshot (scroll speed)
    const NUM_BINS = 64;                // matches analyser.frequencyBinCount

    const vizLbl = this.add.text(px + PAD, y + 10, 'SPECTROGRAM', {
      fontSize: '10px', fill: C.GREEN_DIM_S, fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(d);
    this._modalObjects.push(vizLbl);
    y += 26;

    // Canvas texture — re-created fresh every time the panel opens
    if (this.textures.exists('__viz__')) this.textures.remove('__viz__');
    const canvasTexture = this.textures.createCanvas('__viz__', VIZ_W, VIZ_H);
    const _initCtx = canvasTexture.getContext();
    _initCtx.fillStyle = '#000000';
    _initCtx.fillRect(0, 0, VIZ_W, VIZ_H);
    canvasTexture.refresh();

    const vizImg = this.add.image(px + PAD, y, '__viz__')
      .setOrigin(0, 0).setScrollFactor(0).setDepth(d);
    const vizBorder = this.add.graphics().setScrollFactor(0).setDepth(d + 1);
    const vizRowY = y;
    const _updateVizBorder = (hue) => {
      const hex = Phaser.Display.Color.HSLToColor(hue / 360, 1, 0.5).color;
      vizBorder.clear();
      vizBorder.lineStyle(1, hex, 0.7);
      vizBorder.strokeRect(px + PAD - 1, vizRowY - 1, VIZ_W + 2, VIZ_H + 2);
    };
    _updateVizBorder(this._vizHue ?? 120);
    this._modalObjects.push(vizImg, vizBorder);
    y += VIZ_H + 14;

    // Color ramp: 0–255 → black → dark hue → pure hue → light tint → near-white
    // hue is in [0,360]; at hue=120 (green) this approximates the original ramp.
    const _ampToColor = (v, hue) => {
      if (v < 10)  return '#000000';
      if (v < 101) { const l = Math.round(4 + (v - 10) * (46 / 91));   return `hsl(${hue},100%,${l}%)`; }
      if (v < 201) { const l = Math.round(50 + (v - 101) * (20 / 100)); return `hsl(${hue},100%,${l}%)`; }
      const s = Math.round(80 - ((v - 201) / 54) * 30);
      const l = Math.round(70 + ((v - 201) / 54) * 25);
      return `hsl(${hue},${s}%,${l}%)`;
    };

    const _drawViz = () => {
      if (!this._analyser || !this._freqData || !this.textures.exists('__viz__')) return;

      // Advance hue toward the track's target after the 3 s green hold expires
      let hue = this._vizHue ?? 120;
      const target = this._vizTargetHue ?? 120;
      if (hue !== target && this.time.now >= (this._vizTransitionAt ?? Infinity)) {
        const maxStep = 7.2; // °/frame → 180° in 2 s at 80 ms/frame
        const diff = ((target - hue) % 360 + 540) % 360 - 180; // shortest-path delta
        const step = Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
        hue = ((hue + step) % 360 + 360) % 360;
        if (Math.abs(diff) <= maxStep) hue = target; // snap to avoid float drift
        this._vizHue = hue;
        _updateVizBorder(hue);
      }

      this._analyser.getByteFrequencyData(this._freqData);
      const c2d = canvasTexture.getContext();
      // Shift all existing rows down by VIZ_ROWS (oldest content falls off bottom)
      const imgData = c2d.getImageData(0, 0, VIZ_W, VIZ_H - VIZ_ROWS);
      c2d.putImageData(imgData, 0, VIZ_ROWS);
      // Paint freshest snapshot at the top
      c2d.fillStyle = '#000000';
      c2d.fillRect(0, 0, VIZ_W, VIZ_ROWS);
      const binW = VIZ_W / NUM_BINS;
      for (let i = 0; i < NUM_BINS; i++) {
        c2d.fillStyle = _ampToColor(this._freqData[i], hue);
        c2d.fillRect(Math.round(i * binW), 0, Math.ceil(binW), VIZ_ROWS);
      }
      canvasTexture.refresh();
    };

    this._vizTimer = this.time.addEvent({ delay: 80, loop: true, callback: _drawViz });

    // 4G: Track rows
    const ROW_H  = 44;
    const BTN_W  = 34;
    const BTN_H  = 28;
    const btnGfxList   = [];
    const btnLabels    = [];
    const rowStartYs   = [];
    const focusItemRefs = [];

    TRACKS.forEach((track, i) => {
      const rowY    = y;
      const btnX    = px + PAD;
      const btnY    = rowY + (ROW_H - BTN_H) / 2;
      const isLoaded = this.cache.audio.exists(track.key);

      rowStartYs.push(rowY);

      // Play button — retro bezel style
      const btnGfx = this.add.graphics().setScrollFactor(0).setDepth(d);
      btnGfx.fillStyle(C.PANEL_BG, 1);
      btnGfx.fillRect(btnX, btnY, BTN_W, BTN_H);
      btnGfx.lineStyle(1, isLoaded ? C.GREEN : C.GREEN_DIM, isLoaded ? 1 : 0.5);
      btnGfx.strokeRect(btnX, btnY, BTN_W, BTN_H);
      this._modalObjects.push(btnGfx);
      btnGfxList.push(btnGfx);

      const lblTxt = this.add.text(btnX + BTN_W / 2, btnY + BTN_H / 2, isLoaded ? '▶' : '…', {
        fontSize: '13px',
        fill: isLoaded ? C.GREEN_S : C.GREEN_DIM_S,
        fontFamily: 'monospace',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(d + 1);
      this._modalObjects.push(lblTxt);
      btnLabels.push(lblTxt);

      // Track number
      const numTxt = this.add.text(btnX + BTN_W + 10, rowY + (ROW_H - 14) / 2, track.num, {
        fontSize: '12px', fill: C.GREEN_S, fontFamily: 'monospace',
      }).setScrollFactor(0).setDepth(d);
      this._modalObjects.push(numTxt);

      // Track name
      const nameTxt = this.add.text(btnX + BTN_W + 36, rowY + (ROW_H - 14) / 2, track.name, {
        fontSize: '12px', fill: C.WHITE_S, fontFamily: 'monospace',
      }).setScrollFactor(0).setDepth(d);
      this._modalObjects.push(nameTxt);

      // Register focus item (active or noop — updated on lazy-load completion)
      const focusItem = {
        x: btnX, y: btnY, w: BTN_W, h: BTN_H,
        activate: () => {},
      };
      this._focusItems.push(focusItem);
      focusItemRefs.push(focusItem);

      if (isLoaded) {
        focusItem.activate = () => handleTrackClick(i);
        btnGfx.setInteractive(
          new Phaser.Geom.Rectangle(btnX, rowY, BTN_W, ROW_H),
          Phaser.Geom.Rectangle.Contains,
        );
        btnGfx.input.cursor = 'pointer';
        btnGfx.on('pointerdown', () => { this._haptic(); this._focusIndex = this._focusItems.indexOf(focusItem); this._drawFocusRing(); handleTrackClick(i); });
        btnGfx.on('pointerover',  () => lblTxt.setAlpha(0.65));
        btnGfx.on('pointerout',   () => lblTxt.setAlpha(1));
      }

      y += ROW_H;
    });

    // 4I: Playback logic — define playTrack first (handleTrackClick referenced
    // only inside async 'complete' callback, so TDZ is not an issue)
    const playTrack = (i) => {
      const track = TRACKS[i];
      if (!this._musicPreviewSounds[i]) {
        this._musicPreviewSounds[i] = this.sound.add(track.key, {
          loop: false, volume: GameSettings.musicVolume / 100,
        });
      }
      const s = this._musicPreviewSounds[i];
      this._currentPreviewTrackIdx = i;
      // Reset hue to green and schedule the transition to this track's theme colour
      this._vizHue = 120;
      this._vizTargetHue = TRACKS[i].hue;
      this._vizTransitionAt = this.time.now + 3000;
      s.play();
      this._acquireWakeLock();
      btnLabels[i]?.setText('⏸');
      this._cdSpinTween?.resume();
      this._nowPlayingTxt?.setText(`♪  ${track.name}`);
      drawProgress(0, 0, s.duration);
      s.once('complete', () => {
        if (!this._modalObjects.length) return; // modal was closed
        btnLabels[i]?.setText('▶');
        drawProgress(0, 0, 0);
        this._musicPreviewSounds[i]?.destroy();
        this._musicPreviewSounds[i] = null;
        this._currentPreviewTrackIdx = -1;
        const nextIdx = this._shuffleEnabled
          ? (() => {
              const pool = TRACKS.map((_, idx) => idx).filter(idx => idx !== i);
              return pool[Math.floor(Math.random() * pool.length)];
            })()
          : (i + 1) % TRACKS.length;
        this._focusIndex = nextIdx;
        this._drawFocusRing();
        handleTrackClick(nextIdx);
      });
    };

    const handleTrackClick = (i) => {
      const sound = this._musicPreviewSounds[i];
      if (this._currentPreviewTrackIdx === i && sound) {
        if (sound.isPlaying) {
          sound.pause();
          this._releaseWakeLock();
          btnLabels[i]?.setText('▶');
          this._cdSpinTween?.pause();
          this._nowPlayingTxt?.setText(`⏸  ${TRACKS[i].name}  [paused]`);
        } else if (sound.isPaused) {
          sound.resume();
          this._acquireWakeLock();
          btnLabels[i]?.setText('⏸');
          this._cdSpinTween?.resume();
          this._nowPlayingTxt?.setText(`♪  ${TRACKS[i].name}`);
        } else {
          // Ended — play fresh
          sound.destroy();
          this._musicPreviewSounds[i] = null;
          playTrack(i);
        }
      } else {
        // Different (or no) active track — stop old, start new
        if (this._currentPreviewTrackIdx >= 0 && this._currentPreviewTrackIdx !== i) {
          const old = this._musicPreviewSounds[this._currentPreviewTrackIdx];
          if (old) {
            old.stop();
            old.destroy();
            this._musicPreviewSounds[this._currentPreviewTrackIdx] = null;
          }
          btnLabels[this._currentPreviewTrackIdx]?.setText('▶');
        }
        this._currentPreviewTrackIdx = i;
        playTrack(i);
      }
    };

    // 4H: Lazy-load tracks not yet in cache
    const toLoad = TRACKS.filter(t => !this.cache.audio.exists(t.key));
    if (toLoad.length > 0) {
      this.load.once('complete', () => {
        TRACKS.forEach((track, i) => {
          if (!this.cache.audio.exists(track.key)) return;
          if (btnLabels[i]?.text !== '…') return; // already active
          const btnX = px + PAD;
          const btnY = rowStartYs[i] + (ROW_H - BTN_H) / 2;
          // Re-draw button with active border
          btnGfxList[i].clear();
          btnGfxList[i].fillStyle(C.PANEL_BG, 1);
          btnGfxList[i].fillRect(btnX, btnY, BTN_W, BTN_H);
          btnGfxList[i].lineStyle(1, C.GREEN, 1);
          btnGfxList[i].strokeRect(btnX, btnY, BTN_W, BTN_H);
          btnLabels[i].setText('▶').setStyle({ fill: C.GREEN_S });
          // Attach pointer interaction
          if (!btnGfxList[i].input) {
            btnGfxList[i].setInteractive(
              new Phaser.Geom.Rectangle(btnX, rowStartYs[i], BTN_W, ROW_H),
              Phaser.Geom.Rectangle.Contains,
            );
            btnGfxList[i].input.cursor = 'pointer';
            btnGfxList[i].on('pointerdown', () => { this._haptic(); this._focusIndex = this._focusItems.indexOf(focusItemRefs[i]); this._drawFocusRing(); handleTrackClick(i); });
            btnGfxList[i].on('pointerover',  () => btnLabels[i].setAlpha(0.65));
            btnGfxList[i].on('pointerout',   () => btnLabels[i].setAlpha(1));
          }
          // Enable keyboard activation
          focusItemRefs[i].activate = () => handleTrackClick(i);
        });
      });
      toLoad.forEach(t => this.load.audio(t.key, t.src));
      this.load.start();
    }

    y += 14;
    this._addSeparator(px, y, PANEL_W, d);
    y += 36;

    // 4K: Back + Close buttons
    this._addBackAndCloseButtons(px, y, PANEL_W, d, () => {
      this._swapModal();
      this._openInfo();
    });
    y += 38;
    this._addEscHint(px, y, PANEL_W, d);

    // 4J: Init keyboard focus
    this._initModalFocus();
  }

  // ── Screen recording ──────────────────────────────────────────────────────

  _toggleRecording() {
    if (this._recording) {
      this._stopRecording();
    } else {
      this._startRecording();
    }
  }

  _startRecording() {
    if (!this.game.canvas.captureStream || !window.MediaRecorder) {
      console.warn('[Recorder] canvas.captureStream or MediaRecorder not supported in this browser.');
      return;
    }
    try {
      const videoStream = this.game.canvas.captureStream(30);

      // Tap the master volume node so all game audio is captured.
      // The side-connection does not interrupt normal speaker/headphone playback.
      let audioTracks = [];
      try {
        const ctx = this.sound.context;
        const mvn = this.sound.masterVolumeNode;
        if (ctx && mvn) {
          this._recordAudioDest = ctx.createMediaStreamDestination();
          mvn.connect(this._recordAudioDest);
          audioTracks = this._recordAudioDest.stream.getAudioTracks();
        }
      } catch { /* Web Audio tap unavailable — record video only */ }

      const combined = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioTracks,
      ]);

      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) ?? '';

      this._recordChunks = [];
      this._mediaRecorder = new MediaRecorder(combined, mimeType ? { mimeType } : undefined);

      this._mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this._recordChunks.push(e.data);
      };

      this._mediaRecorder.onstop = () => {
        const blob = new Blob(this._recordChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resource-rescue-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this._recordChunks = [];
      };

      this._mediaRecorder.start(1000); // collect a chunk every second
      this._recording = true;
      this._buildIconBar();
    } catch (err) {
      console.error('[Recorder] Failed to start recording:', err);
    }
  }

  _stopRecording() {
    if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
      this._mediaRecorder.stop();
    }
    // Disconnect the audio tap to avoid accumulating connections on re-record.
    try {
      if (this._recordAudioDest) {
        this.sound.masterVolumeNode.disconnect(this._recordAudioDest);
        this._recordAudioDest = null;
      }
    } catch { /* ignore */ }
    this._recording = false;
    this._buildIconBar();
  }

  // ── About panel ─────────────────────────────────────────────────

  _openAbout() {
    this._focusItems = [];
    const { px, py, depth } = this._openModal(PANEL_H_ABOUT);
    const d = depth + 3;
    let y = py + PAD;

    const title = this.add.text(px + PANEL_W / 2, y, '◈  ABOUT  ◈', {
      fontSize: '15px', fill: C.GREEN_S, fontFamily: 'monospace',
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(d);
    this._modalObjects.push(title);

    y += 28;
    this._addSeparator(px, y, PANEL_W, d);
    y += 18;

    const lineH = 22;
    [
      { label: 'GAME',      value: 'RESOURCE RESCUE  v1.0' },
      { label: null },
      { label: 'COPYRIGHT', value: '(C) 2026 GUNTHER COX' },
      { label: null },
    ].forEach(({ label, value }) => {
      if (label === null && value === undefined) { y += 6; return; }
      const row = label
        ? `${label.padEnd(11, ' ')}${value ?? ''}`
        : `           ${value ?? ''}`;
      const t = this.add.text(px + PAD, y, row, {
        fontSize: '11px', fill: label ? C.GREEN_S : C.WHITE_S, fontFamily: 'monospace',
      }).setScrollFactor(0).setDepth(d);
      this._modalObjects.push(t);
      y += lineH;
    });

    y += 10;
    this._addSeparator(px, y, PANEL_W, d);
    y += 18;

    const robotLabel = this.add.text(px + PAD, y, 'THE REAL SALVIUS', {
      fontSize: '11px', fill: C.GREEN_S, fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(d);
    this._modalObjects.push(robotLabel);
    y += lineH;

    [
      '  OPEN SOURCE HUMANOID ROBOT',
      '  BUILT FROM RECYCLED PARTS (2008)',
      '',
      '  HEIGHT: 6 FT  |  24 DOF  |  BIPED',
      '  RASPBERRY PI + ARDUINO',
    ].forEach((text) => {
      if (!text) { y += 6; return; }
      const t = this.add.text(px + PAD, y, text, {
        fontSize: '11px', fill: C.WHITE_S, fontFamily: 'monospace',
      }).setScrollFactor(0).setDepth(d);
      this._modalObjects.push(t);
      y += lineH;
    });

    y += 8;
    const robotLink = this.add.text(px + PAD, y, '  > salvius.org', {
      fontSize: '11px', fill: C.CYAN_S, fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(d);
    this._modalObjects.push(robotLink);
    robotLink.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, PANEL_W - PAD * 2, lineH),
      Phaser.Geom.Rectangle.Contains,
    );
    robotLink.input.cursor = 'pointer';
    robotLink.on('pointerdown', () => { this._haptic(); window.open('https://salvius.org', '_blank', 'noopener,noreferrer'); });
    robotLink.on('pointerover',  () => robotLink.setAlpha(0.7));
    robotLink.on('pointerout',   () => robotLink.setAlpha(1));
    y += lineH;

    y += 10;
    this._addSeparator(px, y, PANEL_W, d);
    y += 18;

    const supportLabel = this.add.text(px + PAD, y, 'SUPPORT', {
      fontSize: '11px', fill: C.GREEN_S, fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(d);
    this._modalObjects.push(supportLabel);
    y += lineH;

    const emailLink = this.add.text(px + PAD, y, '  > support@salvius.org', {
      fontSize: '11px', fill: C.CYAN_S, fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(d);
    this._modalObjects.push(emailLink);
    emailLink.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, PANEL_W - PAD * 2, lineH),
      Phaser.Geom.Rectangle.Contains,
    );
    emailLink.input.cursor = 'pointer';
    emailLink.on('pointerdown', () => { this._haptic(); window.open('mailto:support@salvius.org'); });
    emailLink.on('pointerover',  () => emailLink.setAlpha(0.7));
    emailLink.on('pointerout',   () => emailLink.setAlpha(1));
    y += lineH;

    const githubLink = this.add.text(px + PAD, y, '  > github.com/salvius/salvius-game', {
      fontSize: '11px', fill: C.CYAN_S, fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(d);
    this._modalObjects.push(githubLink);
    githubLink.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, PANEL_W - PAD * 2, lineH),
      Phaser.Geom.Rectangle.Contains,
    );
    githubLink.input.cursor = 'pointer';
    githubLink.on('pointerdown', () => { this._haptic(); window.open('https://github.com/salvius/salvius-game', '_blank', 'noopener,noreferrer'); });
    githubLink.on('pointerover',  () => githubLink.setAlpha(0.7));
    githubLink.on('pointerout',   () => githubLink.setAlpha(1));
    y += lineH;

    y += 10;
    this._addSeparator(px, y, PANEL_W, d);
    y += 16;

    this._addBackAndCloseButtons(px, y, PANEL_W, d, () => {
      this._swapModal();
      this._openInfo();
    });
    y += 38;
    this._addEscHint(px, y, PANEL_W, d);
    this._initModalFocus();
  }
}
