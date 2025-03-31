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
     * @param {number} variation - Air pocket variation (1-3)
     * @param {Object} options - Additional options
     */
    constructor(scene, x, y, variation = 1, options = {}) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.variation = variation;
        this.active = true;
        this.hasCollided = false;
        this.isDestroyed = false;
        this.sprite = null;
        this.particles = null;
        this.updateTimer = null;
        this.respawnTimer = null;
        this.oxygenAmount = options.oxygenAmount || 20;
        this.respawnTime = options.respawnTime || 30000; // 30 seconds
    }
    
    /**
     * Create the air pocket sprite
     * @returns {Phaser.GameObjects.Sprite} The created sprite
     */
    create() {
        try {
            // Pick the appropriate texture
            const textureName = `air_pocket${this.variation}`;
            
            // Create sprite
            this.sprite = this.scene.physics.add.sprite(this.x, this.y, textureName);
            this.sprite.airPocketInstance = this; // Reference back to this instance
            this.sprite.setScale(0.5); // Smaller visual appearance
            
            // Make physics body larger than visual sprite for better collision detection
            // This helps prevent high-speed tunneling
            if (this.sprite.body) {
                // Make the physics body significantly larger than the visual sprite
                // This gives a much bigger target for high-speed players to hit
                const bodyWidth = this.sprite.width * 2.0;  // Double size
                const bodyHeight = this.sprite.height * 2.0; // Double size
                
                this.sprite.body.setSize(bodyWidth, bodyHeight);
                this.sprite.body.setOffset(
                    (this.sprite.width - bodyWidth) / 2,
                    (this.sprite.height - bodyHeight) / 2
                );
                
                // Non-immovable so it can float
                this.sprite.body.immovable = false;
                
                // Disable gravity - we'll use our own movement
                this.sprite.body.allowGravity = false;
                
                // Add slight bounce for visual effect
                this.sprite.body.bounce.set(0.4);
                
                // Give a slight upward velocity to make it float
                this.sprite.body.velocity.y = -75;
            }
            
            return this.sprite;
        } catch (error) {
            console.error('Error creating air pocket:', error);
            return null;
        }
    }
    
    /**
     * Update the air pocket
     * @param {number} time - Current game time
     */
    update(time) {
        if (!this.active || !this.sprite) return;
        
        // Add wobble effect
        if (this.sprite.body && !this.hasCollided) {
            // Random horizontal movement for realism
            if (Math.random() < 0.1) {
                this.sprite.body.velocity.x += Phaser.Math.Between(-10, 10);
            }
            
            // Ensure upward movement continues
            if (this.sprite.body.velocity.y > -25) {
                this.sprite.body.velocity.y = -75;
            }
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
        if (this.updateTimer) {
            this.updateTimer.remove();
            this.updateTimer = null;
        }
        
        if (this.respawnTimer) {
            this.respawnTimer.remove();
            this.respawnTimer = null;
        }
        
        if (this.particles) {
            this.particles.destroy();
            this.particles = null;
        }
        
        if (this.sprite) {
            this.sprite.destroy();
            this.sprite = null;
        }
        
        this.active = false;
    }
} 