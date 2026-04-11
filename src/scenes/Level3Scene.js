// Level 3 is a vertical world - camera scrolls upward as Salvius climbs the tower.
const WORLD_HEIGHT = 3200;

// Platform layout: { x (centre), y (top surface), w (width) }
// Staggered zigzag, vertical gap 150-180px - safely reachable with jump velocity -700 / gravity 1200.
const PLATFORMS = [
  { x: 400, y: WORLD_HEIGHT - 120,  w: 200 }, // base - wide landing pad
  { x: 220, y: WORLD_HEIGHT - 250,  w: 140 },
  { x: 600, y: WORLD_HEIGHT - 300,  w: 400 },
  { x: 600, y: WORLD_HEIGHT - 380,  w: 120 },
  { x: 700, y: WORLD_HEIGHT - 450,  w: 120 },
  { x: 490, y: WORLD_HEIGHT - 610,  w: 110 },
  { x: 400, y: WORLD_HEIGHT - 710,  w: 110 },
  { x: 250, y: WORLD_HEIGHT - 810,  w: 300 },
  { x: 180, y: WORLD_HEIGHT - 935,  w: 120 },
  { x: 400, y: WORLD_HEIGHT - 1100, w: 100 },
  { x: 500, y: WORLD_HEIGHT - 1240, w: 110 },
  { x: 80,  y: WORLD_HEIGHT - 1420, w: 500 },
  { x: 720, y: WORLD_HEIGHT - 1550, w: 500 },

  { x: 560, y: WORLD_HEIGHT - 1700, w: 60 },
  { x: 660, y: WORLD_HEIGHT - 1850, w: 60 },
  { x: 510, y: WORLD_HEIGHT - 2000, w: 60 },
  { x: 440, y: WORLD_HEIGHT - 2150, w: 60 },

  { x: 600, y: WORLD_HEIGHT - 2340, w: 110 },
  { x: 350, y: WORLD_HEIGHT - 2430, w: 120 },
  { x: 150, y: WORLD_HEIGHT - 2590, w: 60 },
  { x: 440, y: WORLD_HEIGHT - 2680, w: 40 },

  { x: 620, y: WORLD_HEIGHT - 2830, w: 90 },
  { x: 700, y: WORLD_HEIGHT - 2940, w: 110 },
  { x: 400, y: 180,                 w: 160 }, // top - broadcast point
];

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
    if (!this.cache.audio.exists('jump_start')) {
      this.load.audio('jump_start', '/audio/jump-start.wav');
    }
    if (!this.cache.audio.exists('jump_land')) {
      this.load.audio('jump_land', '/audio/jump-land.wav');
    }
  }

  create() {
    const { width, height } = this.scale;
    const groundY = WORLD_HEIGHT - 60;

    this.levelComplete = false;

    // Deep night sky
    this.cameras.main.setBackgroundColor('#050510');

    // ── World & camera bounds (vertical world, fixed viewport width) ───────
    // Extend 500px above y=0 so the player isn't blocked by the physics ceiling
    // before reaching the top platform (y=180) and beacon (y=32).
    this.physics.world.setBounds(0, -500, width, WORLD_HEIGHT + 500);
    this.cameras.main.setBounds(0, -500, width, WORLD_HEIGHT + 500);

    // ── Sky gradient rectangles ────────────────────────────────────────────
    // Bottom portion of sky is slightly lighter (light pollution from city below)
    this.add.rectangle(0, 0, width, WORLD_HEIGHT * 0.6, 0x050510).setOrigin(0, 0).setDepth(0);
    this.add.rectangle(0, WORLD_HEIGHT * 0.6, width, WORLD_HEIGHT * 0.4, 0x0A0A1A).setOrigin(0, 0).setDepth(0);

    // ── Star field (vertical tile across full world height) ────────────────
    this._buildStarTexture(width, height);
    this.bgStars = this.add.tileSprite(0, 0, width, WORLD_HEIGHT, 'stars_l3')
      .setOrigin(0, 0).setScrollFactor(0).setDepth(1);

    // ── City silhouette strip at the base of the world ─────────────────────
    this._buildCitySilhouette(width, height, groundY);
    this.bgCity = this.add.tileSprite(0, WORLD_HEIGHT - height, width, height, 'city_base')
      .setOrigin(0, 0).setScrollFactor(0).setDepth(2);

    // ── Ground floor (safety net - catches any full fall) ──────────────────
    this.add.rectangle(0, groundY, width, 8, 0x1A1A2E).setOrigin(0, 0).setDepth(3);
    this.add.rectangle(0, groundY + 8, width, WORLD_HEIGHT - groundY - 8, 0x0F0F1E).setOrigin(0, 0).setDepth(3);
    const floor = this.add.rectangle(0, groundY, width, 10, 0x000000, 0).setOrigin(0, 0);
    this.physics.add.existing(floor, true);

    // ── Tower structure (drawn behind platforms) ───────────────────────────
    this._drawTowerStructure(width, groundY);

    // ── Platforms ─────────────────────────────────────────────────────────
    this._createPlatforms();

    // ── Warning lights ─────────────────────────────────────────────────────
    this._placeWarningLights(width, groundY);

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

    // ── Player - spawns on the base platform ──────────────────────────────
    const baseY = PLATFORMS[0].y;
    this.player = this.physics.add.sprite(width / 2, baseY, 'salvius')
      .setOrigin(0.5, 1)
      .setScale(0.5)
      .setCollideWorldBounds(true)
      .setDepth(5);
    this.player.body.setSize(130, 380, false).setOffset(105, 70);
    this.player.play('idle');

    // ── Colliders ─────────────────────────────────────────────────────────
    this.physics.add.collider(this.player, floor);
    this.physics.add.collider(this.player, this.platformGroup);

    // ── Signal beacon at the top of the tower ─────────────────────────────
    this._createBeacon(width);

    // ── Level label ───────────────────────────────────────────────────────
    this.add.text(width / 2, 12, 'THE RADIO TOWER', {
      fontSize: '16px',
      fill: '#5588FF',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(10);

    // ── Height progress indicator ─────────────────────────────────────────
    this.heightLabel = this.add.text(width - 10, height - 10, '', {
      fontSize: '13px',
      fill: '#8899CC',
      fontFamily: 'monospace',
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(10);

    // ── Camera - follow player, tight vertical tracking ────────────────────
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(100, 80);

    // ── Input ─────────────────────────────────────────────────────────────
    this.cursors = this.input.keyboard.createCursorKeys();
    this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.playerSpeed = 200;
    this.playerRunSpeed = 400;
    this.wasInAir = false;
  }

  update() {
    // Slow star drift (vertical parallax)
    this.bgStars.tilePositionY = this.cameras.main.scrollY * 0.05;

    // City silhouette shows only when near the ground
    this.bgCity.tilePositionY = 0;

    if (this.levelComplete) return;

    const player = this.player;
    const onGround = player.body.blocked.down;
    const left = this.cursors.left.isDown;
    const right = this.cursors.right.isDown;
    const running = this.shiftKey.isDown;
    const speed = running ? this.playerRunSpeed : this.playerSpeed;
    const moveAnim = running ? 'run' : 'walk';

    // Landing detection - fires regardless of which animation is active
    if (this.wasInAir && onGround) {
      this.sound.play('jump_land');
    }
    this.wasInAir = !onGround;

    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) && onGround) {
      player.setVelocityY(-700);
      player.play('jump', true);
      this.sound.play('jump_start');
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

    if (grounded && player.anims.currentAnim?.key === 'jump') {
      player.play('idle');
    }

    // Height indicator - counts up as Salvius climbs
    const pct = Math.round(((WORLD_HEIGHT - player.y) / WORLD_HEIGHT) * 100);
    this.heightLabel.setText(`HEIGHT ${Math.max(0, pct)}%`);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /** Star tile texture sized to the viewport, tiled vertically across the world. */
  _buildStarTexture(width, height) {
    if (this.textures.exists('stars_l3')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    for (let i = 0; i < 120; i++) {
      const sx = Math.abs(Math.sin(i * 137.5) * width);
      const sy = Math.abs(Math.cos(i * 97.3) * height);
      const brightness = 0.4 + 0.6 * Math.abs(Math.sin(i * 53.1));
      g.fillStyle(0xFFFFFF, brightness);
      g.fillCircle(sx, sy, i % 7 === 0 ? 1.5 : 1);
    }
    g.generateTexture('stars_l3', width, height);
    g.destroy();
  }

  /** City skyline silhouette strip rendered at the base of the world. */
  _buildCitySilhouette(width, height, groundY) {
    if (this.textures.exists('city_base')) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // Dark background fill
    g.fillStyle(0x0A0A1A, 1);
    g.fillRect(0, 0, width, height);
    // Building silhouette layer
    g.fillStyle(0x0E0E24, 1);
    let bldH = 0, nextX = 0;
    for (let x = 0; x <= width; x += 2) {
      if (x >= nextX) {
        const bldW = Math.round(40 + 60 * (0.5 + 0.5 * Math.sin(x * 0.04)));
        bldH = 80 + 60 * (0.5 + 0.5 * Math.sin(x * 0.07 + 1.2));
        nextX = x + bldW;
      }
      g.fillRect(x, height - bldH, 2, bldH);
    }
    // Lit windows (deterministic)
    g.fillStyle(0xFFEE88, 0.5);
    for (let wx = 12; wx < width - 12; wx += 12) {
      const bH = 80 + 60 * (0.5 + 0.5 * Math.sin(wx * 0.07 + 1.2));
      for (let wy = 10; wy < bH - 10; wy += 10) {
        if (Math.sin(wx * 0.3 + wy * 0.7) > 0.3) g.fillRect(wx - 1, height - bH + wy, 3, 2);
      }
    }
    g.generateTexture('city_base', width, height);
    g.destroy();
  }

  /**
   * Draw the full radio tower structure as a world-space image spanning the
   * entire WORLD_HEIGHT. Lattice legs taper from wide at the base to narrow at
   * the top, with cross-braces and horizontal rungs.
   */
  _drawTowerStructure(width, groundY) {
    const cx = width / 2;
    const totalH = groundY;           // draw from y=0 to the ground
    const baseHalfW = 55;             // half-width at base
    const topHalfW  = 8;              // half-width at mast top
    const mastTopY  = 60;             // y where the mast tip ends

    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // ── Outer legs ────────────────────────────────────────────────────────
    g.lineStyle(5, 0x3A3A4A, 1);
    g.lineBetween(cx - baseHalfW, totalH, cx - topHalfW, mastTopY);
    g.lineBetween(cx + baseHalfW, totalH, cx + topHalfW, mastTopY);

    // ── Cross-braces ─────────────────────────────────────────────────────
    const braceCount = Math.ceil(totalH / 155);
    g.lineStyle(2, 0x2E2E3E, 0.9);
    for (let i = 0; i <= braceCount; i++) {
      const t = i / braceCount;
      const y = totalH - t * (totalH - mastTopY);
      const hw = baseHalfW * (1 - t) + topHalfW * t;
      // Horizontal rung
      g.lineStyle(2, 0x3A3A4A, 0.8);
      g.lineBetween(cx - hw, y, cx + hw, y);
      // Diagonal brace to next rung
      if (i < braceCount) {
        const t2  = (i + 1) / braceCount;
        const y2  = totalH - t2 * (totalH - mastTopY);
        const hw2 = baseHalfW * (1 - t2) + topHalfW * t2;
        g.lineStyle(1, 0x2A2A3A, 0.7);
        if (i % 2 === 0) {
          g.lineBetween(cx - hw, y, cx + hw2, y2);
        } else {
          g.lineBetween(cx + hw, y, cx - hw2, y2);
        }
      }
    }

    // ── Narrow mast at the very top ───────────────────────────────────────
    g.lineStyle(3, 0x5A5A6A, 1);
    g.lineBetween(cx, mastTopY, cx, 0);

    // ── Antenna arms at the mast tip ──────────────────────────────────────
    g.lineStyle(2, 0x6A6A7A, 1);
    g.lineBetween(cx - 20, 30, cx + 20, 30);
    g.lineBetween(cx - 12, 18, cx + 12, 18);

    g.generateTexture('tower_structure', width, totalH);
    g.destroy();

    this.add.image(0, 0, 'tower_structure').setOrigin(0, 0).setDepth(3);
  }

  /**
   * Create all steel grate platforms as static physics bodies.
   * Each platform draws its own texture to avoid re-use conflicts.
   */
  _createPlatforms() {
    this.platformGroup = this.physics.add.staticGroup();

    PLATFORMS.forEach(({ x, y, w }, i) => {
      const h = 16;
      const key = `platform_${i}`;

      if (!this.textures.exists(key)) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        // Base steel plate
        g.fillStyle(0x3E5060, 1);
        g.fillRect(0, 0, w, h);
        // Grate lines
        g.lineStyle(1, 0x556070, 0.8);
        for (let gx = 8; gx < w; gx += 10) g.lineBetween(gx, 0, gx, h);
        g.lineBetween(0, h / 2, w, h / 2);
        // Top highlight
        g.lineStyle(2, 0x7A9AAA, 0.7);
        g.lineBetween(0, 0, w, 0);
        // Bottom shadow
        g.lineStyle(2, 0x1E2E38, 0.8);
        g.lineBetween(0, h - 1, w, h - 1);
        g.generateTexture(key, w, h);
        g.destroy();
      }

      const plat = this.add.image(x, y, key).setOrigin(0.5, 0).setDepth(4);
      this.physics.add.existing(plat, true);
      // Adjust body to sit on the top surface only (thin collision strip)
      plat.body.setSize(w, h);
      plat.body.setOffset(0, 0);
      this.platformGroup.add(plat);
    });
  }

  /**
   * Place three red blinking warning lights on the tower:
   * roughly at 25 %, 50 %, and 75 % of the climb height.
   */
  _placeWarningLights(width, groundY) {
    const cx = width / 2;
    [groundY * 0.75, groundY * 0.50, groundY * 0.25].forEach(y => {
      const light = this.add.circle(cx, y, 5, 0xFF2222).setDepth(6);
      this.tweens.add({
        targets: light,
        alpha: 0.1,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  /**
   * Build the glowing signal beacon at the mast tip.
   * Three layered circles provide the glow effect; a small static physics
   * rectangle acts as the touch trigger.
   */
  _createBeacon(width) {
    const cx = width / 2;
    const by = 32; // y position — just above the antenna arms

    // Outer glow halo
    const halo = this.add.circle(cx, by, 30, 0x44DDFF, 0.12).setDepth(7);
    this.tweens.add({
      targets: halo,
      alpha: { from: 0.05, to: 0.38 },
      scaleX: { from: 0.85, to: 1.25 },
      scaleY: { from: 0.85, to: 1.25 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Mid ring
    const ring = this.add.circle(cx, by, 17, 0x88EEFF, 0.45).setDepth(7);
    this.tweens.add({
      targets: ring,
      alpha: { from: 0.2, to: 0.75 },
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Bright core
    const core = this.add.circle(cx, by, 7, 0xFFFFFF, 1).setDepth(8);
    this.tweens.add({
      targets: core,
      alpha: { from: 0.65, to: 1.0 },
      scaleX: { from: 0.8, to: 1.2 },
      scaleY: { from: 0.8, to: 1.2 },
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Invisible physics body the player must touch to trigger the win
    const beacon = this.add.rectangle(cx, by, 60, 60, 0x000000, 0);
    this.physics.add.existing(beacon, true);
    this.physics.add.overlap(this.player, beacon, this._onBroadcastReached, null, this);
  }

  /** Called when Salvius touches the signal beacon at the top. */
  _onBroadcastReached() {
    if (this.levelComplete) return;
    this.levelComplete = true;
    // Freeze the player in place: stop all movement and disable gravity
    // so they stay standing on the platform while the victory screen is shown.
    this.player.setVelocity(0, 0);
    this.player.body.setAllowGravity(false);
    this.player.play('idle');
    this._showVictory();
  }

  /** Victory screen with a broadcast message, then restart from Level 1. */
  _showVictory() {
    const { width, height } = this.scale;

    // Dark overlay
    this.add.rectangle(0, 0, width, height, 0x000000, 0.75)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(20);

    // Signal animation - small radiating circles
    const cx = width / 2, cy = height / 2 - 80;
    for (let r = 0; r < 3; r++) {
      const ring = this.add.circle(cx, cy, 8, 0x4488FF, 0)
        .setStrokeStyle(2, 0x4488FF, 1)
        .setScrollFactor(0).setDepth(21);
      this.tweens.add({
        targets: ring,
        scaleX: 6, scaleY: 6,
        alpha: { from: 1, to: 0 },
        delay: r * 400,
        duration: 1400,
        repeat: -1,
        ease: 'Quad.easeOut',
      });
    }

    this.add.text(width / 2, height / 2 - 44, 'BROADCAST SENT!', {
      fontSize: '38px',
      fill: '#FFD700',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(22);

    this.add.text(width / 2, height / 2 + 14, '"Happy Earth Day -\n from Salvius."', {
      fontSize: '17px',
      fill: '#AACCFF',
      fontFamily: 'monospace',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(22);

    this.add.text(width / 2, height / 2 + 82, 'Mission accomplished.', {
      fontSize: '13px',
      fill: '#888888',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(22);
  }
}
