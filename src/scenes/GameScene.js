export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    this.load.spritesheet('salvius', '/images/salvius-sprite.png', {
      frameWidth: 340,
      frameHeight: 450,
    });
  }

  create() {
    const { width, height } = this.scale;
    const groundY = height - 60;

    // Ground
    this.add.rectangle(0, groundY, width, 8, 0x4caf50).setOrigin(0, 0);
    this.add.rectangle(0, groundY + 8, width, height - groundY - 8, 0x5c4033).setOrigin(0, 0);

    // Animations — spritesheet is 6 cols × 3 rows, 256×256 per frame
    // Row 0 (frames 0–5): idle / walk cycle
    // Row 1 (frames 6–11): run cycle
    // Row 2 (frames 12–17): action / lunge
    this.anims.create({
      key: 'idle',
      frames: this.anims.generateFrameNumbers('salvius', { start: 0, end: 2 }),
      frameRate: 1,
      repeat: -1,
    });

    this.anims.create({
      key: 'walk',
      frames: this.anims.generateFrameNumbers('salvius', { start: 0, end: 5 }),
      frameRate: 8,
      repeat: -1,
    });

    // Row 1 (frames 6–11) + Row 2 (frames 12–11): run cycle
    this.anims.create({
      key: 'run',
      frames: this.anims.generateFrameNumbers('salvius', { start: 6, end: 11 }),
      frameRate: 12,
      repeat: -1,
    });

    // Player — scaled to 0.5 so each visible frame is ~128px, origin at bottom-centre
    this.player = this.add
      .sprite(width / 4, groundY, 'salvius')
      .setOrigin(0.5, 1)
      .setScale(0.5);
    this.player.play('idle');

    this.cursors = this.input.keyboard.createCursorKeys();
    this.shiftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.playerSpeed = 200; // px/s
    this.playerRunSpeed = 400; // px/s
    this.groundY = groundY;
    this.velocityY = 0;
    this.isOnGround = true;
    this.gravity = 1200;  // px/s²
    this.jumpSpeed = -700; // px/s (negative = upward)
  }

  update(_time, delta) {
    const { width } = this.scale;
    const dt = delta / 1000;

    // Jump
    if (Phaser.Input.Keyboard.JustDown(this.cursors.up) && this.isOnGround) {
      this.velocityY = this.jumpSpeed;
      this.isOnGround = false;
    }

    // Gravity & vertical movement
    this.velocityY += this.gravity * dt;
    this.player.y += this.velocityY * dt;

    // Land on ground
    if (this.player.y >= this.groundY) {
      this.player.y = this.groundY;
      this.velocityY = 0;
      this.isOnGround = true;
    }

    const left = this.cursors.left.isDown;
    const right = this.cursors.right.isDown;
    const running = this.shiftKey.isDown;
    const speed = running ? this.playerRunSpeed : this.playerSpeed;
    const moveAnim = running ? 'run' : 'walk';

    if (left && !right) {
      this.player.x -= speed * dt;
      this.player.setFlipX(true);
      if (this.isOnGround && this.player.anims.currentAnim?.key !== moveAnim) {
        this.player.play(moveAnim);
      }
    } else if (right && !left) {
      this.player.x += speed * dt;
      this.player.setFlipX(false);
      if (this.isOnGround && this.player.anims.currentAnim?.key !== moveAnim) {
        this.player.play(moveAnim);
      }
    } else {
      if (this.isOnGround && this.player.anims.currentAnim?.key !== 'idle') {
        this.player.play('idle');
      }
    }

    // Keep Salvius within the visible canvas
    const halfW = this.player.displayWidth / 2;
    this.player.x = Phaser.Math.Clamp(this.player.x, halfW, width - halfW);
  }
}
