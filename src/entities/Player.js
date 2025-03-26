// ... existing code ...
    constructor(scene, x, y) {
        super(scene, x, y);
        // ... existing initialization code ...
        
        // Initialize tread water stamina
        this.treadStamina = {
            lastTreadStart: 0,
            currentTreadDuration: 0,
            effectiveness: 1,
            isRecovering: true
        };
    }
    
    updateTreadStamina(input) {
        const now = Date.now();
        const stamina = PLAYER.TREAD_WATER.STAMINA;
        
        if (input.up) {
            // If we just started treading
            if (this.treadStamina.isRecovering) {
                this.treadStamina.lastTreadStart = now;
                this.treadStamina.isRecovering = false;
            }
            
            // Calculate how long we've been treading
            this.treadStamina.currentTreadDuration = now - this.treadStamina.lastTreadStart;
            
            // If we're past the decay start time
            if (this.treadStamina.currentTreadDuration > stamina.DECAY_START) {
                // Calculate effectiveness based on how long past decay start we are
                const decayTime = this.treadStamina.currentTreadDuration - stamina.DECAY_START;
                const decayProgress = Math.min(1, decayTime / (stamina.MAX_DURATION - stamina.DECAY_START));
                
                // Exponential decay of effectiveness
                this.treadStamina.effectiveness = 1 - (1 - stamina.MIN_EFFECTIVENESS) * 
                    (1 - Math.pow(1 - decayProgress, stamina.DECAY_RATE));
            }
        } else {
            // Recover stamina when not treading
            this.treadStamina.isRecovering = true;
            this.treadStamina.effectiveness = Math.min(1, 
                this.treadStamina.effectiveness + stamina.RECOVERY_RATE * (this.scene.game.loop.delta / 1000));
        }
        
        return this.treadStamina.effectiveness;
    }
    
    processMovement(input) {
        // ... existing movement code ...
        
        // Only apply tread force if we have any effectiveness left
        if (input.up && treadEffectiveness > 0) {
            const currentVelocityY = this.sprite.body.velocity.y;
            const isFalling = currentVelocityY > 0;
            
            // Calculate tread force with momentum preservation and stamina
            let effectiveTreadForce = PLAYER.TREAD_FORCE * treadEffectiveness;
            
            if (isFalling) {
                const fallSpeedRatio = Math.min(1, currentVelocityY / PLAYER.TREAD_WATER.MAX_FALL_SPEED);
                effectiveTreadForce *= (1 - fallSpeedRatio * 0.3);
            }
            
            // Apply the stamina-adjusted tread force
            this.sprite.setAccelerationY(PLAYER.GRAVITY * gravityScale - effectiveTreadForce);
            currentDirection.y = -1;
            
            if (isFalling) {
                this.sprite.body.velocity.y *= PLAYER.TREAD_WATER.VELOCITY_DAMPEN;
                
                if (this.sprite.body.velocity.y > PLAYER.TREAD_WATER.MAX_FALL_SPEED) {
                    this.sprite.body.velocity.y = PLAYER.TREAD_WATER.MAX_FALL_SPEED;
                }
            }
            
            this.sprite.body.setDragY(PLAYER.DRAG * PLAYER.TREAD_WATER.DRAG_MULTIPLIER);
        } else {
            // When not treading or when stamina is depleted, use base drag
            this.sprite.body.setDragY(PLAYER.DRAG);
        }
        // ... rest of existing code ...
    }
// ... existing code ...