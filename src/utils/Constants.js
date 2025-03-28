/**
 * Game constants to avoid magic numbers throughout the codebase
 */
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const GAME_GRAVITY = 0; // Add default gravity for the game (0 for underwater)

// Player constants
export const PLAYER = {
    STARTING_X: 100,
    STARTING_Y: 100,
    SPEED: 200,
    MOVE_SPEED: 200,
    MAX_VELOCITY: 250,
    DRAG: 80,
    ACCELERATION: 200,
    GRAVITY: 200,
    TREAD_FORCE: 185,  // Slightly increased to allow initial good resistance
    TREAD_WATER: {
        VELOCITY_DAMPEN: 0.96,
        MAX_FALL_SPEED: 300,    
        DRAG_MULTIPLIER: 2.2,
        MOMENTUM_THRESHOLD: -50,
        STAMINA: {
            MAX_DURATION: 2200,      // Total duration including decay (ms)
            DECAY_START: 2000,       // Hold full effectiveness for 2 seconds
            MIN_EFFECTIVENESS: 0,     // Complete loss of tread force when depleted
            RECOVERY_RATE: 0.4,      // Keep recovery rate the same
            DECAY_RATE: 0.9          // Even faster decay for more dramatic drop-off
        },
        TREAD_SCALING: {
            MIN_FORCE: 0.65,
            SPEED_THRESHOLD: 275
        },
        POST_BOOST: {
            GRAVITY_SCALE: 1.5,
            GRACE_PERIOD: 400,
            MAX_DRIFT_SPEED: 200,
            POST_ARC_GRAVITY: 1.2
        }
    },
    HITBOX: {
        WIDTH: 60,
        HEIGHT: 80,
        OFFSET_X: 10,
        OFFSET_Y: 20
    },
    HEALTH: {
        MAX: 100,
        DAMAGE: {
            OBSTACLE: 10,
            NO_OXYGEN: 5
        }
    },
    OXYGEN_DEPLETION_DAMAGE: 5,
    BOOST: {
        SPEED: {
            MAX_VELOCITY: 600, // Reduced for better control
            SUPER_BOOST: 800  // Maximum boost speed
        },
        OXYGEN_COST: 2, // Oxygen units per second during boost
        BURST_INTERVAL: 40, // Milliseconds between particle bursts during boost
        COOLDOWN: 500 // Milliseconds of cooldown after boost ends
    },
    BOUNCE: 0.1,
    FRICTION: 0.1
};

// Animation constants
export const ANIMATIONS = {
    IDLE_SWIM: {
        KEY: 'idle_swim',
        FRAME_RATE: 6,
        FRAME_WIDTH: 87,     // Updated to match actual sprite dimensions (261 ÷ 3 frames)
        FRAME_HEIGHT: 102,   // Updated to match actual sprite height
        FRAMES: 3            // Total number of frames in the animation
    },
    DROWNING: {
        KEY: 'drowning',
        FRAME_RATE: 4
    }
};

// Physics constants
export const PHYSICS = {
    TILE_BIAS: 64, // Increased to prevent tunneling through tiles
    BOUNCE: 0.1,
    FRICTION: 0.1,
    WORLD_BOUNDS: {
        WIDTH: 1600,  // Match original game's world size
        HEIGHT: 1200  // Match original game's world size
    }
};

// Particle effects constants
export const PARTICLES = {
    BUBBLE: {
        SCALE: { START: 0.1, END: 0.02 },
        ALPHA: { START: 0.6, END: 0 },
        SPEED: { MIN: 40, MAX: 80 },
        LIFESPAN: 3000,
        FREQUENCY: 300,
        QUANTITY: 1
    },
    MOVEMENT: {
        SCALE: { START: 0.2, END: 0.05 },
        ALPHA: { START: 0.9, END: 0 },
        SPEED: { MIN: 250, MAX: 400 },
        LIFESPAN: 1000,
        FREQUENCY: 20,
        QUANTITY: 3
    },
    BOOST: {
        SCALE: { START: 0.15, END: 0.05 },
        ALPHA: { START: 1.0, END: 0 },
        SPEED: { MIN: 600, MAX: 900 },
        LIFESPAN: 1200,
        PARTICLE_COUNT: 45
    }
};

// Oxygen system constants
export const OXYGEN = {
    MAX: 100,
    DRAIN_RATE: 1,        // Units per second (reduced from 2)
    DRAIN_RATE_BOOST: 5,  // Units per second when boosting (reduced from 10)
    REFILL_RATE: 100,     // Units per second when in air pocket (changed to instant refill)
    MAX_DISPLAY_WIDTH: 400, // Increased to match original game
    COLOR: {
        NORMAL: 0x00a0ff,   // Blue for normal oxygen (changed from green)
        WARNING: 0xe74c3c,  // Red when low
        CRITICAL: 0xff0000, // Bright red when critical
        BOOST: 0x00ffff     // Cyan when boosting
    }
};

// Camera constants
export const CAMERA = {
    FOLLOW: true,
    DEADZONE: {
        WIDTH: 200,
        HEIGHT: 200
    },
    LERP: 0.1,
    ZOOM: {
        DEFAULT: 1,
        MIN: 0.5,
        MAX: 1.5,
        STEP: 0.1
    },
    SHAKE: {
        DURATION: 100,
        INTENSITY: 0.003
    }
};

// Air pocket constants
export const AIR_POCKET = {
    SCALE: 0.165,
    BASE_SPEED: {
        MIN: 350, // Half of original game (700) for slower movement
        MAX: 400  // Half of original game (800) for slower movement
    },
    WOBBLE: {
        SPEED: {
            MIN: 0.02,
            MAX: 0.04
        },
        AMPLITUDE: {
            MIN: 10,
            MAX: 20
        }
    },
    // RESPAWN_TIME: 8000, // 8 seconds (same as original game) - Removed to use Tiled respawn time
    VARIATIONS: 3       // Number of air pocket variations
};

// Audio system constants
export const AUDIO = {
    MUSIC_VOLUME: 0.5,
    AMBIENCE_VOLUME: 0.3,
    EFFECTS_VOLUME: 0.7,
    MASTER_VOLUME: 1.0
};

// Add lighting constants
export const LIGHTING = {
    TRANSITION_SPEED: 0.0004,  // Extremely slow for ultra-smooth transitions
    ZONE_LEVELS: {
        DEFAULT: 0,     // Default brightness (no darkening)
        DIM: 0.4,       // 40% darkness
        DARK: 0.7,      // 70% darkness
        BLACK: 0.9      // 90% darkness
    },
    FLASHLIGHT: {
        CONE_ANGLE: Math.PI / 6,  // 30 degrees for more focused beam
        LENGTH: 600,              // Much longer beam
        GRADIENT: {
            INNER: { color: 0xffff80, alpha: 0.8 },  // Brighter center
            MIDDLE: { color: 0xffff80, alpha: 0.4 },
            OUTER: { color: 0xffff80, alpha: 0 }
        },
        FEATHER: {
            STEPS: 15,           // More steps for smoother feathering
            EDGE_SOFTNESS: 0.3   // How soft the edges should be (0-1)
        },
        OFFSET: {
            X: 100,              // Position ahead of player
            Y: 0
        }
    }
}; 