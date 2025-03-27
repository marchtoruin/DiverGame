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
     * @returns {Phaser.GameObjects.Particles.ParticleEmitter} The created emitter
     */
    createBubbleTrail(player, particleKey) {
        // Just create a dummy emitter that doesn't emit anything
        if (this.emitters.bubble) {
            this.emitters.bubble.destroy();
        }
        
        // Create a dummy emitter that doesn't actually emit any particles
        this.emitters.bubble = this.scene.add.particles(0, 0, particleKey, {
            follow: player,
            frequency: -1, // Never emit automatically
            lifespan: 1,   // Extremely short lifespan
            quantity: 0,   // Zero particles
            maxParticles: 0 // No particles allowed
        }).setDepth(30);
        
        // Completely disable emitter
        this.emitters.bubble.stop();
        
        return this.emitters.bubble;
    }
    
    /**
     * Updates the bubble trail direction based on player velocity
     * @param {Phaser.GameObjects.Sprite} player - The player sprite
     * @param {object} velocity - The velocity object with x and y properties
     */
    updateBubbleTrailDirection(player, velocity) {
        if (!this.enabled || !this.emitters.bubble) return;
        
        const vx = velocity.x;
        const vy = velocity.y;
        
        const minSpeed = 30;
        
        let offsetX = 10; // Default offset
        let offsetY = -32; // Default offset
        let emitAngle = { min: 260, max: 280 };
        
        const speed = Math.sqrt(vx * vx + vy * vy);
        
        if (speed < minSpeed) return;
        
        const absVx = Math.abs(vx);
        const absVy = Math.abs(vy);
        const isVertical = absVy > absVx;
        
        const isFacingLeft = player.flipX;
        
        if (isVertical) {
            if (vy < 0) {
                offsetX = 0;
                offsetY = 10;
                emitAngle = { min: 250, max: 290 };
            } else {
                offsetX = 0;
                offsetY = -32;
                emitAngle = { min: 70, max: 110 };
            }
        } else {
            if (isFacingLeft) {
                offsetX = 10;
                offsetY = -32;
                emitAngle = { min: 340, max: 20 };
            } else {
                offsetX = -10;
                offsetY = -32;
                emitAngle = { min: 160, max: 200 };
            }
        }
        
        if (this.emitters.bubble.followOffset.x !== offsetX || 
            this.emitters.bubble.followOffset.y !== offsetY) {
            
            this.emitters.bubble.followOffset.x = offsetX;
            this.emitters.bubble.followOffset.y = offsetY;
            
            this.emitters.bubble.setAngle(emitAngle);
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
        
        // Enhanced realistic air burst parameters - RESTORED POWERFUL EFFECT
        const scale = isHighSpeedBoost ? 
            { start: 0.4, end: 0.05, ease: 'Cubic.easeOut' } : // Larger particles
            { start: 0.35, end: 0.03, ease: 'Cubic.easeOut' }; // Larger particles
            
        const speed = isHighSpeedBoost ?
            { min: 600, max: 800 } : // Faster for high-speed
            { min: 500, max: 700 };  // Faster for standard boost
            
        // INCREASED LIFESPANS for more visible trail
        const lifespan = isHighSpeedBoost ? 
            800 : // Longer lifespan for high-speed
            600;  // Longer lifespan for standard
            
        const particleCount = isHighSpeedBoost ?
            35 : // More particles for high-speed boost
            25;  // More particles for standard boost
            
        // IMPROVED TRIANGLES: Create more accurate triangle shape for main burst
        // For horizontal movement, make triangle wider on sides
        // For vertical movement, make triangle point more sharply
        let triangleShape;
        
        if (isHorizontal) {
            triangleShape = new Phaser.Geom.Triangle(
                0, 0,                      // Apex (at emitter center)
                directionSign * -20, -20,  // Bottom left corner, wider spread 
                directionSign * -20, 10    // Bottom right corner, slightly asymmetric
            );
        } else {
            // For vertical movement, create a narrower triangle in the direction of movement
            const heightFactor = direction.y > 0 ? -1 : 1; // Flip triangle for up/down
            triangleShape = new Phaser.Geom.Triangle(
                0, 0,                     // Apex (at emitter center)
                -15, heightFactor * 20,   // Left corner 
                15, heightFactor * 20     // Right corner
            );
        }
        
        // Create a temporary boost emitter with more realistic air burst properties
        const boostEmitter = this.scene.add.particles(0, 0, particleKey, {
            x: player.x + offsetX,
            y: player.y + offsetY,
            lifespan: lifespan,
            gravityY: -25, // More upward drift for better cone shape
            speed: speed,
            scale: scale,
            alpha: { start: 0.95, end: 0 },
            // WIDER angle spread for cone shape
            angle: { min: spreadAngleOffset - 45, max: spreadAngleOffset + 45 },
            rotate: { start: 0, end: 360, ease: 'Sine.easeInOut' },
            frequency: -1,
            emitZone: { 
                type: 'random',
                source: triangleShape
            },
            // INCREASED spread with higher acceleration for cone shape
            accelerationX: { min: -50, max: 50 },
            accelerationY: { min: -50, max: 50 },
            tint: isHighSpeedBoost ? 
                [ 0xffffff, 0xd8f0ff, 0xccccff, 0x99ffff ] :
                [ 0xffffff, 0xd8f0ff, 0xccccff ]
        }).setDepth(20);
        
        // Emit boost particles
        boostEmitter.explode(particleCount);
        
        // For high-speed boost, add a second emitter with different parameters for more dramatic effect
        if (isHighSpeedBoost) {
            // IMPROVED TRIANGLES: Create wider, larger triangle for secondary burst
            let secondaryTriangle;
            
            if (isHorizontal) {
                secondaryTriangle = new Phaser.Geom.Triangle(
                    0, 0,                      // Apex
                    directionSign * -30, -25,  // Bottom left further out
                    directionSign * -30, 15    // Bottom right further out, slightly asymmetric
                );
            } else {
                // For vertical movement, create a wider triangle in the direction of movement
                const heightFactor = direction.y > 0 ? -1 : 1; // Flip triangle for up/down
                secondaryTriangle = new Phaser.Geom.Triangle(
                    0, 0,                     // Apex
                    -20, heightFactor * 30,   // Left corner 
                    20, heightFactor * 30     // Right corner
                );
            }
            
            // Secondary emitter parameters
            const secondaryEmitter = this.scene.add.particles(0, 0, particleKey, {
                x: player.x + (offsetX * 1.3),
                y: player.y + (offsetY * 1.3),
                lifespan: lifespan * 0.8, // Longer secondary burst
                gravityY: -20, // More upward drift
                speed: { min: speed.min * 0.7, max: speed.max * 0.7 },
                scale: { start: 0.3, end: 0.04, ease: 'Cubic.easeOut' }, // Larger particles
                alpha: { start: 0.9, end: 0 },
                // WIDER angle spread
                angle: { min: spreadAngleOffset - 60, max: spreadAngleOffset + 60 },
                rotate: { min: -180, max: 180, ease: 'Linear.easeIn' },
                accelerationX: { min: -80, max: 80 }, // More spread
                accelerationY: { min: -80, max: 80 }, // More spread
                frequency: -1,
                emitZone: { 
                    type: 'random',
                    source: secondaryTriangle
                },
                tint: [ 0xffffff, 0x99ffff, 0x66ddff ]
            }).setDepth(21);
            
            // Emit more particles
            secondaryEmitter.explode(Math.floor(particleCount * 0.9));
            
            // Add a third small emission for tiny bubbles with high turbulence and better spread
            const tertiaryEmitter = this.scene.add.particles(0, 0, particleKey, {
                x: player.x + (offsetX * 1.5),
                y: player.y + (offsetY * 1.5), 
                lifespan: lifespan * 1.0, // Slightly longer than main burst
                gravityY: -25, // Higher upward drift
                speed: { min: 100, max: 250 }, // Much slower, more chaotic
                scale: { start: 0.12, end: 0.01, ease: 'Cubic.easeOut' },
                alpha: { start: 0.6, end: 0 },
                // KEY FIX: Always use wider angle spread
                angle: { min: spreadAngleOffset - 60, max: spreadAngleOffset + 60 }, // Much wider spread
                // Extreme rotation for wild turbulence effect - INCREASED FOR VISIBILITY
                rotate: { min: 0, max: 720, ease: 'Linear.easeNone' }, 
                // INCREASED for more spread
                accelerationX: { min: -100, max: 100 },
                accelerationY: { min: -100, max: 100 },
                frequency: -1,
                emitZone: { 
                    type: 'random',
                    source: new Phaser.Geom.Circle(0, 0, 15) // WIDER emission zone for better spread
                },
                tint: [ 0xffffff, 0xaaddff, 0x77aaff ] // Lighter tint
            }).setDepth(22);
            
            // DRASTICALLY IMPROVE corkscrew visibility - DEDICATED SPIRAL EMITTERS
            
            // ENHANCED: Improved corkscrew parameters for more pronounced spirals
            const spiralFrequency = 25; // Higher frequency = tighter spirals
            const spiralAmplitude = 650; // Higher amplitude = wider spirals
            
            // Create corkscrews that move in proper spiral patterns - TOP PATH
            const topCorkscrewEmitter = this.scene.add.particles(0, 0, particleKey, {
                x: player.x + (offsetX * 2),
                y: player.y + (offsetY * 2) - 15, // Offset to top
                lifespan: lifespan * 1.5, // ENHANCED: Longer lifespan for more visible spirals
                gravityY: -10,
                // Consistent slow speed for visible corkscrew 
                speed: { min: 20, max: 30 }, // ENHANCED: Slower for more visible spirals
                // Larger particles for visibility
                scale: { start: 0.22, end: 0.05, ease: 'Linear.easeNone' }, // ENHANCED: Larger particles
                alpha: { start: 0.95, end: 0 }, // ENHANCED: More visible
                // NARROWER angle for predictable path
                angle: { min: spreadAngleOffset - 5, max: spreadAngleOffset + 5 }, // Very tight angle
                // Extreme continuous corkscrew rotation
                rotate: { start: 0, end: 1800, ease: 'Linear.easeNone' }, // ENHANCED: 5 full rotations
                // EXTREME corkscrew motion using sine/cosine functions
                accelerationX: {
                    easeFn: function (t) {
                        // Consistent sine wave that creates distinct spiral
                        return Math.sin(t * spiralFrequency) * spiralAmplitude * directionSign; // ENHANCED: More extreme spiral
                    },
                    ease: 'Linear.easeNone' // No easing for consistent speed
                },
                accelerationY: {
                    easeFn: function (t) {
                        // Cosine wave offset by 90° (half PI) from the X for circular motion
                        return Math.cos(t * spiralFrequency) * spiralAmplitude; // ENHANCED: More extreme spiral
                    },
                    ease: 'Linear.easeNone'
                },
                frequency: -1,
                quantity: 20, // ENHANCED: More particles
                emitZone: {
                    type: 'random',
                    source: new Phaser.Geom.Circle(0, 0, 2) // Very tight emission zone
                },
                tint: [ 0xffffff, 0xaaddff, 0x88ccff, 0x66bbff ] // ENHANCED: More varied blues
            }).setDepth(23); // Now behind player (was 28)
            
            // Create corkscrews that move in proper spiral patterns - BOTTOM PATH
            const bottomCorkscrewEmitter = this.scene.add.particles(0, 0, particleKey, {
                x: player.x + (offsetX * 2),
                y: player.y + (offsetY * 2) + 15, // Offset to bottom
                lifespan: lifespan * 1.5, // ENHANCED: Longer lifespan for more visible spirals
                gravityY: -10,
                // Consistent slow speed for visible corkscrew
                speed: { min: 20, max: 30 }, // ENHANCED: Slower for more visible spirals
                // Larger particles for visibility
                scale: { start: 0.22, end: 0.05, ease: 'Linear.easeNone' }, // ENHANCED: Larger particles
                alpha: { start: 0.95, end: 0 }, // ENHANCED: More visible
                // NARROWER angle for predictable path
                angle: { min: spreadAngleOffset - 5, max: spreadAngleOffset + 5 }, // Very tight angle
                // Opposite rotation direction to top path
                rotate: { start: 1800, end: 0, ease: 'Linear.easeNone' }, // ENHANCED: 5 full rotations, reverse direction
                // EXTREME corkscrew motion using sine/cosine functions - REVERSE PHASE
                accelerationX: {
                    easeFn: function (t) {
                        return Math.sin(t * spiralFrequency + Math.PI) * spiralAmplitude * directionSign; // ENHANCED: More extreme spiral
                    },
                    ease: 'Linear.easeNone'
                },
                accelerationY: {
                    easeFn: function (t) {
                        return Math.cos(t * spiralFrequency + Math.PI) * spiralAmplitude; // ENHANCED: More extreme spiral
                    },
                    ease: 'Linear.easeNone'
                },
                frequency: -1,
                quantity: 20, // ENHANCED: More particles
                emitZone: {
                    type: 'random',
                    source: new Phaser.Geom.Circle(0, 0, 2) // Very tight emission zone
                },
                tint: [ 0xffffff, 0xaaddff, 0x88ccff, 0x66bbff ] // ENHANCED: More varied blues
            }).setDepth(23); // Now behind player (was 28)
            
            // ENHANCED: Added additional middle corkscrew for more density
            const middleCorkscrewEmitter = this.scene.add.particles(0, 0, particleKey, {
                x: player.x + (offsetX * 2),
                y: player.y + (offsetY * 2), // Middle path
                lifespan: lifespan * 1.7, // Even longer lifespan
                gravityY: -8,
                speed: { min: 15, max: 25 }, // Even slower for more visible spirals
                scale: { start: 0.24, end: 0.06, ease: 'Linear.easeNone' }, // Largest particles
                alpha: { start: 1.0, end: 0 }, // Maximum visibility
                angle: { min: spreadAngleOffset - 3, max: spreadAngleOffset + 3 }, // Very tight angle
                rotate: { start: 0, end: 2160, ease: 'Linear.easeNone' }, // 6 full rotations
                accelerationX: {
                    easeFn: function (t) {
                        // Use a different phase offset for the middle path
                        return Math.sin(t * spiralFrequency + Math.PI/2) * spiralAmplitude * directionSign;
                    },
                    ease: 'Linear.easeNone'
                },
                accelerationY: {
                    easeFn: function (t) {
                        return Math.cos(t * spiralFrequency + Math.PI/2) * spiralAmplitude;
                    },
                    ease: 'Linear.easeNone'
                },
                frequency: -1,
                quantity: 15,
                emitZone: {
                    type: 'random',
                    source: new Phaser.Geom.Circle(0, 0, 2)
                },
                tint: [ 0xffffff, 0x99eeff, 0x77ccff, 0x55aaff ] // Distinct tint for middle path
            }).setDepth(23); // Now behind player (was 28)
            
            // Create ultra-clear tracer corkscrew - uses exact particle positioning
            const tracerEmitter = this.scene.add.particles(0, 0, particleKey, {
                x: player.x + (offsetX * 2.5),
                y: player.y + (offsetY * 2.5),
                lifespan: lifespan * 3.0, // ENHANCED: Even longer life
                gravityY: -3, // Almost no gravity
                speed: { min: 15, max: 18 }, // ENHANCED: Even slower for clearer spiral
                scale: { start: 0.3, end: 0.12, ease: 'Linear.easeNone' }, // ENHANCED: Much larger, slower shrink
                alpha: { start: 1.0, end: 0 }, // Maximum visibility
                angle: { min: spreadAngleOffset - 2, max: spreadAngleOffset + 2 }, // Almost perfectly straight
                // Very pronounced rotation
                rotate: { start: 0, end: 4320, ease: 'Linear.easeNone' }, // ENHANCED: 12 full rotations, constant speed!
                // Extreme spiral pattern - PERFECT sinusoidal motion
                accelerationX: {
                    easeFn: function (t) {
                        return Math.sin(t * 15) * 950 * directionSign; // ENHANCED: EXTREME amplitude for clear spiral
                    },
                    ease: 'Linear.easeNone'
                },
                accelerationY: {
                    easeFn: function (t) {
                        return Math.cos(t * 15) * 950; // Matching Y component
                    },
                    ease: 'Linear.easeNone'
                },
                frequency: -1,
                quantity: 15, // ENHANCED: More particles for clearer trail
                // Emit in a line for clearer pattern
                emitZone: {
                    type: 'edge',
                    source: new Phaser.Geom.Line(0, -15, 0, 15), // ENHANCED: Wider vertical line for emission
                    quantity: 15,
                    stepRate: 1,
                    yoyo: false
                },
                tint: [ 0xffffff, 0xbbffff, 0x77ddff, 0x55aaff ] // ENHANCED: More varied bright colors
            }).setDepth(24); // Now behind player (was 25)
            
            // Create a cloud of wider spread particles for visually rich effect
            // IMPROVED TRIANGLES: Better triangle shapes for each direction
            let wideTriangle;
            
            if (isHorizontal) {
                wideTriangle = new Phaser.Geom.Triangle(
                    0, 0,                      // Apex
                    directionSign * -45, -40,  // Bottom left corner (much wider)
                    directionSign * -45, 20    // Bottom right corner (much wider, asymmetric)
                );
            } else {
                // For vertical movement, create a wider triangle in the direction of movement
                const heightFactor = direction.y > 0 ? -1 : 1; // Flip triangle for up/down
                wideTriangle = new Phaser.Geom.Triangle(
                    0, 0,                     // Apex
                    -25, heightFactor * 40,   // Left corner 
                    25, heightFactor * 40     // Right corner
                );
            }
            
            const cloudEmitter = this.scene.add.particles(0, 0, particleKey, {
                x: player.x + (offsetX * 1.2),
                y: player.y + (offsetY * 1.2),
                lifespan: lifespan * 0.7,
                gravityY: -15,
                // Varied speed for more natural look
                speed: { min: 30, max: 120 },
                // Large start, rapid shrink
                scale: { start: 0.35, end: 0.05, ease: 'Cubic.easeOut' },
                alpha: { start: 0.85, end: 0 },
                // WIDER angle spread for consistent look regardless of direction
                angle: { min: spreadAngleOffset - 45, max: spreadAngleOffset + 45 },
                // Random rotation for cloud effect
                rotate: { min: -90, max: 90 },
                // More extreme random acceleration for more spread, matching the left boost
                accelerationX: { min: -70, max: 70 },
                accelerationY: { min: -70, max: 70 },
                frequency: -1,
                quantity: 35, // More particles
                // ENHANCED: Use triangle for triangle-shaped cloud
                emitZone: {
                    type: 'random',
                    source: wideTriangle
                },
                tint: [ 0xffffff, 0xeeffff, 0xccffff ]
            }).setDepth(21); // Now behind player (was 30)
            
            // Create a final ultra-long lasting stream of tiny distant particles
            const distantStreamEmitter = this.scene.add.particles(0, 0, particleKey, {
                x: player.x + (offsetX * 4), // Very far behind
                y: player.y + (offsetY * 4),
                lifespan: lifespan * 3, // Extra long lasting
                gravityY: -5,
                speed: { min: 10, max: 40 },
                scale: { start: 0.06, end: 0.01, ease: 'Linear.easeNone' },
                alpha: { start: 0.5, end: 0 },
                // Wide spread angle
                angle: { min: spreadAngleOffset - 80, max: spreadAngleOffset + 80 },
                // Constant slow rotation
                rotate: { start: 0, end: 720, ease: 'Linear.easeNone' },
                // Light acceleration for gentle drift
                accelerationX: { min: -40, max: 40 },
                accelerationY: { min: -40, max: 40 },
                frequency: -1,
                quantity: 60,
                // Very wide emission zone
                emitZone: {
                    type: 'random',
                    source: new Phaser.Geom.Circle(0, 0, 40)
                },
                tint: [ 0xffffff, 0xccddff, 0xaaddff, 0x99ccff ]
            }).setDepth(26);
            
            // Emit particles
            tertiaryEmitter.explode(Math.floor(particleCount * 1.2));
            topCorkscrewEmitter.explode(20);
            bottomCorkscrewEmitter.explode(20);
            middleCorkscrewEmitter.explode(15);
            tracerEmitter.explode(15);
            cloudEmitter.explode(35);
            distantStreamEmitter.explode(60);
            
            // Destroy the emitters
            this.scene.time.delayedCall(lifespan * 0.7, () => {
                secondaryEmitter.destroy();
            });
            
            this.scene.time.delayedCall(lifespan * 1.0, () => {
                tertiaryEmitter.destroy();
            });
            
            this.scene.time.delayedCall(lifespan * 1.5, () => {
                topCorkscrewEmitter.destroy();
                bottomCorkscrewEmitter.destroy();
            });
            
            this.scene.time.delayedCall(lifespan * 1.7, () => {
                middleCorkscrewEmitter.destroy();
            });
            
            this.scene.time.delayedCall(lifespan * 0.7, () => {
                cloudEmitter.destroy();
            });
            
            this.scene.time.delayedCall(lifespan * 3.0, () => {
                tracerEmitter.destroy();
            });
            
            this.scene.time.delayedCall(lifespan * 3, () => {
                distantStreamEmitter.destroy();
            });
        }
        
        // Destroy the temporary emitter after particles finish
        this.scene.time.delayedCall(lifespan, () => {
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
        // Do nothing - disabled all bubbles
        return;
    }
} 