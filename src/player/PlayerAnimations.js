import { ANIMS } from '../config/GameConfig.js';

/**
 * Register the four Salvius player animations on the given Phaser scene's
 * animation manager.  Safe to call from any scene – skips animations that
 * already exist (which Phaser keeps globally across scenes).
 *
 * @param {Phaser.Scene} scene
 */
export function createPlayerAnimations(scene) {
  for (const [key, cfg] of Object.entries(ANIMS)) {
    if (!scene.anims.exists(key)) {
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers('salvius', { start: cfg.start, end: cfg.end }),
        frameRate: cfg.frameRate,
        repeat: cfg.repeat,
      });
    }
  }
}
