

export const TILE_SIZE = 40;
export const CANVAS_WIDTH = 800; // Restored to PC Width
export const CANVAS_HEIGHT = 600; // Restored to PC Height
export const LANE_GENERATION_BUFFER = 20; // How many lanes ahead to generate

// Animation
export const MOVE_DURATION = 5; // Frames to complete a hop (Base speed) - Faster/Snappier

// Power-ups
export const POWERUP_DURATION = 600; // Frames (~10 seconds at 60fps)

// Co-op
export const RESPAWN_TIME = 300; // 5 seconds cooldown before you can find a bus

export const COLORS = {
  // Environment
  GRASS_LIGHT: '#84cc16', // lime-500
  GRASS_DARK: '#65a30d',  // lime-600
  GRASS_SIDE: '#4d7c0f',  // Darker side for 3d effect
  
  MUD_LIGHT: '#78350f',
  MUD_DARK: '#451a03',
  MUD_SIDE: '#290f02',

  ROCK_LIGHT: '#94a3b8',
  ROCK_DARK: '#64748b',
  ROCK_SIDE: '#475569',

  SNOW_LIGHT: '#f8fafc',
  SNOW_DARK: '#e2e8f0',
  SNOW_SIDE: '#cbd5e1',

  SAND_LIGHT: '#fde047',
  SAND_DARK: '#facc15',
  SAND_SIDE: '#eab308',
  
  ROAD: '#334155',        // slate-700
  ROAD_MARKING: '#94a3b8',
  
  WATER: '#38bdf8',       // sky-400
  WATER_SIDE: '#0ea5e9',
  
  RAIL: '#78350f',
  RAIL_METAL: '#525252',
  RAIL_WOOD: '#3f2c22',
  
  // Objects
  TREE_TRUNK: '#713f12', // amber-900
  TREE_LEAVES: '#166534', // green-800
  TREE_LEAVES_LIGHT: '#22c55e', // green-500
  
  BUSH_MAIN: '#15803d', // green-700
  BUSH_LIGHT: '#4ade80', // green-400
  
  STUMP_TOP: '#d6d3d1', // stone-300
  STUMP_SIDE: '#57534e', // stone-600

  STONE: '#94a3b8', // slate-400
  STONE_SIDE: '#64748b', // slate-500
  
  LOG: '#78350f',
  LOG_SIDE: '#451a03',
  LOG_END: '#92400e',

  TURTLE_SHELL: '#15803d', // green-700
  TURTLE_SKIN: '#86efac', // green-300

  LILYPAD_DARK: '#15803d', // green-700
  LILYPAD_LIGHT: '#4ade80', // green-400
  LILYPAD_FLOWER: '#f472b6', // pink-400
  
  // Interactive
  CONE_ORANGE: '#f97316', // orange-500
  CONE_WHITE: '#f1f5f9', // slate-100
  OIL_SPILL: '#0f172a', // slate-900
  
  ABANDONED_BUS_BODY: '#d97706', // amber-600 (rusty)
  ABANDONED_BUS_WINDOW: '#451a03', // very dark amber/brown
  
  // Power-ups
  POWERUP_SHIELD: '#3b82f6', // blue-500
  POWERUP_SHIELD_GLOW: '#60a5fa', // blue-400
  POWERUP_SPEED: '#f59e0b', // amber-500
  POWERUP_MULTI: '#d946ef', // fuchsia-500

  // Vehicles
  CAR_COLORS: [
    { top: '#ef4444', side: '#b91c1c', wheel: '#171717' }, // Red
    { top: '#3b82f6', side: '#1d4ed8', wheel: '#171717' }, // Blue
    { top: '#eab308', side: '#a16207', wheel: '#171717' }, // Yellow
    { top: '#a855f7', side: '#7e22ce', wheel: '#171717' }, // Purple
    { top: '#f97316', side: '#ea580c', wheel: '#171717' }, // Orange
    { top: '#ec4899', side: '#db2777', wheel: '#171717' }, // Pink
  ],

  TRUCK_CAB: '#3b82f6', 
  TRUCK_TRAILER: '#e2e8f0', 
  
  TRAIN_TOP: '#dc2626',
  TRAIN_SIDE: '#991b1b',
  TRAIN_STRIPE: '#feca1d',

  // Train Variants
  TRAIN_FREIGHT_ENGINE: '#1e293b', // slate-800
  TRAIN_FREIGHT_CONTAINERS: ['#3b82f6', '#ef4444', '#eab308', '#22c55e'],
  
  TRAIN_BULLET_BODY: '#e2e8f0', // slate-200
  TRAIN_BULLET_STRIPE: '#0ea5e9', // sky-500
  TRAIN_BULLET_WINDOW: '#1e293b', // slate-800

  // Chicken P1 (Yellow)
  CHICKEN_BODY: '#fef08a', // yellow-200
  CHICKEN_SIDE: '#fde047', // yellow-300
  CHICKEN_BEAK: '#f97316',
  CHICKEN_COMB: '#ef4444',
  CHICKEN_LEG: '#f97316',

  // Chicken P2 (Blue/White)
  CHICKEN_P2_BODY: '#e2e8f0', // slate-200
  CHICKEN_P2_SIDE: '#cbd5e1', // slate-300
  CHICKEN_P2_COMB: '#3b82f6', // blue-500
  CHICKEN_P2_BEAK: '#fcd34d', // amber-300
  CHICKEN_P2_LEG: '#f97316',

  // Decorations
  FLOWER_COLORS: ['#f472b6', '#fbbf24', '#cbd5e1', '#a78bfa', '#f87171'], // Pink, Amber, Slate-white, Purple, Red
  PEBBLE_COLORS: ['#78716c', '#57534e', '#a8a29e'],
};

export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

export enum GameStatus {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export enum GameMode {
  SINGLE = 'SINGLE',
  COOP = 'COOP'
}
