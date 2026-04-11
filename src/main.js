import Phaser from 'phaser';
import { Level1Scene } from './scenes/Level1Scene.js';
import { Level2Scene } from './scenes/Level2Scene.js';
import { Level3Scene } from './scenes/Level3Scene.js';

const sceneMap = {
  '#level1': Level1Scene,
  '#level2': Level2Scene,
  '#level3': Level3Scene,
};

const allScenes = [Level1Scene, Level2Scene, Level3Scene];
const hash = window.location.hash.toLowerCase();
const startScene = sceneMap[hash];
const scenes = startScene
  ? [startScene, ...allScenes.filter(s => s !== startScene)]
  : allScenes;

new Phaser.Game({
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
