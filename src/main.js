import Phaser from 'phaser';
import { Level1Scene } from './scenes/Level1Scene.js';
import { Level2Scene } from './scenes/Level2Scene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 400,
  parent: 'game',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 1200 }, debug: false },
  },
  scene: [Level1Scene, Level2Scene],
});
