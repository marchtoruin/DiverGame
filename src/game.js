// This file is now deprecated.
// The game has been refactored into a modular structure.
// Please use the following files instead:
//
// - src/index.js - Main entry point
// - src/scenes/GameScene.js - Main game scene
// - src/entities/Player.js - Player entity
// - src/systems/AnimationSystem.js - Animation system
// - src/systems/AudioSystem.js - Audio system
// - src/systems/ParticleSystem.js - Particle effects
// - src/systems/TilemapSystem.js - Tilemap loading and handling
// - src/utils/Constants.js - Game constants

// Importing from our new module structure to maintain backward compatibility
import Game from './index.js';

export default Game; 