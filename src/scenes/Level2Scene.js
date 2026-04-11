const WORLD_WIDTH = 4000;
const RAT_SPEED = 90;
const INVINCIBILITY_MS = 1500;
const MAX_LIVES = 3;

// One rat per zone, each confined between a pair of every-other rock.
// minX/maxX are the left edges of the bounding rocks.
const RAT_PATROLS = [
  { minX: 520,  maxX: 1180 },
  { minX: 1180, maxX: 1880 },
  { minX: 1880, maxX: 2480 },
  { minX: 2480, maxX: 3080 },
  { minX: 3080, maxX: 3680 },
];

export class Level2Scene extends Phaser.Scene {
  constructor() {
    super('Level2Scene');
  }

  preload() {
    if (!this.textures.exists('salvius')) {
      this.load.spritesheet('salvius', '/images/salvius-sprite.png', {
        frameWidth: 340,
        frameHeight: 450,
      });
    }
    // Battery image is used for the lives HUD
    if (!this.textures.exists('item_battery')) {
      this.load.image('item_battery', '/images/level-1/battery.png');
    }
  }

  create() {
    const { width, height } = this.scale;
    const groundY = height - 60;

    this.cameras.main.setBackgroundColor('#2A2A32');

    // World & camera bounds
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, height);
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, height);

    // ── Background silhouettes ─────────────────────────────────────────────
    this._buildJunkSilhouettes(width, height, groundY);
    this.bgFar = this.add.tileSprite(0, 0, width, height, 'junk_far')
      .setOrigin(0, 0).setScrollFactor(0);
    this.bgMid = this.add.tileSprite(0, 0, width, height, 'junk_mid')
      .setOrigin(0, 0).setScrollFactor(0);

    // ── Visual ground (dark gravel) ────────────────────────────────────────
    this.add.rectangle(0, groundY, WORLD_WIDTH, 8, 0x3D3D3D).setOrigin(0, 0);
    this.add.rectangle(0, groundY + 8, WORLD_WIDTH, height - groundY - 8, 0x2A2A2A).setOrigin(0, 0);

    // ── Physics floor ──────────────────────────────────────────────────────
    const floor = this.add.rectangle(0, groundY, WORLD_WIDTH, 10, 0x000000, 0).setOrigin(0, 0);
    this.physics.add.existing(floor, true);

    // ── Junkyard decorations ───────────────────────────────────────────────
    this._placeScrapPiles(groundY);
    this._placeDebris(groundY);

    // ── Rats ──────────────────────────────────────────────────────────────
    this._makeRatTexture();
    this._placeRats(groundY);

    // ── State ─────────────────────────────────────────────────────────────
    this.lives = MAX_LIVES;
    this.isInvincible = false;
    this.levelComplete = false;

    // ── Reuse or recreate player animations ───────────────────────────────
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

    // ── Smog drifts ───────────────────────────────────────────────────────
    this._placeSmogClouds();

    // ── Colliders / overlaps ───────────────────────────────────────────────
    this.physics.add.collider(this.player, floor);
    this.physics.add.collider(this.player, this.debrisGroup);
    this.physics.add.overlap(this.player, this.ratGroup, this._onRatHit, null, this);

    // ── HUD ───────────────────────────────────────────────────────────────
    this._buildLivesHUD();

    // ── Radio tower (replaces boundary wall) — must come before tower overlap ─
    this._createRadioTower(height, groundY);
    this.physics.add.overlap(this.player, this.towerTrigger, this._onTowerReached, null, this);

    // ── Level label (top-centre, fixed to camera) ──────────────────────────
    this.add.text(this.scale.width / 2, 12, 'THE CITY OF SCRAP', {
      fontSize: '16px',
      fill: '#AA8844',
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

    // ── Rat patrol ────────────────────────────────────────────────────────
    for (const rat of this.rats) {
      if (rat.sprite.x >= rat.maxX) {
        rat.dir = -1;
        rat.sprite.setFlipX(true);
      } else if (rat.sprite.x <= rat.minX) {
        rat.dir = 1;
        rat.sprite.setFlipX(false);
      }
      rat.sprite.setVelocityX(rat.dir * RAT_SPEED);
      rat.sprite.body.velocity.y = 0;
      rat.sprite.y = rat.groundY;
    }

    if (this.levelComplete) return;

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

  /** Battery icons in the top-right corner (one per life). */
  _buildLivesHUD() {
    const { width } = this.scale;
    this.lifeIcons = [];
    for (let i = 0; i < MAX_LIVES; i++) {
      const icon = this.add.image(width - 12 - i * 44, 12, 'item_battery')
        .setDisplaySize(34, 34)
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(11);
      this.lifeIcons.push(icon);
    }
  }

  /** Draw a simple rat sprite (facing right) and cache the texture. */
  _makeRatTexture() {
    if (this.textures.exists('rat')) return;
    const W = 44, H = 22;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Body — dark grey rounded oval
    g.fillStyle(0x4A4A4A, 1);
    g.fillEllipse(W * 0.42, H * 0.52, W * 0.68, H * 0.78);

    // Head — slightly lighter
    g.fillStyle(0x5A5A5A, 1);
    g.fillEllipse(W * 0.76, H * 0.44, W * 0.36, H * 0.62);

    // Snout — pink
    g.fillStyle(0xCC7070, 1);
    g.fillEllipse(W * 0.96, H * 0.48, W * 0.14, H * 0.30);

    // Ear — pink round
    g.fillStyle(0x3A3A3A, 1);
    g.fillCircle(W * 0.72, H * 0.12, 5);
    g.fillStyle(0xCC7070, 1);
    g.fillCircle(W * 0.72, H * 0.12, 3);

    // Eye — small white dot
    g.fillStyle(0xEEEEEE, 1);
    g.fillCircle(W * 0.84, H * 0.32, 2);
    g.fillStyle(0x111111, 1);
    g.fillCircle(W * 0.85, H * 0.32, 1);

    // Tail — thin curved line (two segments)
    g.lineStyle(2, 0x888888, 1);
    g.beginPath();
    g.moveTo(W * 0.08, H * 0.55);
    g.lineTo(W * 0.00, H * 0.30);
    g.strokePath();

    // Legs — 4 stubby rectangles
    g.fillStyle(0x3E3E3E, 1);
    g.fillRect(W * 0.22, H * 0.72, 5, 7);
    g.fillRect(W * 0.34, H * 0.74, 5, 6);
    g.fillRect(W * 0.50, H * 0.72, 5, 7);
    g.fillRect(W * 0.62, H * 0.74, 5, 6);

    g.generateTexture('rat', W, H);
    g.destroy();
  }

  /** Spawn one rat per patrol zone, each confined between its two rocks. */
  _placeRats(groundY) {
    this.ratGroup = this.physics.add.group();
    this.rats = [];
    this.groundY = groundY;

    for (const { minX, maxX } of RAT_PATROLS) {
      // Start near the left edge of the zone (120px in) so the first rat
      // is visible at game start (~x=640) without the player needing to scroll.
      const startX = minX + 120;
      const sprite = this.physics.add.sprite(startX, groundY, 'rat')
        .setOrigin(0.5, 1)
        .setScale(1)
        .setDepth(4);
      sprite.body.setAllowGravity(false);
      // Narrow hitbox — just the body, not the snout/tail
      sprite.body.setSize(30, 14).setOffset(4, 6);
      sprite.setVelocityX(RAT_SPEED);

      this.ratGroup.add(sprite);
      this.rats.push({ sprite, minX, maxX, dir: 1, groundY });
    }
  }

  /** Called when the player overlaps a rat. */
  _onRatHit(player, _rat) {
    if (this.isInvincible || this.levelComplete) return;

    this.lives--;
    // Gray out the rightmost active battery icon
    this.lifeIcons[this.lives].setTint(0x333333);

    // Electrical spark at player's upper body
    this._spawnSpark(player.x, player.y - 80);

    // Camera shake
    this.cameras.main.shake(200, 0.015);

    if (this.lives <= 0) {
      this._showGameOver();
      return;
    }

    // Invincibility flash
    this.isInvincible = true;
    this.tweens.add({
      targets: player,
      alpha: 0.3,
      duration: 150,
      yoyo: true,
      repeat: 4,
      onComplete: () => {
        player.setAlpha(1);
        this.isInvincible = false;
      },
    });
  }

  /** Draw a brief electrical spark starburst at the given world position. */
  _spawnSpark(wx, wy) {
    const g = this.add.graphics().setDepth(20);
    const colours = [0xFFFF00, 0xFFFFAA, 0xFFCC00, 0xFFFFFF];
    const rays = 8;
    for (let i = 0; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2;
      const len = 14 + (i % 3) * 6;
      const col = colours[i % colours.length];
      g.lineStyle(2, col, 1);
      g.beginPath();
      g.moveTo(wx, wy);
      g.lineTo(wx + Math.cos(angle) * len, wy + Math.sin(angle) * len);
      g.strokePath();
    }
    // Small bright core
    g.fillStyle(0xFFFFFF, 1);
    g.fillCircle(wx, wy, 4);

    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => g.destroy(),
    });
  }

  /** Show GAME OVER overlay and restart at Level 1. */
  _showGameOver() {
    this.levelComplete = true; // freeze input / overlap
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, 0x000000, 0.65)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(20);

    this.add.text(width / 2, height / 2 - 20, 'GAME OVER', {
      fontSize: '44px',
      fill: '#FF3333',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(21);

    this.add.text(width / 2, height / 2 + 30, 'Returning to Level 1...', {
      fontSize: '16px',
      fill: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(21);

    this.time.delayedCall(2500, () => this.scene.start('Level1Scene'));
  }

  /** Called when the player walks into the radio tower trigger zone. */
  _onTowerReached(player, _trigger) {
    if (this.levelComplete) return;
    this.levelComplete = true;

    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, 0x000000, 0.5)
      .setOrigin(0, 0).setScrollFactor(0).setDepth(20);

    this.add.text(width / 2, height / 2 - 20, 'LEVEL COMPLETE!', {
      fontSize: '40px',
      fill: '#FFD700',
      fontFamily: 'monospace',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(21);

    this.add.text(width / 2, height / 2 + 28, 'Signal acquired — heading to the radio tower...', {
      fontSize: '16px',
      fill: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(21);

    this.time.delayedCall(2500, () => this.scene.start('Level3Scene'));
  }

  /**
   * Build jagged junkyard silhouette textures for the parallax background.
   * Uses a sawtooth + random variation profile instead of smooth sine waves.
   */
  _buildJunkSilhouettes(width, height, groundY) {
    const farG = this.make.graphics({ x: 0, y: 0, add: false });
    farG.fillStyle(0x3A3A4A, 0.7);
    farG.fillPoints(this._jaggedProfile(width, groundY, height, 70, 14, 0x1A2B3C), true);
    farG.generateTexture('junk_far', width, height);
    farG.destroy();

    const midG = this.make.graphics({ x: 0, y: 0, add: false });
    midG.fillStyle(0x282830, 0.85);
    midG.fillPoints(this._jaggedProfile(width, groundY, height, 50, 10, 0x2A1C0E), true);
    midG.generateTexture('junk_mid', width, height);
    midG.destroy();
  }

  /**
   * Generate an irregular skyline polygon: alternating stepped heights
   * to evoke piled debris, cranes, and broken machinery on the horizon.
   * @param {number} seed  A small integer used to vary the pattern
   */
  _jaggedProfile(width, groundY, height, maxAmp, stepW, seed) {
    // Use a simple deterministic "random" based on index position so it's
    // seamless across the tile (first and last x share the same height).
    const pts = [new Phaser.Math.Vector2(0, height)];
    let currentH = groundY - maxAmp * 0.5;
    for (let x = 0; x <= width; x += stepW) {
      // Hash the column index to get a stable pseudo-random height
      const t = Math.sin(x * 0.07 + seed) * 0.5 + 0.5; // 0..1
      const targetH = groundY - maxAmp * (0.2 + 0.8 * t);
      // Stepped: keep previous height for half the step, then jump
      if ((x / stepW) % 2 === 0) currentH = targetH;
      pts.push(new Phaser.Math.Vector2(x, currentH));
    }
    pts.push(new Phaser.Math.Vector2(width, height));
    return pts;
  }

  /** Place physic-enabled debris (jagged rocks / crushed metal). */
  _placeDebris(groundY) {
    this.debrisGroup = this.physics.add.staticGroup();

    const configs = [
      { x: 520,  w: 60, h: 30, color: 0x4A3020, accent: 0x6B4030 },
      { x: 870,  w: 40, h: 22, color: 0x3E3E3E, accent: 0x5A5A5A },
      { x: 1180, w: 78, h: 42, color: 0x4A2E18, accent: 0x6E4020 },
      { x: 1530, w: 44, h: 28, color: 0x3A3A3A, accent: 0x555555 },
      { x: 1880, w: 65, h: 38, color: 0x4A3020, accent: 0x6B4030 },
      { x: 2180, w: 36, h: 20, color: 0x3E3E3E, accent: 0x5A5A5A },
      { x: 2480, w: 82, h: 48, color: 0x4A2E18, accent: 0x6E4020 },
      { x: 2780, w: 48, h: 30, color: 0x3A3A3A, accent: 0x555555 },
      { x: 3080, w: 62, h: 36, color: 0x4A3020, accent: 0x6B4030 },
      { x: 3430, w: 52, h: 32, color: 0x3E3E3E, accent: 0x5A5A5A },
      { x: 3680, w: 74, h: 44, color: 0x4A2E18, accent: 0x6E4020 },
    ];

    configs.forEach(({ x, w, h, color, accent }, i) => {
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      // Jagged irregular shape using a polygon
      g.fillStyle(color, 1);
      g.fillPoints([
        new Phaser.Math.Vector2(0,       h * 0.6),
        new Phaser.Math.Vector2(w * 0.1, 0),
        new Phaser.Math.Vector2(w * 0.4, h * 0.15),
        new Phaser.Math.Vector2(w * 0.6, 0),
        new Phaser.Math.Vector2(w * 0.85,h * 0.2),
        new Phaser.Math.Vector2(w,       h * 0.5),
        new Phaser.Math.Vector2(w,       h),
        new Phaser.Math.Vector2(0,       h),
      ], true);
      // Rust/metal highlight
      g.fillStyle(accent, 0.5);
      g.fillRect(w * 0.2, h * 0.1, w * 0.3, h * 0.2);
      const key = `debris_${i}`;
      g.generateTexture(key, w, h);
      g.destroy();

      const piece = this.add.image(x, groundY - h, key).setOrigin(0, 0);
      this.physics.add.existing(piece, true);
      this.debrisGroup.add(piece);
    });
  }

  /** Place tall scrap-pile decorations (replaces trees). */
  _placeScrapPiles(groundY) {
    this._makeScrapPileTexture('scrap_sm', 28, 60);
    this._makeScrapPileTexture('scrap_md', 38, 85);
    this._makeScrapPileTexture('scrap_lg', 50, 110);

    [
      { x: 180,  key: 'scrap_md' },
      { x: 410,  key: 'scrap_sm' },
      { x: 700,  key: 'scrap_lg' },
      { x: 1020, key: 'scrap_sm' },
      { x: 1340, key: 'scrap_md' },
      { x: 1640, key: 'scrap_lg' },
      { x: 1800, key: 'scrap_sm' },
      { x: 2040, key: 'scrap_md' },
      { x: 2360, key: 'scrap_lg' },
      { x: 2620, key: 'scrap_sm' },
      { x: 2900, key: 'scrap_md' },
      { x: 3180, key: 'scrap_lg' },
      { x: 3360, key: 'scrap_sm' },
      { x: 3580, key: 'scrap_md' },
      { x: 3820, key: 'scrap_lg' },
    ].forEach(({ x, key }) => {
      this.add.image(x, groundY, key).setOrigin(0.5, 1).setDepth(2);
    });
  }

  /** Draw a stacked scrap-pile texture (recycled junk tower). */
  _makeScrapPileTexture(key, w, h) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const cx = w / 2;

    // Base heap (wide)
    g.fillStyle(0x4A3018, 1);
    g.fillRect(0, h * 0.65, w, h * 0.35);

    // Middle slab
    g.fillStyle(0x3E3E3E, 1);
    g.fillRect(cx - w * 0.3, h * 0.38, w * 0.6, h * 0.30);

    // Top piece (narrower, angled)
    g.fillStyle(0x5C3B1E, 1);
    g.fillPoints([
      new Phaser.Math.Vector2(cx - w * 0.18, h * 0.38),
      new Phaser.Math.Vector2(cx + w * 0.22, h * 0.12),
      new Phaser.Math.Vector2(cx + w * 0.28, h * 0.38),
    ], true);

    // Protruding rod / antenna stub
    g.fillStyle(0x6B6B6B, 1);
    g.fillRect(cx + w * 0.05, 0, 4, h * 0.18);

    // Rust accent streaks on the base
    g.fillStyle(0x7A3E10, 0.6);
    g.fillRect(w * 0.1, h * 0.70, 6, h * 0.20);
    g.fillRect(w * 0.55, h * 0.68, 4, h * 0.22);

    g.generateTexture(key, w, h);
    g.destroy();
  }

  /** Drifting smog / smoke patches across the junkyard sky. */
  _placeSmogClouds() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x6B6B5A, 0.5);
    g.fillEllipse(50, 38, 85, 44);
    g.fillStyle(0x5A5A4A, 0.4);
    g.fillEllipse(95, 28, 95, 52);
    g.fillStyle(0x6B6B5A, 0.35);
    g.fillEllipse(142, 38, 70, 38);
    g.generateTexture('smog', 200, 72);
    g.destroy();

    [
      { x: -60,  y: 30, scale: 0.85, duration: 70000, drift: 1050 },
      { x: 200,  y: 55, scale: 1.05, duration: 90000, drift: 1200 },
      { x: 460,  y: 22, scale: 0.70, duration: 55000, drift: 820  },
      { x: 640,  y: 68, scale: 1.10, duration: 95000, drift: 1300 },
      { x: -200, y: 42, scale: 0.90, duration: 75000, drift: 1080 },
      { x: 330,  y: 18, scale: 0.80, duration: 62000, drift: 930  },
    ].forEach(({ x, y, scale, duration, drift }) => {
      const smog = this.add.image(x, y, 'smog')
        .setScale(scale)
        .setScrollFactor(0.15)
        .setDepth(6);
      this.tweens.add({
        targets: smog,
        x: { from: x, to: x + drift },
        duration,
        repeat: -1,
      });
    });
  }

  /**
   * Draw a radio tower near the right edge of the world: tall lattice structure
   * with cross-braces, three horizontal rungs, a narrow mast, and a blinking
   * red warning light at the top. An invisible trigger zone at the base detects
   * when the player reaches it.
   */
  _createRadioTower(height, groundY) {
    const towerX = WORLD_WIDTH - 220;
    const towerW = 90;
    const towerH = groundY;       // tower base sits at ground level
    const mastH  = towerH * 0.85; // total visual height (from top of screen)
    const baseW  = towerW;
    const topW   = 14;
    const cx     = towerX + towerW / 2;

    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // ── Lattice legs (two angled outer legs converging to a narrow mast) ──
    g.lineStyle(4, 0x4A4A4A, 1);
    // Left leg
    g.lineBetween(0, towerH, topW / 2, mastH);
    // Right leg
    g.lineBetween(baseW, towerH, baseW - topW / 2, mastH);

    // ── Cross-braces ─────────────────────────────────────────────────────
    g.lineStyle(2, 0x3A3A3A, 0.9);
    const braceCount = 8;
    for (let i = 0; i <= braceCount; i++) {
      const t = i / braceCount;
      const y  = towerH - t * (towerH - mastH);
      const hw = (baseW / 2) * (1 - t) + (topW / 2) * t; // linear taper
      // Horizontal rung
      g.lineBetween(baseW / 2 - hw, y, baseW / 2 + hw, y);
      // Diagonal braces (alternating direction)
      if (i < braceCount) {
        const t2  = (i + 1) / braceCount;
        const y2  = towerH - t2 * (towerH - mastH);
        const hw2 = (baseW / 2) * (1 - t2) + (topW / 2) * t2;
        if (i % 2 === 0) {
          g.lineBetween(baseW / 2 - hw, y, baseW / 2 + hw2, y2);
        } else {
          g.lineBetween(baseW / 2 + hw, y, baseW / 2 - hw2, y2);
        }
      }
    }

    // ── Narrow mast above the lattice ─────────────────────────────────────
    const mastTopY = mastH * 0.35;
    g.lineStyle(3, 0x5A5A5A, 1);
    g.lineBetween(baseW / 2, mastH, baseW / 2, mastTopY);

    // ── Platform rings on the mast ────────────────────────────────────────
    g.lineStyle(3, 0x6B6B6B, 1);
    [0.55, 0.65, 0.75].forEach(t => {
      const py = mastH + (mastTopY - mastH) * (1 - t);
      g.lineBetween(baseW / 2 - 10, py, baseW / 2 + 10, py);
    });

    g.generateTexture('radio_tower', towerW, towerH);
    g.destroy();

    this.add.image(towerX, 0, 'radio_tower').setOrigin(0, 0).setDepth(4);

    // ── Blinking red warning light at mast tip ────────────────────────────
    const light = this.add.circle(
      towerX + towerW / 2,
      mastTopY,              // world-space Y matches generated texture top
      4,
      0xFF2222,
    ).setDepth(5);
    this.tweens.add({
      targets: light,
      alpha: 0,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ── Invisible trigger zone at tower base ──────────────────────────────
    const trigger = this.add.rectangle(towerX, 0, towerW, groundY, 0x000000, 0)
      .setOrigin(0, 0);
    this.physics.add.existing(trigger, true);
    this.towerTrigger = trigger;
  }
}
