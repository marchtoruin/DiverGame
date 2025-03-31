import { PARTICLES } from '../utils/Constants';

/**
 * Manages particle effects in the game
 */
export default class ParticleSystem {
    /**
     * Create and initialize the particle system
     * @param {Phaser.Scene} scene - The scene this system belongs to
     */
    constructor(scene) {
        this.scene = scene;
        this.emitters = {};
        this.enabled = true;
        this.movementBurstEmitter = null;
        this.boostEmitter = null;
        this.markerPosition = null; // Store the position of the yellow marker pixel
    }

    /**
     * Finds the yellow marker pixel (#ffff00) on the player sprite
     * @param {Phaser.GameObjects.Sprite} player - The player sprite
     * @returns {Object|null} The position of the marker or null if not found
     */
    findYellowMarkerPosition(player) {
        if (!player || !player.texture) return null;
        
        // Target pixel color (yellow #ffff00)
        const targetColor = 0xffff00;
        
        // Cache the result so we don't need to search every time
        if (this.markerPosition) return this.markerPosition;
        
        console.log('Searching for yellow marker pixel (#ffff00) on player sprite');
        
        try {
            // Get texture data - this varies by Phaser version, so we'll try multiple approaches
            // First, attempt with TextureManager
            const textureManager = this.scene.textures;
            if (textureManager) {
                const frame = textureManager.getFrame(player.texture.key);
                if (frame) {
                    const source = frame.source;
                    if (source && source.image) {
                        // We found the texture source, now we'd process it for the yellow pixel
                        console.log('Found texture source for player');
                        
                        // For simplicity, we'll just use a fixed offset based on the sprite
                        // In a production environment, you'd scan the actual texture for the yellow marker
                        const facingRight = !player.flipX;
                        this.markerPosition = {
                            x: facingRight ? -25 : 25,
                            y: -5
                        };
                        console.log('Using fixed marker position:', this.markerPosition);
                        return this.markerPosition;
                    }
                }
            }
            
            // Fallback to fixed positions if we can't access the texture data
            console.log('Could not access texture data, using fixed offsets');
            return null;
        } catch (error) {
            console.error('Error finding yellow marker:', error);
            return null;
        }
    }

    /**
     * Create a trailing bubble effect for the player
     * @param {Phaser.GameObjects.Sprite} player - The player sprite to follow
     * @param {string} particleKey - Key for the bubble particle image
     * @returns {object} Object with direction tracking properties
     */
    createBubbleTrail(player, particleKey) {
        if (!this.enabled || !player) return null;
        
        try {
            console.log('Setting up direction change bubble system');
            
            // Clean up existing emitter if present
            if (this.emitters.bubble) {
                this.emitters.bubble.destroy();
            }
            
            // Instead of creating an emitter that follows the player, 
            // we'll just set up tracking properties for direction changes
            // and create one-time emitters as needed in updateBubbleTrailDirection
            
            // Initialize direction tracking
            this._lastPlayerDirection = null;
            this._lastEmitTime = 0;
            
            // Store an empty object just to maintain the API
            this.emitters.bubble = { 
                isDirectionChangeTracker: true
            };
            
            console.log('Direction change tracking initialized');
            
            return this.emitters.bubble;
        } catch (error) {
            console.error('Error setting up direction change tracking:', error);
            return null;
        }
    }
    
    /**
     * Updates the bubble trail direction based on player velocity
     * @param {Phaser.GameObjects.Sprite} player - The player sprite
     * @param {object} velocity - The velocity object with x and y properties
     */
    updateBubbleTrailDirection(player, velocity) {
        if (!this.enabled || !this.emitters.bubble) return;
        
        try {
            const vx = velocity.x;
            const vy = velocity.y;
            const now = Date.now();
            
            // Get normalized direction
            const speed = Math.sqrt(vx * vx + vy * vy);
            
            // Initialize last direction if not set
            if (!this._lastPlayerDirection) {
                this._lastPlayerDirection = { x: 0, y: 0 };
                this._lastEmitTime = 0;
            }
            
            // Process all movement changes for responsive feedback
            const MIN_SPEED = 5; // Lower threshold to detect slight movements
            
            if (speed < MIN_SPEED) {
                // Reset last direction when stopped to ensure next input triggers effect
                if (this._lastPlayerDirection.x !== 0 || this._lastPlayerDirection.y !== 0) {
                    this._lastPlayerDirection = { x: 0, y: 0 };
                }
                return;
            }
            
            // Normalize to get current direction vector
            const dirX = vx / speed;
            const dirY = vy / speed;
            
            // Set lower direction change threshold for more instant feedback
            // and reduce cooldown to make the effect more responsive
            const significantChange = 
                (Math.abs(dirX - this._lastPlayerDirection.x) > 0.2 || 
                 Math.abs(dirY - this._lastPlayerDirection.y) > 0.2) &&
                (now - this._lastEmitTime > 50); // Much shorter cooldown for more immediate response
            
            // Add specific detection for initial movement from rest
            const startingMovement = 
                (Math.abs(this._lastPlayerDirection.x) < 0.1 && 
                 Math.abs(this._lastPlayerDirection.y) < 0.1) &&
                (speed > 20) &&
                (now - this._lastEmitTime > 50);
            
            // Also detect stopping movement 
            const stoppingMovement =
                (Math.abs(this._lastPlayerDirection.x) > 0.2 || 
                 Math.abs(this._lastPlayerDirection.y) > 0.2) &&
                (speed < 30 && speed > MIN_SPEED) &&
                (now - this._lastEmitTime > 50);
                
            // Emit on any significant movement change
            if (significantChange || startingMovement || stoppingMovement) {
                console.log("Direction changed, emitting bubble burst instantly");
                
                // Store new direction immediately
                this._lastPlayerDirection = { x: dirX, y: dirY };
                this._lastEmitTime = now;
                
                // Calculate facing direction to ensure burst appears behind player
                const isFacingLeft = player.flipX;
                
                // Position burst behind the player based on FACING direction, not movement direction
                // This ensures bubbles come from behind the character sprite visually
                let offsetX, offsetY;
                
                if (Math.abs(dirX) > Math.abs(dirY)) {
                    // Primarily horizontal movement
                    offsetX = isFacingLeft ? 30 : -30; // Opposite of facing direction (behind player)
                    offsetY = -5; // Slightly above center
                } else {
                    // Primarily vertical movement
                    offsetX = isFacingLeft ? 25 : -25; // Still respect facing direction
                    offsetY = dirY < 0 ? 30 : -30; // Behind vertical movement
                }
                
                // Create a one-time burst emitter directly at the correct position
                const burstPosition = {
                    x: player.x + offsetX,
                    y: player.y + offsetY
                };
                
                // Calculate angle based on movement direction (opposite to movement)
                const movementAngle = Math.atan2(dirY, dirX) * 180 / Math.PI;
                const emitAngle = (movementAngle + 180) % 360; // Opposite direction
                const angleSpread = 35; // Wider angle spread for larger burst
                
                // Create a short-lived direction change burst
                const burstEmitter = this.scene.add.particles(
                    burstPosition.x,
                    burstPosition.y, 
                    'bubble', 
                    {
                        lifespan: { min: 600, max: 900 }, // Slightly longer lifespan
                        speed: { min: 40, max: 80 }, // Slightly faster
                        scale: { start: 0.15, end: 0.02 }, // Larger bubbles
                        alpha: { start: 0.9, end: 0 }, // More visible
                        angle: { min: emitAngle - angleSpread, max: emitAngle + angleSpread },
                        gravityY: -15,
                        rotate: { min: -15, max: 15 },
                        frequency: -1, // Don't emit automatically
                        emitZone: {
                            type: 'random',
                            source: new Phaser.Geom.Circle(0, 0, 12) // Larger emission zone
                        },
                        tint: [ 0xffffff, 0xccccff, 0xbbddff ]
                    }
                ).setDepth(5); // Lower depth to ensure bubbles appear behind player
                
                // Emit a larger burst - use more particles for faster movement
                const burstSize = Math.min(15, Math.floor(8 + (speed / 80))); 
                burstEmitter.emitParticle(burstSize);
                
                // Clean up after particles are done
                this.scene.time.delayedCall(1000, () => {
                    burstEmitter.destroy();
                });
            }
        } catch (error) {
            console.error('Error updating bubble direction:', error);
        }
    }
    
    /**
     * Toggles particle effects on/off
     */
    toggleParticles() {
        this.enabled = !this.enabled;
        
        Object.values(this.emitters).forEach(emitter => {
            if (this.enabled) {
                emitter.start();
            } else {
                emitter.stop();
            }
        });
        
        if (this.movementBurstEmitter) {
            this.enabled ? this.movementBurstEmitter.start() : this.movementBurstEmitter.stop();
        }
    }
    
    /**
     * Create a powerful burst of bubbles when the player uses boost
     * @param {Phaser.GameObjects.Sprite} player - The player sprite
     * @param {string} particleKey - Key for the bubble particle image
     * @param {object} direction - Direction vector {x, y}
     * @param {boolean} isHighSpeedBoost - Whether this is a high-speed boost
     */
    emitBoostBurst(player, particleKey, direction, isHighSpeedBoost = false) {
        if (!this.enabled || !player) return;
        
        // Calculate boost direction based on current movement
        let offsetX, offsetY, emitAngle;
        
        // Use consistent positions that are properly mirrored for left/right facing
        const isFacingLeft = player.flipX;
        
        // IMPROVED POSITIONING: Fixed positions that are properly mirrored
        if (direction.x !== 0) {
            // Horizontal movement - emit from behind player at approximately backpack level
            if (direction.x > 0) { // Moving right
                offsetX = -35; // Further out by 10px (was -25)
                offsetY = -10; // Higher by 5px (was -5)
            } else { // Moving left
                offsetX = 35;  // Further out by 10px (was 25)
                offsetY = -10; // Higher by 5px (was -5)
            }
            emitAngle = { min: 170, max: 190 };
        } else if (direction.y !== 0) {
            if (direction.y > 0) { // Moving down
                // When moving down, position particles more centered on player
                offsetX = isFacingLeft ? 15 : -15; // Further out by 10px
                offsetY = -25; // Higher by 5px (was -20)
            } else { // Moving up
                // When moving up, position particles more centered and moved to match the backpack
                offsetX = isFacingLeft ? 25 : -25; // Further out by 10px (was 15/-15)
                offsetY = -10; // Higher by 5px (was -5), moved up to match horizontal offsets
            }
            emitAngle = direction.y > 0 ? { min: 260, max: 280 } : { min: 80, max: 100 };
        } else {
            // Default (no movement) - use player's facing direction
            offsetX = isFacingLeft ? 35 : -35; // Further out by 10px (was 25/-25)
            offsetY = -10; // Higher by 5px (was -5)
            emitAngle = { min: 170, max: 190 }; // Always use same angle range
        }
        
        // Store the axis and direction for spread and emission control
        const isHorizontal = direction.x !== 0;
        const directionSign = isHorizontal ? (direction.x > 0 ? 1 : -1) : (direction.y > 0 ? 1 : -1);
        
        // CRITICAL FIX: Calculate spread angles based on direction, to ensure consistent look
        const spreadAngleOffset = isHorizontal ? 
            (direction.x > 0 ? 180 : 0) : // 180 for right, 0 for left
            (direction.y > 0 ? 270 : 90); // 270 for down, 90 for up
        
        // TONED DOWN: Reduced particle scale and increased fade speed for less aggressive effect
        const scale = isHighSpeedBoost ? 
            { start: 0.3, end: 0.03, ease: 'Cubic.easeOut' } : // Reduced from 0.4/0.05
            { start: 0.25, end: 0.02, ease: 'Cubic.easeOut' }; // Reduced from 0.35/0.03
            
        // TONED DOWN: Reduced particle speed for less aggressive effect
        const speed = isHighSpeedBoost ?
            { min: 400, max: 600 } : // Reduced from 600/800
            { min: 300, max: 500 };  // Reduced from 500/700
            
        // TONED DOWN: Reduced particle lifespan
        const lifespan = isHighSpeedBoost ? 
            600 : // Reduced from 800
            450;  // Reduced from 600
            
        // TONED DOWN: Reduced particle count for less aggressive effect
        const particleCount = isHighSpeedBoost ?
            20 : // Reduced from 35
            15;  // Reduced from 25
            
        // IMPROVED TRIANGLES: Create more accurate triangle shape for main burst
        // For horizontal movement, make triangle wider on sides
        // For vertical movement, make triangle point more sharply
        let triangleShape;
        
        if (isHorizontal) {
            triangleShape = new Phaser.Geom.Triangle(
                0, 0,                      // Apex (at emitter center)
                directionSign * -15, -15,  // Bottom left corner, reduced spread (was -20)
                directionSign * -15, 8     // Bottom right corner, reduced spread (was -20, 10)
            );
        } else {
            // For vertical movement, create a narrower triangle in the direction of movement
            const heightFactor = direction.y > 0 ? -1 : 1; // Flip triangle for up/down
            triangleShape = new Phaser.Geom.Triangle(
                0, 0,                     // Apex (at emitter center)
                -12, heightFactor * 15,   // Left corner, reduced spread (was -15, 20)
                12, heightFactor * 15     // Right corner, reduced spread (was 15, 20)
            );
        }
        
        // TONED DOWN: Reduced gravity, narrower angle spread, decreased acceleration for less aggressive effect
        const boostEmitter = this.scene.add.particles(0, 0, particleKey, {
            x: player.x + offsetX,
            y: player.y + offsetY,
            lifespan: lifespan,
            gravityY: -15, // Reduced from -25
            speed: speed,
            scale: scale,
            alpha: { start: 0.8, end: 0 }, // Reduced from 0.95
            // Narrower angle spread (was -45/+45)
            angle: { min: spreadAngleOffset - 35, max: spreadAngleOffset + 35 },
            rotate: { start: 0, end: 360, ease: 'Sine.easeInOut' },
            frequency: -1,
            emitZone: { 
                type: 'random',
                source: triangleShape
            },
            // TONED DOWN: Reduced acceleration for less chaotic motion
            accelerationX: { min: -30, max: 30 }, // Reduced from -50/50
            accelerationY: { min: -30, max: 30 }, // Reduced from -50/50
            tint: isHighSpeedBoost ? 
                [ 0xffffff, 0xd8f0ff, 0xccccff, 0x99ffff ] :
                [ 0xffffff, 0xd8f0ff, 0xccccff ]
        }).setDepth(20);
        
        // Emit boost particles
        boostEmitter.explode(particleCount);
        
        // For high-speed boost, add a second emitter with different parameters for more dramatic effect
        if (isHighSpeedBoost) {
            // TONED DOWN: Smaller triangles for secondary burst
            let secondaryTriangle;
            
            if (isHorizontal) {
                secondaryTriangle = new Phaser.Geom.Triangle(
                    0, 0,                      // Apex
                    directionSign * -20, -18,  // Bottom left, reduced (was -30, -25)
                    directionSign * -20, 12    // Bottom right, reduced (was -30, 15)
                );
            } else {
                // For vertical movement, create a wider triangle in the direction of movement
                const heightFactor = direction.y > 0 ? -1 : 1; // Flip triangle for up/down
                secondaryTriangle = new Phaser.Geom.Triangle(
                    0, 0,                     // Apex
                    -15, heightFactor * 20,   // Left corner, reduced (was -20, 30)
                    15, heightFactor * 20     // Right corner, reduced (was 20, 30)
                );
            }
            
            // TONED DOWN: Secondary emitter with reduced parameters
            const secondaryEmitter = this.scene.add.particles(0, 0, particleKey, {
                x: player.x + (offsetX * 1.2), // Moved closer to player (was 1.3)
                y: player.y + (offsetY * 1.2), // Moved closer to player (was 1.3)
                lifespan: lifespan * 0.7, // Reduced from 0.8
                gravityY: -12, // Reduced from -20
                speed: { min: speed.min * 0.6, max: speed.max * 0.6 }, // Reduced from 0.7
                scale: { start: 0.2, end: 0.03, ease: 'Cubic.easeOut' }, // Reduced from 0.3/0.04
                alpha: { start: 0.7, end: 0 }, // Reduced from 0.9
                // Narrower angle spread (was -60/+60)
                angle: { min: spreadAngleOffset - 40, max: spreadAngleOffset + 40 },
                rotate: { min: -180, max: 180, ease: 'Linear.easeIn' },
                // Reduced acceleration (was -80/80)
                accelerationX: { min: -50, max: 50 },
                accelerationY: { min: -50, max: 50 },
                frequency: -1,
                emitZone: { 
                    type: 'random',
                    source: secondaryTriangle
                },
                tint: [ 0xffffff, 0x99ffff, 0x66ddff ]
            }).setDepth(21);
            
            // TONED DOWN: Emit fewer particles
            secondaryEmitter.explode(Math.floor(particleCount * 0.7)); // Reduced from 0.9
            
            // TONED DOWN: Third emitter with reduced parameters for tiny bubbles
            const tertiaryEmitter = this.scene.add.particles(0, 0, particleKey, {
                x: player.x + (offsetX * 1.3), // Moved closer to player (was 1.5)
                y: player.y + (offsetY * 1.3), // Moved closer to player (was 1.5)
                lifespan: lifespan * 0.8, // Reduced from 1.0
                gravityY: -15, // Reduced from -25
                speed: { min: 80, max: 180 }, // Reduced from 100/250
                scale: { start: 0.1, end: 0.01, ease: 'Cubic.easeOut' }, // Reduced from 0.12
                alpha: { start: 0.5, end: 0 }, // Reduced from 0.6
                // Reduced angle spread (was -60/+60)
                angle: { min: spreadAngleOffset - 40, max: spreadAngleOffset + 40 },
                // Reduced rotation (was 0/720)
                rotate: { min: 0, max: 360, ease: 'Linear.easeNone' },
                // Reduced acceleration (was -100/100)
                accelerationX: { min: -60, max: 60 },
                accelerationY: { min: -60, max: 60 },
                frequency: -1,
                emitZone: { 
                    type: 'random',
                    source: new Phaser.Geom.Circle(0, 0, 10) // Reduced from 15
                },
                tint: [ 0xffffff, 0xaaddff, 0x77aaff ]
            }).setDepth(22);
            
            // TONED DOWN: Emit fewer tertiary particles
            tertiaryEmitter.explode(Math.floor(particleCount * 0.5)); // Added explicit count
            
            // Set emitter cleanup timers
            this.scene.time.delayedCall(lifespan + 100, () => {
                secondaryEmitter.destroy();
                tertiaryEmitter.destroy();
            });
        }
        
        // Clean up the emitter after the particles are done
        this.scene.time.delayedCall(lifespan + 100, () => {
            boostEmitter.destroy();
        });
    }
    
    /**
     * Clean up all player emitters
     */
    cleanupPlayerEmitters() {
        if (this.emitters.bubble) {
            this.emitters.bubble.stop();
            this.emitters.bubble.destroy();
            delete this.emitters.bubble;
        }
        
        if (this.movementBurstEmitter) {
            this.movementBurstEmitter.stop();
            this.movementBurstEmitter.destroy();
            this.movementBurstEmitter = null;
        }
    }
    
    /**
     * Destroy all particle effects and clean up resources
     */
    destroy() {
        this.cleanupPlayerEmitters();
        
        // Clean up any other emitters
        Object.values(this.emitters).forEach(emitter => {
            if (emitter) {
                emitter.destroy();
            }
        });
        
        this.emitters = {};
    }

    /**
     * Create a continuous stream of bubbles from player's helmet
     * @param {Phaser.GameObjects.Sprite} player - The player sprite 
     * @param {string} particleKey - Key for the bubble image
     * @returns {Phaser.GameObjects.Particles.ParticleEmitter} The created emitter
     */
    createHelmetBubbles(player, particleKey) {
        if (!this.enabled || !player) return null;
        
        try {
            console.log('Creating helmet bubbles with particleKey:', particleKey);
            
            // Create helmet bubbles with simple timing
            const helmetEmitter = this.scene.add.particles(0, 0, particleKey, {
                follow: player,
                followOffset: { x: 10, y: -35 }, // Moved in by 10px more (was 20) and up by 10px more (was -25)
                lifespan: 2500, // Much longer lifespan to see them float up
                speed: { min: 25, max: 40 }, // Faster upward movement
                scale: { start: 0.11, end: 0.05 }, // Same size bubbles with slower shrinking
                alpha: { start: 0.9, end: 0 }, // Slightly more visible
                angle: { min: 265, max: 275 }, // Focused upward angle
                gravityY: -30, // Stronger upward acceleration for bubbles
                frequency: -1, // Don't emit automatically
                quantity: 1,
                maxParticles: 20, // More particles for longer lifespan
                emitZone: {
                    type: 'random',
                    source: new Phaser.Geom.Circle(0, 0, 3)
                }
            }).setDepth(30);
            
            console.log('Helmet emitter created:', helmetEmitter);
            
            // Instead of complex breathing, just emit a burst every 3 seconds
            const bubbleState = {
                lastBurstTime: 0,
                burstInterval: 3000, // 3 seconds between bursts
                burstCount: 0
            };
            
            // Simple update function that emits a burst every 3 seconds
            const updateBubbleBursts = (time, delta) => {
                if (!player.active || !helmetEmitter || !this.enabled) return;
                
                // Update position based on player facing
                const facingOffset = player.flipX ? -10 : 10; // Moved in by 10px more (was -20/20)
                helmetEmitter.followOffset.x = facingOffset;
                helmetEmitter.followOffset.y = -35; // Moved up by 10px more (was -25)
                
                // Check if it's time for a burst
                const elapsed = time - bubbleState.lastBurstTime;
                if (elapsed >= bubbleState.burstInterval) {
                    console.log("Emitting bubble burst");
                    
                    // Emit a burst of 3-4 bubbles
                    helmetEmitter.emitParticle(3 + Math.floor(Math.random() * 2));
                    
                    // Update the last burst time
                    bubbleState.lastBurstTime = time;
                    bubbleState.burstCount++;
                }
            };
            
            // Add the update callback
            this.scene.events.on('update', updateBubbleBursts);
            
            // Do an initial burst
            helmetEmitter.emitParticle(3);
            bubbleState.lastBurstTime = this.scene.time.now;
            
            // Store for cleanup
            this.emitters.helmetBubbles = helmetEmitter;
            
            return helmetEmitter;
        } catch (error) {
            console.error('Error creating helmet bubbles:', error);
            return null;
        }
    }

    /**
     * Emit a burst of movement bubbles
     * @param {Phaser.GameObjects.Sprite} sprite - The player sprite
     * @param {string} particleKey - Key for the bubble particle image
     * @param {object} direction - Direction vector {x, y}
     */
    emitMovementBurst(sprite, particleKey, direction) {
        if (!this.enabled || !sprite) return;

        try {
            console.log('Emitting movement burst');
            
            // Calculate facing direction to ensure burst appears behind player
            const isFacingLeft = sprite.flipX;
            
            // Position burst behind the player based on FACING direction, not movement direction
            let offsetX, offsetY;
            
            if (Math.abs(direction.x) > Math.abs(direction.y)) {
                // Primarily horizontal movement
                offsetX = isFacingLeft ? 35 : -35; // Opposite of facing direction (behind player)
                offsetY = -10; // Slightly above center
            } else {
                // Primarily vertical movement
                offsetX = isFacingLeft ? 30 : -30; // Still respect facing direction
                offsetY = direction.y < 0 ? 35 : -35; // Behind vertical movement
            }
            
            // Calculate angle based on movement direction
            const movementAngle = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
            const emitAngle = (movementAngle + 180) % 360; // Opposite of movement
            const angleSpread = 30; // Wider angle spread
            
            // Create movement burst emitter with improved settings
            const movementEmitter = this.scene.add.particles(
                sprite.x + offsetX,
                sprite.y + offsetY, 
                particleKey, 
                {
                    lifespan: { min: 600, max: 800 },
                    gravityY: -15,
                    speed: { min: 50, max: 80 },
                    scale: { start: 0.15, end: 0.02 }, // Larger bubbles
                    alpha: { start: 0.9, end: 0 },
                    angle: { min: emitAngle - angleSpread, max: emitAngle + angleSpread },
                    rotate: { min: -20, max: 20 },
                    frequency: -1, // Only emit when explicitly told
                    emitZone: {
                        type: 'random',
                        source: new Phaser.Geom.Circle(0, 0, 10) // Larger emission zone
                    },
                    tint: [ 0xffffff, 0xccccff, 0xbbddff ]
                }
            ).setDepth(5); // Lower depth to ensure bubbles appear behind player

            // Emit a larger burst of bubbles
            const burstSize = Math.min(12, Math.floor(7 + Math.abs(direction.x * 3))); 
            movementEmitter.emitParticle(burstSize);

            // Clean up after particles are done
            this.scene.time.delayedCall(850, () => {
                movementEmitter.destroy();
            });
        } catch (error) {
            console.error('Error emitting movement burst:', error);
        }
    }

    /**
     * Creates a particle emitter with the given configuration
     * @param {Object} config - Configuration for the particle emitter
     * @returns {Phaser.GameObjects.Particles.ParticleEmitter} The created emitter
     */
    createParticleEmitter(config) {
        if (!this.enabled || !this.scene) return null;
        
        try {
            // Extract required properties
            const { x, y, texture = 'bubble', ...otherConfig } = config;
            
            // Set defaults if not provided
            const emitterConfig = {
                x: x || 0,
                y: y || 0,
                ...otherConfig
            };
            
            // Create the emitter
            const emitter = this.scene.add.particles(x, y, texture, emitterConfig);
            
            // Store for cleanup
            const emitterId = `emitter_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            this.emitters[emitterId] = emitter;
            
            return emitter;
        } catch (error) {
            console.error('Error creating particle emitter:', error);
            return null;
        }
    }
    
    /**
     * Creates a one-time particle emitter that automatically destroys itself
     * @param {Object} config - Configuration for the particle emitter
     * @returns {Phaser.GameObjects.Particles.ParticleEmitter} The created emitter
     */
    createOneTimeEmitter(config) {
        if (!this.enabled || !this.scene) return null;
        
        try {
            // Extract required properties
            const { x, y, texture = 'bubble', emitCount = 10, lifespan = 1000, ...otherConfig } = config;
            
            // Set defaults if not provided
            const emitterConfig = {
                x: x || 0,
                y: y || 0,
                lifespan: lifespan,
                frequency: -1, // Only emit when explicity called
                ...otherConfig
            };
            
            // Create the emitter
            const emitter = this.scene.add.particles(x, y, texture, emitterConfig);
            
            // Emit particles immediately
            emitter.emitParticle(emitCount);
            
            // Set up automatic cleanup after particles die
            this.scene.time.delayedCall(lifespan + 100, () => {
                emitter.destroy();
            });
            
            return emitter;
        } catch (error) {
            console.error('Error creating one-time particle emitter:', error);
            return null;
        }
    }
} 