import Player from '../entities/Player';
import { PLAYER, CAMERA } from '../utils/Constants';

/**
 * System for managing the player entity
 */
export default class PlayerSystem {
    /**
     * Create a new PlayerSystem
     * @param {Phaser.Scene} scene - The scene this system belongs to
     */
    constructor(scene) {
        this.scene = scene;
        this.player = null;
        this.lastPosition = null;
        this.moving = false;
    }
    
    /**
     * Create a player entity at the given position
     * @param {number} x - Initial x position
     * @param {number} y - Initial y position
     * @returns {Player} The created player entity
     */
    createPlayer(x, y) {
        try {
            // Create a new player
            this.player = new Player(this.scene, x, y);
            
            // Create the player sprite
            const sprite = this.player.create();
            
            if (sprite) {
                // Register player with physics system
                this.scene.physics.world.enable(sprite);
                
                // Create bubbles for player
                this.player.createMaskBubbles();
                
                // Create particle trail if particle system exists
                if (this.scene.particleSystem) {
                    this.scene.particleSystem.createBubbleTrail(sprite, 'bubble');
                    
                    // Connect player movement bursts to particles
                    this.player.on('movementBurst', (sprite, direction) => {
                        this.scene.particleSystem.emitMovementBurst(sprite, 'bubble', direction);
                    });
                }
            }
            
            return this.player;
        } catch (error) {
            console.error('Error in PlayerSystem.createPlayer():', error);
            return null;
        }
    }
    
    /**
     * Update the player and related systems
     * @param {number} time - Current game time
     * @param {number} delta - Time elapsed since last update
     */
    update(time, delta) {
        if (!this.player?.active) return;
        
        try {
            // Update the player entity
            this.player.update(time, delta);
            
            // Update particle effects (if available)
            if (this.player.updateParticleEffects) {
                this.player.updateParticleEffects();
            }
            
            // Track player movement
            if (this.player.sprite && this.lastPosition) {
                const dx = this.player.sprite.x - this.lastPosition.x;
                const dy = this.player.sprite.y - this.lastPosition.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Update last position for next frame
                this.lastPosition.x = this.player.sprite.x;
                this.lastPosition.y = this.player.sprite.y;
                
                // Set moving flag
                this.moving = distance > 0.5;
                
                // Emit movement event if player is moving
                if (this.moving && typeof this.player.emit === 'function') {
                    this.player.emit('movement', {
                        x: dx,
                        y: dy,
                        distance: distance
                    });
                }
            }
        } catch (error) {
            console.error('Error in PlayerSystem update:', error);
        }
    }
    
    /**
     * Reset the player to a specific position
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    resetPlayer(x, y) {
        if (this.player) {
            this.player.reset(x, y);
            
            // Reset movement tracking
            if (this.player.sprite) {
                this.lastPosition = { x: this.player.sprite.x, y: this.player.sprite.y };
            }
        }
    }
    
    /**
     * Get the current player position
     * @returns {Object|null} Position object with x and y, or null if no player
     */
    getPlayerPosition() {
        return this.player?.sprite ? {
            x: this.player.sprite.x,
            y: this.player.sprite.y
        } : null;
    }
    
    /**
     * Check if the player is active
     * @returns {boolean} True if player exists and is active
     */
    isPlayerActive() {
        return this.player?.active;
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        if (this.player?.destroy) {
            this.player.destroy();
        }
        this.player = null;
        this.lastPosition = null;
    }
} 