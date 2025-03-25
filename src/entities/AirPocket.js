import { OXYGEN } from '../utils/Constants';

/**
 * AirPocket - Collectible air pocket entity
 */
export default class AirPocket {
    /**
     * Create a new air pocket
     * @param {Phaser.Scene} scene - The game scene
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number|Object} variation - Variation of air pocket (1-3) or config object
     */
    constructor(scene, x, y, variation = 1) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        
        // Handle if variation is passed as an object with config properties
        let config = {};
        if (typeof variation === 'object') {
            config = variation;
            this.variation = Math.min(Math.max(config.type || 1, 1), 3); // Clamp between 1-3
            this.oxygenAmount = config.oxygenAmount || 25;
            
            // Handle respawn time - convert from seconds to milliseconds if needed
            if (config.respawn !== undefined) {
                // Convert seconds to milliseconds
                this.respawnTime = config.respawn * 1000;
                console.log(`Setting respawn time to ${this.respawnTime}ms (${config.respawn} seconds)`);
            } else {
                this.respawnTime = 10000; // Default 10 seconds
            }
        } else {
            this.variation = Math.min(Math.max(variation, 1), 3); // Clamp between 1-3
            
            // Default property values
            this.oxygenAmount = 25; // Default amount of oxygen to give
            this.respawnTime = 10000; // 10 seconds
            
            // Adjust oxygen amount based on variation
            if (this.variation === 2) {
                this.oxygenAmount = 35;
            } else if (this.variation === 3) {
                this.oxygenAmount = 50;
            }
        }
        
        // Air pocket properties
        this.sprite = null;
        this.active = true;
        this.respawnTimer = null;
        this.hasCollided = false; // Track if it has collided with obstacles
        this.isDestroyed = false; // Track if it has been destroyed by collection
        
        console.log(`AirPocket created with variation ${this.variation}, oxygen ${this.oxygenAmount}, respawn ${this.respawnTime/1000}s`);
    }
    
    /**
     * Create the air pocket sprite
     * @returns {Phaser.GameObjects.Sprite} The created sprite
     */
    create() {
        try {
            // Create the sprite based on variation
            const textureKey = `air_pocket${this.variation}`;
            this.sprite = this.scene.add.sprite(this.x, this.y, textureKey);
            this.sprite.setScale(0.165); // Add back the correct scale
            
            // Enable physics
            this.scene.physics.world.enable(this.sprite);
            
            // Store reference to this instance on the sprite
            this.sprite.airPocketInstance = this;

            // Set up physics properties
            if (this.sprite.body) {
                // Set up circular physics body for better interaction
                const bodyRadius = 40;
                this.sprite.body.setCircle(bodyRadius);
                
                // Set the offset to center the collision circle
                this.sprite.body.setOffset(
                    this.sprite.width / 2 - bodyRadius,
                    this.sprite.height / 2 - bodyRadius
                );

                // Disable gravity and set up movement properties
                this.sprite.body.setAllowGravity(false);
                this.sprite.body.setBounce(0.1, 0.1);
                this.sprite.body.setFriction(0, 0);
                this.sprite.body.setDrag(20, 20);

                // Give it a slight initial velocity
                this.sprite.body.setVelocity(
                    Phaser.Math.Between(-20, 20),
                    -40 // Upward movement
                );
            }

            // Add subtle pulsing animation
            this.scene.tweens.add({
                targets: this.sprite,
                scale: this.sprite.scale * 1.1,
                duration: 1000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            return this.sprite;
        } catch (error) {
            console.error('Error creating air pocket sprite:', error);
            return null;
        }
    }
    
    /**
     * Called when the air pocket collides with an obstacle
     * Makes the air pocket static at that position
     */
    handleObstacleCollision() {
        if (!this.sprite || !this.sprite.body || this.hasCollided) return;
        
        // Stop all movement
        this.sprite.body.setVelocity(0, 0);
        this.sprite.body.setAcceleration(0, 0);
        
        // Make it immovable
        this.sprite.body.immovable = true;
        
        // Mark as collided - IMPORTANT: It should remain visible and active
        this.hasCollided = true;
        
        // CRITICAL: Make sure it remains visible and active
        this.sprite.setVisible(true);
        this.sprite.setActive(true);
        this.sprite.body.enable = true;
        
        console.log(`Air pocket at (${this.x}, ${this.y}) has collided with obstacle and is now static but still visible`);
    }
    
    /**
     * Mark for respawn after being collected by player
     */
    markForRespawn() {
        if (this.isDestroyed) return;
        
        console.log(`Air pocket marked for respawn in ${this.respawnTime}ms (${this.respawnTime/1000} seconds)`);
        
        // Reset active state
        this.active = false;
        
        // Mark as destroyed (collected)
        this.isDestroyed = true;
        
        // Hide the sprite
        if (this.sprite) {
            this.sprite.setVisible(false);
            this.sprite.setActive(false);
            
            // Disable physics to prevent further interactions
            if (this.sprite.body) {
                this.sprite.body.enable = false;
            }
        }

        // Start the respawn timer
        if (this.scene) {
            console.log('Starting respawn timer...');
            this.respawnTimer = this.scene.time.delayedCall(this.respawnTime, () => {
                console.log('Respawn timer completed, calling respawn()');
                this.respawn();
            });
        }
    }
    
    /**
     * Respawn the air pocket
     */
    respawn() {
        console.log('Respawning air pocket');
        this.active = true;
        this.isDestroyed = false;

        if (this.sprite) {
            this.sprite.setVisible(true);
            this.sprite.setActive(true);
            if (this.sprite.body) {
                this.sprite.body.enable = true;
            }
        }

        // Clear the respawn timer
        if (this.respawnTimer) {
            this.respawnTimer.remove();
            this.respawnTimer = null;
        }

        console.log('Air pocket respawned successfully');
    }
    
    /**
     * Deactivate this air pocket (called when collected by player)
     */
    deactivate() {
        this.active = false;
        this.isDestroyed = true;
        
        if (this.sprite) {
            this.sprite.setVisible(false);
            if (this.sprite.body) {
                this.sprite.body.enable = false;
            }
        }

        // Start respawn timer
        if (this.scene) {
            console.log(`Starting respawn timer for ${this.respawnTime/1000} seconds`);
            this.respawnTimer = this.scene.time.delayedCall(this.respawnTime, () => {
                console.log('Respawn timer completed, respawning air pocket');
                this.respawn();
            });
        }
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        if (this.respawnTimer) {
            this.respawnTimer.remove();
            this.respawnTimer = null;
        }
        
        if (this.sprite) {
            this.sprite.destroy();
            this.sprite = null;
        }
    }
} 