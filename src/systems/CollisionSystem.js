import { PLAYER } from '../utils/Constants';

/**
 * System for managing all collisions in the game
 */
export default class CollisionSystem {
    /**
     * Create a new CollisionSystem
     * @param {Phaser.Scene} scene - The scene this system belongs to
     */
    constructor(scene) {
        this.scene = scene;
        this.colliders = [];
        this.overlaps = [];
        
        console.log('CollisionSystem initialized');
        
        // Check if dependencies are ready for collision setup
        if (this.areDependenciesReady()) {
            this.setupCollisions();
        } else {
            // Delay collision setup to allow dependencies to be created
            console.log('Delaying collision setup until dependencies are ready');
            scene.time.delayedCall(300, () => {
                if (this.areDependenciesReady()) {
                    this.setupCollisions();
                } else {
                    console.warn('Dependencies still not ready for collision setup');
                    // One last attempt
                    scene.time.delayedCall(500, () => this.setupCollisions());
                }
            });
        }
    }
    
    /**
     * Check if all required dependencies are ready for collision setup
     * @returns {boolean} True if dependencies are ready
     */
    areDependenciesReady() {
        const playerReady = Boolean(this.scene.player && this.scene.player.sprite);
        const tilemapReady = Boolean(this.scene.tilemapSystem);
        const airPocketReady = Boolean(this.scene.airPocketSystem);
        
        console.log('Collision dependencies ready check:', {
            player: playerReady,
            tilemap: tilemapReady,
            airPocket: airPocketReady
        });
        
        return playerReady && tilemapReady && airPocketReady;
    }
    
    /**
     * Setup all collisions between game entities
     */
    setupCollisions() {
        console.log('Setting up collision handlers');
        
        try {
            this.setupPlayerCollisions();
            this.setupAirPocketOverlaps();
            // Enemy collisions are now handled directly in GameScene
            // to ensure proper initialization timing
            
            console.log('Collision setup complete');
        } catch (error) {
            console.error('Error setting up collisions:', error);
        }
    }
    
    /**
     * Set up collisions between player and environment
     */
    setupPlayerCollisions() {
        // Skip if player or tilemapSystem are not available
        if (!this.scene.player || !this.scene.player.sprite || !this.scene.tilemapSystem) {
            console.warn('Player or tilemap not available for collision setup');
            
            // Schedule a retry
            this.scene.time.delayedCall(500, () => {
                console.log('Retrying player collision setup...');
                this.setupPlayerCollisions();
            });
            return;
        }
        
        const playerSprite = this.scene.player.sprite;
        console.log('Setting up player collision with obstacles');
        
        // Set up collisions between player and obstacle layers
        Object.keys(this.scene.tilemapSystem.layers || {}).forEach(layerName => {
            const layer = this.scene.tilemapSystem.layers[layerName];
            
            // If this is an obstacle layer, add collision
            if (layer && layerName.toLowerCase().includes('obstacle')) {
                console.log(`Adding collision between player and ${layerName} layer`);
                
                try {
                    // Add collision between player and this obstacle layer
                    const collider = this.scene.physics.add.collider(
                        playerSprite,
                        layer,
                        this.handlePlayerObstacleCollision,
                        null,
                        this
                    );
                    
                    // Store the collider for later reference
                    this.colliders.push({
                        name: `player_${layerName}`,
                        collider: collider
                    });
                    
                    console.log(`Added collider between player and ${layerName}`);
                } catch (error) {
                    console.error(`Error adding collision for ${layerName}:`, error);
                }
            }
        });
        
        // Set up world bounds collision
        playerSprite.setCollideWorldBounds(true);
        console.log('Player collision with world bounds enabled');
    }
    
    /**
     * Set up overlaps between player and air pockets
     */
    setupAirPocketOverlaps() {
        // Skip if player or airPocketSystem are not available
        if (!this.scene.player || !this.scene.player.sprite || !this.scene.airPocketSystem) {
            console.warn('Player or air pocket system not available for overlap setup');
            return;
        }
        
        const playerSprite = this.scene.player.sprite;
        
        // Check if we have air pockets to overlap with
        if (this.scene.airPocketSystem.airPockets && this.scene.airPocketSystem.airPockets.length > 0) {
            console.log(`Setting up player overlap with ${this.scene.airPocketSystem.airPockets.length} air pockets`);
            
            try {
                // Add overlap between player and air pockets group
                const overlap = this.scene.physics.add.overlap(
                    playerSprite,
                    this.scene.airPocketSystem.airPockets,
                    this.handlePlayerAirPocketOverlap,
                    null,
                    this
                );
                
                // Store the overlap for later reference
                this.overlaps.push({
                    name: 'player_airpockets',
                    overlap: overlap
                });
                
                console.log('Added player-air pocket overlap');
            } catch (error) {
                console.error('Error adding air pocket overlap:', error);
            }
        } else {
            console.warn('No air pockets available for overlap setup');
        }
    }
    
    /**
     * Handle collision between player and obstacles
     * @param {Phaser.Physics.Arcade.Sprite} playerSprite - The player sprite
     * @param {Phaser.Tilemaps.Tile} tile - The tile that was collided with
     */
    handlePlayerObstacleCollision(playerSprite, tile) {
        // Only handle collisions with actual tiles
        if (!tile || tile.index === -1) return;
        
        // Simple collision response - already handled by physics
        // Add any custom behavior needed on collision here
    }
    
    /**
     * Handle overlap between player and air pockets
     * @param {Phaser.Physics.Arcade.Sprite} playerSprite - The player sprite
     * @param {Phaser.Physics.Arcade.Sprite} airPocket - The air pocket sprite
     */
    handlePlayerAirPocketOverlap(playerSprite, airPocket) {
        // Let the air pocket system handle the actual oxygen refill
        if (this.scene.airPocketSystem && typeof this.scene.airPocketSystem.handlePlayerOverlap === 'function') {
            this.scene.airPocketSystem.handlePlayerOverlap(playerSprite, airPocket);
        }
    }
    
    /**
     * Update method called each frame
     * @param {number} time - Current time
     * @param {number} delta - Time elapsed since last update
     */
    update(time, delta) {
        // Check if we need to rebuild any collision handlers
        if (time % 1000 < 16) { // Check about once per second
            if (!this.colliders.length && this.scene.player && this.scene.player.sprite) {
                console.log('No colliders found, attempting to rebuild collision setup');
                this.setupCollisions();
            }
        }
        
        // Add any per-frame collision checks here
    }
    
    /**
     * Clean up resources when the system is destroyed
     */
    destroy() {
        // Remove all colliders
        this.colliders.forEach(colliderObj => {
            if (colliderObj.collider && colliderObj.collider.destroy) {
                colliderObj.collider.destroy();
            }
        });
        
        // Remove all overlaps
        this.overlaps.forEach(overlapObj => {
            if (overlapObj.overlap && overlapObj.overlap.destroy) {
                overlapObj.overlap.destroy();
            }
        });
        
        this.colliders = [];
        this.overlaps = [];
        
        console.log('CollisionSystem destroyed');
    }
} 