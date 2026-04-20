import { TouchControls, TOUCH_HUD_HEIGHT } from '../ui/TouchControls.js';
import { GameSettings } from '../settings/GameSettings.js';
import { createPlayerAnimations } from '../player/PlayerAnimations.js';
import { updatePlayerMovement } from '../player/PlayerController.js';

const WORLD_WIDTH = 4000;

const ITEMS = [
  { key: 'item_battery',      src: '/images/level-1/battery.png',        label: 'Battery',       x: 50   },
  { key: 'item_motor',        src: '/images/level-1/motor.png',          label: 'Motor',         x: 950  },
  { key: 'item_wire',         src: '/images/level-1/wire.png',           label: 'Wire',          x: 1650 },
  { key: 'item_gear',         src: '/images/level-1/gear.png',           label: 'Gear',          x: 2650 },
  { key: 'item_circuit_board',src: '/images/level-1/circuit-board.png',  label: 'Circuit Board', x: 3150 },
];

export class Level1Scene extends Phaser.Scene {
  constructor() {
    super('Level1Scene');
  }

  preload() {
    this.load.spritesheet('salvius', '/images/salvius-sprite.png', {
      frameWidth: 340,
      frameHeight: 450,
    });
    ITEMS.forEach(({ key, src }) => this.load.image(key, src));

    this.load.image('rock_small',  '/images/level-1/rock-small.png');
    this.load.image('rock_medium', '/images/level-1/rock-medium.png');
    this.load.image('rock_large',  '/images/level-1/rock-large.png');
    this.load.image('cactus_short', '/images/level-1/cactus-short.png');
    this.load.image('cactus_tall',  '/images/level-1/cactus-tall.png');

    this.load.audio('pick_up_object', '/audio/pick-up-object.wav');
    if (!this.cache.audio.exists('music_level1')) {
      this.load.audio('music_level1', '/music/01-alkali-plains.wav');
    }
  }

  create() {
    const { width, height } = this.scale;
    const hudH = this.sys.game.device.input.touch ? TOUCH_HUD_HEIGHT : 0;
    const groundY = height - 60 - hudH;
    this.groundY = groundY;

    this.cameras.main.setBackgroundColor('#E8C87A');

    // World & camera bounds
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, height - hudH);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, height - hudH);

    // ── Parallax background dunes ──────────────────────────────────────────
    this._buildDuneTextures(width, height, groundY);
    this.bgFarDunes = this.add.tileSprite(0, 0, width, height - hudH, 'dunes_far')
      .setOrigin(0, 0).setScrollFactor(0);
    this.bgMidDunes = this.add.tileSprite(0, 0, width, height - hudH, 'dunes_mid')
      .setOrigin(0, 0).setScrollFactor(0);

    // ── Touch HUD backing strip ────────────────────────────────────────────
    if (hudH > 0) {
      this.hudBacking = this.add.rectangle(0, height - hudH, width, hudH, 0x000000)
        .setOrigin(0, 0).setScrollFactor(0).setDepth(19);
    }

    // ── Visual ground (spans full world width) ─────────────────────────────
    this.groundLine = this.add.rectangle(0, groundY, WORLD_WIDTH, 8, 0xC2A060).setOrigin(0, 0);
    this.groundFill = this.add.rectangle(0, groundY + 8, WORLD_WIDTH, height - groundY - 8, 0x9A7040).setOrigin(0, 0);

    // ── Physics floor (invisible, for collision) ───────────────────────────
    this.floor = this.add.rectangle(0, groundY, WORLD_WIDTH, 10, 0x000000, 0).setOrigin(0, 0);
    this.physics.add.existing(this.floor, true);

    // ── Decorative world elements ──────────────────────────────────────────
    this._placeCacti(groundY);
    this._placeRocks(groundY);

    // ── Collectible items ──────────────────────────────────────────────────
    this.collectedItems = new Set();
    this._placeItems(groundY);

    // ── Animations ────────────────────────────────────────────────────────
    createPlayerAnimations(this);

    // ── Player ────────────────────────────────────────────────────────────
    this.player = this.physics.add.sprite(250, groundY, 'salvius')
      .setOrigin(0.5, 1)
      .setScale(0.5)
      .setCollideWorldBounds(true)
      .setDepth(5);
    this.player.body.setSize(130, 380, false).setOffset(105, 70);
    this.player.play('idle');

    // ── Drifting clouds ────────────────────────────────────────────────────
    this._placeClouds();

    // ── Colliders / overlaps ───────────────────────────────────────────────
    this.physics.add.collider(this.player, this.floor);
    this.physics.add.collider(this.player, this.rockGroup);
    this.physics.add.overlap(this.player, this.itemGroup, this._onCollect, null, this);

    // ── Right-edge cliff ───────────────────────────────────────────────────
    this._createBoundaryCliff(height, groundY);

    // ── HUD ───────────────────────────────────────────────────────────────
    this._buildHUD();

    // ── Camera ────────────────────────────────────────────────────────────
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(Math.min(300, width * 0.3), 200);

    // ── Input ─────────────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys();
    this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.wasd = this.input.keyboard.addKeys({ up: 'W', left: 'A', right: 'D', space: 'SPACE' });
    // ── Touch controls (mobile only) ──────────────────────────────────────
    if (this.sys.game.device.input.touch) {
      this.touchInput = new TouchControls(this);
    }
    this.scale.on('resize', this._onResize, this);
    this.events.on('shutdown', () => {
      this.scale.off('resize', this._onResize, this);
      this.touchInput?.destroy();
      this.music?.stop();
      this.music = null;
    });

    // ── Background music ───────────────────────────────────────────────────
    this.music = this.sound.add('music_level1', { loop: true, volume: GameSettings.musicVolume / 100 });
    if (GameSettings.musicPlaying) this.music.play();

    // ── Persistent UI overlay ──────────────────────────────────────────────
    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
  }

  update() {
    if (!GameSettings.reducedMotion) {
      this.bgFarDunes.tilePositionX = this.cameras.main.scrollX * 0.1;
      this.bgMidDunes.tilePositionX = this.cameras.main.scrollX * 0.25;
    }

    updatePlayerMovement(this);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  _buildDuneTextures(width, height, groundY) {
    // Far dunes: low-frequency, tall sandy waves
    const farG = this.make.graphics({ x: 0, y: 0, add: false });
    farG.fillStyle(0xC8A45E, 0.45);
    farG.fillPoints(this._hillProfile(width, groundY, height, 90, (2 * Math.PI) / width, 0), true);
    farG.generateTexture('dunes_far', width, height);
    farG.destroy();

    // Mid dunes: slightly higher frequency, darker warm sand
    const midG = this.make.graphics({ x: 0, y: 0, add: false });
    midG.fillStyle(0xA07840, 0.55);
    midG.fillPoints(this._hillProfile(width, groundY, height, 60, (4 * Math.PI) / width, Math.PI * 0.6), true);
    midG.generateTexture('dunes_mid', width, height);
    midG.destroy();
  }

  _hillProfile(width, groundY, height, amplitude, frequency, phase) {
    const pts = [new Phaser.Math.Vector2(0, height)];
    for (let x = 0; x <= width; x += 4) {
      pts.push(new Phaser.Math.Vector2(
        x,
        groundY - amplitude * (0.5 + 0.5 * Math.sin(x * frequency + phase)),
      ));
    }
    pts.push(new Phaser.Math.Vector2(width, height));
    return pts;
  }

  /** Place sandstone rocks across the desert world. */
  _placeRocks(groundY) {
    this.rockGroup = this.physics.add.staticGroup();
    const configs = [
      { x: 550,  key: 'rock_medium' },
      { x: 900,  key: 'rock_small'  },
      { x: 1200, key: 'rock_large'  },
      { x: 1550, key: 'rock_small'  },
      { x: 1900, key: 'rock_large'  },
      { x: 2200, key: 'rock_small'  },
      { x: 2500, key: 'rock_large'  },
      { x: 2800, key: 'rock_small'  },
      { x: 3100, key: 'rock_medium' },
      { x: 3450, key: 'rock_medium' },
      { x: 3700, key: 'rock_large'  },
    ];

    configs.forEach(({ x, key }) => {
      const rock = this.add.image(x, groundY + 20, key).setOrigin(0.5, 1).setScale(0.5);
      this.physics.add.existing(rock, true);
      this.rockGroup.add(rock);
    });
  }

  /** Place desert cacti across the world. */
  _placeCacti(groundY) {
    this.cactiImages = [];
    [
      { x: 430,  key: 'cactus_short' },
      { x: 730,  key: 'cactus_tall'  },
      { x: 1050, key: 'cactus_short' },
      { x: 1680, key: 'cactus_tall'  },
      { x: 1820, key: 'cactus_short' },
      { x: 2380, key: 'cactus_tall'  },
      { x: 2640, key: 'cactus_short' },
      { x: 3200, key: 'cactus_tall'  },
      { x: 3380, key: 'cactus_short' },
      { x: 3840, key: 'cactus_tall'  },
    ].forEach(({ x, key }) => {
      const scale = key === 'cactus_short' ? 0.5 : 1;
      const img = this.add.image(x, groundY + 20, key).setOrigin(0.5, 1).setScale(scale);
      this.cactiImages.push(img);
    });
  }

  /** Place the 5 collectible items on the ground. */
  _placeItems(groundY) {
    this.itemGroup = this.physics.add.staticGroup();

    ITEMS.forEach(({ key, x }) => {
      // Use the group's create() so the static body is managed by the group
      const img = this.itemGroup.create(x, groundY - 28, key)
        .setScale(0.18)
        .setDepth(3)
        .setData('itemKey', key);

      // Resize static body to match the scaled display size
      img.body.setSize(img.width * 0.18, img.height * 0.18);
      img.refreshBody();

      // Bob tween is purely visual - the static body stays at the original Y
      if (!GameSettings.reducedMotion) {
        this.tweens.add({
          targets: img,
          y: groundY - 38,
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    });
  }

  /** Called when player overlaps a collectible item. */
  _onCollect(player, item) {
    const key = item.getData('itemKey');
    if (this.collectedItems.has(key)) return;

    this.collectedItems.add(key);

    // Capture world position before destroying the item
    const itemX = item.x;
    const itemY = item.y;
    this.tweens.killTweensOf(item);
    item.destroy();

    if (GameSettings.sounds) this.sound.play('pick_up_object');

    // Update HUD icon: switch from grayscale to full colour + scale pop
    const icon = this.hudIcons[key];
    if (icon) {
      icon.clearTint();
      this.tweens.add({
        targets: icon,
        scaleX: icon.scaleX * 1.7,
        scaleY: icon.scaleY * 1.7,
        duration: 150,
        yoyo: true,
        ease: 'Back.easeOut',
      });
    }

    // Update counter
    const count = this.collectedItems.size;
    this.hudCounter.setText(`${count} / 5`);

    // Floating label rising from the item's world position
    const itemData = ITEMS.find(i => i.key === key);
    const floatText = this.add.text(itemX, itemY - 20, `+ ${itemData?.label ?? ''}`, {
      fontSize: '18px',
      fill: '#FFD700',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(15);

    this.tweens.add({
      targets: floatText,
      y: itemY - 90,
      alpha: 0,
      duration: 1000,
      ease: 'Cubic.easeOut',
      onComplete: () => floatText.destroy(),
    });

    if (count === 5) {
      this._showLevelComplete();
    }
  }

  /** Build the fixed-to-screen HUD showing collected item progress. */
  _buildHUD() {
    const panelX = 10;
    const panelY = 10;
    const iconSize = 36;
    const gap = 8;
    const totalW = ITEMS.length * (iconSize + gap) - gap + 16;
    const totalH = iconSize + 16;

    // Panel background
    const panel = this.add.rectangle(panelX, panelY, totalW, totalH, 0x000000, 0.45)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(10);

    this.hudIcons = {};

    ITEMS.forEach(({ key }, i) => {
      const ix = panelX + 8 + i * (iconSize + gap) + iconSize / 2;
      const iy = panelY + totalH / 2;

      const icon = this.add.image(ix, iy, key)
        .setDisplaySize(iconSize, iconSize)
        .setScrollFactor(0)
        .setDepth(11)
        .setTint(0x444444); // grayscale until collected

      this.hudIcons[key] = icon;
    });

    // "X / 5" counter label, bottom-right of panel
    this.hudCounter = this.add.text(
      panelX + totalW - 6,
      panelY + totalH - 4,
      '0 / 5',
      { fontSize: '13px', fill: '#ffffff', fontFamily: 'monospace' }
    )
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(11);
  }

  /** Show a "Level Complete" banner then transition to Level 2. */
  _showLevelComplete() {
    const { width, height } = this.scale;

    // Dim overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.5)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(20);

    this.add.text(width / 2, height / 2 - 24, 'LEVEL COMPLETE!', {
      fontSize: '40px',
      fill: '#FFD700',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 6,
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21);

    this.add.text(width / 2, height / 2 + 28, 'Heading to the Junkyard...', {
      fontSize: '18px',
      fill: '#ffffff',
      fontFamily: 'monospace',
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(21);

    this.time.delayedCall(2500, () => this.scene.start('Level2Scene'));
  }

  /** Add slowly drifting clouds (hot desert sky - keep white but sparser). */
  _placeClouds() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xFFFFFF, 0.75);
    g.fillEllipse(50, 42, 80, 50);
    g.fillEllipse(92, 32, 90, 58);
    g.fillEllipse(138, 42, 72, 44);
    g.generateTexture('cloud_l1', 200, 80);
    g.destroy();

    [
      { x: -80,  y: 35, scale: 0.80, duration: 60000, drift: 980  },
      { x: 270,  y: 52, scale: 1.00, duration: 80000, drift: 1150 },
      { x: 510,  y: 28, scale: 0.70, duration: 50000, drift: 860  },
      { x: -200, y: 60, scale: 0.90, duration: 68000, drift: 1020 },
      { x: 380,  y: 20, scale: 0.75, duration: 55000, drift: 890  },
    ].forEach(({ x, y, scale, duration, drift }) => {
      const cloud = this.add.image(x, y, 'cloud_l1')
        .setScale(scale)
        .setScrollFactor(0.15)
        .setDepth(6);
      this.tweens.add({
        targets: cloud,
        x: { from: x, to: x + drift },
        duration,
        repeat: -1,
      });
    });
  }

  _onResize(gameSize) {
    const { width, height } = gameSize;
    const hudH = this.touchInput ? TOUCH_HUD_HEIGHT : 0;
    const effectiveH = height - hudH;
    this.bgFarDunes?.setSize(width, effectiveH);
    this.bgMidDunes?.setSize(width, effectiveH);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, effectiveH);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, effectiveH);
    this.cameras.main.setDeadzone(Math.min(300, width * 0.3), 200);
    if (this.hudBacking) this.hudBacking.setPosition(0, effectiveH).setSize(width, hudH);
    this.touchInput?.resize(width, height);

    const newGroundY = height - 60 - hudH;
    if (this.groundY !== undefined && newGroundY !== this.groundY) {
      const deltaY = newGroundY - this.groundY;
      this.groundY = newGroundY;

      this.groundLine?.setPosition(0, newGroundY);
      this.groundFill?.setPosition(0, newGroundY + 8);

      if (this.floor) this.floor.body.reset(this.floor.x, newGroundY);

      this.rockGroup?.getChildren().forEach(rock => {
        rock.body.reset(rock.x, rock.y + deltaY);
      });

      this.cactiImages?.forEach(img => img.setY(img.y + deltaY));

      this.itemGroup?.getChildren().forEach(item => {
        this.tweens.killTweensOf(item);
        item.body.reset(item.x, item.y + deltaY);
        if (!GameSettings.reducedMotion) {
          this.tweens.add({
            targets: item,
            y: item.y - 10,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      });

      if (this.player?.body.blocked.down) {
        this.player.body.reset(this.player.x, this.player.y + deltaY);
      }
    }
  }

  /** Sandstone cliff face at the right edge of the world. */
  _createBoundaryCliff(height, groundY) {
    const cliffW = 80;
    const cliffH = groundY + 8;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xC8924A, 1);
    g.fillRect(0, 0, cliffW, cliffH);
    g.lineStyle(1, 0x9A6A2E, 0.6);
    for (let ly = 15; ly < cliffH; ly += 22) {
      g.lineBetween(4, ly, cliffW - 4, ly + (ly % 44 < 22 ? 3 : -3));
    }
    g.lineStyle(1, 0x9A6A2E, 0.4);
    g.lineBetween(cliffW * 0.35, 0, cliffW * 0.3, cliffH * 0.5);
    g.lineBetween(cliffW * 0.7, cliffH * 0.2, cliffW * 0.65, cliffH);
    g.lineStyle(2, 0xE8B870, 0.5);
    g.lineBetween(0, 0, 0, cliffH);
    g.generateTexture('cliff_l1', cliffW, cliffH);
    g.destroy();

    this.add.image(WORLD_WIDTH - cliffW, 0, 'cliff_l1').setOrigin(0, 0).setDepth(4);
  }
}
