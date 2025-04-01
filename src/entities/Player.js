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
                
                // Enhanced physics settings to prevent wall pushing
                body.pushable = false;    // Prevent being pushed by other objects
                body.setImmovable(false); // Allow movement but with rigid collision
                body.mass = 5;            // Increase mass for better collision separation
                body.bounce.set(0.1);     // Low bounce to prevent wall tunneling
                
                // Set proper hitbox size - use a slightly smaller hitbox than visuals
                // to prevent getting caught on corners while still having solid collisions
                body.setSize(70, 100, true);
                body.setOffset(28, 25);
                
                // CRITICAL: Save original body size and offset for collision system
                this.originalBodySize = {
                    width: body.width,
                    height: body.height,
                    offsetX: body.offset.x,
                    offsetY: body.offset.y
                };
                
                // Store maximum allowed momentum to prevent excessive force build-up
                this.maxMomentum = PLAYER.MAX_VELOCITY * 1.5;
                
                // Enable collision detection
                body.enable = true;
                
                console.log('Player physics body configured with enhanced collision settings');
            }
            
            // Set up sprite properties
            this.sprite.setOrigin(0.5, 0.5);
            this.sprite.setDepth(10);
            
            // Register update event to manage velocity and prevent wall pushing
            this.scene.events.on('update', this.limitExcessiveVelocity, this);
            
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
                this.sprite.body.setSize(70, 100, true);
                this.sprite.body.setOffset(28, 25);
                this.sprite.body.enable = true;
                this.sprite.body.pushable = false;
                this.sprite.body.mass = 5;
                
                // Store original body size even in fallback
                this.originalBodySize = {
                    width: this.sprite.body.width,
                    height: this.sprite.body.height,
                    offsetX: this.sprite.body.offset.x,
                    offsetY: this.sprite.body.offset.y
                };
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
        
        // Safety check - if oxygen is zero but player isn't dead, trigger death
        if (this.oxygen <= 0 && !this.isDead) {
            console.log("⚠️ Safety check - Player has zero oxygen but isn't dead, triggering death now");
            this.die();
            return;
        }
        
        try {
            const input = this.getInputState();
            this._inputState = input;
            
            this.updateBoost(delta);
            this.processMovement(input);
            this.updateOxygen(delta);
            
            // Update particle effects at the end of the frame too
            // to catch any velocity-based effects or changes made by physics
            this.updateParticleEffects();
            
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
        
        // Store current movement direction
        let currentDirection = { x: 0, y: 0 };
        let keyPressed = false; // Track if any movement key was pressed this frame
        
        // Reset acceleration each frame
        this.sprite.setAcceleration(0, 0);
        
        // Get base acceleration value from constants
        const baseAcceleration = PLAYER.ACCELERATION;
        
        // Check if we had any direction last frame
        const hadDirection = this.lastDirection && (this.lastDirection.x !== 0 || this.lastDirection.y !== 0);
        
        // Apply horizontal movement
        if (input.left) {
            this.sprite.setAccelerationX(-baseAcceleration);
            currentDirection.x = -1;
            keyPressed = true;
        } else if (input.right) {
            this.sprite.setAccelerationX(baseAcceleration);
            currentDirection.x = 1;
            keyPressed = true;
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
            keyPressed = true;
            
            if (isFalling) {
                this.sprite.body.velocity.y *= PLAYER.TREAD_WATER.VELOCITY_DAMPEN;
                
                if (this.sprite.body.velocity.y > PLAYER.TREAD_WATER.MAX_FALL_SPEED) {
                    this.sprite.body.velocity.y = PLAYER.TREAD_WATER.MAX_FALL_SPEED;
                }
            }
            
            this.sprite.body.setDragY(PLAYER.DRAG * PLAYER.TREAD_WATER.DRAG_MULTIPLIER);
        } else if (input.down) {
            // Fast fall approach using constants for easier tuning
            
            // Apply gravity multiplier from constants
            this.sprite.setAccelerationY(PLAYER.GRAVITY * PLAYER.FAST_FALL.GRAVITY_MULT);
            
            // Direct position update from constants
            this.sprite.y += PLAYER.FAST_FALL.POSITION_STEP;
            
            // Set velocity from constants
            this.sprite.body.velocity.y = PLAYER.FAST_FALL.SPEED;
            
            // Set drag from constants
            this.sprite.body.setDragY(PLAYER.FAST_FALL.DRAG);
            
            // DEBUG: Log values to console when S is first pressed
            if (!this._wasFastFalling) {
                this._wasFastFalling = true;
                console.log('FAST FALL ACTIVE:', {
                    gravity: PLAYER.GRAVITY * PLAYER.FAST_FALL.GRAVITY_MULT,
                    speed: PLAYER.FAST_FALL.SPEED,
                    posStep: PLAYER.FAST_FALL.POSITION_STEP,
                    drag: PLAYER.FAST_FALL.DRAG
                });
            }
            
            currentDirection.y = 1;
            keyPressed = true;
        } else {
            // Reset fast falling flag when S is released
            if (this._wasFastFalling) {
                this._wasFastFalling = false;
                console.log('Fast fall deactivated');
            }
            
            // Reset player's vertical scale when not fast-falling
            if (this.sprite.scaleY !== 1) {
                this.sprite.scaleY = 1;
            }
            
            // When not treading or when stamina is depleted, use base drag
            this.sprite.body.setDragY(PLAYER.DRAG);
        }
        
        // Detect key press or release to trigger bubble effects instantly
        const startedMoving = keyPressed && !hadDirection;
        const changedDirection = 
            currentDirection.x !== (this.lastDirection?.x || 0) || 
            currentDirection.y !== (this.lastDirection?.y || 0);
        const stoppedMoving = !keyPressed && hadDirection;
        
        // Trigger particle effects on ANY movement change 
        if (startedMoving || changedDirection || stoppedMoving) {
            // Store new direction immediately
            this.lastDirection = { ...currentDirection };
            
            // Update particle effects instantly when input changes
            this.updateParticleEffects();
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
                if (this.scene.particleSystem && this.sprite) {
                    console.log("Emitting boost particles");
                    this.scene.particleSystem.emitBoostBurst(
                        this.sprite, 
                        'bubble', 
                        boostDirection, 
                        true
                    );
                } else {
                    console.warn("Cannot emit boost particles - particleSystem or sprite not available");
                }
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
        
        // Update movement state
        this.isMoving = isMovingNow;
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
        
        // Track actual velocity vector for more precise directional changes
        const velocity = {
            x: this.sprite.body.velocity.x,
            y: this.sprite.body.velocity.y
        };
        
        // For input-based direction changes, we want to force immediate bubble emission
        // even if velocity hasn't changed much yet. This creates more responsive feedback.
        
        // If lastDirection exists, use it to override velocity for more immediate feedback
        if (this.lastDirection && (this.lastDirection.x !== 0 || this.lastDirection.y !== 0)) {
            // Use higher velocity magnitude to ensure bubble emission triggers
            const inputDirectionVelocity = {
                x: this.lastDirection.x * 100, // Significant velocity to trigger burst
                y: this.lastDirection.y * 100  // immediately with input changes
            };
            
            // Always update the bubble trail direction system with input-based velocity
            // This creates an immediate response to input changes
            if (this.scene.particleSystem.updateBubbleTrailDirection) {
                this.scene.particleSystem.updateBubbleTrailDirection(
                    this.sprite, 
                    inputDirectionVelocity
                );
            }
        } else {
            // Use actual velocity if no input direction is active
            if (this.scene.particleSystem.updateBubbleTrailDirection) {
                this.scene.particleSystem.updateBubbleTrailDirection(
                    this.sprite, 
                    velocity
                );
            }
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
        if (!this.active || this.isDead) return;
        
        const oldOxygen = this.oxygen;
        
        if (this.isInAirPocket) {
            // Refill oxygen when in an air pocket - instant refill like in original game
            this.oxygen = this.maxOxygen;
        } else if (this.boostActive) {
            // Oxygen depletion is handled in processMovement when boost is active
            // Ensure we're still depleting oxygen here as a fallback
            this.oxygen -= (delta / 1000) * OXYGEN.DRAIN_RATE_BOOST;
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
            if (this.oxygen <= 0) {
                if (!this.oxygenDepleted) {
                    this.oxygenDepleted = true;
                    console.log("⚠️ Player out of oxygen - triggering death");
                    this.scene.events.emit('playerOxygenDepleted');
                    
                    // Call die directly - don't rely on event handling
                    this.die();
                }
            } else if (this.oxygen > 0 && this.oxygenDepleted) {
                // Only reset the oxygenDepleted flag if oxygen is significantly above zero
                // This prevents edge cases where oxygen hovers near zero
                if (this.oxygen > this.maxOxygen * 0.05) {
                    console.log("🔄 Oxygen restored to safe level, resetting depleted flag");
                    this.oxygenDepleted = false;
                }
            }
        }
    }

    /**
     * Check if player can boost
     * @returns {boolean} True if player can boost
     */
    canBoost() {
        if (this.boostActive || this.boostCooldown || this.isDead) {
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
        if (amount <= 0 || this.isDead) return;
        
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + amount);
        this.oxygenDepleted = false;
        
        this.scene.events.emit('oxygenChange', this.oxygen, this.maxOxygen);
        return this.oxygen;
    }

    /**
     * Clean up resources when the player is destroyed
     */
    destroy() {
        // Remove all event listeners
        this.removeAllListeners();
        
        // Remove scene event listeners
        if (this.scene && this.scene.events) {
            this.scene.events.off('update', this.limitExcessiveVelocity, this);
        }
        
        // Destroy the sprite if it exists
        if (this.sprite) {
            this.sprite.destroy();
            this.sprite = null;
        }
        
        // Destroy mask bubbles if they exist
        if (this.maskBubbles) {
            this.maskBubbles.forEach(bubble => {
                if (bubble && bubble.destroy) {
                    bubble.destroy();
                }
            });
            this.maskBubbles = [];
        }
        
        // Call the parent class destroy method
        super.destroy();
    }

    /**
     * Update player health
     * @param {number} delta - Time since last update
     */
    updateHealth(delta) {
        if (this.isDead || !this.active) return;
        
        if (!this.isDrowning && this.health < PLAYER.HEALTH.MAX) {
            this.health += (delta / 1000) * PLAYER.HEALTH.RECOVERY_RATE;
            this.health = Math.min(this.health, PLAYER.HEALTH.MAX);
        }
        
        if (this.health <= 0) {
            console.log("⚠️ Player health depleted - triggering death");
            this.die();
        }
    }
    
    /**
     * Apply damage to the player
     * @param {number} amount - Amount of damage to apply
     */
    takeDamage(amount) {
        if (!this.active || this.isDead) return;
        
        this.health -= amount;
        this.health = Math.max(0, this.health);
        
        if (amount > 0.1) {
            this.scene.cameras.main.shake(100, 0.01 * amount);
        }
        
        this.scene.events.emit('healthChange', this.health, PLAYER.HEALTH.MAX);
        
        if (this.health <= 0) {
            console.log("⚠️ Player taking fatal damage - triggering death");
            this.die();
        }
    }
    
    /**
     * Handle player death
     */
    die() {
        if (!this.active || this.isDead) {
            console.log("Ignoring duplicate die() call - player already dead");
            return; // Prevent multiple deaths
        }
        
        console.log("⚠️ Player died - triggering game over");
        this.active = false;
        this.isDead = true; // Set isDead flag to prevent repeated death calls
        
        if (this.sprite) {
            // Stop any movement
            if (this.sprite.body) {
                this.sprite.body.setVelocity(0, 0);
                this.sprite.body.setAcceleration(0, 0);
            }
            
            // Visual effect
            this.sprite.setTint(0xff0000);
            this.sprite.setAlpha(0.7);
            
            // Add a death animation
            this.scene.tweens.add({
                targets: this.sprite,
                alpha: 0,
                y: this.sprite.y + 50,
                duration: 1000,
                ease: 'Power2',
                onComplete: () => {
                    if (this.sprite) {
                        this.sprite.setVisible(false);
                    }
                }
            });
        }
        
        // Emit playerDeath event to trigger game over - try both approaches
        this.scene.events.emit('playerDeath');
        
        // Legacy support
        if (this.scene.playerDied) {
            this.scene.playerDied();
        }
        
        // Direct call to game state manager as a fallback
        if (this.scene.gameStateManager) {
            console.log("Directly calling game state manager");
            this.scene.gameStateManager.changeState(this.scene.gameStateManager.gameStates.GAME_OVER);
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

    /**
     * Limit player velocity to prevent wall pushing issues
     * @param {number} time - Current game time
     * @param {number} delta - Time since last update
     */
    limitExcessiveVelocity(time, delta) {
        if (!this.sprite || !this.sprite.body) return;
        
        const body = this.sprite.body;
        const vx = body.velocity.x;
        const vy = body.velocity.y;
        
        // Only apply velocity limiting when not boosting
        if (!this.boostActive) {
            // If velocity exceeds our defined maximum momentum in any direction, cap it
            if (Math.abs(vx) > this.maxMomentum) {
                body.velocity.x = Math.sign(vx) * this.maxMomentum;
            }
            
            if (Math.abs(vy) > this.maxMomentum) {
                body.velocity.y = Math.sign(vy) * this.maxMomentum;
            }
            
            // Check if player might be pushing against a wall
            // If there's high acceleration but little movement, player might be against a wall
            if (body.blocked.left || body.blocked.right) {
                // Reduce horizontal velocity more aggressively when colliding with walls
                body.velocity.x *= 0.7;
            }
            
            if (body.blocked.up || body.blocked.down) {
                // Reduce vertical velocity more aggressively when colliding with walls
                body.velocity.y *= 0.7;
            }
        }
    }
} 
