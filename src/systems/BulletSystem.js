import Bullet from '../entities/Bullet.js';

/**
 * System for managing bullets in the game
 */
export default class BulletSystem {
    /**
     * Create a new BulletSystem
     * @param {Phaser.Scene} scene - The scene this system belongs to
     */
    constructor(scene) {
        this.scene = scene;
        
        // Create bullet group
        this.bullets = this.scene.add.group({
            classType: Bullet,
            maxSize: 10,
            runChildUpdate: true
        });
        
        // Firing properties
        this.fireRate = 150; // Time between shots in ms
        this.lastFireTime = 0;
        this.isFiring = false;
        
        // Oxygen cost per shot
        this.oxygenCostPerShot = 0.7; // Reduced from 2 to make shooting more sustainable
        
        // Reference to the lighting system (will be set in init)
        this.lightingSystem = null;
        
        // Set up input handling
        this.setupInput();
    }
    
    /**
     * Initialize system with references to other systems
     */
    init() {
        // Get reference to the lighting system if it exists
        if (this.scene.lightingSystem) {
            this.lightingSystem = this.scene.lightingSystem;
        }
    }
    
    setupInput() {
        // Set up mouse input for firing
        this.scene.input.on('pointerdown', (pointer) => {
            if (pointer.leftButtonDown()) {
                this.isFiring = true;
            }
        });
        
        this.scene.input.on('pointerup', (pointer) => {
            if (!pointer.leftButtonDown()) {
                this.isFiring = false;
            }
        });
    }

    /**
     * Update bullet system
     * @param {number} time - Current game time
     * @param {number} delta - Time since last update
     */
    update(time, delta) {
        // Handle firing logic
        if (this.isFiring || this.scene.input.activePointer.isDown) {
            // Check if enough time has passed since last shot
            if (time - this.lastFireTime >= this.fireRate) {
                // Only fire if we have a player reference
                if (this.scene.player?.sprite) {
                    // Use player's facing direction instead of mouse position
                    const direction = this.scene.player.sprite.flipX ? -1 : 1;
                    this.fireBullet(this.scene.player.sprite.x, this.scene.player.sprite.y, direction);
                    this.lastFireTime = time;
                }
            }
        }
    }
    
    /**
     * Fire a bullet from the player
     * @param {number} x - X position of the player
     * @param {number} y - Y position of the player
     * @param {number} direction - Direction of the bullet
     */
    fireBullet(x, y, direction) {
        // Check if player has enough oxygen to fire
        if (this.scene.player && this.scene.player.oxygen < this.oxygenCostPerShot) {
            return; // Can't fire if not enough oxygen
        }

        // Use manually tuned offsets based on the player sprite
        let bulletX = x;
        let bulletY = y;
        
        // Different offsets based on player direction
        if (direction > 0) { // Facing right
            bulletX = x + 50; // Moved out by 12px (was +38)
            bulletY = y - 40; // Moved up by 2px (was -38)
        } else { // Facing left
            bulletX = x - 50; // Moved out by 12px (was -38)
            bulletY = y - 40; // Moved up by 2px (was -38)
        }
        
        let bullet = this.bullets.getFirstDead(true);
        
        if (bullet) {
            bullet.fire(bulletX, bulletY, direction);
            
            // The depth is now set in the Bullet class constructor
            // to be higher than the darkness overlay (950)
            
            // Add a subtle camera shake effect when firing
            if (this.scene.cameras && this.scene.cameras.main) {
                this.scene.cameras.main.shake(50, 0.003, false); // Duration 50ms, intensity 0.003 (very subtle)
            }
            
            // Consume oxygen for firing
            if (this.scene.player) {
                this.scene.player.oxygen = Math.max(0, this.scene.player.oxygen - this.oxygenCostPerShot);
                this.scene.events.emit('playerOxygenChanged', this.scene.player.oxygen, this.scene.player.maxOxygen);
            }
        }
    }
    
    /**
     * Set up collision between bullets and a target
     * @param {Phaser.GameObjects.Sprite|Phaser.GameObjects.Group} target - The target to check collisions with
     * @param {Function} callback - Callback function when collision occurs
     */
    setupCollision(target, callback) {
        // Remove any existing overlap and ensure it's properly destroyed
        if (this.bulletCollider) {
            this.bulletCollider.destroy();
            this.bulletCollider = null;
        }

        // Create new overlap with provided target and callback
        this.bulletCollider = this.scene.physics.add.overlap(
            this.bullets,
            target,
            (bullet, targetHit) => {
                // Only process if the bullet is still active
                if (bullet && bullet.active) {
                    if (callback) {
                        callback(bullet, targetHit);
                    }
                    // Ensure bullet is deactivated after collision
                    bullet.deactivate();
                }
            },
            null,
            this
        );
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        // Remove input listeners
        this.scene.input.off('pointerdown');
        this.scene.input.off('pointerup');
        
        // Destroy bullet group
        if (this.bulletCollider) {
            this.bulletCollider.destroy();
        }
        this.bullets.clear(true, true);
    }
}