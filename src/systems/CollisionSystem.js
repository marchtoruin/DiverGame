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
        
        // Enable Continuous Collision Detection for the player to prevent tunneling at high speeds
        if (playerSprite.body) {
            // Store the original player body size and offset
            this.originalBodySize = {
                width: playerSprite.body.width,
                height: playerSprite.body.height,
                offsetX: playerSprite.body.offset.x,
                offsetY: playerSprite.body.offset.y
            };
            
            // Set up a check function to run every frame
            this.scene.events.on('update', this.checkHighSpeedCollision, this);
            
            console.log('High-speed collision detection enabled for player');
        }
    }
    
    /**
     * Check for high-speed collisions to prevent tunneling through obstacles
     * @param {number} time - Current game time
     * @param {number} delta - Time since last update
     */
    checkHighSpeedCollision(time, delta) {
        const player = this.scene.player;
        if (!player || !player.sprite || !player.sprite.body) return;
        
        const playerBody = player.sprite.body;
        
        // Get player velocity
        const velocityX = playerBody.velocity.x;
        const velocityY = playerBody.velocity.y;
        
        // Calculate velocity magnitude
        const velocityMagnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        
        // Only apply special handling for high velocities (like during boost)
        const isHighSpeed = velocityMagnitude > 300;
        
        if (isHighSpeed) {
            // Calculate movement direction
            const dirX = velocityX !== 0 ? Math.sign(velocityX) : 0;
            const dirY = velocityY !== 0 ? Math.sign(velocityY) : 0;
            
            // Temporarily increase the player's collision body size in the direction of movement
            // This effectively creates a "sweep test" that prevents tunneling
            const extraSize = 10; // Extra collision padding
            
            // Adjust body size based on movement direction
            if (Math.abs(velocityX) > Math.abs(velocityY)) {
                // Moving mostly horizontally
                const extraWidth = Math.floor(Math.abs(velocityX) / 60); // Scale with velocity
                playerBody.setSize(
                    this.originalBodySize.width + extraSize + extraWidth,
                    this.originalBodySize.height,
                    false
                );
                
                // Adjust offset based on direction to keep the player sprite centered
                if (dirX > 0) {
                    // Moving right
                    playerBody.setOffset(
                        this.originalBodySize.offsetX - extraSize/2,
                        this.originalBodySize.offsetY
                    );
                } else {
                    // Moving left
                    playerBody.setOffset(
                        this.originalBodySize.offsetX - extraSize/2 - extraWidth,
                        this.originalBodySize.offsetY
                    );
                }
            } else {
                // Moving mostly vertically
                const extraHeight = Math.floor(Math.abs(velocityY) / 60); // Scale with velocity
                playerBody.setSize(
                    this.originalBodySize.width,
                    this.originalBodySize.height + extraSize + extraHeight,
                    false
                );
                
                // Adjust offset based on direction to keep the player sprite centered
                if (dirY > 0) {
                    // Moving down
                    playerBody.setOffset(
                        this.originalBodySize.offsetX,
                        this.originalBodySize.offsetY - extraSize/2
                    );
                } else {
                    // Moving up
                    playerBody.setOffset(
                        this.originalBodySize.offsetX,
                        this.originalBodySize.offsetY - extraSize/2 - extraHeight
                    );
                }
            }
            
            // Debug visualization
            if (this.scene.physics.config.debug && !this.debugText) {
                this.debugText = this.scene.add.text(10, 40, 
                    `High-speed collision: ${velocityMagnitude.toFixed(0)}`, 
                    { font: '12px Arial', fill: '#ff0000' }
                ).setDepth(1000).setScrollFactor(0);
            } else if (this.scene.physics.config.debug && this.debugText) {
                this.debugText.setText(`High-speed collision: ${velocityMagnitude.toFixed(0)}`);
            }
        } else {
            // Restore original collision body size and offset when moving at normal speed
            if (this.originalBodySize) {
                playerBody.setSize(
                    this.originalBodySize.width,
                    this.originalBodySize.height,
                    false
                );
                playerBody.setOffset(
                    this.originalBodySize.offsetX,
                    this.originalBodySize.offsetY
                );
            }
            
            // Hide debug text when back to normal speed
            if (this.debugText) {
                this.debugText.setText('');
            }
        }
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
        // Remove the update event listener
        this.scene.events.off('update', this.checkHighSpeedCollision, this);
        
        // Clean up debug text
        if (this.debugText) {
            this.debugText.destroy();
            this.debugText = null;
        }
        
        // Remove all colliders
        this.colliders.forEach(({ collider }) => {
            if (collider && typeof collider.destroy === 'function') {
                collider.destroy();
            }
        });
        this.colliders = [];
        
        // Remove all overlaps
        this.overlaps.forEach(({ overlap }) => {
            if (overlap && typeof overlap.destroy === 'function') {
                overlap.destroy();
            }
        });
        this.overlaps = [];
        
        console.log('CollisionSystem destroyed');
    }
} 