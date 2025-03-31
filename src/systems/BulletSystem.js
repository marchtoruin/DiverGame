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
                // Only fire if we have a player reference and diver arm
                if (this.scene.player?.sprite && this.scene.diverArm) {
                    // Get the arm tip position
                    const diverArm = this.scene.diverArm;
                    
                    // Get bullet origin position
                    let bulletX, bulletY;
                    
                    // Check if we have pre-calculated tip position
                    if (diverArm.tipX !== undefined && diverArm.tipY !== undefined) {
                        // Use the pre-calculated tip position directly
                        bulletX = diverArm.tipX;
                        bulletY = diverArm.tipY;
                    } else {
                        // Fallback calculation if tip position is not available
                        const armLength = 70;
                        // Use trueDirection for tip calculation
                        const trueDirection = diverArm.trueDirection || 0;
                        bulletX = diverArm.x + Math.cos(trueDirection) * armLength;
                        bulletY = diverArm.y + Math.sin(trueDirection) * armLength;
                    }
                    
                    // Use the raw angle directly for bullet direction
                    const trueDirection = diverArm.trueDirection || 0;
                    
                    // Calculate velocity components directly from true direction
                    const dirX = Math.cos(trueDirection);
                    const dirY = Math.sin(trueDirection);
                    
                    console.log(`[BULLET] Firing using trueDirection ${Phaser.Math.RadToDeg(trueDirection).toFixed(1)}°, ` +
                               `direction: (${dirX.toFixed(2)}, ${dirY.toFixed(2)}), ` +
                               `from: (${bulletX.toFixed(0)}, ${bulletY.toFixed(0)})`);
                    
                    // Fire the bullet with the raw direction components
                    this.fireBullet(bulletX, bulletY, { x: dirX, y: dirY });
                    
                    // Update last fire time
                    this.lastFireTime = time;
                }
            }
        }
    }
    
    /**
     * Fire a bullet from the player
     * @param {number} x - X position of the bullet origin
     * @param {number} y - Y position of the bullet origin
     * @param {number|object} direction - Direction of the bullet (number for left/right or vector object with x,y for precise direction)
     */
    fireBullet(x, y, direction) {
        // Check if player has enough oxygen to fire
        if (this.scene.player && this.scene.player.oxygen < this.oxygenCostPerShot) {
            return; // Can't fire if not enough oxygen
        }

        let bullet = this.bullets.getFirstDead(true);
        
        if (bullet) {
            // If direction is a vector object with x and y properties, use it directly
            if (typeof direction === 'object' && direction.x !== undefined && direction.y !== undefined) {
                // Use the provided origin point without offset
                bullet.fire(x, y, direction);
            } else {
                // Legacy support for simple left/right direction
                // Different offsets based on player direction
                let bulletX = x;
                let bulletY = y;
                
                if (direction > 0) { // Facing right
                    bulletX = x + 50;
                    bulletY = y - 40;
                } else { // Facing left
                    bulletX = x - 50;
                    bulletY = y - 40;
                }
                
                bullet.fire(bulletX, bulletY, direction);
            }
            
            // Add a subtle camera shake effect when firing
            if (this.scene.cameras && this.scene.cameras.main) {
                this.scene.cameras.main.shake(50, 0.003, false);
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