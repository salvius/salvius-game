const WORLD_WIDTH = 4000;

export class Level3Scene extends Phaser.Scene {
  constructor() {
    super('Level3Scene');
  }

  preload() {
    if (!this.textures.exists('salvius')) {
      this.load.spritesheet('salvius', '/images/salvius-sprite.png', {
        frameWidth: 340,
        frameHeight: 450,
      });
    }
  }

  create() {
    const { width, height } = this.scale;
    const groundY = height - 60;

    // Deep city night sky
    this.cameras.main.setBackgroundColor('#0A0A1A');

    // World & camera bounds
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, height);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, height);

    // ── Parallax city silhouettes ──────────────────────────────────────────
    this._buildCitySilhouettes(width, height, groundY);
    this.bgFar = this.add.tileSprite(0, 0, width, height, 'city_far')
      .setOrigin(0, 0).setScrollFactor(0);
    this.bgMid = this.add.tileSprite(0, 0, width, height, 'city_mid')
      .setOrigin(0, 0).setScrollFactor(0);

    // ── Visual ground (dark street) ────────────────────────────────────────
    this.add.rectangle(0, groundY, WORLD_WIDTH, 8, 0x1A1A2E).setOrigin(0, 0);
    this.add.rectangle(0, groundY + 8, WORLD_WIDTH, height - groundY - 8, 0x0F0F1E).setOrigin(0, 0);

    // ── Physics floor ──────────────────────────────────────────────────────
    const floor = this.add.rectangle(0, groundY, WORLD_WIDTH, 10, 0x000000, 0).setOrigin(0, 0);
    this.physics.add.existing(floor, true);

    // ── Street details ─────────────────────────────────────────────────────
    this._placeStreetLamps(groundY);
    this._placeBarriers(groundY);

    // ── Stars ─────────────────────────────────────────────────────────────
    this._placeStars(width, height, groundY);

    // ── Player animations ──────────────────────────────────────────────────
    if (!this.anims.exists('idle')) {
      this.anims.create({
        key: 'idle',
        frames: this.anims.generateFrameNumbers('salvius', { start: 0, end: 2 }),
        frameRate: 1, repeat: -1,
      });
    }
    if (!this.anims.exists('walk')) {
      this.anims.create({
        key: 'walk',
        frames: this.anims.generateFrameNumbers('salvius', { start: 0, end: 5 }),
        frameRate: 8, repeat: -1,
      });
    }
    if (!this.anims.exists('run')) {
      this.anims.create({
        key: 'run',
        frames: this.anims.generateFrameNumbers('salvius', { start: 6, end: 11 }),
        frameRate: 12, repeat: -1,
      });
    }
    if (!this.anims.exists('jump')) {
      this.anims.create({
        key: 'jump',
        frames: this.anims.generateFrameNumbers('salvius', { start: 14, end: 16 }),
        frameRate: 10, repeat: 0,
      });
    }

    // ── Player ────────────────────────────────────────────────────────────
    this.player = this.physics.add.sprite(width / 4, groundY, 'salvius')
      .setOrigin(0.5, 1)
      .setScale(0.5)
      .setCollideWorldBounds(true)
      .setDepth(5);
    this.player.body.setSize(130, 380, false).setOffset(105, 70);
    this.player.play('idle');

    // ── Colliders ─────────────────────────────────────────────────────────
    this.physics.add.collider(this.player, floor);
    this.physics.add.collider(this.player, this.barrierGroup);

    // ── Boundary wall ─────────────────────────────────────────────────────
    this._createBoundaryWall(height, groundY);

    // ── Level label ───────────────────────────────────────────────────────
    this.add.text(this.scale.width / 2, 12, 'THE RADIO TOWER', {
      fontSize: '16px',
      fill: '#5588FF',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(10);

    // ── Camera ────────────────────────────────────────────────────────────
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(300, 200);

    // ── Input ─────────────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys();
    this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.playerSpeed = 200;
    this.playerRunSpeed = 400;
  }

  update() {
    this.bgFar.tilePositionX = this.cameras.main.scrollX * 0.1;
    this.bgMid.tilePositionX = this.cameras.main.scrollX * 0.25;

    const player = this.player;
    const onGround = player.body.blocked.down;
    const left = this.cursors.left.isDown;
    const right = this.cursors.right.isDown;
    const running = this.shiftKey.isDown;
    const speed = running ? this.playerRunSpeed : this.playerSpeed;
    const moveAnim = running ? 'run' : 'walk';

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) && onGround) {
      player.setVelocityY(-700);
      player.play('jump', true);
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

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Build two-layer parallax city silhouettes using stepped building profiles
   * with small lit-window details.
   */
  _buildCitySilhouettes(width, height, groundY) {
    // Far layer — tall distant skyscrapers, dark blue-grey
    const farG = this.make.graphics({ x: 0, y: 0, add: false });
    farG.fillStyle(0x1A1A3A, 1);
    farG.fillPoints(this._buildingProfile(width, groundY, height, 130, 70, 0.04), true);
    // Windows on far buildings
    farG.fillStyle(0xFFEE88, 0.35);
    this._addWindowDots(farG, width, groundY, 130, 0.04, 14, 10);
    farG.generateTexture('city_far', width, height);
    farG.destroy();

    // Mid layer — closer shorter buildings, darker
    const midG = this.make.graphics({ x: 0, y: 0, add: false });
    midG.fillStyle(0x0E0E24, 1);
    midG.fillPoints(this._buildingProfile(width, groundY, height, 90, 50, 0.07), true);
    // Brighter windows on mid buildings
    midG.fillStyle(0xFFEE88, 0.55);
    this._addWindowDots(midG, width, groundY, 90, 0.07, 10, 8);
    midG.generateTexture('city_mid', width, height);
    midG.destroy();
  }

  /**
   * Generate a stepped building skyline polygon (square tops instead of smooth
   * sine waves), suitable for fillPoints.
   */
  _buildingProfile(width, groundY, height, maxH, minH, freq) {
    const pts = [new Phaser.Math.Vector2(0, height)];
    let bldH = groundY - maxH;
    let nextChange = 0;

    for (let x = 0; x <= width; x += 2) {
      if (x >= nextChange) {
        // Deterministic building width and height using sin
        const bldW = Math.round(40 + 60 * (0.5 + 0.5 * Math.sin(x * freq)));
        bldH = groundY - minH - (maxH - minH) * (0.5 + 0.5 * Math.sin(x * freq * 1.7 + 1.2));
        nextChange = x + bldW;
      }
      pts.push(new Phaser.Math.Vector2(x, bldH));
    }
    pts.push(new Phaser.Math.Vector2(width, height));
    return pts;
  }

  /** Scatter small square lit-window dots across a building profile. */
  _addWindowDots(g, width, groundY, maxH, freq, cols, rows) {
    for (let wx = cols; wx < width - cols; wx += cols) {
      const bH = maxH * (0.5 + 0.5 * Math.sin(wx * freq * 1.7 + 1.2));
      const bTop = groundY - maxH * 0.3 - bH;
      for (let wy = rows; wy < bH - rows; wy += rows) {
        // Randomly omit some windows for variety (deterministic via sin)
        if (Math.sin(wx * 0.3 + wy * 0.7) > 0.3) {
          g.fillRect(wx - 2, bTop + wy, 3, 2);
        }
      }
    }
  }

  /** Place street lamp posts along the ground at regular intervals. */
  _placeStreetLamps(groundY) {
    if (!this.textures.exists('lamp')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      // Pole
      g.fillStyle(0x3A3A5A, 1);
      g.fillRect(6, 20, 4, 55);
      // Arm
      g.fillRect(2, 18, 14, 4);
      // Lamp head
      g.fillStyle(0xBBAA44, 1);
      g.fillEllipse(7, 14, 14, 10);
      // Glow corona
      g.fillStyle(0xFFEE66, 0.22);
      g.fillEllipse(8, 14, 32, 28);
      g.generateTexture('lamp', 18, 76);
      g.destroy();
    }

    for (let x = 300; x < WORLD_WIDTH - 200; x += 280) {
      this.add.image(x, groundY, 'lamp').setOrigin(0.5, 1).setDepth(2);
    }
  }

  /** Place concrete barriers / planters as obstacles (with physics). */
  _placeBarriers(groundY) {
    this.barrierGroup = this.physics.add.staticGroup();

    const configs = [
      { x: 480,  w: 52, h: 26 },
      { x: 820,  w: 38, h: 20 },
      { x: 1150, w: 70, h: 32 },
      { x: 1490, w: 44, h: 22 },
      { x: 1820, w: 60, h: 28 },
      { x: 2140, w: 36, h: 18 },
      { x: 2460, w: 78, h: 34 },
      { x: 2770, w: 48, h: 24 },
      { x: 3060, w: 62, h: 30 },
      { x: 3390, w: 50, h: 26 },
      { x: 3620, w: 68, h: 30 },
    ];

    configs.forEach(({ x, w, h }, i) => {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      // Concrete block
      g.fillStyle(0x2A2A44, 1);
      g.fillRoundedRect(0, 0, w, h, 4);
      // Light edge highlight
      g.lineStyle(1, 0x4A4A6A, 0.7);
      g.strokeRoundedRect(0, 0, w, h, 4);
      // Stencil stripe
      g.fillStyle(0xFFEE00, 0.15);
      g.fillRect(w * 0.2, h * 0.3, w * 0.6, h * 0.15);
      const key = `barrier_${i}`;
      g.generateTexture(key, w, h);
      g.destroy();

      const barrier = this.add.image(x, groundY - h, key).setOrigin(0, 0).setDepth(3);
      this.physics.add.existing(barrier, true);
      this.barrierGroup.add(barrier);
    });
  }

  /** Scatter small white star dots in the sky (above groundY). */
  _placeStars(width, height, groundY) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // Generate a tile of stars using a deterministic scatter
    const tW = width, tH = Math.round(groundY * 0.85);
    for (let i = 0; i < 80; i++) {
      // Deterministic positions using sin/cos of index
      const sx = Math.abs(Math.sin(i * 137.5) * tW);
      const sy = Math.abs(Math.cos(i * 97.3) * tH);
      const brightness = 0.4 + 0.6 * Math.abs(Math.sin(i * 53.1));
      g.fillStyle(0xFFFFFF, brightness);
      g.fillCircle(sx, sy, i % 5 === 0 ? 1.5 : 1);
    }
    g.generateTexture('stars', tW, tH);
    g.destroy();

    this.add.tileSprite(0, 0, width, tH, 'stars')
      .setOrigin(0, 0)
      .setScrollFactor(0.05)
      .setDepth(0);
  }

  /** Solid boundary wall at the far right of the city. */
  _createBoundaryWall(height, groundY) {
    const wallW = 80;
    const wallH = groundY + 8;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x1A1A2E, 1);
    g.fillRect(0, 0, wallW, wallH);
    // Blue neon edge
    g.lineStyle(2, 0x3355AA, 0.8);
    g.lineBetween(0, 0, 0, wallH);
    // Horizontal panel lines
    g.lineStyle(1, 0x2A2A4E, 0.6);
    for (let ly = 20; ly < wallH; ly += 28) {
      g.lineBetween(4, ly, wallW - 4, ly);
    }
    g.generateTexture('wall_l3', wallW, wallH);
    g.destroy();
    this.add.image(WORLD_WIDTH - wallW, 0, 'wall_l3').setOrigin(0, 0).setDepth(4);
  }
}
