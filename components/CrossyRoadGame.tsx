import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, RotateCcw, Trophy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Gamepad2, Shield, Zap, Users, User, Bus } from 'lucide-react';
import { 
  TILE_SIZE, 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  COLORS, 
  GameStatus, 
  GameMode,
  LANE_GENERATION_BUFFER,
  MOVE_DURATION,
  POWERUP_DURATION,
  RESPAWN_TIME
} from '../constants';
import { Lane, Player, LaneType, Obstacle, GameState, PowerUp, PowerUpType, Decoration, DecorationType, Particle, DifficultyLevel, ChickenBreed, CosmeticItem } from '../types';

// --- Helper Functions ---

const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;
const randomInt = (min: number, max: number) => Math.floor(randomRange(min, max));
const randomChoice = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const SEASONS = [
  { // SPRING
    GRASS_LIGHT: '#84cc16',
    GRASS_DARK: '#65a30d',
    GRASS_SIDE: '#4d7c0f',
    TREE_LEAVES: '#166534',
    TREE_LEAVES_LIGHT: '#22c55e',
    BUSH_MAIN: '#15803d',
    BUSH_LIGHT: '#4ade80',
    WATER: '#38bdf8',
    WATER_SIDE: '#0ea5e9'
  },
  { // SUMMER
    GRASS_LIGHT: '#a3e635',
    GRASS_DARK: '#84cc16',
    GRASS_SIDE: '#65a30d',
    TREE_LEAVES: '#15803d',
    TREE_LEAVES_LIGHT: '#4ade80',
    BUSH_MAIN: '#16a34a',
    BUSH_LIGHT: '#86efac',
    WATER: '#0ea5e9',
    WATER_SIDE: '#0284c7'
  },
  { // AUTUMN
    GRASS_LIGHT: '#fcd34d',
    GRASS_DARK: '#f59e0b',
    GRASS_SIDE: '#d97706',
    TREE_LEAVES: '#c2410c',
    TREE_LEAVES_LIGHT: '#ea580c',
    BUSH_MAIN: '#b45309',
    BUSH_LIGHT: '#f59e0b',
    WATER: '#38bdf8',
    WATER_SIDE: '#0ea5e9'
  },
  { // WINTER
    GRASS_LIGHT: '#e0f2fe',
    GRASS_DARK: '#bae6fd',
    GRASS_SIDE: '#7dd3fc',
    TREE_LEAVES: '#f8fafc',
    TREE_LEAVES_LIGHT: '#ffffff',
    BUSH_MAIN: '#e2e8f0',
    BUSH_LIGHT: '#f1f5f9',
    WATER: '#7dd3fc',
    WATER_SIDE: '#38bdf8'
  }
];

const lerpColor = (a: string, b: string, amount: number) => {
    const ah = parseInt(a.replace(/#/g, ''), 16),
        ar = ah >> 16, ag = ah >> 8 & 0xff, ab = ah & 0xff,
        bh = parseInt(b.replace(/#/g, ''), 16),
        br = bh >> 16, bg = bh >> 8 & 0xff, bb = bh & 0xff,
        rr = Math.round(ar + amount * (br - ar)),
        rg = Math.round(ag + amount * (bg - ag)),
        rb = Math.round(ab + amount * (bb - ab));
    return '#' + ((1 << 24) + (rr << 16) + (rg << 8) + rb).toString(16).slice(1);
};

let obstacleIdCounter = 0;
let powerUpIdCounter = 0;
let particleIdCounter = 0;
let floatTextIdCounter = 0;
let decorationIdCounter = 0;

const generateLane = (index: number, difficultyLevel: DifficultyLevel = DifficultyLevel.NORMAL): Lane => {
  // First few lanes are always grass
  if (index < 3) {
    return { id: index, y: index, type: 'grass', obstacles: [], powerUps: [], decorations: [], speed: 0, direction: 1 };
  }

  // --- Difficulty Scaling ---
  let diffMultiplier = 1;
  switch (difficultyLevel) {
      case DifficultyLevel.NORMAL: diffMultiplier = 1; break;
      case DifficultyLevel.IMPOSSIBLE: diffMultiplier = 2.5; break;
      case DifficultyLevel.IMPOSSIBLE_X2: diffMultiplier = 5.0; break;
      case DifficultyLevel.CHUCK_NORRIS: diffMultiplier = 10.0; break;
  }

  const difficulty = Math.min(index / (150 / diffMultiplier), 1); // 0.0 to 1.0
  const speedScaling = index * 0.02 * diffMultiplier; // Infinite speed scaling

  const typeProb = Math.random();
  let type: LaneType = 'grass';
  
  const grassThresh = Math.max(0.05, 0.25 - (difficulty * 0.20));
  const roadThresh = grassThresh + 0.35 + (difficulty * 0.10);
  const waterThresh = roadThresh + 0.20 + (difficulty * 0.15);

  if (typeProb < grassThresh) type = 'grass';
  else if (typeProb < roadThresh) type = 'road';
  else if (typeProb < waterThresh) type = 'water';
  else type = 'rail';

  const direction = Math.random() > 0.5 ? 1 : -1;
  const baseSpeed = randomRange(2, 4.5) + speedScaling; 
  
  const obstacles: Obstacle[] = [];
  const powerUps: PowerUp[] = [];
  const decorations: Decoration[] = [];
  
  if (type === 'grass') {
    for (let k = 0; k < CANVAS_WIDTH / TILE_SIZE; k++) {
       const cellOccupied = Math.random() < 0.15;
       
       if (cellOccupied) { 
          const obsRoll = Math.random();
          let obsType: 'tree' | 'stone' | 'bush' | 'stump' | 'traffic_cone' | 'black_cube' = 'tree';
          
          if (obsRoll < 0.45) obsType = 'tree';
          else if (obsRoll < 0.65) obsType = 'stone';
          else if (obsRoll < 0.8) obsType = 'bush';
          else if (obsRoll < 0.9) obsType = 'stump';
          else if (obsRoll < 0.95) obsType = 'traffic_cone';
          else obsType = 'black_cube'; // 5% chance

          obstacles.push({
            id: obstacleIdCounter++,
            x: k * TILE_SIZE,
            gridX: k,
            width: TILE_SIZE,
            speed: 0,
            type: obsType,
            shootTimer: obsType === 'black_cube' ? randomInt(60, 180) : undefined
          });
       } else {
          // Powerups
          if (Math.random() < 0.02) {
             const puRoll = Math.random();
             let puType: PowerUpType = 'shield';
             if (puRoll < 0.4) puType = 'speed';
             else if (puRoll < 0.7) puType = 'multiplier';
             
             powerUps.push({
               id: powerUpIdCounter++,
               type: puType,
               gridX: k,
               x: k * TILE_SIZE
             });
          } else {
             // Decorations
             if (Math.random() < 0.4) {
                const decRoll = Math.random();
                let decType: DecorationType = 'grass_tuft';
                let decColor = '#4d7c0f';

                if (decRoll < 0.3) {
                   decType = 'flower';
                   decColor = randomChoice(COLORS.FLOWER_COLORS);
                } else if (decRoll < 0.5) {
                   decType = 'pebble';
                   decColor = randomChoice(COLORS.PEBBLE_COLORS);
                } else {
                   decType = 'grass_tuft';
                   decColor = '#4d7c0f'; 
                }

                decorations.push({
                   id: decorationIdCounter++,
                   x: k * TILE_SIZE + randomRange(5, TILE_SIZE - 5),
                   yOffset: randomRange(5, TILE_SIZE - 5),
                   type: decType,
                   color: decColor
                });
                
                if (Math.random() < 0.3 && decType !== 'pebble') {
                    decorations.push({
                       id: decorationIdCounter++,
                       x: k * TILE_SIZE + randomRange(5, TILE_SIZE - 5),
                       yOffset: randomRange(5, TILE_SIZE - 5),
                       type: decType,
                       color: decType === 'flower' ? randomChoice(COLORS.FLOWER_COLORS) : decColor
                    });
                }
             }
          }
       }
    }
  } else if (type === 'road') {
    // Road Decorations (Oil Spills)
    if (Math.random() < 0.3) {
        const oilX = randomInt(0, Math.floor(CANVAS_WIDTH / TILE_SIZE));
        decorations.push({
            id: decorationIdCounter++,
            x: oilX * TILE_SIZE, 
            gridX: oilX,
            yOffset: 0,
            type: 'oil_spill',
            color: COLORS.OIL_SPILL
        });
    }

    const maxCars = 4 + Math.floor(difficulty * 5); 
    const numCars = randomInt(3, Math.min(8, maxCars));
    
    let currentX = randomRange(0, 200);
    const laneSpeed = baseSpeed * (Math.random() < 0.3 ? 1.5 : 1);
    
    for (let i = 0; i < numCars; i++) {
      const isTruck = Math.random() < 0.25;
      const minSpacing = Math.max(150, 250 - (difficulty * 120));
      const maxSpacing = Math.max(250, 400 - (difficulty * 180));
      currentX += randomRange(minSpacing, maxSpacing);
      
      if (currentX > CANVAS_WIDTH + 200) break;

      obstacles.push({
        id: obstacleIdCounter++,
        x: currentX, 
        width: isTruck ? TILE_SIZE * 3 : TILE_SIZE * 2, 
        speed: laneSpeed, 
        type: isTruck ? 'truck' : 'car',
        color: randomChoice(COLORS.CAR_COLORS)
      });
    }
  } else if (type === 'water') {
    const roll = Math.random();
    let laneSubtype: 'log' | 'turtle' | 'lilypad' = 'log';
    if (roll < 0.15) laneSubtype = 'lilypad';
    else if (roll < 0.35) laneSubtype = 'turtle';

    const laneSpeed = laneSubtype === 'lilypad' ? 0 : baseSpeed * 0.8;

    if (laneSubtype === 'lilypad') {
        let gapCount = 0;
        for (let k = 0; k < CANVAS_WIDTH / TILE_SIZE; k++) {
            // ~30% chance of a pad per tile, strict grid alignment
            // Safety: Ensure we don't have gaps > 2 tiles
            let spawn = Math.random() < 0.3;
            if (gapCount >= 2) spawn = true;

            if (spawn) {
                obstacles.push({
                    id: obstacleIdCounter++,
                    x: k * TILE_SIZE,
                    width: TILE_SIZE,
                    speed: 0,
                    type: 'lilypad'
                });
                gapCount = 0;
            } else {
                gapCount++;
            }
        }
    } else {
        // Fill the lane logic for Logs/Turtles
        // Start slightly off-screen to the left to ensure coverage
        let currentX = -randomRange(50, 200);
        
        while (currentX < CANVAS_WIDTH + 200) {
            let width = TILE_SIZE * 3;
            if (laneSubtype === 'turtle') {
                width = randomInt(2, 4) * TILE_SIZE;
            } else {
                const sizeRoll = Math.random();
                if (sizeRoll < 0.3) width = TILE_SIZE * 3;
                else if (sizeRoll < 0.7) width = TILE_SIZE * 4;
                else width = TILE_SIZE * 5;
            }

            obstacles.push({
                id: obstacleIdCounter++,
                x: currentX,
                width: width,
                speed: laneSpeed,
                type: laneSubtype,
            });

            // Playable Gap: 1.5 to 3.5 tiles (60px to 140px)
            const gap = randomRange(60, 150);
            currentX += width + gap;
        }
    }
  }

  const greenDuration = Math.max(40, 200 - (difficulty * 120));

  return {
    id: index,
    y: index,
    type,
    obstacles,
    powerUps,
    decorations,
    speed: baseSpeed,
    direction,
    trafficLightState: 'green',
    trafficTimer: 0,
    trafficGreenDuration: greenDuration
  };
};

const createPlayer = (id: number, startXGrid: number, profile: 'DEFAULT' | 'P2', breed: ChickenBreed = 'CLASSIC', cosmetic: CosmeticItem = 'NONE'): Player => ({
  id,
  gridX: startXGrid, 
  gridY: 0, 
  x: startXGrid * TILE_SIZE, 
  y: 0, 
  z: 0,
  scale: { x: 1, y: 1 },
  rotation: 0,
  isMoving: false, moveProgress: 0, 
  startX: 0, startY: 0, targetX: 0, targetY: 0,
  nextMove: null,
  facing: 'UP', dead: false, active: true, respawnTimer: 0,
  health: 3, maxHealth: 3, invincibleTimer: 0,
  onLog: false, logSpeed: 0,
  idleTimer: 0,
  colorProfile: profile,
  breed,
  cosmetic,
  powerUpState: { shield: false, speedTimer: 0, multiplierTimer: 0, hasGun: true, ammo: 999 }
});

const CrossyRoadGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<GameStatus>(GameStatus.MENU);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [selectedMode, setSelectedMode] = useState<GameMode>(GameMode.SINGLE);
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(DifficultyLevel.NORMAL);
  const [selectedBreed, setSelectedBreed] = useState<ChickenBreed>('CLASSIC');
  const [selectedCosmetic, setSelectedCosmetic] = useState<CosmeticItem>('NONE');
  const [showCustomization, setShowCustomization] = useState(false);
  
  // Track player stats for HUD
  const [playerStats, setPlayerStats] = useState<{p1Shield: boolean, p2Shield: boolean, p1Respawn: number, p2Respawn: number, p1Health: number, p2Health: number}>({
      p1Shield: false, p2Shield: false, p1Respawn: 0, p2Respawn: 0, p1Health: 3, p2Health: 3
  });

  const [activePowerUps, setActivePowerUps] = useState({ shield: false, speed: 0, multi: 0 });

  const gameState = useRef<GameState>({
    mode: GameMode.SINGLE,
    difficulty: DifficultyLevel.NORMAL,
    lanes: [],
    players: [],
    enemies: [],
    cameraY: 0,
    frameCount: 0,
    score: 0,
    highScore: 0,
    particles: [],
    floatingTexts: [],
    shake: 0
  });

  const requestRef = useRef<number>(0);

  // --- Particle System ---
  const spawnParticles = (x: number, y: number, color: string, count: number, speed: number = 1) => {
    for (let i = 0; i < count; i++) {
      gameState.current.particles.push({
        id: particleIdCounter++,
        x, y,
        vx: (Math.random() - 0.5) * 5 * speed,
        vy: (Math.random() - 0.5) * 5 * speed - 2,
        life: randomRange(20, 40),
        maxLife: 40,
        color: color,
        size: randomRange(2, 5),
        type: 'simple',
        gravity: 0.2
      });
    }
  };

  const spawnVehicleExplosion = (x: number, y: number, color: string, width: number) => {
    gameState.current.shake = 15;
    // Debris
    for (let i = 0; i < 8; i++) {
      gameState.current.particles.push({
        id: particleIdCounter++,
        x: x + randomRange(0, width),
        y: y + randomRange(0, TILE_SIZE),
        vx: (Math.random() - 0.5) * 15,
        vy: -randomRange(5, 12),
        life: randomRange(40, 60),
        maxLife: 60,
        color: color,
        size: randomRange(4, 8),
        type: 'debris',
        gravity: 0.4,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.5,
        drag: 0.98
      });
    }
    // Wheels
    for (let i = 0; i < 3; i++) {
       gameState.current.particles.push({
        id: particleIdCounter++,
        x: x + randomRange(0, width),
        y: y + TILE_SIZE,
        vx: (Math.random() - 0.5) * 10,
        vy: -randomRange(8, 15),
        life: randomRange(40, 60),
        maxLife: 60,
        color: '#171717',
        size: randomRange(5, 7),
        type: 'debris',
        gravity: 0.4,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.4,
        drag: 0.99
      });
    }
    // Smoke
    for (let i = 0; i < 12; i++) {
       const isFire = Math.random() < 0.4;
       gameState.current.particles.push({
         id: particleIdCounter++,
         x: x + randomRange(0, width),
         y: y + randomRange(0, TILE_SIZE),
         vx: (Math.random() - 0.5) * 2,
         vy: -randomRange(1, 4), 
         life: randomRange(30, 50),
         maxLife: 50,
         color: isFire ? '#fbbf24' : '#94a3b8', 
         size: randomRange(6, 12),
         type: isFire ? 'fire' : 'smoke',
         gravity: -0.05,
         drag: 0.95,
         rotation: Math.random() * Math.PI * 2,
         rotationSpeed: (Math.random() - 0.5) * 0.1
       });
    }
  };

  const spawnFloatingText = (x: number, y: number, text: string, color: string) => {
     gameState.current.floatingTexts.push({
       id: floatTextIdCounter++,
       x, y,
       text,
       color,
       life: 60,
       maxLife: 60,
       vy: -1
     });
  };

  // --- Game Control ---

  const initGame = useCallback((mode: GameMode, difficulty: DifficultyLevel) => {
    const initialLanes = [];
    for (let i = 0; i < LANE_GENERATION_BUFFER; i++) {
      initialLanes.push(generateLane(i, difficulty));
    }

    const storedHS = localStorage.getItem('chicken_hs');
    const loadedHS = storedHS ? parseInt(storedHS, 10) : 0;
    setHighScore(loadedHS);

    const startXGrid = Math.floor(CANVAS_WIDTH / TILE_SIZE / 2);

    const players: Player[] = [];
    players.push(createPlayer(0, startXGrid, 'DEFAULT', selectedBreed, selectedCosmetic));
    
    if (mode === GameMode.COOP) {
        players.push(createPlayer(1, startXGrid - 1, 'P2', selectedBreed, selectedCosmetic)); // Player 2 slightly to the left
    }

    gameState.current = {
      mode,
      difficulty,
      lanes: initialLanes,
      players,
      cameraY: 0,
      frameCount: 0,
      score: 0,
      highScore: loadedHS,
      particles: [],
      projectiles: [],
      floatingTexts: [],
      shake: 0
    };
    setScore(0);
    setPlayerStats({ p1Shield: false, p2Shield: false, p1Respawn: 0, p2Respawn: 0, p1Health: 3, p2Health: 3 });
    setActivePowerUps({ shield: false, speed: 0, multi: 0 });
    setStatus(GameStatus.PLAYING);
  }, [selectedBreed, selectedCosmetic]);

  // --- Movement Logic ---

  const attemptMove = (playerId: number, key: string) => {
    const state = gameState.current;
    const player = state.players[playerId];
    if (!player || player.dead || !player.active) return;
    
    if (state.lanes.length === 0) return;

    let dX = 0;
    let dY = 0;
    let newFacing = player.facing;

    if (key === 'UP') { dY = 1; newFacing = 'UP'; }
    else if (key === 'DOWN') { dY = -1; newFacing = 'DOWN'; }
    else if (key === 'LEFT') { dX = -1; newFacing = 'LEFT'; }
    else if (key === 'RIGHT') { dX = 1; newFacing = 'RIGHT'; }
    else if (key === 'SLIDE') {
        // Random Slip
        const options = [
            { dX: 0, dY: 1, f: 'UP' },
            { dX: 0, dY: -1, f: 'DOWN' },
            { dX: -1, dY: 0, f: 'LEFT' },
            { dX: 1, dY: 0, f: 'RIGHT' }
        ];
        const choice = randomChoice(options);
        dX = choice.dX; 
        dY = choice.dY; 
        newFacing = choice.f as any;
    }
    else return;

    player.facing = newFacing;

    const currentGridX = Math.round(player.x / TILE_SIZE);
    const newGridX = currentGridX + dX;
    const newGridY = player.gridY + dY;

    // 1. Boundary Checks
    const maxTilesX = Math.floor(CANVAS_WIDTH / TILE_SIZE);
    if (newGridX < 0 || newGridX >= maxTilesX) return;
    if (newGridY < 0) return; // Can't go backwards indefinitely? Or just block start

    // 2. Obstacle Check
    const targetLane = state.lanes.find(l => l.y === newGridY);
    if (targetLane && targetLane.type === 'grass') {
       const obstacle = targetLane.obstacles.find(o => o.gridX === newGridX);
       if (obstacle) {
           if (obstacle.type === 'traffic_cone') {
               obstacle.dead = true;
               targetLane.obstacles = targetLane.obstacles.filter(o => o !== obstacle);
               spawnParticles(newGridX * TILE_SIZE + TILE_SIZE/2, newGridY * TILE_SIZE + TILE_SIZE/2, COLORS.CONE_ORANGE, 8);
               spawnFloatingText(newGridX * TILE_SIZE, newGridY * TILE_SIZE, "PUNCH!", '#fff');
               state.shake = 2; 
           } else {
               return; // Blocked (Tree, Stone, Bus)
           }
       }
    }

    // 3. Initiate Move
    player.isMoving = true;
    player.moveProgress = 0;
    player.idleTimer = 0;
    
    player.startX = player.x; 
    player.startY = player.y; 
    
    player.gridX = newGridX;
    player.gridY = newGridY;
    
    if (dX !== 0) player.targetX = player.x + (dX * TILE_SIZE);
    else player.targetX = player.x;
    
    player.targetY = newGridY * TILE_SIZE;
    player.scale = { x: 1.3, y: 0.7 };

    // Update Global Score if this player pushed further
    if (newGridY > state.score) {
      const multiplier = player.powerUpState.multiplierTimer > 0 ? 2 : 1;
      const scoreDiff = (1 * multiplier);
      const newScore = state.score + scoreDiff;
      state.score = newScore;
      setScore(newScore);
      
      // Decrease respawn timer for dead players based on score
      state.players.forEach(p => {
          if (p.dead && p.respawnTimer > 0) {
              p.respawnTimer -= scoreDiff;
          }
      });
    }

    const lastLane = state.lanes[state.lanes.length - 1];
    if (lastLane && player.gridY + LANE_GENERATION_BUFFER > lastLane.y) {
       state.lanes.push(generateLane(lastLane.y + 1, state.difficulty));
    }
    if (state.lanes.length > 50) state.lanes.shift();
  };

  const handleInput = useCallback((key: string) => {
    if (status !== GameStatus.PLAYING) return;
    const { players, mode } = gameState.current;
    
    let p1Action: string | null = null;
    let p2Action: string | null = null;

    // Player 1 Controls (WASD)
    if (key === 'w') p1Action = 'UP';
    if (key === 's') p1Action = 'DOWN';
    if (key === 'a') p1Action = 'LEFT';
    if (key === 'd') p1Action = 'RIGHT';
    if (key === ' ') shoot(0); // Space to shoot

    // Arrow Controls
    let arrowAction: string | null = null;
    if (key === 'ArrowUp') arrowAction = 'UP';
    if (key === 'ArrowDown') arrowAction = 'DOWN';
    if (key === 'ArrowLeft') arrowAction = 'LEFT';
    if (key === 'ArrowRight') arrowAction = 'RIGHT';
    if (key === 'Enter') shoot(mode === GameMode.SINGLE ? 0 : 1); // Enter to shoot (P1 in single, P2 in coop)

    // Route inputs
    if (mode === GameMode.SINGLE) {
        // In Single Player, both WASD and Arrows control Player 1
        const action = p1Action || arrowAction;
        if (action) {
            if (players[0].isMoving) players[0].nextMove = action;
            else attemptMove(0, action);
        }
    } else {
        // Co-op
        if (p1Action) {
             if (players[0].isMoving) players[0].nextMove = p1Action;
             else attemptMove(0, p1Action);
        }
        if (arrowAction && players.length > 1) {
             if (players[1].isMoving) players[1].nextMove = arrowAction;
             else attemptMove(1, arrowAction);
        }
    }

  }, [status]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => handleInput(e.key);
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInput]);


  const shoot = (playerId: number) => {
      const player = gameState.current.players[playerId];
      if (!player || player.dead || !player.active) return;
      
      // Infinite ammo for now, or check ammo if desired
      // if (player.powerUpState.ammo <= 0) return;

      const speed = 15;
      let vx = 0;
      let vy = 0;

      if (player.facing === 'UP') vy = 1;
      else if (player.facing === 'DOWN') vy = -1;
      else if (player.facing === 'LEFT') vx = -1;
      else if (player.facing === 'RIGHT') vx = 1;

      gameState.current.projectiles.push({
          id: Date.now() + Math.random(),
          x: player.x + TILE_SIZE/2,
          y: player.y + TILE_SIZE/2,
          vx: vx * speed,
          vy: vy * speed,
          ownerId: playerId,
          active: true
      });
      
      // Recoil effect
      player.scale = { x: 1.2, y: 0.8 };
  };

  const update = useCallback(() => {
    const state = gameState.current;
    const { players, lanes, mode } = state;
    state.frameCount++;

    if (state.shake > 0) {
        state.shake *= 0.9;
        if (state.shake < 0.5) state.shake = 0;
    }

    // --- Particle Updates ---
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.drag) { p.vx *= p.drag; p.vy *= p.drag; }
      if (p.gravity) p.vy += p.gravity;
      if (p.rotation !== undefined && p.rotationSpeed !== undefined) p.rotation += p.rotationSpeed;
      if (p.type === 'smoke' || p.type === 'fire') p.size *= 1.02;
      p.life--;
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    for (let i = state.floatingTexts.length - 1; i >= 0; i--) {
       const t = state.floatingTexts[i];
       t.y += t.vy;
       t.life--;
       if (t.life <= 0) state.floatingTexts.splice(i, 1);
    }

    // --- Lane Logic (Environment) ---
    lanes.forEach(lane => {
      if (lane.type === 'road' || lane.type === 'water') {
        lane.obstacles = lane.obstacles.filter(obs => !obs.dead);
        lane.obstacles.forEach(obs => {
          obs.x += obs.speed * lane.direction; 
          const buffer = 300;
          if (lane.direction === 1 && obs.x > CANVAS_WIDTH + buffer) {
            const otherObstacles = lane.obstacles.filter(o => o !== obs);
            const minX = otherObstacles.length > 0 ? Math.min(...otherObstacles.map(o => o.x)) : 0;
            obs.x = Math.min(-obs.width - randomRange(50, 200), minX - obs.width - randomRange(60, 150));
          } else if (lane.direction === -1 && obs.x < -buffer) {
            const otherObstacles = lane.obstacles.filter(o => o !== obs);
            const maxX = otherObstacles.length > 0 ? Math.max(...otherObstacles.map(o => o.x + o.width)) : CANVAS_WIDTH;
            obs.x = Math.max(CANVAS_WIDTH + buffer + randomRange(50, 200), maxX + randomRange(60, 150));
          }
        });
      }

      if (lane.type === 'rail') {
        if (!lane.trafficTimer) lane.trafficTimer = 0;
        lane.trafficTimer++;
        const greenDuration = lane.trafficGreenDuration || 200;

        if (lane.trafficLightState === 'green' && lane.trafficTimer > greenDuration) {
           lane.trafficLightState = 'warning';
           lane.trafficTimer = 0;
        } else if (lane.trafficLightState === 'warning' && lane.trafficTimer > 60) {
           lane.trafficLightState = 'red';
           lane.trafficTimer = 0;
           
           const rand = Math.random();
           let trainVariant = 'standard';
           let trainSpeed = 40;
           let trainWidth = CANVAS_WIDTH * 2;

           if (rand < 0.25) {
             trainVariant = 'freight';
             trainSpeed = 20; 
             trainWidth = CANVAS_WIDTH * 3.5; 
           } else if (rand > 0.85) {
             trainVariant = 'bullet';
             trainSpeed = 80;
             trainWidth = CANVAS_WIDTH * 2.5; 
           }

           lane.obstacles.push({
             id: obstacleIdCounter++,
             x: lane.direction === 1 ? -trainWidth : CANVAS_WIDTH + trainWidth,
             width: trainWidth,
             speed: trainSpeed,
             type: 'train',
             trainVariant: trainVariant as any 
           });

        } else if (lane.trafficLightState === 'red') {
           lane.obstacles = lane.obstacles.filter(obs => !obs.dead);
           const train = lane.obstacles[0];
           if (train) {
             train.x += train.speed * lane.direction;
             if ((lane.direction === 1 && train.x > CANVAS_WIDTH + 100) || 
                 (lane.direction === -1 && train.x + train.width < -100)) {
               lane.obstacles = [];
               lane.trafficLightState = 'green';
               lane.trafficTimer = 0;
             }
           }
        }
      }
    });

    if (status === GameStatus.MENU) {
       state.cameraY += 0.4;
       if (lanes.length === 0) lanes.push(generateLane(0, state.difficulty));
       const lastLane = lanes[lanes.length - 1];
       const maxVisibleY = Math.floor((state.cameraY + CANVAS_HEIGHT) / TILE_SIZE) + 4;
       if (lastLane && lastLane.y < maxVisibleY) lanes.push(generateLane(lastLane.y + 1, state.difficulty));
       if (lanes.length > 30) lanes.shift();
       return;
    }

    if (status !== GameStatus.PLAYING) return;

    // Determine leading player Y for camera and active players
    const activePlayers = players.filter(p => !p.dead && p.active);

    // --- Projectile Logic ---
    if (!state.projectiles) state.projectiles = [];
    
    // --- Black Cube Logic ---
    // Iterate visible lanes to find black cubes
    const minVisibleY = Math.floor(state.cameraY / TILE_SIZE) - 2;
    const maxVisibleY = Math.floor((state.cameraY + CANVAS_HEIGHT) / TILE_SIZE) + 4;
    const visibleLanes = state.lanes.filter(l => l.y >= minVisibleY && l.y <= maxVisibleY);

    visibleLanes.forEach(lane => {
        if (lane.type === 'grass') {
            lane.obstacles.forEach(obs => {
                if (obs.type === 'black_cube' && obs.shootTimer !== undefined) {
                    obs.shootTimer--;
                    if (obs.shootTimer <= 0) {
                        // Shoot!
                        obs.shootTimer = randomInt(120, 240); // Reset timer (2-4 seconds)
                        
                        // Find nearest player
                        let target = null;
                        let minDist = Infinity;
                        activePlayers.forEach(p => {
                            const dist = Math.hypot(p.x - obs.x, p.y - (lane.y * TILE_SIZE));
                            if (dist < minDist) {
                                minDist = dist;
                                target = p;
                            }
                        });

                        if (target) {
                            const startX = obs.x + TILE_SIZE/2;
                            const startY = lane.y * TILE_SIZE + TILE_SIZE/2;
                            const dx = target.x + TILE_SIZE/2 - startX;
                            const dy = target.y + TILE_SIZE/2 - startY;
                            const angle = Math.atan2(dy, dx);
                            const speed = 4;
                            
                            state.projectiles.push({
                                id: Date.now() + Math.random(),
                                x: startX,
                                y: startY,
                                vx: Math.cos(angle) * speed,
                                vy: Math.sin(angle) * speed,
                                ownerId: -1, // Enemy projectile
                                active: true
                            });
                            
                            spawnParticles(startX, startY, '#ef4444', 5); // Muzzle flash
                        }
                    }
                }
            });
        }
    });

    // --- Projectile Logic ---
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const proj = state.projectiles[i];
        proj.x += proj.vx;
        proj.y += proj.vy;
        
        // Remove if off screen
        if (proj.x < -50 || proj.x > CANVAS_WIDTH + 50 || proj.y < state.cameraY - 100 || proj.y > state.cameraY + CANVAS_HEIGHT + 100) {
            state.projectiles.splice(i, 1);
            continue;
        }

        if (proj.ownerId === -1) {
            // Enemy Projectile: Check collision with players
            let hit = false;
            for (const player of activePlayers) {
                 if (Math.abs(proj.x - (player.x + TILE_SIZE/2)) < 15 && Math.abs(proj.y - (player.y + TILE_SIZE/2)) < 15) {
                    hit = true;
                    if (player.powerUpState.shield) {
                        player.powerUpState.shield = false;
                        spawnParticles(player.x + TILE_SIZE/2, player.y + TILE_SIZE/2, COLORS.POWERUP_SHIELD, 10);
                        spawnFloatingText(player.x, player.y, "BLOCKED!", '#fff');
                    } else {
                        takeDamage(player);
                        spawnParticles(player.x + TILE_SIZE/2, player.y + TILE_SIZE/2, COLORS.CHICKEN_BODY, 15);
                    }
                    break;
                 }
            }
            if (hit) state.projectiles.splice(i, 1);
        } else {
            // Player Projectile: Check collision with enemies
            let hit = false;
            // Check Chasers
            for (let j = state.enemies.length - 1; j >= 0; j--) {
                const enemy = state.enemies[j];
                if (Math.abs(proj.x - (enemy.x + TILE_SIZE/2)) < 20 && Math.abs(proj.y - (enemy.y + TILE_SIZE/2)) < 20) {
                    enemy.active = false;
                    hit = true;
                    spawnParticles(enemy.x + TILE_SIZE/2, enemy.y + TILE_SIZE/2, '#ea580c', 15);
                    spawnFloatingText(enemy.x, enemy.y, "SPLAT!", '#fff');
                    break;
                }
            }
            // Check Black Cubes (Obstacles)
            if (!hit) {
                 visibleLanes.forEach(lane => {
                    if (lane.type === 'grass') {
                        lane.obstacles.forEach(obs => {
                            if (obs.type === 'black_cube') {
                                const obsY = lane.y * TILE_SIZE;
                                if (Math.abs(proj.x - (obs.x + TILE_SIZE/2)) < 20 && Math.abs(proj.y - (obsY + TILE_SIZE/2)) < 20) {
                                    // Destroy cube? Or just effects? Let's destroy it.
                                    // Actually, obstacles array is hard to splice from here without index.
                                    // Let's just mark it dead if we add a dead flag, or just particles.
                                    // For now, just particles, maybe indestructible or hard to kill.
                                    spawnParticles(obs.x + TILE_SIZE/2, obsY + TILE_SIZE/2, '#000', 5);
                                    hit = true;
                                    // Optional: Destroy it
                                    // lane.obstacles = lane.obstacles.filter(o => o.id !== obs.id);
                                }
                            }
                        });
                    }
                 });
            }
            
            if (hit) {
                state.projectiles.splice(i, 1);
            }
        }
    }

    // --- Enemy Logic ---
    if (!state.enemies) state.enemies = [];

    // --- Chaser Enemy Logic ---
    // Ensure there is always one 'chaser' enemy
    const chaserExists = state.enemies.some(e => e.type === 'chaser');
    if (!chaserExists) {
        // Spawn chaser behind the camera or at start
        const spawnY = state.cameraY - 100; 
        state.enemies.push({
            id: Date.now(),
            x: CANVAS_WIDTH / 2,
            y: spawnY,
            speed: 1.2 + (state.difficulty * 0.1), // Persistent speed
            type: 'chaser',
            facing: 'UP',
            active: true
        });
    }

    for (let i = state.enemies.length - 1; i >= 0; i--) {
        const enemy = state.enemies[i];
        if (!enemy.active) {
            state.enemies.splice(i, 1);
            continue;
        }

        if (enemy.type === 'chaser') {
            // Find closest player
            let closestPlayer = null;
            let minDist = Infinity;
            activePlayers.forEach(p => {
                const dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
                if (dist < minDist) {
                    minDist = dist;
                    closestPlayer = p;
                }
            });

            if (closestPlayer) {
                const dx = closestPlayer.x - enemy.x;
                const dy = closestPlayer.y - enemy.y;
                const dist = Math.hypot(dx, dy);
                
                if (dist > 0) {
                    // Move towards player
                    enemy.x += (dx / dist) * enemy.speed;
                    enemy.y += (dy / dist) * enemy.speed;
                    
                    // Update facing
                    if (Math.abs(dx) > Math.abs(dy)) {
                        enemy.facing = dx > 0 ? 'RIGHT' : 'LEFT';
                    } else {
                        enemy.facing = dy > 0 ? 'DOWN' : 'UP';
                    }
                }

                // Collision with player
                if (dist < TILE_SIZE * 0.8) {
                    if (closestPlayer.powerUpState.shield) {
                        closestPlayer.powerUpState.shield = false;
                        enemy.active = false; // Will respawn next frame
                        spawnParticles(enemy.x, enemy.y, '#ea580c', 20);
                        spawnFloatingText(enemy.x, enemy.y, "BOP!", '#fff');
                    } else {
                        takeDamage(closestPlayer);
                        enemy.active = false; // Will respawn next frame
                    }
                }
            } else {
                // No active players, just move up
                enemy.y += enemy.speed;
            }

            // Teleport if too far behind (to keep it relevant)
            if (enemy.y < state.cameraY - 400) {
                enemy.y = state.cameraY - 100;
                enemy.x = CANVAS_WIDTH / 2;
            }
        }
    }

    // --- Player Updates ---
    
    // Check if ALL active players are dead
    const allDead = players.every(p => p.dead);
    if (allDead) {
        setStatus(GameStatus.GAME_OVER);
        if (state.score > state.highScore) {
            setHighScore(state.score);
            localStorage.setItem('chicken_hs', state.score.toString());
        }
        return;
    }

    // Determine leading player Y for camera
    let maxY = state.cameraY;
    activePlayers.forEach(p => {
        if (p.y > maxY) maxY = p.y;
    });

    const targetCameraY = maxY - CANVAS_HEIGHT * 0.25; 
    if (targetCameraY > state.cameraY) {
      state.cameraY += (targetCameraY - state.cameraY) * 0.1;
    }

    // Find nearby active player for respawning
    // Only check if we have dead players ready to respawn
    const playersToRespawn = players.filter(p => p.dead && p.respawnTimer <= 0 && !p.active);
    if (mode === GameMode.COOP && playersToRespawn.length > 0 && activePlayers.length > 0) {
        const activePlayer = activePlayers[0];
        playersToRespawn.forEach(p => {
             p.dead = false;
             p.active = true;
             p.health = p.maxHealth;
             p.gridX = activePlayer.gridX;
             p.gridY = activePlayer.gridY;
             p.x = p.gridX * TILE_SIZE; // snap to grid
             p.y = activePlayer.y;
             p.onLog = activePlayer.onLog;
             p.logSpeed = activePlayer.logSpeed;
             p.powerUpState.shield = true;
             
             // Update HUD
             setPlayerStats(prev => {
                 if (p.id === 0) return { ...prev, p1Health: p.health };
                 return { ...prev, p2Health: p.health };
             });

             spawnParticles(p.x + TILE_SIZE/2, p.y + TILE_SIZE/2, '#fff', 30);
             spawnFloatingText(p.x, p.y + TILE_SIZE, "SAVED!", '#fff');
        });
    }

    // Iterate players
    players.forEach((player) => {
        if (player.dead) {
            // Timer is now score-based, so we don't decrement it here
            return;
        }

        // Stats UI Updates
        if (player.id === 1) { // Player 2
            setPlayerStats(prev => {
               if (prev.p2Shield === player.powerUpState.shield && prev.p2Respawn === player.respawnTimer && prev.p2Health === player.health) return prev;
               return { ...prev, p2Shield: player.powerUpState.shield, p2Respawn: player.respawnTimer, p2Health: player.health };
            });
        } else {
            // Player 1
            setPlayerStats(prev => {
               if (prev.p1Shield === player.powerUpState.shield && prev.p1Health === player.health && prev.p1Respawn === player.respawnTimer) return prev;
               return { ...prev, p1Shield: player.powerUpState.shield, p1Health: player.health, p1Respawn: player.respawnTimer };
            });
            
            setActivePowerUps(prev => {
               if (prev.shield === player.powerUpState.shield && 
                   prev.speed === player.powerUpState.speedTimer && 
                   prev.multi === player.powerUpState.multiplierTimer) return prev;
               return {
                   shield: player.powerUpState.shield,
                   speed: player.powerUpState.speedTimer,
                   multi: player.powerUpState.multiplierTimer
               };
            });
        }

        // Powerups timers
        if (player.powerUpState.speedTimer > 0) player.powerUpState.speedTimer--;
        if (player.powerUpState.multiplierTimer > 0) player.powerUpState.multiplierTimer--;
        if (player.invincibleTimer > 0) player.invincibleTimer--;

        // Movement
        const effectiveDuration = player.powerUpState.speedTimer > 0 ? MOVE_DURATION / 1.5 : MOVE_DURATION;
        
        if (player.isMoving) {
            player.moveProgress += 1 / effectiveDuration;
            
            if (player.moveProgress < 0.2) {
                player.scale.x = 1.2 - player.moveProgress;
                player.scale.y = 0.8 + player.moveProgress;
            } else if (player.moveProgress > 0.8) {
                player.scale.x = 1 + (player.moveProgress - 0.8);
                player.scale.y = 1 - (player.moveProgress - 0.8);
            } else {
                player.scale.x = 0.9; player.scale.y = 1.1;
            }

            if (player.moveProgress >= 1) {
                player.moveProgress = 1;
                player.isMoving = false;
                player.x = player.targetX;
                player.y = player.targetY;
                player.z = 0;
                player.scale = { x: 1, y: 1 };
                player.gridX = Math.round(player.x / TILE_SIZE);
                
                // Collection
                const lane = lanes.find(l => l.y === player.gridY);
                if (lane) {
                    lane.powerUps = lane.powerUps.filter(p => {
                        if (p.gridX === player.gridX) {
                            if (p.type === 'shield') {
                                player.powerUpState.shield = true;
                                spawnFloatingText(player.x, player.y + TILE_SIZE, "SHIELD!", COLORS.POWERUP_SHIELD);
                                spawnParticles(player.x + TILE_SIZE/2, player.y + TILE_SIZE/2, COLORS.POWERUP_SHIELD, 10);
                            }
                            if (p.type === 'speed') {
                                player.powerUpState.speedTimer = POWERUP_DURATION;
                                spawnFloatingText(player.x, player.y + TILE_SIZE, "SPEED!", COLORS.POWERUP_SPEED);
                                spawnParticles(player.x + TILE_SIZE/2, player.y + TILE_SIZE/2, COLORS.POWERUP_SPEED, 10);
                            }
                            if (p.type === 'multiplier') {
                                player.powerUpState.multiplierTimer = POWERUP_DURATION;
                                spawnFloatingText(player.x, player.y + TILE_SIZE, "2X SCORE!", COLORS.POWERUP_MULTI);
                                spawnParticles(player.x + TILE_SIZE/2, player.y + TILE_SIZE/2, COLORS.POWERUP_MULTI, 10);
                            }
                            return false; 
                        }
                        return true;
                    });

                    // Oil Check
                    if (lane.decorations) {
                        const oil = lane.decorations.find(d => d.type === 'oil_spill' && d.gridX === player.gridX);
                        if (oil) {
                            spawnFloatingText(player.x, player.y + TILE_SIZE, "SLIP!", '#fff');
                            attemptMove(player.id, 'SLIDE');
                        }
                    }
                }
                
                if (player.nextMove) {
                    const move = player.nextMove;
                    player.nextMove = null;
                    attemptMove(player.id, move);
                }

            } else {
                player.x = player.startX + (player.targetX - player.startX) * player.moveProgress;
                player.y = player.startY + (player.targetY - player.startY) * player.moveProgress;
                player.z = Math.sin(player.moveProgress * Math.PI) * (TILE_SIZE * 0.8);
            }
        } else {
            // Idle / Log Physics
            if (!player.dead) {
                player.idleTimer++;
                if (player.idleTimer > 300) { // 5 seconds
                    // Spawn Eagle (Removed)
                }
            }

            if (player.onLog && !player.dead) {
                player.x += player.logSpeed;
                player.gridX = Math.round(player.x / TILE_SIZE);
                if (player.x < -TILE_SIZE/2 || player.x > CANVAS_WIDTH - TILE_SIZE/2) {
                    takeDamage(player);
                    spawnParticles(player.x + TILE_SIZE/2, player.y + TILE_SIZE/2, COLORS.WATER_SIDE, 20);
                }
            } else {
                const desiredX = player.gridX * TILE_SIZE;
                if (Math.abs(player.x - desiredX) > 0.5) player.x += (desiredX - player.x) * 0.2;
                else player.x = desiredX;
                player.y = player.gridY * TILE_SIZE;
            }
            
            const breath = Math.sin(state.frameCount * 0.1 + player.id) * 0.03;
            player.scale.x += (1 + breath - player.scale.x) * 0.2;
            player.scale.y += (1 - breath - player.scale.y) * 0.2;
        }

        // Camera Death Check
        if (player.y < state.cameraY - 100) {
            takeDamage(player); // Fell off screen
        }

        // --- Collision Detection ---
        const currentLane = lanes.find(l => l.y === player.gridY);
        let safeOnWater = false;
        let foundLogSpeed = 0;

        if (currentLane && !player.dead) { 
            const pCx = player.x + TILE_SIZE/2; 
            const pHW = TILE_SIZE * 0.25; 

            if (currentLane.type !== 'water' && !player.isMoving) {
                player.onLog = false;
                player.logSpeed = 0;
            }

            if (currentLane.type === 'road') {
                for (const obs of currentLane.obstacles) {
                    if (obs.dead) continue;
                    if (pCx + pHW > obs.x + 8 && pCx - pHW < obs.x + obs.width - 8) {
                        if (player.powerUpState.shield) {
                            player.powerUpState.shield = false;
                            obs.dead = true;
                            const impactColor = obs.color?.side || '#ef4444';
                            spawnVehicleExplosion(obs.x, currentLane.y * TILE_SIZE, impactColor, obs.width);
                            spawnFloatingText(player.x, player.y + TILE_SIZE, "SMASH!", '#fff');
                        } else {
                            takeDamage(player);
                            state.shake = 20; 
                            spawnParticles(player.x + TILE_SIZE/2, player.y + TILE_SIZE/2, COLORS.CHICKEN_BODY, 20);
                        }
                    }
                }
            } else if (currentLane.type === 'rail' && currentLane.obstacles.length > 0) {
                const train = currentLane.obstacles[0];
                if (!train.dead) {
                    if (pCx + pHW > train.x + 10 && pCx - pHW < train.x + train.width - 10) {
                        if (player.powerUpState.shield) {
                            player.powerUpState.shield = false;
                            train.dead = true;
                            spawnVehicleExplosion(player.x - TILE_SIZE, currentLane.y * TILE_SIZE, COLORS.TRAIN_SIDE, TILE_SIZE * 3);
                            spawnFloatingText(player.x, player.y + TILE_SIZE, "EPIC!", '#fff');
                        } else {
                            takeDamage(player);
                            state.shake = 25; 
                            spawnParticles(player.x + TILE_SIZE/2, player.y + TILE_SIZE/2, COLORS.CHICKEN_BODY, 30);
                        }
                    }
                }
            } else if (currentLane.type === 'water') {
                let foundObs = null;
                for (const obs of currentLane.obstacles) {
                    if (pCx > obs.x && pCx < obs.x + obs.width) {
                        safeOnWater = true;
                        foundLogSpeed = obs.speed * currentLane.direction;
                        foundObs = obs;
                    }
                }
                if (!player.isMoving) {
                    if (safeOnWater) {
                        player.onLog = true;
                        player.logSpeed = foundLogSpeed;
                        
                        if (foundObs) {
                            // Center player on the obstacle (log/turtle/lilypad)
                            const obsCenter = foundObs.x + foundObs.width / 2;
                            const playerCenter = player.x + TILE_SIZE / 2;
                            const diff = obsCenter - playerCenter;
                            // Smoothly move towards center
                            if (Math.abs(diff) > 1) {
                                player.x += diff * 0.1;
                            }
                        }
                    } else {
                        takeDamage(player);
                        state.shake = 10; 
                        spawnParticles(player.x + TILE_SIZE/2, player.y + TILE_SIZE/2, COLORS.WATER, 15);
                    }
                }
            } else {
                if (!player.isMoving) {
                    player.onLog = false;
                    player.logSpeed = 0;
                }
            }
        }
    });

  }, [status, score, highScore]);

  const killPlayer = (player: Player) => {
    player.dead = true;
    player.active = false;
    player.respawnTimer = 20; // 20 points to respawn
    // Don't set status to GAME_OVER here, checked at start of update
  };

  const rescuePlayer = (player: Player) => {
      const state = gameState.current;
      const otherPlayer = state.players.find(p => p.id !== player.id && !p.dead && p.active);
      if (otherPlayer) {
          player.gridX = otherPlayer.gridX;
          player.gridY = otherPlayer.gridY;
          player.x = otherPlayer.x;
          player.y = otherPlayer.y;
          player.onLog = otherPlayer.onLog;
          player.logSpeed = otherPlayer.logSpeed;
      } else {
          // Find nearest grass lane behind them
          for (let i = state.lanes.length - 1; i >= 0; i--) {
              if (state.lanes[i].type === 'grass' && state.lanes[i].y <= player.gridY) {
                  player.gridY = state.lanes[i].y;
                  player.y = player.gridY * TILE_SIZE;
                  player.x = player.gridX * TILE_SIZE;
                  player.onLog = false;
                  break;
              }
          }
      }
  };

  const takeDamage = (player: Player) => {
    if (player.invincibleTimer > 0) return;

    if (gameState.current.mode === GameMode.COOP) {
        player.health -= 1;
        
        // Update HUD
        setPlayerStats(prev => {
            if (player.id === 0) return { ...prev, p1Health: player.health };
            return { ...prev, p2Health: player.health };
        });

        if (player.health <= 0) {
            killPlayer(player);
        } else {
            player.invincibleTimer = 60; // 1 second of invincibility
            spawnFloatingText(player.x, player.y + TILE_SIZE, "-1 HP", '#ef4444');
            
            // Rescue player if they fell in water or off screen
            const currentLane = gameState.current.lanes.find(l => l.y === player.gridY);
            if (!currentLane || currentLane.type === 'water' || player.y < gameState.current.cameraY - 50) {
                rescuePlayer(player);
            }
        }
    } else {
        killPlayer(player);
    }
  };

  // --- Render Loop ---

  const drawShadow = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha: number = 0.2) => {
     ctx.save();
     ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
     ctx.transform(1, 0, -0.6, 1, 0, 0); 
     ctx.fillRect(x + h*0.6, y, w, h * 0.5); 
     ctx.restore();
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = gameState.current;
    
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.save();
    if (state.shake > 0) {
        const dx = (Math.random() - 0.5) * state.shake;
        const dy = (Math.random() - 0.5) * state.shake;
        ctx.translate(dx, dy);
    }
    
    const projectY = (worldY: number) => {
       const screenY = CANVAS_HEIGHT - (worldY - state.cameraY) - 100;
       return screenY;
    };

    const minVisibleY = Math.floor(state.cameraY / TILE_SIZE) - 2;
    const maxVisibleY = Math.floor((state.cameraY + CANVAS_HEIGHT) / TILE_SIZE) + 4;

    const visibleLanes = state.lanes.filter(l => l.y >= minVisibleY && l.y <= maxVisibleY);
    visibleLanes.sort((a, b) => b.y - a.y); 

    visibleLanes.forEach(lane => {
      const laneY = projectY(lane.y * TILE_SIZE);
      
      if (lane.type === 'grass') {
        const isDark = lane.y % 2 !== 0;
        ctx.fillStyle = isDark ? COLORS.GRASS_DARK : COLORS.GRASS_LIGHT;
        ctx.fillRect(0, laneY, CANVAS_WIDTH, TILE_SIZE);
        ctx.fillStyle = COLORS.GRASS_SIDE;
        ctx.fillRect(0, laneY + TILE_SIZE, CANVAS_WIDTH, TILE_SIZE/2);
        
        ctx.fillStyle = isDark ? '#4d7c0f' : '#65a30d';
        for(let i=0; i<CANVAS_WIDTH; i+=20) {
            if ((i + lane.y * 10) % 7 === 0) ctx.fillRect(i + (lane.y%3)*5, laneY + 5, 4, 4);
            if ((i + lane.y * 5) % 11 === 0) ctx.fillRect(i + 10, laneY + 25, 6, 6);
        }

        if (lane.decorations) {
          lane.decorations.forEach(dec => {
             const dX = dec.x;
             const dY = laneY + dec.yOffset;
             
             if (dec.type !== 'pebble') {
                drawShadow(ctx, dX, dY + 4, 4, 4, 0.1);
             }

             if (dec.type === 'grass_tuft') {
                ctx.fillStyle = dec.color;
                ctx.fillRect(dX, dY, 2, 3);
                ctx.fillRect(dX + 2, dY + 1, 2, 2);
                ctx.fillRect(dX - 2, dY + 2, 2, 1);
             } else if (dec.type === 'pebble') {
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.fillRect(dX + 1, dY + 3, 4, 2); 
                ctx.fillStyle = dec.color;
                ctx.fillRect(dX, dY, 4, 3);
             } else if (dec.type === 'flower') {
                ctx.fillStyle = '#166534';
                ctx.fillRect(dX + 1, dY + 2, 2, 4);
                ctx.fillStyle = dec.color;
                ctx.fillRect(dX, dY, 4, 4);
                ctx.fillStyle = '#fff';
                ctx.fillRect(dX + 1, dY + 1, 2, 2);
             }
          });
        }

      } else if (lane.type === 'road') {
        // Base road color with slight variation per lane
        const isDarkRoad = lane.y % 3 === 0;
        const isLightRoad = lane.y % 5 === 0;
        
        let roadColor = COLORS.ROAD;
        let roadSideColor = '#1e293b';
        
        if (isDarkRoad) {
           roadColor = '#2d3a4d';
           roadSideColor = '#1a2433';
        } else if (isLightRoad) {
           roadColor = '#3b4b61';
           roadSideColor = '#243042';
        }

        ctx.fillStyle = roadColor;
        ctx.fillRect(0, laneY, CANVAS_WIDTH, TILE_SIZE);
        ctx.fillStyle = roadSideColor; 
        ctx.fillRect(0, laneY + TILE_SIZE, CANVAS_WIDTH, TILE_SIZE/2);
        
        // Asphalt texture (subtle noise)
        ctx.fillStyle = isDarkRoad ? '#3b4b61' : '#2d3a4d';
        for(let i=0; i<CANVAS_WIDTH; i+=15) {
            if ((i + lane.y * 7) % 3 === 0) ctx.fillRect(i + (lane.y%4)*5, laneY + 5, 2, 2);
            if ((i + lane.y * 11) % 5 === 0) ctx.fillRect(i + 10, laneY + 25, 3, 2);
            if ((i + lane.y * 13) % 7 === 0) ctx.fillRect(i + 25, laneY + 15, 2, 3);
        }
        
        // Road markings (in the middle of the road)
        ctx.fillStyle = COLORS.ROAD_MARKING;
        for (let m = 0; m < CANVAS_WIDTH; m+=100) {
           ctx.fillRect(m + 20, laneY + TILE_SIZE/2 - 2, 40, 4);
        }

        if (lane.decorations) {
            lane.decorations.forEach(dec => {
                if (dec.type === 'oil_spill') {
                    const dX = dec.x;
                    const dY = laneY + 5;
                    ctx.fillStyle = COLORS.OIL_SPILL;
                    ctx.beginPath();
                    ctx.ellipse(dX + TILE_SIZE/2, dY + TILE_SIZE/2, 14, 8, 0, 0, Math.PI*2);
                    ctx.fill();
                    ctx.fillStyle = 'rgba(255,255,255,0.1)';
                    ctx.beginPath();
                    ctx.ellipse(dX + TILE_SIZE/2 - 4, dY + TILE_SIZE/2 - 2, 4, 2, -0.2, 0, Math.PI*2);
                    ctx.fill();
                }
            });
        }

      } else if (lane.type === 'water') {
        const offset = (Math.sin(state.frameCount * 0.05 + lane.y) * 5);
        ctx.fillStyle = COLORS.WATER;
        ctx.fillRect(0, laneY, CANVAS_WIDTH, TILE_SIZE);
        ctx.fillStyle = COLORS.WATER_SIDE;
        ctx.fillRect(0, laneY + TILE_SIZE, CANVAS_WIDTH, TILE_SIZE/2);
        
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        for (let w = 0; w < CANVAS_WIDTH; w+= 60) {
           const waveX = w + offset + (lane.y % 2) * 30;
           ctx.fillRect(waveX % CANVAS_WIDTH, laneY + 8, 15, 2);
           ctx.fillRect((waveX + 20) % CANVAS_WIDTH, laneY + 28, 10, 2);
        }
      } else if (lane.type === 'rail') {
        ctx.fillStyle = COLORS.RAIL;
        ctx.fillRect(0, laneY, CANVAS_WIDTH, TILE_SIZE);
        ctx.fillStyle = '#451a03'; 
        ctx.fillRect(0, laneY + TILE_SIZE, CANVAS_WIDTH, TILE_SIZE/2);
        
        ctx.fillStyle = COLORS.RAIL_WOOD;
        for (let s = 0; s < CANVAS_WIDTH; s+=30) {
          ctx.fillRect(s, laneY + 4, 8, TILE_SIZE - 8);
          ctx.fillStyle = '#5d4037';
          ctx.fillRect(s + 1, laneY + 5, 6, 2);
          ctx.fillStyle = COLORS.RAIL_WOOD;
        }
        
        ctx.fillStyle = COLORS.RAIL_METAL;
        ctx.fillRect(0, laneY + 8, CANVAS_WIDTH, 4);
        ctx.fillRect(0, laneY + TILE_SIZE - 12, CANVAS_WIDTH, 4);
        
        if (lane.trafficLightState === 'warning' || lane.trafficLightState === 'red') {
           const lightOn = lane.trafficLightState === 'red' || (Math.floor(Date.now() / 150) % 2 === 0);
           const isLeft = lane.direction === 1;
           const lightX = isLeft ? 60 : CANVAS_WIDTH - 60; 
           
           if (lightOn) {
             const gradient = ctx.createRadialGradient(lightX, laneY + TILE_SIZE/2, 0, lightX, laneY + TILE_SIZE/2, 60);
             gradient.addColorStop(0, 'rgba(255, 0, 0, 0.4)');
             gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
             ctx.fillStyle = gradient;
             ctx.fillRect(lightX - 60, laneY - 20, 120, 100);
           }
           
           ctx.fillStyle = '#475569';
           ctx.fillRect(lightX - 3, laneY - 40, 6, 40);
           ctx.fillStyle = '#1e293b';
           ctx.fillRect(lightX - 13, laneY - 60, 26, 26);
           
           ctx.fillStyle = lightOn ? '#ef4444' : '#7f1d1d';
           ctx.beginPath();
           ctx.arc(lightX, laneY - 47, 8, 0, Math.PI*2);
           ctx.fill();
        }
      }

      if (lane.powerUps && lane.powerUps.length > 0) {
         lane.powerUps.forEach(pu => {
            const px = pu.x + (TILE_SIZE - 20)/2;
            const py = laneY + (TILE_SIZE - 20)/2 + Math.sin(state.frameCount * 0.1) * 3; 
            
            drawShadow(ctx, px, py + 20, 20, 20, 0.2);

            if (pu.type === 'shield') {
               ctx.fillStyle = COLORS.POWERUP_SHIELD;
               ctx.beginPath();
               ctx.arc(pu.x + TILE_SIZE/2, py + 10, 10, 0, Math.PI*2);
               ctx.fill();
               if (state.frameCount % 20 < 10) {
                 ctx.fillStyle = '#fff';
                 ctx.fillRect(pu.x + TILE_SIZE/2 + 4, py + 4, 2, 2);
               }
               ctx.fillStyle = '#fff';
               ctx.font = '12px sans-serif';
               ctx.fillText('S', pu.x + TILE_SIZE/2 - 4, py + 14);
            } else if (pu.type === 'speed') {
               ctx.fillStyle = COLORS.POWERUP_SPEED;
               ctx.beginPath();
               ctx.moveTo(pu.x + TILE_SIZE/2, py);
               ctx.lineTo(pu.x + TILE_SIZE/2 + 8, py + 8);
               ctx.lineTo(pu.x + TILE_SIZE/2, py + 20);
               ctx.lineTo(pu.x + TILE_SIZE/2 - 8, py + 12);
               ctx.fill();
               ctx.strokeStyle = '#fff';
               ctx.lineWidth = 2;
               ctx.stroke();
            } else if (pu.type === 'multiplier') {
               ctx.fillStyle = COLORS.POWERUP_MULTI;
               ctx.fillRect(pu.x + TILE_SIZE/2 - 8, py + 2, 16, 16);
               ctx.fillStyle = '#fff';
               ctx.font = 'bold 10px monospace';
               ctx.fillText('x2', pu.x + TILE_SIZE/2 - 6, py + 14);
            }
         });
      }

      // Draw obstacles (Trees, Cars, Logs, etc) logic...
      lane.obstacles.forEach(obs => {
          const x = obs.x;
          const y = laneY;
          
          if (obs.type === 'tree') {
             const trunkW = TILE_SIZE * 0.4;
             const trunkH = TILE_SIZE * 0.6;
             drawShadow(ctx, x + (TILE_SIZE - trunkW)/2, y + TILE_SIZE, trunkW, trunkH, 0.3);
             ctx.fillStyle = COLORS.TREE_TRUNK;
             ctx.fillRect(x + (TILE_SIZE - trunkW)/2, y + TILE_SIZE - trunkH, trunkW, trunkH);
             ctx.fillStyle = COLORS.TREE_LEAVES;
             ctx.fillRect(x + (TILE_SIZE - TILE_SIZE*0.9)/2, y + TILE_SIZE - trunkH - TILE_SIZE*0.6 + 10, TILE_SIZE*0.9, TILE_SIZE*0.6);
             ctx.fillStyle = COLORS.TREE_LEAVES_LIGHT;
             ctx.fillRect(x + (TILE_SIZE - TILE_SIZE*0.7)/2, y + TILE_SIZE - trunkH - TILE_SIZE*0.6 * 1.5 + 10, TILE_SIZE*0.7, TILE_SIZE*0.6);
          } 
          else if (obs.type === 'stone') {
             const w = TILE_SIZE * 0.8;
             const h = TILE_SIZE * 0.5;
             drawShadow(ctx, x + (TILE_SIZE - w)/2, y + TILE_SIZE - h + h, w, h, 0.3);
             ctx.fillStyle = COLORS.STONE_SIDE;
             ctx.fillRect(x + (TILE_SIZE - w)/2, y + TILE_SIZE - h + 10, w, h - 10);
             ctx.fillStyle = COLORS.STONE;
             ctx.fillRect(x + (TILE_SIZE - w)/2, y + TILE_SIZE - h, w, 10);
          }
          else if (obs.type === 'bush') {
             const w = TILE_SIZE * 0.9;
             const h = TILE_SIZE * 0.7;
             drawShadow(ctx, x + (TILE_SIZE - w)/2, y + TILE_SIZE, w, h, 0.3);
             ctx.fillStyle = COLORS.BUSH_MAIN || '#15803d';
             ctx.beginPath();
             ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE - h/2, w/2, 0, Math.PI*2);
             ctx.fill();
             ctx.fillStyle = COLORS.BUSH_LIGHT || '#4ade80';
             ctx.beginPath();
             ctx.arc(x + TILE_SIZE/2 - 4, y + TILE_SIZE - h/2 - 4, w/3, 0, Math.PI*2);
             ctx.fill();
          }
          else if (obs.type === 'stump') {
             const w = TILE_SIZE * 0.6;
             const h = TILE_SIZE * 0.4;
             drawShadow(ctx, x + (TILE_SIZE - w)/2, y + TILE_SIZE, w, h, 0.3);
             ctx.fillStyle = COLORS.STUMP_SIDE || '#57534e';
             ctx.fillRect(x + (TILE_SIZE - w)/2, y + TILE_SIZE - h, w, h);
             ctx.fillStyle = COLORS.STUMP_TOP || '#d6d3d1';
             ctx.beginPath();
             ctx.ellipse(x + TILE_SIZE/2, y + TILE_SIZE - h, w/2, h/3, 0, 0, Math.PI*2);
             ctx.fill();
          }
          else if (obs.type === 'black_cube') {
             const size = TILE_SIZE * 0.8;
             const offset = (TILE_SIZE - size) / 2;
             
             // Shadow
             drawShadow(ctx, x + offset, y + TILE_SIZE, size, size/2, 0.5);
             
             // Cube Body
             ctx.fillStyle = '#000000';
             ctx.fillRect(x + offset, y + TILE_SIZE - size, size, size);
             
             // Red Eye / Sensor
             ctx.fillStyle = '#ef4444';
             const eyeSize = size * 0.3;
             // Pulse effect
             const pulse = Math.sin(state.frameCount * 0.2) * 2;
             ctx.fillRect(x + TILE_SIZE/2 - eyeSize/2, y + TILE_SIZE - size/2 - eyeSize/2, eyeSize, eyeSize);
             
             // Glow
             ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
             ctx.beginPath();
             ctx.arc(x + TILE_SIZE/2, y + TILE_SIZE - size/2, eyeSize + 4 + pulse, 0, Math.PI*2);
             ctx.fill();
          }
          else if (obs.type === 'car') {
             const h = TILE_SIZE * 0.65;
             const w = obs.width;
             const isRight = lane.direction === 1;
             const colorSide = obs.color?.side || '#b91c1c';
             const colorTop = obs.color?.top || '#ef4444';
             
             // Center car vertically in the lane
             const yOffset = (TILE_SIZE - h) / 2 + 5;
             const drawY = y + yOffset;

             // Shadow
             drawShadow(ctx, x, drawY + h, w, h, 0.4);
             
             // Wheels (Back)
             ctx.fillStyle = '#0f172a';
             ctx.beginPath();
             // Front Wheel
             ctx.roundRect(x + 8, drawY + h - 6, 10, 10, 3);
             // Back Wheel
             ctx.roundRect(x + w - 18, drawY + h - 6, 10, 10, 3);
             ctx.fill();
             
             // Hubcaps
             ctx.fillStyle = '#94a3b8';
             ctx.beginPath();
             ctx.arc(x + 13, drawY + h - 1, 2, 0, Math.PI * 2);
             ctx.arc(x + w - 13, drawY + h - 1, 2, 0, Math.PI * 2);
             ctx.fill();
             
             // Lower Body (Chassis) - Lowered skirt (h - 6 instead of h - 2)
             ctx.fillStyle = colorSide;
             ctx.beginPath();
             ctx.roundRect(x, drawY, w, h - 6, 4);
             ctx.fill();

             // Lower Body Highlight (Top edge of chassis)
             ctx.fillStyle = colorTop;
             ctx.beginPath();
             ctx.roundRect(x, drawY, w, 4, [4, 4, 0, 0]);
             ctx.fill();
             
             // Cabin
             const cabinW = w * 0.6;
             const cabinX = isRight ? x + 12 : x + w - cabinW - 12;
             
             ctx.fillStyle = colorSide;
             ctx.beginPath();
             ctx.roundRect(cabinX, drawY - h * 0.5 + 4, cabinW, 16, [6, 6, 0, 0]);
             ctx.fill();

             // Cabin Roof (Lighter for 3D)
             ctx.fillStyle = colorTop;
             ctx.beginPath();
             ctx.roundRect(cabinX + 2, drawY - h * 0.5 + 4, cabinW - 4, 6, [4, 4, 0, 0]);
             ctx.fill();
             
             // Windows
             ctx.fillStyle = '#38bdf8'; // Brighter window
             ctx.beginPath();
             ctx.roundRect(cabinX + 4, drawY - h * 0.5 + 8, cabinW - 8, 10, 2);
             ctx.fill();
             
             // Window reflection
             ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
             ctx.beginPath();
             ctx.moveTo(cabinX + 6, drawY - h * 0.5 + 18);
             ctx.lineTo(cabinX + 14, drawY - h * 0.5 + 8);
             ctx.lineTo(cabinX + 20, drawY - h * 0.5 + 8);
             ctx.lineTo(cabinX + 12, drawY - h * 0.5 + 18);
             ctx.fill();
             
             // Window divider
             ctx.fillStyle = colorSide;
             ctx.fillRect(cabinX + cabinW/2 - 2, drawY - h * 0.5 + 8, 4, 10);
             
             // Headlights / Taillights
             // Front Light (Yellow/White)
             ctx.fillStyle = isRight ? '#fef08a' : '#ef4444'; 
             ctx.beginPath();
             ctx.roundRect(isRight ? x + w - 4 : x, drawY + h - 10, 4, 6, 2);
             ctx.fill();
             
             // Front Light Glow
             if (isRight) {
                 const grad = ctx.createLinearGradient(x + w, 0, x + w + 20, 0);
                 grad.addColorStop(0, 'rgba(254, 240, 138, 0.5)');
                 grad.addColorStop(1, 'rgba(254, 240, 138, 0)');
                 ctx.fillStyle = grad;
                 ctx.fillRect(x + w, drawY + h - 12, 20, 10);
             } else {
                 const grad = ctx.createLinearGradient(x, 0, x - 20, 0);
                 grad.addColorStop(0, 'rgba(254, 240, 138, 0.5)');
                 grad.addColorStop(1, 'rgba(254, 240, 138, 0)');
                 ctx.fillStyle = grad;
                 ctx.fillRect(x - 20, drawY + h - 12, 20, 10);
             }
             
             // Back Light (Red)
             ctx.fillStyle = isRight ? '#ef4444' : '#fef08a'; 
             ctx.beginPath();
             ctx.roundRect(isRight ? x : x + w - 4, drawY + h - 10, 4, 6, 2);
             ctx.fill();
             
             // Bumpers
             ctx.fillStyle = '#94a3b8';
             ctx.beginPath();
             ctx.roundRect(isRight ? x + w - 3 : x - 1, drawY + h - 4, 4, 4, 1);
             ctx.roundRect(isRight ? x - 1 : x + w - 3, drawY + h - 4, 4, 4, 1);
             ctx.fill();
          }
          else if (obs.type === 'truck') {
             const h = TILE_SIZE * 0.75;
             drawShadow(ctx, x, y + TILE_SIZE, obs.width, h, 0.4);
             
             const cabW = TILE_SIZE * 1.2;
             const facingRight = lane.direction === 1;
             const cabX = facingRight ? x + obs.width - cabW : x;
             const trailerX = facingRight ? x : x + cabW + 2;
             const trailerW = obs.width - cabW - 2;
             
             // Wheels (Trailer)
             ctx.fillStyle = '#0f172a';
             ctx.beginPath();
             // Trailer Wheels (3 sets)
             ctx.roundRect(trailerX + 10, y + TILE_SIZE - 6, 12, 12, 3);
             ctx.roundRect(trailerX + 24, y + TILE_SIZE - 6, 12, 12, 3);
             ctx.roundRect(trailerX + trailerW - 22, y + TILE_SIZE - 6, 12, 12, 3);
             
             // Cab Wheels (2 sets)
             ctx.roundRect(cabX + 10, y + TILE_SIZE - 6, 12, 12, 3);
             ctx.roundRect(cabX + cabW - 22, y + TILE_SIZE - 6, 12, 12, 3);
             ctx.fill();
             
             // Hubcaps
             ctx.fillStyle = '#94a3b8';
             ctx.beginPath();
             ctx.arc(trailerX + 16, y + TILE_SIZE, 3, 0, Math.PI * 2);
             ctx.arc(trailerX + 30, y + TILE_SIZE, 3, 0, Math.PI * 2);
             ctx.arc(trailerX + trailerW - 16, y + TILE_SIZE, 3, 0, Math.PI * 2);
             ctx.arc(cabX + 16, y + TILE_SIZE, 3, 0, Math.PI * 2);
             ctx.arc(cabX + cabW - 16, y + TILE_SIZE, 3, 0, Math.PI * 2);
             ctx.fill();

             // Cab
             ctx.fillStyle = COLORS.TRUCK_CAB || '#1e3a8a';
             ctx.beginPath();
             ctx.roundRect(cabX, y + TILE_SIZE - h + 10, cabW, h - 10, [8, 8, 2, 2]);
             ctx.fill();
             
             // Cab Window
             ctx.fillStyle = '#bae6fd';
             ctx.beginPath();
             ctx.roundRect(facingRight ? cabX + 10 : cabX + 4, y + TILE_SIZE - h + 14, cabW - 14, 12, 2);
             ctx.fill();
             
             // Grill
             ctx.fillStyle = '#94a3b8';
             ctx.fillRect(facingRight ? cabX + cabW - 6 : cabX, y + TILE_SIZE - h + 30, 6, 14);
             
             // Trailer
             ctx.fillStyle = COLORS.TRUCK_TRAILER || '#f8fafc';
             ctx.beginPath();
             ctx.roundRect(trailerX, y + TILE_SIZE - h, trailerW, h - 4, 2);
             ctx.fill();
             
             // Trailer Detail (Stripe)
             ctx.fillStyle = '#ef4444'; 
             ctx.fillRect(trailerX, y + TILE_SIZE - h + 15, trailerW, 8);
             
             // Headlights
             ctx.fillStyle = facingRight ? '#fef08a' : '#ef4444';
             ctx.fillRect(facingRight ? cabX + cabW - 4 : cabX, y + TILE_SIZE - 14, 4, 6);
          }
          else if (obs.type === 'train') {
             const h = TILE_SIZE * 0.9;
             drawShadow(ctx, x, y + TILE_SIZE, obs.width, h, 0.5);
             
             // IMPROVED TRAIN VARIANTS
             if (obs.trainVariant === 'bullet') {
                // Sleek Bullet Train
                ctx.fillStyle = COLORS.TRAIN_BULLET_BODY;
                // Main Body
                ctx.beginPath();
                if (lane.direction === 1) {
                    ctx.moveTo(x, y + TILE_SIZE);
                    ctx.lineTo(x + obs.width, y + TILE_SIZE);
                    ctx.lineTo(x + obs.width + 20, y + TILE_SIZE - h + 10); // Nose
                    ctx.lineTo(x + obs.width, y + TILE_SIZE - h);
                    ctx.lineTo(x, y + TILE_SIZE - h);
                } else {
                    ctx.moveTo(x + obs.width, y + TILE_SIZE);
                    ctx.lineTo(x, y + TILE_SIZE);
                    ctx.lineTo(x - 20, y + TILE_SIZE - h + 10); // Nose
                    ctx.lineTo(x, y + TILE_SIZE - h);
                    ctx.lineTo(x + obs.width, y + TILE_SIZE - h);
                }
                ctx.fill();

                // Stripe
                ctx.fillStyle = COLORS.TRAIN_BULLET_STRIPE;
                ctx.fillRect(x, y + TILE_SIZE - h + 15, obs.width, 8);
                
                // Continuous Window
                ctx.fillStyle = COLORS.TRAIN_BULLET_WINDOW; // dark
                ctx.fillRect(x, y + TILE_SIZE - h + 5, obs.width, 6);

             } else if (obs.trainVariant === 'freight') {
                // Industrial Freight Train
                const engineW = TILE_SIZE * 2.5;
                const isRight = lane.direction === 1;
                const engineX = isRight ? x + obs.width - engineW : x;
                const cargoX = isRight ? x : x + engineW;
                const cargoW = obs.width - engineW;

                // Engine
                ctx.fillStyle = '#1e293b'; // Dark slate
                ctx.fillRect(engineX, y + TILE_SIZE - h, engineW, h);
                // Engine Cab
                ctx.fillStyle = '#334155';
                ctx.fillRect(engineX + (isRight ? 10 : engineW - 30), y + TILE_SIZE - h - 10, 20, 10);

                // Cargo Containers
                const numContainers = Math.floor(cargoW / (TILE_SIZE * 2));
                for(let i=0; i<numContainers; i++) {
                    const cX = cargoX + i * TILE_SIZE * 2;
                    const color = COLORS.TRAIN_FREIGHT_CONTAINERS[i % 4];
                    ctx.fillStyle = color;
                    // Container Body
                    if (cX + TILE_SIZE*2 < cargoX + cargoW) {
                        ctx.fillRect(cX + 2, y + TILE_SIZE - h + 5, TILE_SIZE * 2 - 4, h - 10);
                        // Corrugated lines
                        ctx.fillStyle = 'rgba(0,0,0,0.1)';
                        for(let l=0; l<5; l++) {
                            ctx.fillRect(cX + 6 + l*12, y + TILE_SIZE - h + 5, 2, h - 10);
                        }
                    }
                }

             } else {
                // Standard Commuter Train
                ctx.fillStyle = COLORS.TRAIN_SIDE; // Dark Red
                ctx.fillRect(x, y + TILE_SIZE - h, obs.width, h);
                
                // Roof
                ctx.fillStyle = '#525252'; // Grey Roof
                ctx.fillRect(x, y + TILE_SIZE - h - 4, obs.width, 4);
                
                // Stripe
                ctx.fillStyle = COLORS.TRAIN_STRIPE; // Yellow
                ctx.fillRect(x, y + TILE_SIZE - h + 25, obs.width, 4);

                // Windows and Doors
                const segment = TILE_SIZE * 1.5;
                for (let i = 0; i < obs.width; i += segment) {
                    // Window
                    ctx.fillStyle = '#93c5fd'; // Light blue
                    ctx.fillRect(x + i + 5, y + TILE_SIZE - h + 5, 20, 15);
                    ctx.fillRect(x + i + 30, y + TILE_SIZE - h + 5, 20, 15);
                    
                    // Door
                    ctx.fillStyle = '#d4d4d4'; // Silver
                    ctx.fillRect(x + i + 55, y + TILE_SIZE - h + 2, 10, h - 5);
                }
             }
          }
          else if (obs.type === 'log') {
             ctx.fillStyle = COLORS.LOG;
             ctx.fillRect(x, y + 5, obs.width, TILE_SIZE - 15);
             ctx.fillStyle = COLORS.LOG_SIDE;
             ctx.fillRect(x, y + 5 + TILE_SIZE - 15, obs.width, 10);
          }
          else if (obs.type === 'turtle') {
             const numTurtles = Math.floor(obs.width / TILE_SIZE);
             const bob = Math.sin(state.frameCount * 0.05 + obs.id) * 2;
             
             for (let i = 0; i < numTurtles; i++) {
                 const tX = x + i * TILE_SIZE + TILE_SIZE/2;
                 const tY = y + TILE_SIZE/2 + bob;
                 
                 // Water ripple/shadow underneath
                 ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
                 ctx.beginPath();
                 ctx.ellipse(tX, tY + 4, TILE_SIZE/2 - 4, TILE_SIZE/2 - 8, 0, 0, Math.PI*2);
                 ctx.fill();
                 
                 // Legs
                 ctx.fillStyle = COLORS.TURTLE_SKIN || '#86efac';
                 ctx.beginPath();
                 ctx.arc(tX - 10, tY - 10, 4, 0, Math.PI*2);
                 ctx.arc(tX + 10, tY - 10, 4, 0, Math.PI*2);
                 ctx.arc(tX - 10, tY + 10, 4, 0, Math.PI*2);
                 ctx.arc(tX + 10, tY + 10, 4, 0, Math.PI*2);
                 ctx.fill();
                 
                 // Head
                 ctx.beginPath();
                 if (lane.direction === 1) {
                     ctx.arc(tX + 14, tY, 5, 0, Math.PI*2);
                 } else {
                     ctx.arc(tX - 14, tY, 5, 0, Math.PI*2);
                 }
                 ctx.fill();
                 
                 // Shell
                 ctx.fillStyle = COLORS.TURTLE_SHELL || '#15803d';
                 ctx.beginPath();
                 ctx.arc(tX, tY, 12, 0, Math.PI*2);
                 ctx.fill();
                 
                 // Shell Pattern
                 ctx.strokeStyle = '#14532d'; // darker green
                 ctx.lineWidth = 1.5;
                 ctx.beginPath();
                 ctx.arc(tX, tY, 8, 0, Math.PI*2);
                 ctx.stroke();
             }
          }
          else if (obs.type === 'traffic_cone') {
            const cX = x + TILE_SIZE/2;
            const cY = y + TILE_SIZE - 8;
            drawShadow(ctx, cX - 6, cY + 8, 12, 12, 0.2);
            ctx.fillStyle = COLORS.CONE_ORANGE;
            ctx.fillRect(cX - 8, cY, 16, 4);
            ctx.beginPath();
            ctx.moveTo(cX - 6, cY); ctx.lineTo(cX + 6, cY); ctx.lineTo(cX, cY - 14); ctx.fill();
            ctx.fillStyle = COLORS.CONE_WHITE;
            ctx.beginPath(); ctx.moveTo(cX - 4, cY - 4); ctx.lineTo(cX + 4, cY - 4); ctx.lineTo(cX + 2, cY - 8); ctx.lineTo(cX - 2, cY - 8); ctx.fill();
          }
          else if (obs.type === 'abandoned_bus') {
             // Rusty old bus, width is TILE_SIZE * 3
             const h = TILE_SIZE * 0.8;
             drawShadow(ctx, x, y + TILE_SIZE, obs.width, h, 0.4);
             
             ctx.fillStyle = COLORS.ABANDONED_BUS_BODY;
             // Main body
             ctx.fillRect(x, y + TILE_SIZE - h, obs.width, h);
             // Windows (Broken)
             ctx.fillStyle = COLORS.ABANDONED_BUS_WINDOW;
             const windowW = 20;
             const gap = 10;
             for(let w = 10; w < obs.width - 10; w += windowW + gap) {
                 ctx.fillRect(x + w, y + TILE_SIZE - h + 10, windowW, 15);
             }
             // Rust spots
             ctx.fillStyle = '#78350f'; // Dark rust
             ctx.fillRect(x + 10, y + TILE_SIZE - 10, 10, 5);
             ctx.fillRect(x + obs.width - 30, y + TILE_SIZE - 20, 15, 8);
             
             // "BUS" text
             ctx.fillStyle = '#78350f';
             ctx.font = 'bold 10px monospace';
             ctx.fillText('BUS', x + obs.width/2 - 10, y + TILE_SIZE - 30);
          }
          else if (obs.type === 'lilypad') {
             const padW = TILE_SIZE * 0.85;
             const padH = TILE_SIZE * 0.85;
             const cX = x + TILE_SIZE/2;
             const cY = y + TILE_SIZE/2;
             
             // Water ripple/shadow underneath
             ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
             ctx.beginPath();
             ctx.ellipse(cX, cY + 2, padW/2, padH/2, 0, 0, Math.PI*2);
             ctx.fill();
             
             // Pad Base
             ctx.fillStyle = '#166534'; // Dark green edge
             ctx.beginPath();
             ctx.arc(cX, cY + 2, padW/2, 0, Math.PI * 1.8);
             ctx.lineTo(cX, cY + 2);
             ctx.fill();

             // Pad Top
             ctx.fillStyle = '#22c55e'; // green-500
             ctx.beginPath();
             ctx.arc(cX, cY, padW/2, 0, Math.PI * 1.8);
             ctx.lineTo(cX, cY);
             ctx.fill();
             
             // Details (Veins)
             ctx.strokeStyle = '#15803d'; // green-700
             ctx.lineWidth = 1.5;
             ctx.beginPath();
             ctx.moveTo(cX, cY);
             ctx.lineTo(cX - padW/2.5, cY - padH/2.5);
             ctx.moveTo(cX, cY);
             ctx.lineTo(cX + padW/2.5, cY - padH/3);
             ctx.moveTo(cX, cY);
             ctx.lineTo(cX - padW/3, cY + padH/2.5);
             ctx.stroke();

             // Flower (Optional)
             if (obs.id % 3 === 0) {
                 ctx.fillStyle = '#fdf4ff'; // Pinkish white
                 ctx.beginPath();
                 ctx.arc(cX + padW/4, cY - padH/4, 4, 0, Math.PI*2);
                 ctx.fill();
                 ctx.fillStyle = '#fbcfe8';
                 ctx.beginPath();
                 ctx.arc(cX + padW/4, cY - padH/4, 2, 0, Math.PI*2);
                 ctx.fill();
             }
          }
      });
    });



    // Draw projectiles
    if (state.projectiles) {
        state.projectiles.forEach(p => {
            const pY = projectY(p.y);
            // Color based on owner
            ctx.fillStyle = p.ownerId === -1 ? '#ef4444' : '#facc15'; // Red for enemy, Yellow for player
            ctx.beginPath();
            ctx.arc(p.x, pY, 4, 0, Math.PI*2);
            ctx.fill();
            // Trail
            ctx.fillStyle = p.ownerId === -1 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(250, 204, 21, 0.3)';
            ctx.beginPath();
            ctx.arc(p.x - p.vx*0.5, pY + p.vy*0.5, 3, 0, Math.PI*2);
            ctx.fill();
        });
    }

    // Draw enemies
    if (state.enemies) {
        state.enemies.forEach(enemy => {
            const eX = enemy.x;
            const eY = projectY(enemy.y);
            
            // Only draw if visible
            if (eY < -50 || eY > CANVAS_HEIGHT + 50) return;

            ctx.save();
            ctx.translate(eX + TILE_SIZE/2, eY + TILE_SIZE);
            
            if (enemy.type === 'chaser') {
                // Chaser Enemy (e.g., a Wolf or Bear)
                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.beginPath();
                ctx.ellipse(0, -4, 16, 8, 0, 0, Math.PI*2);
                ctx.fill();

                // Body
                ctx.fillStyle = '#4b5563'; // Gray-600
                ctx.fillRect(-14, -26, 28, 18);
                
                // Head
                ctx.fillStyle = '#374151'; // Gray-700
                if (enemy.facing === 'LEFT') {
                    ctx.fillRect(-20, -32, 16, 16);
                    // Snout
                    ctx.fillStyle = '#9ca3af';
                    ctx.fillRect(-24, -24, 6, 6);
                    ctx.fillStyle = '#000';
                    ctx.fillRect(-24, -24, 2, 2); // Nose
                    // Eyes (Red for scary)
                    ctx.fillStyle = '#ef4444';
                    ctx.fillRect(-18, -28, 2, 2);
                } else if (enemy.facing === 'RIGHT') {
                    ctx.fillRect(4, -32, 16, 16);
                    // Snout
                    ctx.fillStyle = '#9ca3af';
                    ctx.fillRect(18, -24, 6, 6);
                    ctx.fillStyle = '#000';
                    ctx.fillRect(22, -24, 2, 2); // Nose
                    // Eyes
                    ctx.fillStyle = '#ef4444';
                    ctx.fillRect(16, -28, 2, 2);
                } else if (enemy.facing === 'UP') {
                    ctx.fillRect(-8, -32, 16, 16);
                    // Ears
                    ctx.fillStyle = '#374151';
                    ctx.beginPath(); ctx.moveTo(-8, -32); ctx.lineTo(-4, -32); ctx.lineTo(-6, -38); ctx.fill();
                    ctx.beginPath(); ctx.moveTo(4, -32); ctx.lineTo(8, -32); ctx.lineTo(6, -38); ctx.fill();
                } else {
                    // DOWN
                    ctx.fillRect(-8, -32, 16, 16);
                    // Snout
                    ctx.fillStyle = '#9ca3af';
                    ctx.fillRect(-6, -22, 12, 6);
                    ctx.fillStyle = '#000';
                    ctx.fillRect(-2, -20, 4, 2); // Nose
                    // Eyes
                    ctx.fillStyle = '#ef4444';
                    ctx.fillRect(-4, -28, 2, 2);
                    ctx.fillRect(2, -28, 2, 2);
                    // Ears
                    ctx.fillStyle = '#374151';
                    ctx.beginPath(); ctx.moveTo(-8, -32); ctx.lineTo(-4, -32); ctx.lineTo(-6, -38); ctx.fill();
                    ctx.beginPath(); ctx.moveTo(4, -32); ctx.lineTo(8, -32); ctx.lineTo(6, -38); ctx.fill();
                }

                // Legs
                ctx.fillStyle = '#1f2937';
                const legSwing = Math.sin(state.frameCount * 0.3) * 5;
                if (enemy.facing === 'LEFT' || enemy.facing === 'RIGHT') {
                    ctx.fillRect(-10 + legSwing, -8, 6, 8);
                    ctx.fillRect(4 - legSwing, -8, 6, 8);
                } else {
                    ctx.fillRect(-8, -8, 6, 8);
                    ctx.fillRect(2, -8, 6, 8);
                }
            }

            ctx.restore();
        });
    }

    if (status !== GameStatus.MENU) {
       // Draw all players
       state.players.forEach(p => {
           drawPlayer(ctx, p, projectY, state.frameCount);
       });
    }
    
    // Draw Particles
    state.particles.forEach(p => {
       const screenY = projectY(p.y);
       ctx.save();
       ctx.translate(p.x, screenY);
       if (p.rotation !== undefined) ctx.rotate(p.rotation);
       
       if (p.type === 'smoke' || p.type === 'fire') {
          const alpha = Math.min(1, p.life / 20);
          const r = p.size;
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
          grad.addColorStop(0, p.color); 
          grad.addColorStop(1, `rgba(0,0,0,0)`); 
          ctx.globalAlpha = alpha;
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
       } else {
         ctx.fillStyle = p.color;
         ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
       }
       ctx.restore();
    });

    // Draw Text
    state.floatingTexts.forEach(t => {
       const screenY = projectY(t.y);
       ctx.fillStyle = t.color;
       ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
       ctx.font = 'bold 16px "Press Start 2P"'; 
       ctx.strokeText(t.text, t.x, screenY);
       ctx.fillText(t.text, t.x, screenY);
    });
    
    ctx.restore();

  }, [status]);

  const drawPlayer = (ctx: CanvasRenderingContext2D, player: Player, projectY: (y: number) => number, frameCount: number) => {
    // If dead and timer > 0, maybe flash ghost or don't draw
    if (player.dead && player.active === false && player.respawnTimer > 0) return;

    // Set colors based on profile AND breed
    let C = {
        BODY: COLORS.CHICKEN_BODY,
        SIDE: COLORS.CHICKEN_SIDE,
        COMB: COLORS.CHICKEN_COMB,
        BEAK: COLORS.CHICKEN_BEAK,
        LEG: COLORS.CHICKEN_LEG
    };

    if (player.colorProfile === 'P2') {
        C = {
            BODY: COLORS.CHICKEN_P2_BODY,
            SIDE: COLORS.CHICKEN_P2_SIDE,
            COMB: COLORS.CHICKEN_P2_COMB,
            BEAK: COLORS.CHICKEN_P2_BEAK,
            LEG: COLORS.CHICKEN_P2_LEG || COLORS.CHICKEN_LEG
        };
    } else {
        // Apply Breed Colors for P1 (or default)
        if (player.breed === 'SILKIE') {
            C.BODY = '#e5e7eb'; // Light gray
            C.SIDE = '#d1d5db';
            C.COMB = '#4b5563'; // Dark comb
        } else if (player.breed === 'ROOSTER') {
            C.BODY = '#b91c1c'; // Reddish
            C.SIDE = '#991b1b';
            C.COMB = '#ef4444'; // Bright red
        } else if (player.breed === 'VOID') {
            C.BODY = '#1e1b4b'; // Dark indigo
            C.SIDE = '#0f172a';
            C.COMB = '#6366f1'; // Glowing indigo
            C.BEAK = '#818cf8';
        }
    }

    const pX = player.x;
    const pY = projectY(player.y) - player.z; 
    const pGroundY = projectY(player.y);
    
    ctx.save();
    
    if (!player.dead && player.z >= 0) {
       const shadowScale = Math.max(0.4, 1 - (player.z / 80)); 
       const shadowAlpha = Math.max(0.1, 0.4 - (player.z / 150));
       ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
       ctx.beginPath();
       ctx.ellipse(pX + TILE_SIZE/2 + 2, pGroundY + TILE_SIZE/2 + 2, 12 * shadowScale, 6 * shadowScale, 0, 0, Math.PI*2);
       ctx.fill();
    }
    
    const centerX = pX + TILE_SIZE/2;
    const bottomY = pY + TILE_SIZE;
    ctx.translate(centerX, bottomY);
    
    if (player.dead) {
       ctx.rotate(Math.PI/2);
       ctx.scale(1, 0.1); 
    } else {
       ctx.scale(player.scale.x, player.scale.y);
    }
    ctx.translate(-centerX, -bottomY);

    if (player.powerUpState.shield) {
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.strokeStyle = COLORS.POWERUP_SHIELD_GLOW;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const bubbleSize = TILE_SIZE * 0.8 + Math.sin(frameCount * 0.2) * 2;
        ctx.arc(pX + TILE_SIZE/2, pY + TILE_SIZE/2 - 10, bubbleSize, 0, Math.PI*2);
        ctx.fill(); ctx.stroke();
    }

    if (player.dead) {
       ctx.fillStyle = C.BODY;
       ctx.beginPath(); ctx.arc(pX + TILE_SIZE/2, pY + TILE_SIZE/2, 20, 0, Math.PI*2); ctx.fill();
       ctx.restore();
       return;
    }

    const bob = player.isMoving ? 0 : Math.sin(frameCount * 0.15 + player.id) * 2;
    const drawY = pY + bob;

    const bodyW = 20; const bodyH = 20;
    const bodyX = pX + (TILE_SIZE - bodyW)/2;
    const bodyY = drawY + TILE_SIZE - 35; 

    // Legs
    ctx.fillStyle = C.LEG;
    if (player.isMoving) {
       const swing = Math.sin(player.moveProgress * Math.PI * 2) * 6;
       ctx.fillRect(bodyX + 4, bodyY + bodyH, 2, 5 + swing);
       ctx.fillRect(bodyX + bodyW - 6, bodyY + bodyH, 2, 5 - swing);
    } else {
       ctx.fillRect(bodyX + 4, bodyY + bodyH, 2, 5);
       ctx.fillRect(bodyX + bodyW - 6, bodyY + bodyH, 2, 5);
    }

    // Body
    ctx.fillStyle = C.SIDE;
    ctx.fillRect(bodyX, bodyY, bodyW, bodyH); 
    ctx.fillStyle = C.BODY; 
    ctx.fillRect(bodyX, bodyY - bodyH/2, bodyW, bodyH/2);

    // Wings
    ctx.fillStyle = '#fcd34d'; 
    if (player.colorProfile === 'P2') ctx.fillStyle = '#94a3b8';
    
    // Breed Wing Override
    if (player.breed === 'SILKIE') ctx.fillStyle = '#e5e7eb';
    if (player.breed === 'ROOSTER') ctx.fillStyle = '#15803d'; // Green wings
    if (player.breed === 'VOID') ctx.fillStyle = '#4338ca';

    let wingOffset = 0;
    if (player.isMoving && player.z > 5) wingOffset = Math.sin(frameCount * 0.8) * 6;
    else if (!player.isMoving) wingOffset = Math.sin(frameCount * 0.1) * 1;

    ctx.beginPath();
    ctx.moveTo(bodyX, bodyY + 5);
    ctx.lineTo(bodyX - 4 - wingOffset, bodyY + 12 - wingOffset);
    ctx.lineTo(bodyX, bodyY + 15);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(bodyX + bodyW, bodyY + 5);
    ctx.lineTo(bodyX + bodyW + 4 + wingOffset, bodyY + 12 - wingOffset);
    ctx.lineTo(bodyX + bodyW, bodyY + 15);
    ctx.fill();

    // Beak
    ctx.fillStyle = C.BEAK;
    if (player.facing === 'RIGHT') ctx.fillRect(bodyX + bodyW, bodyY - 5 + bob/2, 6, 6);
    else if (player.facing === 'LEFT') ctx.fillRect(bodyX - 6, bodyY - 5 + bob/2, 6, 6);
    else ctx.fillRect(bodyX + 7, bodyY + 5 + bob/2, 6, 6);

    // Comb
    ctx.fillStyle = C.COMB;
    ctx.fillRect(bodyX + 7, bodyY - bodyH/2 - 4 + bob, 6, 4);
    
    // Silkie Fluff
    if (player.breed === 'SILKIE') {
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(bodyX + 4, bodyY - bodyH/2 - 6 + bob, 12, 6);
    }

    // Eyes
    const blinkCycle = frameCount % (200 + player.id * 50);
    const blink = blinkCycle > 190; 

    if (!blink) {
        ctx.fillStyle = player.breed === 'VOID' ? '#ef4444' : '#000'; // Red eyes for Void
        if (player.facing === 'RIGHT') ctx.fillRect(bodyX + bodyW - 2, bodyY - 8 + bob, 2, 2);
        else if (player.facing === 'LEFT') ctx.fillRect(bodyX, bodyY - 8 + bob, 2, 2);
        else {
           ctx.fillRect(bodyX + 4, bodyY - 5 + bob, 2, 2);
           ctx.fillRect(bodyX + bodyW - 6, bodyY - 5 + bob, 2, 2);
        }
    }

    // --- COSMETICS ---
    const headTopY = bodyY - bodyH/2 + bob;
    const headCenterX = bodyX + bodyW/2;

    if (player.cosmetic === 'TOP_HAT') {
        ctx.fillStyle = '#111';
        ctx.fillRect(headCenterX - 10, headTopY - 2, 20, 2); // Brim
        ctx.fillRect(headCenterX - 6, headTopY - 14, 12, 12); // Hat
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(headCenterX - 6, headTopY - 4, 12, 2); // Band
    } else if (player.cosmetic === 'CROWN') {
        ctx.fillStyle = '#fbbf24'; // Gold
        ctx.beginPath();
        ctx.moveTo(headCenterX - 8, headTopY);
        ctx.lineTo(headCenterX - 8, headTopY - 10);
        ctx.lineTo(headCenterX - 4, headTopY - 6);
        ctx.lineTo(headCenterX, headTopY - 12);
        ctx.lineTo(headCenterX + 4, headTopY - 6);
        ctx.lineTo(headCenterX + 8, headTopY - 10);
        ctx.lineTo(headCenterX + 8, headTopY);
        ctx.fill();
    } else if (player.cosmetic === 'SUNGLASSES') {
        ctx.fillStyle = '#000';
        if (player.facing === 'RIGHT') {
            ctx.fillRect(bodyX + bodyW - 2, bodyY - 9 + bob, 6, 4);
        } else if (player.facing === 'LEFT') {
            ctx.fillRect(bodyX - 4, bodyY - 9 + bob, 6, 4);
        } else {
            ctx.fillRect(bodyX + 2, bodyY - 6 + bob, 16, 4);
        }
    } else if (player.cosmetic === 'HEADPHONES') {
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(headCenterX, headTopY + 6, 12, Math.PI, 0);
        ctx.stroke();
        
        ctx.fillStyle = '#ef4444'; // Red muffs
        if (player.facing === 'RIGHT' || player.facing === 'LEFT') {
             ctx.fillRect(headCenterX - 4, headTopY + 2, 8, 8);
        } else {
             ctx.fillRect(headCenterX - 14, headTopY + 4, 6, 10);
             ctx.fillRect(headCenterX + 8, headTopY + 4, 6, 10);
        }
    }
    
    ctx.restore();
  };

  const tick = useCallback(() => {
    update();
    draw();
    requestRef.current = requestAnimationFrame(tick);
  }, [update, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(tick);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [tick]);

  return (
    <div 
      className="relative w-full h-[100dvh] bg-slate-900 flex flex-col items-center justify-center select-none overflow-hidden touch-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      
      {/* HUD */}
      {status === GameStatus.PLAYING && (
      <div className="absolute top-4 left-0 right-0 z-10 flex flex-col items-center pointer-events-none gap-2">
         {/* Score Board */}
         <div className="flex justify-between w-full max-w-[800px] px-6">
            <div className="bg-slate-900/90 p-3 rounded-xl border-2 border-slate-700 shadow-xl backdrop-blur-md transform -skew-x-6">
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest block transform skew-x-6">Score</span>
                <span className="text-white pixel-font text-3xl transform skew-x-6 block text-center transition-all duration-100" style={{ color: activePowerUps.multi > 0 ? COLORS.POWERUP_MULTI : 'white' }}>
                    {score}
                    {activePowerUps.multi > 0 && <span className="text-xs ml-1 text-fuchsia-400">x2</span>}
                </span>
            </div>
            <div className="bg-slate-900/90 p-3 rounded-xl border-2 border-yellow-600/50 shadow-xl backdrop-blur-md transform -skew-x-6">
                <span className="text-yellow-500 text-[10px] font-black uppercase tracking-widest block flex items-center gap-1 transform skew-x-6">
                <Trophy size={10} strokeWidth={3} /> Best
                </span>
                <span className="text-white pixel-font text-3xl transform skew-x-6 block text-center">{highScore}</span>
            </div>
         </div>
         
         {/* Active Effects / P2 Status */}
         <div className="flex gap-2">
             {activePowerUps.shield && (
                 <div className="bg-blue-500/90 text-white p-2 rounded-lg border-2 border-blue-400 shadow-lg flex items-center gap-2 animate-bounce">
                     <Shield size={16} fill="white" />
                     <span className="text-xs font-bold pixel-font">SHIELD</span>
                 </div>
             )}
             {activePowerUps.speed > 0 && (
                 <div className="bg-amber-500/90 text-white p-2 rounded-lg border-2 border-amber-400 shadow-lg flex items-center gap-2">
                     <Zap size={16} fill="white" />
                     <span className="text-xs font-bold pixel-font">{Math.ceil(activePowerUps.speed/60)}s</span>
                 </div>
             )}
         </div>
         
         {/* Co-op HUD */}
         {selectedMode === GameMode.COOP && (
             <div className="mt-2 flex gap-4">
                 <div className={`p-2 rounded-lg border-2 flex items-center gap-2 ${playerStats.p1Respawn > 0 ? 'bg-red-900 border-red-700 opacity-50' : (playerStats.p1Shield ? 'bg-blue-600 border-blue-400' : 'bg-yellow-600 border-yellow-400')}`}>
                     <User size={16} fill="white" /> 
                     <span className="text-[10px] font-bold">
                         {playerStats.p1Respawn > 0 ? `${playerStats.p1Respawn} PTS` : 'P1'}
                     </span>
                     {playerStats.p1Respawn <= 0 && (
                         <div className="flex gap-1 ml-2">
                             {[...Array(3)].map((_, i) => (
                                 <div key={i} className={`w-3 h-3 rounded-full ${i < playerStats.p1Health ? 'bg-red-500' : 'bg-slate-800'}`} />
                             ))}
                         </div>
                     )}
                 </div>
                 <div className={`p-2 rounded-lg border-2 flex items-center gap-2 ${playerStats.p2Respawn > 0 ? 'bg-red-900 border-red-700 opacity-50' : (playerStats.p2Shield ? 'bg-blue-600 border-blue-400' : 'bg-slate-600 border-slate-400')}`}>
                     <User size={16} fill="white" /> 
                     <span className="text-[10px] font-bold">
                         {playerStats.p2Respawn > 0 ? `${playerStats.p2Respawn} PTS` : 'P2'}
                     </span>
                     {playerStats.p2Respawn <= 0 && (
                         <div className="flex gap-1 ml-2">
                             {[...Array(3)].map((_, i) => (
                                 <div key={i} className={`w-3 h-3 rounded-full ${i < playerStats.p2Health ? 'bg-red-500' : 'bg-slate-800'}`} />
                             ))}
                         </div>
                     )}
                 </div>
             </div>
         )}
      </div>
      )}

      {/* Canvas */}
      <div className="relative shadow-2xl rounded-2xl overflow-hidden border-8 border-slate-800 bg-[#84cc16] w-full max-w-4xl flex-shrink-0">
        <canvas 
          ref={canvasRef} 
          width={CANVAS_WIDTH} 
          height={CANVAS_HEIGHT} 
          className="w-full h-auto object-contain block"
          style={{ imageRendering: 'pixelated' }}
        />
        
        {/* Menu Overlay */}
        {status === GameStatus.MENU && (
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-4 text-center backdrop-blur-[1px]">
             <div className="relative mb-8 transform hover:scale-105 transition-transform duration-500">
                <div className="absolute inset-0 bg-yellow-500 blur-2xl opacity-20 animate-pulse rounded-full"></div>
                <h1 className="relative text-5xl md:text-7xl text-white pixel-font text-shadow-lg tracking-tighter leading-none transform -rotate-3 animate-[wiggle_3s_ease-in-out_infinite]">
                  CHICKEN
                </h1>
                <h1 className="relative text-5xl md:text-7xl text-yellow-400 pixel-font text-shadow-lg tracking-tighter leading-none transform rotate-2 animate-[wiggle_3s_ease-in-out_infinite_reverse] ml-8">
                  CROSSY
                </h1>
             </div>
             
             {/* Mode Selection */}
             <div className="flex gap-4 mb-4">
                 <button 
                    onClick={() => setSelectedMode(GameMode.SINGLE)}
                    className={`px-4 py-3 rounded-xl border-b-4 font-bold transition-all ${selectedMode === GameMode.SINGLE ? 'bg-green-500 border-green-700 scale-110 shadow-lg text-white' : 'bg-slate-700 border-slate-900 text-slate-400 hover:bg-slate-600'}`}
                 >
                    SINGLE
                 </button>
                 <button 
                    onClick={() => setSelectedMode(GameMode.COOP)}
                    className={`px-4 py-3 rounded-xl border-b-4 font-bold transition-all flex items-center gap-2 ${selectedMode === GameMode.COOP ? 'bg-blue-500 border-blue-700 scale-110 shadow-lg text-white' : 'bg-slate-700 border-slate-900 text-slate-400 hover:bg-slate-600'}`}
                 >
                    <Users size={16} /> CO-OP
                 </button>
             </div>

             {/* Difficulty Selection */}
             <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-xl">
                 {Object.values(DifficultyLevel).map((diff) => (
                     <button
                         key={diff}
                         onClick={() => setSelectedDifficulty(diff)}
                         className={`px-3 py-2 rounded-lg border-b-4 font-bold text-sm transition-all ${selectedDifficulty === diff ? 'bg-purple-500 border-purple-700 scale-110 shadow-lg text-white' : 'bg-slate-700 border-slate-900 text-slate-400 hover:bg-slate-600'}`}
                     >
                         {diff}
                     </button>
                 ))}
             </div>
             
             <button 
               onClick={() => initGame(selectedMode, selectedDifficulty)}
               className="group relative px-8 py-5 bg-yellow-500 hover:bg-yellow-400 text-white font-bold rounded-2xl border-b-8 border-yellow-700 active:border-b-0 active:translate-y-2 transition-all flex items-center gap-4 text-2xl shadow-[0_10px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_30px_rgba(250,204,21,0.4)]"
             >
               <div className="bg-white/20 p-2 rounded-lg">
                 <Play className="fill-white w-6 h-6" /> 
               </div>
               <span className="pixel-font text-xl mt-1 tracking-wide">START GAME</span>
             </button>

             {/* Customization Button */}
             <button 
                onClick={() => setShowCustomization(true)}
                className="mt-4 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl border-b-4 border-slate-900 transition-all flex items-center gap-2"
             >
                <User size={20} /> CUSTOMIZE
             </button>

             {/* Customization Overlay */}
             {showCustomization && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 p-6 rounded-2xl border-4 border-slate-600 max-w-md w-full shadow-2xl">
                        <h2 className="text-2xl text-white font-bold mb-6 text-center pixel-font">CUSTOMIZE</h2>
                        
                        <div className="mb-6">
                            <h3 className="text-yellow-400 font-bold mb-2 text-left text-sm tracking-wider">BREED</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {['CLASSIC', 'SILKIE', 'ROOSTER', 'VOID'].map(breed => (
                                    <button
                                        key={breed}
                                        onClick={() => setSelectedBreed(breed as ChickenBreed)}
                                        className={`p-3 rounded-lg border-2 text-xs font-bold transition-all ${selectedBreed === breed ? 'bg-green-600 border-green-400 text-white scale-105 shadow-lg' : 'bg-slate-700 border-slate-900 text-slate-400 hover:bg-slate-600'}`}
                                    >
                                        {breed}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mb-8">
                            <h3 className="text-blue-400 font-bold mb-2 text-left text-sm tracking-wider">ACCESSORY</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {['NONE', 'TOP_HAT', 'SUNGLASSES', 'CROWN', 'HEADPHONES'].map(item => (
                                    <button
                                        key={item}
                                        onClick={() => setSelectedCosmetic(item as CosmeticItem)}
                                        className={`p-3 rounded-lg border-2 text-xs font-bold transition-all ${selectedCosmetic === item ? 'bg-blue-600 border-blue-400 text-white scale-105 shadow-lg' : 'bg-slate-700 border-slate-900 text-slate-400 hover:bg-slate-600'}`}
                                    >
                                        {item.replace('_', ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button 
                            onClick={() => setShowCustomization(false)}
                            className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl border-b-4 border-yellow-700 active:border-b-0 active:translate-y-1 transition-all text-xl pixel-font"
                        >
                            DONE
                        </button>
                    </div>
                </div>
             )}
             
             <div className="mt-12 flex gap-6 text-white/80 font-bold bg-slate-900/60 p-4 rounded-2xl backdrop-blur-md border border-white/10 shadow-xl">
                <div className="flex flex-col items-center gap-2">
                   <div className="text-[10px] text-yellow-300 mb-1">PLAYER 1</div>
                   <div className="grid grid-cols-3 gap-1">
                      <div/>
                      <span className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center border-b-2 border-slate-800 shadow-lg text-xs">W</span>
                      <div/>
                      <span className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center border-b-2 border-slate-800 shadow-lg text-xs">A</span>
                      <span className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center border-b-2 border-slate-800 shadow-lg text-xs">S</span>
                      <span className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center border-b-2 border-slate-800 shadow-lg text-xs">D</span>
                   </div>
                </div>
                
                {selectedMode === GameMode.COOP && (
                <>
                <div className="w-px bg-white/20"></div>
                <div className="flex flex-col items-center gap-2">
                   <div className="text-[10px] text-blue-300 mb-1">PLAYER 2</div>
                   <div className="grid grid-cols-3 gap-1">
                      <div/>
                      <ArrowUp className="w-8 h-8 p-1 rounded bg-slate-700 border-b-2 border-slate-800 shadow-lg" />
                      <div/>
                      <ArrowLeft className="w-8 h-8 p-1 rounded bg-slate-700 border-b-2 border-slate-800 shadow-lg" />
                      <ArrowDown className="w-8 h-8 p-1 rounded bg-slate-700 border-b-2 border-slate-800 shadow-lg" />
                      <ArrowRight className="w-8 h-8 p-1 rounded bg-slate-700 border-b-2 border-slate-800 shadow-lg" />
                   </div>
                </div>
                </>
                )}
             </div>
          </div>
        )}

        {/* Game Over Overlay */}
        {status === GameStatus.GAME_OVER && (
          <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm animate-in fade-in duration-300">
             <h2 className="text-6xl text-white pixel-font mb-8 text-shadow-red transform rotate-2 animate-[pulse_0.5s_ease-in-out]">SPLAT!</h2>
             
             <div className="bg-white p-6 rounded-3xl mb-8 min-w-[240px] shadow-[0_15px_0_rgba(0,0,0,0.1)] transform hover:scale-105 transition-transform duration-300 border-4 border-slate-200">
                <div className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-2">Final Score</div>
                <div className="text-6xl font-black text-slate-800 pixel-font leading-none">{score}</div>
                {score >= highScore && score > 0 && (
                   <div className="mt-4 inline-block px-4 py-2 bg-yellow-400 text-yellow-900 text-xs font-black rounded-full animate-bounce shadow-lg">
                      NEW RECORD!
                   </div>
                )}
             </div>

             <button 
               onClick={() => initGame(selectedMode)}
               className="px-10 py-5 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-2xl border-b-8 border-blue-700 active:border-b-0 active:translate-y-2 transition-all flex items-center gap-4 text-xl shadow-xl hover:shadow-blue-500/30"
             >
               <RotateCcw className="w-6 h-6" strokeWidth={3} /> 
               <span className="pixel-font tracking-wide mt-1">TRY AGAIN</span>
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CrossyRoadGame;