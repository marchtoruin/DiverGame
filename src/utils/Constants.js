// ... existing code ...
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
// ... existing code ...