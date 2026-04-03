import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  width: 800,
  height: 400,
  backgroundColor: '#87CEEB',
  parent: 'game',
  scene: [GameScene],
});
