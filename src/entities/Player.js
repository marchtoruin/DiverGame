import { PLAYER, OXYGEN } from '../utils/Constants.js';

export default class Player extends Phaser.GameObjects.Container {
    constructor(scene, x, y) {
        super(scene, x, y);
        
        this.scene = scene;
        this.sprite = null;
        this.boostActive = false;
        this.boostCooldown = false;
        this.boostCooldownTime = 0;
        this.spawnPoint = { x, y };
        this.maxOxygen = OXYGEN.MAX;
        this.oxygen = this.maxOxygen;
        this.health = PLAYER.HEALTH.MAX;
        this.active = true;
        this.transitioning = false;
        this.isInAirPocket = false;
        this.isDrowning = false;
        this.lastPosition = { x, y };
        this.speed = PLAYER.MAX_VELOCITY;
        this._inputState = null;
        this._lastBoostParticleTime = null;
        this.oxygenDepleted = false;
        this.isLowOxygen = false;
        
        // New properties for separate boost system
        this.boostVelocity = { x: 0, y: 0 };
        this.boostDecay = 0.94; // How quickly boost velocity decays each frame
        this.boostDirection = { x: 0, y: 0 };
        this.boostIntensity = 0; // Current boost intensity (0-1)
        
        // Initialize tread water stamina
        this.treadStamina = {
            lastTreadStart: 0,
            currentTreadDuration: 0,
            effectiveness: 1,
            isRecovering: true
        };
    }

    /**
     * Create the player sprite
     * @returns {Phaser.GameObjects.Sprite} The created sprite
     */
    create() {
        try {
            console.log('Creating player sprite...');
            // Create the sprite with physics using the static player texture
            this.sprite = this.scene.physics.add.sprite(
                this.spawnPoint.x, 
                this.spawnPoint.y, 
                'player' // Always use static texture to start
            );
            
            if (!this.sprite) {
                console.error('Failed to create player sprite');
                return null;
            }
            
            // Configure physics body
            const body = this.sprite.body;
            if (body) {
                body.setCollideWorldBounds(true);
                body.setBounce(PLAYER.BOUNCE);
                body.setDrag(PLAYER.DRAG, PLAYER.DRAG);
                body.setFriction(PLAYER.FRICTION, PLAYER.FRICTION);
                body.setMaxVelocity(PLAYER.MAX_VELOCITY, PLAYER.MAX_VELOCITY);
                
                // Set proper hitbox size and offset - keep the same physics body size for collision consistency
                body.setSize(80, 120, true);
                body.setOffset(5, 5);
                
                // Enable collision detection and make player immovable
                body.enable = true;
                body.setImmovable(true);  // Make player immovable for better collision detection
                body.pushable = false;    // Prevent being pushed by enemies
            }
            
            // Set up sprite properties
            this.sprite.setOrigin(0.5, 0.5);
            this.sprite.setDepth(10);
            
            return this.sprite;
        } catch (error) {
            console.error('Error in Player.create():', error);
            // Fall back to the original sprite if the new one fails
            this.sprite = this.scene.physics.add.sprite(
                this.spawnPoint.x, 
                this.spawnPoint.y, 
                'player'
            );
            
            if (this.sprite && this.sprite.body) {
                this.sprite.body.setSize(80, 120, true);
                this.sprite.body.setOffset(5, 5);
                this.sprite.body.enable = true;
            }
            
            return this.sprite;
        }
    }

    createMaskBubbles() {
        if (!this.scene.add || !this.scene.add.particles) return;

        try {
            // Don't create our own mask bubbles - rely on the ParticleSystem
            
            // Create a reference to helmet bubbles from the particle system
            if (this.scene.particleSystem) {
                this.helmetBubbles = this.scene.particleSystem.createHelmetBubbles(this.sprite, 'bubble');
            }
        } catch (error) {
            console.error('Error creating player bubbles:', error);
        }
    }

    /**
     * Reset the player to a specific position
     * @param {number} x - X position to reset to
     * @param {number} y - Y position to reset to
     */
    reset(x, y) {
        this.spawnPoint = { x, y };
        
        if (!this.sprite || !this.sprite.body) {
            if (this.sprite) {
                this.sprite.destroy();
            }
            
            this.sprite = this.create();
        } else {
            this.sprite.setPosition(x, y);
            this.sprite.setVelocity(0, 0);
            this.sprite.setAcceleration(0, 0);
            
            // Ensure max velocity is reset to normal value
            this.sprite.body.setMaxVelocity(PLAYER.MAX_VELOCITY, PLAYER.MAX_VELOCITY);
        }
        
        if (this.sprite) {
            if (this.sprite.body && !this.sprite.body.enable) {
                this.sprite.body.enable = true;
            }
            
            this.sprite.setActive(true);
            this.sprite.setVisible(true);
        }
        
        this.oxygen = this.maxOxygen;
        this.health = PLAYER.HEALTH.MAX;
        this.active = true;
        this.isDrowning = false;
        this.boostActive = false;
        this.boostCooldown = false;
        this.boostCooldownTime = 0;
        
        if (this.scene && this.scene.events) {
            this.scene.events.emit('playerHealthChanged', this.health, PLAYER.HEALTH.MAX);
            this.scene.events.emit('playerOxygenChanged', this.oxygen, this.maxOxygen);
        }
    }

    /**
     * Update player state
     * @param {number} time - Current game time
     * @param {number} delta - Time elapsed since last update
     */
    update(time, delta) {
        if (!this.active || !this.sprite || !this.sprite.body) {
            return;
        }
        
        try {
            const input = this.getInputState();
            this._inputState = input;
            
            // Explicitly update sprite orientation based on input
            if (input.left) {
                this.sprite.flipX = true;
            } else if (input.right) {
                this.sprite.flipX = false;
            }
            
            this.updateBoost(delta);
            this.processMovement(input);
            this.updateOxygen(delta);
            
            this.lastPosition = { x: this.sprite.x, y: this.sprite.y };
        } catch (error) {
            console.error('Error in Player.update:', error);
        }
    }

    /**
     * Get the current input state for player movement
     * @returns {Object} The current input state with left, right, up, down, and boost properties
     */
    getInputState() {
        if (!this.scene || !this.scene.input) {
            return { left: false, right: false, up: false, down: false, boost: false };
        }
        
        const cursors = this.scene.cursors;
        const keys = this.scene.keys || this.scene.wasdKeys;
        const touchData = this.scene.touchData;

        if (!keys) {
            if (cursors) {
                return {
                    left: cursors.left?.isDown || false,
                    right: cursors.right?.isDown || false,
                    up: cursors.up?.isDown || false, 
                    down: cursors.down?.isDown || false,
                    boost: cursors.space?.isDown || false
                };
            }
            
            return { left: false, right: false, up: false, down: false, boost: false };
        }

        const keyboardInput = {
            left: (keys && keys.left?.isDown) || (cursors && cursors.left?.isDown) || false,
            right: (keys && keys.right?.isDown) || (cursors && cursors.right?.isDown) || false,
            up: (keys && keys.up?.isDown) || (cursors && cursors.up?.isDown) || false,
            down: (keys && keys.down?.isDown) || (cursors && cursors.down?.isDown) || false,
            boost: (keys && keys.boost?.isDown) || (cursors && cursors.space?.isDown) || false
        };

        const touchInput = {
            left: touchData?.left || false,
            right: touchData?.right || false,
            up: touchData?.up || false,
            down: touchData?.down || false,
            boost: touchData?.boost || false
        };

        return {
            left: keyboardInput.left || touchInput.left,
            right: keyboardInput.right || touchInput.right,
            up: keyboardInput.up || touchInput.up,
            down: keyboardInput.down || touchInput.down,
            boost: keyboardInput.boost || touchInput.boost
        };
    }

    /**
     * Process player movement based on input
     * @param {Object} input - Input state object
     */
    processMovement(input) {
        if (!this.sprite || !this.sprite.body || !this.active) {
            return;
        }
        
        // Reset acceleration each frame
        this.sprite.setAcceleration(0, 0);
        
        // Store current movement direction
        let currentDirection = { x: 0, y: 0 };
        
        // Get base acceleration value from constants
        const baseAcceleration = PLAYER.ACCELERATION;
        
        // Apply horizontal movement
        if (input.left) {
            this.sprite.setAccelerationX(-baseAcceleration);
            this.sprite.setFlipX(true);
            currentDirection.x = -1;
        } else if (input.right) {
            this.sprite.setAccelerationX(baseAcceleration);
            this.sprite.setFlipX(false);
            currentDirection.x = 1;
        }
        
        // Update tread stamina and get current effectiveness
        const treadEffectiveness = this.updateTreadStamina(input);
        
        // Handle post-boost momentum
        const timeSinceBoost = this.lastBoostEndTime ? Date.now() - this.lastBoostEndTime : null;
        const inPostBoostGrace = timeSinceBoost && timeSinceBoost < PLAYER.TREAD_WATER.POST_BOOST.GRACE_PERIOD;
        const hasUpwardMomentum = this.sprite.body.velocity.y < 0;
        
        // Calculate gravity scale based on post-boost state
        let gravityScale = 1;
        if (timeSinceBoost && hasUpwardMomentum) {
            if (inPostBoostGrace) {
                if (this.sprite.body.velocity.y < -PLAYER.TREAD_WATER.POST_BOOST.MAX_DRIFT_SPEED) {
                    this.sprite.body.velocity.y = -PLAYER.TREAD_WATER.POST_BOOST.MAX_DRIFT_SPEED;
                }
                gravityScale = 0.5;
            } else {
                gravityScale = PLAYER.TREAD_WATER.POST_BOOST.GRAVITY_SCALE;
            }
        }
        
        // Apply scaled gravity
        this.sprite.setAccelerationY(PLAYER.GRAVITY * gravityScale);
        
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
        
        // Handle boost (triggered by spacebar)
        if (input.boost && this.oxygen > 0) {
            if (!this.boostActive) {
                this.boostActive = true;
                this.scene.events.emit('boostStart');
            }
            
            // Calculate boost direction based on input
            const boostDirection = this.getBoostDirection(input);
            const boostSpeed = PLAYER.BOOST.SPEED.MAX_VELOCITY;
            
            // Apply boost velocity
            if (boostDirection.x !== 0 || boostDirection.y !== 0) {
                this.sprite.body.velocity.x = boostDirection.x * boostSpeed;
                this.sprite.body.velocity.y = boostDirection.y * boostSpeed;
                
                // Ensure physics engine doesn't cap our velocity during boost
                if (this.sprite.body.maxVelocity.x < boostSpeed) {
                    this.sprite.body.setMaxVelocity(boostSpeed, boostSpeed);
                }
            }
            
            // Consume oxygen while boosting
            this.oxygen = Math.max(0, this.oxygen - PLAYER.BOOST.OXYGEN_COST * (1/60)); // Assuming 60 FPS
            this.scene.events.emit('oxygenChanged', this.oxygen, this.maxOxygen);
            
            // Create boost effects
            const now = Date.now();
            if (!this._lastBoostParticleTime || (now - this._lastBoostParticleTime > PLAYER.BOOST.BURST_INTERVAL)) {
                this._lastBoostParticleTime = now;
                this.emitBoostBurst(true);
            }
        } else {
            // When not boosting
            if (this.boostActive) {
                this.boostActive = false;
                this.scene.events.emit('boostEnd');
            }
            
            // Reset to normal max velocity
            if (this.sprite.body.maxVelocity.x > PLAYER.MAX_VELOCITY) {
                this.sprite.body.setMaxVelocity(PLAYER.MAX_VELOCITY, PLAYER.MAX_VELOCITY);
            }
        }
        
        // Track if player is moving this frame
        const isMovingNow = currentDirection.x !== 0 || currentDirection.y !== 0;
        
        // Check for direction change
        const directionChanged = 
            currentDirection.x !== (this.lastDirection?.x || 0) || 
            currentDirection.y !== (this.lastDirection?.y || 0);
            
        // Create movement burst on direction change or start of movement
        if (isMovingNow && (!this.isMoving || directionChanged) && 
            (!this._lastMovementBurstTime || (Date.now() - this._lastMovementBurstTime > 500)) && 
            !this.boostActive) {
            
            this.scene.events.emit('movementBurst', this.sprite, currentDirection);
            this._lastMovementBurstTime = Date.now();
        }
        
        // Update movement state
        this.isMoving = isMovingNow;
        this.lastDirection = { ...currentDirection };
    }
    
    /**
     * Get normalized boost direction based on input or facing direction
     * @param {Object} input - Current input state
     * @returns {Object} Normalized direction vector {x, y}
     */
    getBoostDirection(input) {
        let direction = { x: 0, y: 0 };
        
        // Get direction from input
        if (input.left) direction.x = -1;
        else if (input.right) direction.x = 1;
        
        if (input.up) direction.y = -1;
        else if (input.down) direction.y = 1;
        
        // If no input direction, boost upward instead of using facing direction
        if (direction.x === 0 && direction.y === 0) {
            direction.y = -1; // Upward boost
        }
        
        // Normalize direction vector to ensure consistent speed in all directions
        const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
        if (magnitude > 0 && magnitude !== 1) {
            direction.x /= magnitude;
            direction.y /= magnitude;
        }
        
        return direction;
    }
    
    /**
     * Process boost velocity separately from regular movement
     * @param {Object} input - Current input state
     */
    processBoostVelocity(input) {
        // This method is now unused - boost handling moved to processMovement
    }

    /**
     * Update particle effects based on player movement
     */
    updateParticleEffects() {
        if (!this.sprite || !this.scene.particleSystem) return;
        
        this.scene.particleSystem.updateBubbleTrailDirection(
            this.sprite, 
            this.sprite.body.velocity
        );
        
        const speed = Math.sqrt(
            this.sprite.body.velocity.x * this.sprite.body.velocity.x + 
            this.sprite.body.velocity.y * this.sprite.body.velocity.y
        );
        
        const prevSpeed = this.lastPosition ? Math.sqrt(
            Math.pow(this.sprite.x - this.lastPosition.x, 2) + 
            Math.pow(this.sprite.y - this.lastPosition.y, 2)
        ) : 0;
        
        if (speed > 150 && prevSpeed < 50 && this.scene.particleSystem) {
            const direction = {
                x: this.sprite.body.velocity.x,
                y: this.sprite.body.velocity.y
            };
            
            const dirLength = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
            if (dirLength > 0) {
                direction.x /= dirLength;
                direction.y /= dirLength;
            }
            
            this.scene.particleSystem.emitMovementBurst(this.sprite, 'bubble', direction);
        }
    }

    /**
     * Update boost state and apply effects
     * @param {number} delta - Time in ms since last update
     */
    updateBoost(delta) {
        const now = Date.now();
        const stamina = PLAYER.TREAD_WATER.STAMINA;
        
        if (this._inputState.up) {
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

    /**
     * Update oxygen level over time
     * @param {number} delta - Time in ms since last update
     */
    updateOxygen(delta) {
        // Skip if player is dead
        if (!this.active) return;
        
        const oldOxygen = this.oxygen;
        
        if (this.isInAirPocket) {
            // Refill oxygen when in an air pocket - instant refill like in original game
            this.oxygen = this.maxOxygen;
        } else if (this.boostActive) {
            // Oxygen depletion is handled in updateBoost when boost is active
        } else {
            // Normal oxygen depletion
            this.oxygen -= (delta / 1000) * OXYGEN.DRAIN_RATE;
        }
        
        // Ensure oxygen stays within bounds
        this.oxygen = Phaser.Math.Clamp(this.oxygen, 0, this.maxOxygen);
        
        // Only emit event if oxygen changed
        if (oldOxygen !== this.oxygen) {
            this.scene.events.emit('playerOxygenChanged', this.oxygen, this.maxOxygen);
            
            // Handle low oxygen state
            const isLowOxygenNow = this.oxygen <= this.maxOxygen * 0.3;
            if (isLowOxygenNow !== this.isLowOxygen) {
                this.isLowOxygen = isLowOxygenNow;
                this.scene.events.emit('playerLowOxygen', this.isLowOxygen);
            }
            
            // Handle oxygen depletion
            if (this.oxygen <= 0 && !this.oxygenDepleted) {
                this.oxygenDepleted = true;
                this.scene.events.emit('playerOxygenDepleted');
            } else if (this.oxygen > 0 && this.oxygenDepleted) {
                this.oxygenDepleted = false;
            }
        }
    }

    /**
     * Check if player can boost
     * @returns {boolean} True if player can boost
     */
    canBoost() {
        if (this.boostActive || this.boostCooldown) {
            return false;
        }
        
        const minOxygenRequired = this.maxOxygen * 0.1;
        return this.oxygen > minOxygenRequired;
    }

    /**
     * Add oxygen to the player
     * @param {number} amount - Amount of oxygen to add
     */
    addOxygen(amount) {
        if (amount <= 0) return;
        
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + amount);
        this.oxygenDepleted = false;
        
        this.scene.events.emit('oxygenChange', this.oxygen, this.maxOxygen);
        return this.oxygen;
    }

    destroy() {
        if (this.maskBubbles) {
            this.maskBubbles.destroy();
            this.maskBubbles = null;
        }
        
        if (this.helmetBubbles) {
            this.helmetBubbles.destroy();
            this.helmetBubbles = null;
        }
    }

    /**
     * Update player health
     * @param {number} delta - Time since last update
     */
    updateHealth(delta) {
        if (!this.isDrowning && this.health < PLAYER.HEALTH.MAX) {
            this.health += (delta / 1000) * PLAYER.HEALTH.RECOVERY_RATE;
            this.health = Math.min(this.health, PLAYER.HEALTH.MAX);
        }
        
        if (this.health <= 0 && this.active) {
            this.die();
        }
    }
    
    /**
     * Apply damage to the player
     * @param {number} amount - Amount of damage to apply
     */
    takeDamage(amount) {
        if (!this.active) return;
        
        this.health -= amount;
        this.health = Math.max(0, this.health);
        
        if (amount > 0.1) {
            this.scene.cameras.main.shake(100, 0.01 * amount);
        }
        
        this.scene.events.emit('healthChange', this.health, PLAYER.HEALTH.MAX);
        
        if (this.health <= 0 && !this.isDead) {
            this.die();
        }
    }
    
    /**
     * Handle player death
     */
    die() {
        this.active = false;
        
        if (this.sprite) {
            this.sprite.setTint(0xff0000);
            this.sprite.setAlpha(0.7);
        }
        
        if (this.scene.playerDied) {
            this.scene.playerDied();
        }
    }
    
    /**
     * Set whether the player is in an air pocket
     * @param {boolean} isInPocket - Whether in an air pocket
     */
    setInAirPocket(isInPocket) {
        this.isInAirPocket = isInPocket;
    }
    
    /**
     * Get the player's current position
     * @returns {object} - Position with x and y coordinates
     */
    getPosition() {
        return this.sprite ? { x: this.sprite.x, y: this.sprite.y } : this.spawnPoint;
    }

    handleMovement(time, delta) {
        if (!this.sprite || !this.scene.keys) return;
        
        const keys = this.scene.keys;
        const sprite = this.sprite;
        
        // Get current velocity for momentum calculations
        const currentVelX = sprite.body.velocity.x;
        const currentVelY = sprite.body.velocity.y;
        
        // Calculate target velocity based on input
        let targetVelX = 0;
        let targetVelY = 0;
        
        if (keys.left.isDown) {
            targetVelX = -this.moveSpeed;
            // Only update facing direction when actively pressing movement keys
            sprite.flipX = true;
        }
        if (keys.right.isDown) {
            targetVelX = this.moveSpeed;
            // Only update facing direction when actively pressing movement keys
            sprite.flipX = false;
        }
        if (keys.up.isDown) {
            targetVelY = -this.moveSpeed;
        }
        if (keys.down.isDown) {
            targetVelY = this.moveSpeed;
        }
        
        // Apply smooth acceleration/deceleration
        sprite.body.velocity.x = Phaser.Math.Linear(
            currentVelX,
            targetVelX,
            this.acceleration * (delta / 1000)
        );
        
        sprite.body.velocity.y = Phaser.Math.Linear(
            currentVelY,
            targetVelY,
            this.acceleration * (delta / 1000)
        );
        
        // Update last position for movement tracking
        if (!this.lastPosition) {
            this.lastPosition = { x: sprite.x, y: sprite.y };
        }
        
        // Emit movement event if there's significant movement
        const dx = sprite.x - this.lastPosition.x;
        const dy = sprite.y - this.lastPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 1) {
            this.scene.events.emit('movement', {
                x: dx,
                y: dy,
                distance: distance
            });
            
            // Update last position
            this.lastPosition.x = sprite.x;
            this.lastPosition.y = sprite.y;
        }
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
} 
