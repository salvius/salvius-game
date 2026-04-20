import Phaser from 'phaser';
import { PLAYER_SPEED, PLAYER_RUN_SPEED, JUMP_VELOCITY } from '../config/GameConfig.js';

/**
 * Handle player movement + animation for a single update tick.
 *
 * Reads input from scene.cursors / scene.wasd / scene.shiftKey / scene.touchInput
 * and writes velocity + animations to scene.player.
 *
 * @param {Phaser.Scene} scene
 * @param {object} [opts]
 * @param {() => void} [opts.onJump]  Called when the player initiates a jump.
 * @param {() => void} [opts.onLand]  Called on the first frame the player lands.
 */
export function updatePlayerMovement(scene, { onJump, onLand } = {}) {
  const player   = scene.player;
  const onGround = player.body.blocked.down;

  // Optional landing callback (state tracked on the scene with _wasInAir)
  if (onLand !== undefined) {
    if (scene._wasInAir && onGround) onLand();
    scene._wasInAir = !onGround;
  }

  const left    = scene.cursors.left.isDown  || scene.wasd.left.isDown  || (scene.touchInput?.left  ?? false);
  const right   = scene.cursors.right.isDown || scene.wasd.right.isDown || (scene.touchInput?.right ?? false);
  const running = scene.shiftKey.isDown      || (scene.touchInput?.run  ?? false);
  const speed   = running
    ? (scene.playerRunSpeed ?? PLAYER_RUN_SPEED)
    : (scene.playerSpeed    ?? PLAYER_SPEED);
  const moveAnim = running ? 'run' : 'walk';

  const jumpPressed = Phaser.Input.Keyboard.JustDown(scene.cursors.up)
                    || Phaser.Input.Keyboard.JustDown(scene.wasd.up)
                    || Phaser.Input.Keyboard.JustDown(scene.wasd.space)
                    || (scene.touchInput?.consumeJump() ?? false);
  if (jumpPressed && onGround) {
    player.setVelocityY(JUMP_VELOCITY);
    player.play('jump', true);
    if (onJump) onJump();
  }

  const grounded = onGround && player.body.velocity.y >= 0;

  if (left && !right) {
    player.setVelocityX(-speed);
    player.setFlipX(true);
    if (grounded && player.anims.currentAnim?.key !== moveAnim) player.play(moveAnim);
  } else if (right && !left) {
    player.setVelocityX(speed);
    player.setFlipX(false);
    if (grounded && player.anims.currentAnim?.key !== moveAnim) player.play(moveAnim);
  } else {
    player.setVelocityX(0);
    if (grounded && player.anims.currentAnim?.key !== 'idle') player.play('idle');
  }

  if (grounded && player.anims.currentAnim?.key === 'jump') player.play('idle');
}
