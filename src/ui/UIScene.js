import Phaser from 'phaser';
import { GameSettings } from '../settings/GameSettings.js';

// ── HUD color palette ───────────────────────────────────────────────────────
const C = {
  GREEN:      0x00FF41,
  GREEN_DIM:  0x1A3A1A,
  CYAN:       0x00FFFF,
  BLACK:      0x000000,
  PANEL_BG:   0x050A05,
  // CSS strings for Phaser Text
  GREEN_S:    '#00FF41',
  GREEN_DIM_S:'#1A4A1A',
  CYAN_S:     '#00FFFF',
  DARK_S:     '#030803',
  WHITE_S:    '#CCFFCC',
};

// Panel dimensions
const PANEL_W     = 400;
const PANEL_H_CFG = 340;
const PANEL_H_INFO= 400;
const PAD         = 24;
const ICON_BAR_H  = 36;
const ICON_BAR_PAD= 8;

export class UIScene extends Phaser.Scene {
  constructor() {
    super({ key: 'UIScene', active: false });
    this._modalObjects = [];
  }

  create() {
    this._buildIconBar();

    // Close any open modal with Escape
    this.input.keyboard.on('keydown-ESC', () => {
      if (this._modalOpen) this._closeModal();
    });

    // Re-build icon bar on resize so it stays anchored to top-right
    this.scale.on('resize', this._onResize, this);
    this.events.on('shutdown', () => {
      this.scale.off('resize', this._onResize, this);
    });
  }

  // ── Persistent icon bar ───────────────────────────────────────────────────

  _buildIconBar() {
    // Clean up previous bar if rebuilding after resize
    if (this._barObjects) this._barObjects.forEach(o => o.destroy());
    this._barObjects = [];

    const { width } = this.scale;
    const barW  = 106;
    const barH  = ICON_BAR_H;
    const barX  = width - barW - ICON_BAR_PAD;
    const barY  = ICON_BAR_PAD;
    const depth = 30;

    // Bar backing — thin green-bordered rectangle
    const barBg = this.add.graphics()
      .setScrollFactor(0)
      .setDepth(depth);
    barBg.fillStyle(C.PANEL_BG, 0.88);
    barBg.fillRect(barX, barY, barW, barH);
    barBg.lineStyle(1, C.GREEN, 0.8);
    barBg.strokeRect(barX, barY, barW, barH);

    // Gear button — full hit zone on the background graphic
    const gearZoneX = barX + 4, gearZoneY = barY + 2, gearZoneW = 46, gearZoneH = barH - 4;
    const gearBg = this.add.graphics().setScrollFactor(0).setDepth(depth);
    this._drawGlow(gearBg, gearZoneX, gearZoneY, gearZoneW, gearZoneH);
    gearBg.setInteractive(
      new Phaser.Geom.Rectangle(gearZoneX, gearZoneY, gearZoneW, gearZoneH),
      Phaser.Geom.Rectangle.Contains,
    );
    gearBg.input.cursor = 'pointer';

    const gearBtn = this.add.text(barX + 27, barY + barH / 2, '⚙', {
      fontSize: '20px', fill: C.GREEN_S, fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

    gearBg.on('pointerover',  () => gearBtn.setAlpha(0.7));
    gearBg.on('pointerout',   () => gearBtn.setAlpha(1));
    gearBg.on('pointerdown',  () => {
      if (this._modalOpen) return;
      this._openSettings();
    });

    // Divider
    const div = this.add.text(barX + 53, barY + barH / 2, '│', {
      fontSize: '18px', fill: C.GREEN_DIM_S, fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

    // Book button — full hit zone on the background graphic
    const bookZoneX = barX + 57, bookZoneY = barY + 2, bookZoneW = 46, bookZoneH = barH - 4;
    const bookBg = this.add.graphics().setScrollFactor(0).setDepth(depth);
    this._drawGlow(bookBg, bookZoneX, bookZoneY, bookZoneW, bookZoneH);
    bookBg.setInteractive(
      new Phaser.Geom.Rectangle(bookZoneX, bookZoneY, bookZoneW, bookZoneH),
      Phaser.Geom.Rectangle.Contains,
    );
    bookBg.input.cursor = 'pointer';

    const bookBtn = this.add.text(barX + 80, barY + barH / 2, '📖', {
      fontSize: '18px', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

    bookBg.on('pointerover',  () => bookBtn.setAlpha(0.7));
    bookBg.on('pointerout',   () => bookBtn.setAlpha(1));
    bookBg.on('pointerdown',  () => {
      if (this._modalOpen) return;
      this._openInfo();
    });

    this._barObjects = [barBg, gearBg, gearBtn, div, bookBg, bookBtn];
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
    // Pass false to get ALL scenes (active + paused) — a paused game scene
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

    // Panel position — centered
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
    const sep = this.add.text(x + PAD, y, '─'.repeat(Math.floor((w - PAD * 2) / 8)), {
      fontSize: '10px', fill: C.GREEN_DIM_S, fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(depth);
    this._modalObjects.push(sep);
    return sep;
  }

  _closeModal() {
    this._modalObjects.forEach(o => o.destroy());
    this._modalObjects = [];
    this._modalOpen = false;

    const gameScene = this._getGameScene();
    gameScene?.scene.resume();
  }

  // ── Settings panel ────────────────────────────────────────────────────────

  _openSettings() {
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

    y += 20;
    this._addSeparator(px, y, PANEL_W, d);
    y += 18;

    // Close button
    this._addCloseButton(px, y, PANEL_W, d);
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
      bg.on('pointerdown', () => {
        if (active) return;
        onChange(isOn);
        this._closeModal();
        this._openSettings();
      });
      bg.on('pointerover',  () => txt.setAlpha(0.7));
      bg.on('pointerout',   () => txt.setAlpha(1));

      this._modalObjects.push(bg, txt);
    };

    renderBtn(true);   // ON
    renderBtn(false);  // OFF

    return startY + ROW_H;
  }

  _addCloseButton(px, y, panelW, depth) {
    const btnW = 120;
    const btnH = 28;
    const btnX = px + (panelW - btnW) / 2;

    const bg = this.add.graphics().setScrollFactor(0).setDepth(depth);
    bg.fillStyle(C.PANEL_BG, 1);
    bg.fillRect(btnX, y, btnW, btnH);
    bg.lineStyle(1.5, C.GREEN, 0.9);
    bg.strokeRect(btnX, y, btnW, btnH);

    const txt = this.add.text(btnX + btnW / 2, y + btnH / 2, '[ ✕  CLOSE ]', {
      fontSize: '12px', fill: C.GREEN_S, fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);

    bg.setInteractive(
      new Phaser.Geom.Rectangle(btnX, y, btnW, btnH),
      Phaser.Geom.Rectangle.Contains,
    );
    bg.on('pointerdown', () => this._closeModal());
    bg.on('pointerover',  () => txt.setAlpha(0.65));
    bg.on('pointerout',   () => txt.setAlpha(1));

    this._modalObjects.push(bg, txt);
  }

  // ── Info / manual panel ───────────────────────────────────────────────────

  _openInfo() {
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
      { label: 'CONTROLS', value: '← → MOVE  |  SHIFT RUN' },
      { label: null,        value: '↑ JUMP' },
      { label: null },
      { label: 'LVL 1',   value: 'DESERT — COLLECT 5 PARTS' },
      { label: 'LVL 2',   value: 'JUNKYARD — REACH RADIO TOWER' },
      { label: 'LVL 3',   value: 'TOWER CLIMB — REACH BEACON' },
      { label: null },
      { label: 'TOUCH',   value: '◀ ▶ ▲ RUN  BUTTONS ON-SCREEN' },
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

    y += 10;
    this._addSeparator(px, y, PANEL_W, d);
    y += 16;

    this._addCloseButton(px, y, PANEL_W, d);
  }
}
