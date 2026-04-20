/** Shared gameplay constants used across all Level scenes. */

export const PLAYER_SPEED     = 200;
export const PLAYER_RUN_SPEED = 400;
export const JUMP_VELOCITY    = -700;

export const ANIMS = {
  idle: { start: 0,  end: 2,  frameRate: 1,  repeat: -1 },
  walk: { start: 0,  end: 5,  frameRate: 8,  repeat: -1 },
  run:  { start: 6,  end: 11, frameRate: 12, repeat: -1 },
  jump: { start: 14, end: 16, frameRate: 10, repeat: 0  },
};
