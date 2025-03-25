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
        
        // Set up input handling
        this.setupInput();
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
     * @param {number} x - X position of the bullet
     * @param {number} y - Y position of the bullet
     * @param {number} direction - Direction of the bullet
     */
    fireBullet(x, y, direction) {
        let bullet = this.bullets.getFirstDead(true);
        
        if (bullet) {
            bullet.fire(x, y, direction);
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