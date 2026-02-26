

export type LaneType = 'grass' | 'road' | 'water' | 'rail';
export type ObstacleType = 'car' | 'truck' | 'log' | 'turtle' | 'lilypad' | 'train' | 'tree' | 'stone' | 'bush' | 'stump' | 'traffic_cone' | 'abandoned_bus' | 'black_cube';

export type PowerUpType = 'shield' | 'speed' | 'multiplier';
export type DecorationType = 'flower' | 'pebble' | 'grass_tuft' | 'oil_spill';

export type ChickenBreed = 'CLASSIC' | 'SILKIE' | 'ROOSTER' | 'VOID';
export type CosmeticItem = 'NONE' | 'TOP_HAT' | 'SUNGLASSES' | 'CROWN' | 'HEADPHONES';

export enum DifficultyLevel {
  NORMAL = 'NORMAL',
  IMPOSSIBLE = 'IMPOSSIBLE',
  IMPOSSIBLE_X2 = 'IMPOSSIBLE_X2',
  CHUCK_NORRIS = 'CHUCK_NORRIS'
}

export interface Decoration {
  id: number;
  x: number;
  yOffset: number;
  type: DecorationType;
  color: string;
  gridX?: number; // Added for precise interaction checking (oil spill)
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  // Advanced Physics
  type?: 'simple' | 'debris' | 'smoke' | 'fire';
  rotation?: number;
  rotationSpeed?: number;
  gravity?: number;
  drag?: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
}

export interface PowerUp {
  id: number;
  type: PowerUpType;
  x: number;
  gridX: number;
  collected?: boolean; // Visual flag for animation/removal
}

export interface Obstacle {
  id: number;
  x: number;
  width: number;
  speed: number;
  type: ObstacleType;
  color?: { top: string; side: string; wheel: string };
  // For static objects
  gridX?: number;
  // For car variant
  carType?: number; 
  // For train variants
  trainVariant?: 'standard' | 'freight' | 'bullet';
  // State
  dead?: boolean; // For destroyed cars (shield collision)
  // For shooting obstacles
  shootTimer?: number;
}

export interface Lane {
  id: number;
  y: number; // The logical grid row index (0 is start)
  type: LaneType;
  obstacles: Obstacle[];
  powerUps: PowerUp[];
  decorations: Decoration[];
  speed: number;
  direction: -1 | 1;
  trafficLightState?: 'green' | 'red' | 'warning'; // For trains
  trafficTimer?: number;
  trafficGreenDuration?: number; // How long the light stays green (difficulty dependent)
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: number; // Player ID
  active: boolean;
}

export interface Player {
  id: number;
  // Logical Position
  gridX: number; 
  gridY: number; 
  
  // Visual Position
  x: number; 
  y: number; 
  z: number; // Vertical hop height
  scale: { x: number, y: number }; // Squash and stretch
  rotation: number; // For death animation
  
  // Animation State
  isMoving: boolean;
  moveProgress: number; // 0.0 to 1.0
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  
  // Input Buffering
  nextMove: string | null;
  
  // State
  facing: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
  dead: boolean;
  active: boolean; // For co-op, is player currently in game?
  respawnTimer: number; // Frames until respawn
  health: number;
  maxHealth: number;
  invincibleTimer: number;
  colorProfile: 'DEFAULT' | 'P2';

  // Customization
  breed: ChickenBreed;
  cosmetic: CosmeticItem;

  // Log Mechanics
  onLog: boolean;
  logSpeed: number;

  // Idle Mechanics
  idleTimer: number;

  // Power Ups
  powerUpState: {
    shield: boolean;
    speedTimer: number;
    multiplierTimer: number;
    hasGun: boolean;
    ammo: number;
  };
}

export interface Enemy {
  id: number;
  x: number;
  y: number;
  speed: number;
  type: 'chaser';
  facing: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN';
  active: boolean;
  targetPlayerId?: number;
}

export interface GameState {
  mode: 'SINGLE' | 'COOP';
  difficulty: DifficultyLevel;
  lanes: Lane[];
  players: Player[]; // Array of players
  enemies: Enemy[];
  score: number;
  highScore: number;
  cameraY: number;
  frameCount: number;
  projectiles: Projectile[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  shake: number;
}
