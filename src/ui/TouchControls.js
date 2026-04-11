import Phaser from 'phaser';
import { GameSettings } from '../settings/GameSettings.js';

/** Height (px) reserved at the bottom of the screen for the touch HUD. */
export const TOUCH_HUD_HEIGHT = 130;

/**
 * On-screen virtual D-pad for touch devices.
 *
 * Left side:  ◀ (left)  ▶ (right)
 * Right side: ▲ (jump)  RUN (run)
 *
 * Usage:
 *   this.touchInput = new TouchControls(this);      // in create()
 *   this.touchInput?.destroy();                      // in shutdown handler
 *
 * In update():
 *   const left    = this.cursors.left.isDown  || (this.touchInput?.left  ?? false);
 *   const right   = this.cursors.right.isDown || (this.touchInput?.right ?? false);
 *   const running = this.shiftKey.isDown      || (this.touchInput?.run   ?? false);
 *   const jumpPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up)
 *                     || (this.touchInput?.consumeJump() ?? false);
 */
export class TouchControls {
  constructor(scene) {
    this.scene = scene;
    this.left = false;
    this.right = false;
    this.run = false;
    this._jumpPending = false;
    this._objects = [];

    // Allow up to 4 simultaneous touches (left + right + jump + run)
    scene.input.addPointer(3);

    this._build(scene.scale.width, scene.scale.height);

    this._resizeCb = (gameSize) => this.resize(gameSize.width, gameSize.height);
    scene.scale.on('resize', this._resizeCb);
  }

  _build(w, h) {
    this._objects.forEach(o => o.destroy());
    this._objects = [];

    const R = 40;             // button radius (px)
    const FILL_A = 0.3;       // fill alpha (resting)
    const PRESSED_SCALE = 0.85; // scale when pressed
    const DEPTH = 20;

    // Bottom-left: directional pad
    const padY  = h - 78;
    const leftX  = 65;
    const rightX = 150;

    // Bottom-right: action buttons
    const actY  = h - 78;
    const jumpX = w - 65;
    const runX  = w - 150;

    const make = (x, y, label, onDown, onUp) => {
      // Position the Graphics at the button centre so Phaser scales from there.
      const g = this.scene.add.graphics({ x, y })
        .setScrollFactor(0)
        .setDepth(DEPTH);

      // Draw at local (0,0) — the object's own origin is already at (x,y).
      g.fillStyle(0xffffff, FILL_A);
      g.fillCircle(0, 0, R);
      g.lineStyle(1.5, 0xffffff, 0.55);
      g.strokeCircle(0, 0, R);

      g.setInteractive(
        new Phaser.Geom.Circle(0, 0, R),
        Phaser.Geom.Circle.Contains,
      );

      const t = this.scene.add.text(x, y, label, {
        fontSize: '22px',
        fill: '#ffffff',
        fontFamily: 'monospace',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 1);

      g.on('pointerdown', () => {
        onDown();
        this.scene.tweens.killTweensOf([g, t]);
        this.scene.tweens.add({
          targets: [g, t],
          scaleX: PRESSED_SCALE,
          scaleY: PRESSED_SCALE,
          duration: 70,
          ease: 'Quad.easeIn',
        });
        this._vibrate(15);
      });

      const release = () => {
        onUp();
        this.scene.tweens.killTweensOf([g, t]);
        this.scene.tweens.add({
          targets: [g, t],
          scaleX: 1,
          scaleY: 1,
          duration: 110,
          ease: 'Back.easeOut',
        });
      };
      g.on('pointerup', release);
      g.on('pointerout', release);

      this._objects.push(g, t);
    };

    make(leftX,  padY, '◀', () => { this.left  = true;  }, () => { this.left  = false; });
    make(rightX, padY, '▶', () => { this.right = true;  }, () => { this.right = false; });
    make(jumpX,  actY, '▲', () => { this._jumpPending = true; }, () => {});
    make(runX,   actY, 'RUN', () => { this.run  = true;  }, () => { this.run   = false; });
  }

  /** Short haptic pulse — no-op on desktop or unsupported browsers. */
  _vibrate(ms = 15) {
    if (!GameSettings.haptics) return;
    if ('vibrate' in navigator) navigator.vibrate(ms);
  }

  /** Re-layout buttons after a viewport resize. Resets any held state. */
  resize(width, height) {
    this.left = this.right = this.run = false;
    this._jumpPending = false;
    this._build(width, height);
  }

  /**
   * Returns true exactly once per jump-button press (mirrors JustDown semantics).
   * Call once per update() frame.
   */
  consumeJump() {
    if (this._jumpPending) {
      this._jumpPending = false;
      return true;
    }
    return false;
  }

  destroy() {
    this.scene.scale.off('resize', this._resizeCb);
    this._objects.forEach(o => o.destroy());
    this._objects = [];
    this.left = this.right = this.run = false;
    this._jumpPending = false;
  }
}
