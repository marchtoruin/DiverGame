/**
 * AirPocketSystem - Manages air pockets in the game
 * TODO: This file needs significant cleanup - redundant code and excessive logging should be removed
 */
import AirPocket from '../entities/AirPocket.js';

export default class AirPocketSystem {
    /**
     * Create a new air pocket system
     * @param {Phaser.Scene} scene - The game scene
     * @param {Object} player - The player entity
     */
    constructor(scene, player) {
        this.scene = scene;
        this.player = player || scene.player; // Accept player as param or get from scene
        this.airPockets = [];
        this.group = scene.physics.add.group();
        this.lastValidationTime = null;
        this.pendingOverlapSetup = false;
        this.colliders = [];
        this.processedObjectIds = [];
        
        // DEBUGGING: Flag to control debug visualization
        // Set to false to disable debug markers
        this.debugVisualsEnabled = false;
        
        // DEBUGGING: Container for debug visuals
        this.debugGraphics = null;
        this.debugTexts = [];
        
        // Automatically initialize - but use a short delay to ensure player is ready
        if (scene.game.isBooted) {
            scene.time.delayedCall(50, () => this.init());
        } else {
            scene.game.events.once('ready', () => this.init());
        }
    }

    /**
     * Load air pocket assets
     */
    preload() {
        // Preload air pocket textures if not already loaded
        if (!this.scene.textures.exists('air_pocket1')) {
            this.scene.load.image('air_pocket1', 'assets/images/air_pocket1.png');
            this.scene.load.image('air_pocket2', 'assets/images/air_pocket2.png');
            this.scene.load.image('air_pocket3', 'assets/images/air_pocket3.png');
        }
    }

    /**
     * Initialize the air pocket system
     */
    init() {
        // console.log('Initializing AirPocketSystem');
        
        try {
            // Create debug graphics container if debug is enabled
            if (this.debugVisualsEnabled) {
                this.createDebugContainer();
            }
            
            // Get air pockets from the map
            this.getAirPocketsFromMap();
            
            // Set up collisions with the obstacles layer
            this.setupObstacleCollisions();
            
            // Create particle emitters for air pockets
            this.createParticleEmitters();
            
            // Set up player overlap if player exists
            if (this.player) {
                // console.log('Setting up player overlap with air pockets');
                this.setupPlayerOverlap(this.player);
            } else {
                // console.warn('Player not available during init, will setup overlap later');
                this.pendingOverlapSetup = true;
            }
            
            // Setup validation timer to ensure air pockets are working
            this.scene.time.delayedCall(1000, () => {
                this.validateAirPockets();
            });
            
            // console.log(`AirPocketSystem initialized with ${this.airPockets.length} air pockets`);
        } catch (error) {
            console.error('Error initializing AirPocketSystem:', error);
        }
    }

    /**
     * Ensure all air pocket textures are loaded
     */
    ensureTexturesLoaded() {
        // Check if air pocket textures are loaded
        const requiredTextures = ['air_pocket1', 'air_pocket2', 'air_pocket3'];
        const missingTextures = requiredTextures.filter(
            texture => !this.scene.textures.exists(texture)
        );
        
        if (missingTextures.length > 0) {
            console.warn(`Missing required air pocket textures: ${missingTextures.join(', ')}`);
            console.log('Attempting to load missing air pocket textures...');
            
            // Try loading from base paths if available in the scene
            if (missingTextures.includes('air_pocket1') && !this.scene.textures.exists('air_pocket1')) {
                this.scene.load.image('air_pocket1', 'assets/air_pocket1.png');
            }
            
            if (missingTextures.includes('air_pocket2') && !this.scene.textures.exists('air_pocket2')) {
                this.scene.load.image('air_pocket2', 'assets/air_pocket2.png');
            }
            
            if (missingTextures.includes('air_pocket3') && !this.scene.textures.exists('air_pocket3')) {
                this.scene.load.image('air_pocket3', 'assets/air_pocket3.png');
            }
            
            // Start the loader if we added any images
            if (this.scene.load.list.size > 0) {
                this.scene.load.start();
            }
        } else {
            console.log('All required air pocket textures are loaded');
        }
    }

    /**
     * Setup collisions between air pockets and the obstacles layer
     */
    setupObstacleCollisions() {
        // Check if obstacles layer exists
        if (!this.scene.tilemapSystem || !this.scene.tilemapSystem.layers) {
            // console.warn('No tilemap layers found for air pocket collisions');
            return;
        }
        
        // Try to find obstacles layer with case-insensitive check
        const obstaclesLayerKey = 
            // First check if we already have a direct 'obstacles' key (from our new fix)
            this.scene.tilemapSystem.layers.obstacles ? 'obstacles' :
            // Then check capitalized version
            this.scene.tilemapSystem.layers.Obstacles ? 'Obstacles' :
            // Then try to find any key that includes 'obstacle'
            Object.keys(this.scene.tilemapSystem.layers)
                .find(key => key.toLowerCase().includes('obstacle'));
            
        if (!obstaclesLayerKey) {
            // console.warn('No obstacles layer found for air pocket collisions');
            return;
        }
        
        const obstaclesLayer = this.scene.tilemapSystem.layers[obstaclesLayerKey];
        // console.log(`Found obstacles layer with key: ${obstaclesLayerKey} for air pocket collisions`);
        
        // Clear any existing colliders
        if (this.obstaclesCollider && this.obstaclesCollider.active) {
            this.obstaclesCollider.destroy();
        }
        
        // FIXED: Check if we're using a real tilemap layer (with setCollisionByExclusion)
        // or a physics group from the fallback map
        if (obstaclesLayer && typeof obstaclesLayer.setCollisionByExclusion === 'function') {
            // Real tilemap layer case
            // console.log('Using real tilemap layer for air pocket collisions');
            obstaclesLayer.setCollisionByExclusion([-1]);
            
            // Add collider for all air pockets in the group
            this.obstaclesCollider = this.scene.physics.add.collider(
                this.group,
                obstaclesLayer,
                this.handleAirPocketObstacleCollision,
                null,
                this
            );
            
            // console.log('Air pocket-obstacles collider set up successfully');
        } else if (obstaclesLayer) {
            // Fallback case - obstaclesLayer is likely a physics group or array
            // console.log('Using fallback obstacles for air pocket collisions');
            
            try {
                // Check if it's a physics group (from our fallback map)
                if (obstaclesLayer.getChildren || obstaclesLayer.children) {
                    const obstacles = obstaclesLayer.getChildren ? 
                        obstaclesLayer.getChildren() : 
                        obstaclesLayer.children.entries;
                        
                    // console.log(`Found ${obstacles.length} obstacle objects for air pocket collisions`);
                    
                    // Add collider with the physics group
                    this.obstaclesCollider = this.scene.physics.add.collider(
                        this.group,
                        obstaclesLayer,
                        this.handleAirPocketObstacleCollision,
                        null,
                        this
                    );
                    
                    // console.log('Air pocket-obstacles collider set up successfully (fallback)');
                } else {
                    // console.warn('Obstacles layer is not a recognized layer or group type');
                }
            } catch (e) {
                console.error('Error setting up air pocket collisions:', e);
            }
        } else {
            // console.warn('Invalid obstacles layer for air pocket collisions');
        }
    }

    /**
     * Handle collision between air pocket and obstacles
     */
    handleAirPocketObstacleCollision(airPocketSprite, obstacle) {
        if (!airPocketSprite || !airPocketSprite.body) return;
        
        // Get the air pocket instance
        const airPocketInstance = airPocketSprite.airPocketInstance;
        
        // If this air pocket has already collided with obstacles, skip further processing
        if (airPocketInstance && airPocketInstance.hasCollided) {
            return;
        }
        
        // console.log('Air pocket collided with obstacle - making it static');
        
        // When air pocket collides with obstacle, stop it from moving
        airPocketSprite.body.setVelocity(0, 0);
        airPocketSprite.body.setAcceleration(0, 0);
        
        // Make it completely static
        airPocketSprite.body.immovable = true;
        
        // Make sure it doesn't fall
        airPocketSprite.body.setAllowGravity(false);
        
        // CRITICAL: Ensure the sprite remains visible and enabled
        airPocketSprite.setVisible(true);
        airPocketSprite.setActive(true);
        airPocketSprite.body.enable = true;
        
        // Mark the air pocket instance as having collided
        if (airPocketInstance) {
            airPocketInstance.hasCollided = true;
            
            // CRITICAL: Make sure the air pocket remains ACTIVE
            airPocketInstance.active = true;
            
            // CRITICAL: Make sure it's NOT marked as destroyed
            airPocketInstance.isDestroyed = false;
            
            // We'll continue to update this air pocket, but don't use the timer anymore
            if (airPocketInstance.updateTimer) {
                airPocketInstance.updateTimer.remove();
                airPocketInstance.updateTimer = null;
            }
            
            // Call the instance method if it exists
            if (typeof airPocketInstance.handleObstacleCollision === 'function') {
                airPocketInstance.handleObstacleCollision();
            }
        }
        
        // Console logging for debugging
        // console.log('Air pocket collided with obstacle and is now permanently static');
    }

    /**
     * Find and create air pockets from the map
     */
    getAirPocketsFromMap() {
        // console.log('Finding air pockets in tilemap...');
        
        // Initialize the array if it doesn't exist
        if (!this.airPockets) {
            this.airPockets = [];
        } else {
            // Clear existing air pockets to prevent duplicates
            this.airPockets.forEach(airPocket => {
                if (airPocket && airPocket.destroy) {
                    airPocket.destroy();
                }
            });
            this.airPockets = [];
        }
        
        // Clear the physics group to prevent duplicates
        if (this.group) {
            this.group.clear(true, true);
        }
        
        // Skip if no tilemap system is available
        if (!this.scene.tilemapSystem || !this.scene.tilemapSystem.map) {
            console.error('No tilemap available to extract air pockets from');
            return this.airPockets;
        }
        
        const map = this.scene.tilemapSystem.map;
        
        try {
            const objectLayerNames = map.getObjectLayerNames();
            
            // Clear any existing debug points first
            if (this.debugVisualsEnabled && this.debugGraphics) {
                this.debugGraphics.clear();
                this.clearDebugTexts();
            }
            
            // First look specifically for the "AirPockets" layer
            let airPocketsLayer = null;
            
            // Try to find the AirPockets layer (case-insensitive)
            for (const layerName of objectLayerNames) {
                if (layerName.toLowerCase() === 'airpockets') {
                    airPocketsLayer = map.getObjectLayer(layerName);
                    break;
                }
            }
            
            // If found, process air pockets from this layer
            if (airPocketsLayer && airPocketsLayer.objects && airPocketsLayer.objects.length > 0) {
                // Track processed positions to prevent duplicates
                const processedPositions = new Set();
                
                for (const obj of airPocketsLayer.objects) {
                    // Skip if not a point object
                    if (!obj.point) {
                        console.warn(`Air pocket at (${obj.x}, ${obj.y}) is not a point object - skipping`);
                        continue;
                    }
                    
                    // Skip if not named "air_pocket"
                    if (obj.name !== "air_pocket") {
                        console.warn(`Object at (${obj.x}, ${obj.y}) is not named "air_pocket" - skipping`);
                        continue;
                    }
                    
                    // Skip if we've already processed an air pocket at this position
                    const posKey = `${Math.round(obj.x)},${Math.round(obj.y)}`;
                    if (processedPositions.has(posKey)) {
                        console.warn(`Skipping duplicate air pocket at (${obj.x}, ${obj.y})`);
                        continue;
                    }
                    
                    // Extract properties
                    let variation = 1;
                    let oxygenAmount = null;
                    let respawnTime = null;
                    
                    // Check for properties on the object
                    if (obj.properties && Array.isArray(obj.properties)) {
                        obj.properties.forEach(prop => {
                            if (prop.name === 'variation') {
                                variation = parseInt(prop.value, 10) || 1;
                            } else if (prop.name === 'oxygen') {
                                oxygenAmount = parseInt(prop.value, 10);
                            } else if (prop.name === 'respawn') {
                                respawnTime = parseInt(prop.value, 10);
                            }
                        });
                    }
                    
                    console.log('Creating air pocket with properties:', {
                        x: obj.x,
                        y: obj.y,
                        variation,
                        oxygen: oxygenAmount,
                        respawn: respawnTime
                    });
                    
                    // Create a single air pocket with all properties
                    const airPocket = this.createAirPocket(obj.x, obj.y, {
                        type: variation,
                        oxygenAmount: oxygenAmount,
                        respawnTime: respawnTime
                    });
                    
                    if (airPocket && airPocket.sprite) {
                        // Add to the physics group for overlap detection
                        this.group.add(airPocket.sprite);
                        // Mark this position as processed
                        processedPositions.add(posKey);
                    }
                }
            }
            
            // If we still don't have any air pockets, create fallback ones
            if (this.airPockets.length === 0) {
                console.warn('No air pockets found in map, creating fallback air pockets');
                this.createFallbackAirPockets();
            }
            
            // Set up player overlap if player is already available
            if (this.player && this.player.sprite) {
                this.setupPlayerOverlap(this.player);
            } else {
                this.pendingOverlapSetup = true;
            }
            
        } catch (error) {
            console.error('Error processing air pockets from map:', error);
            this.createFallbackAirPockets();
        }
        
        return this.airPockets;
    }

    /**
     * Create an air pocket from a Tiled object
     * @param {Object} obj - The Tiled object
     * @returns {AirPocket} The created air pocket
     */
    createAirPocketFromObject(obj) {
        // Skip objects that don't have valid coordinates
        if (obj.x === undefined || obj.y === undefined) {
            // console.warn(`Skipping air pocket object with invalid coordinates`);
            return null;
        }
        
        // Skip if we've already processed this object (check by ID if available)
        if (obj.id && this.processedObjectIds && this.processedObjectIds.includes(obj.id)) {
            // console.log(`Air pocket with ID ${obj.id} already processed, skipping`);
            return null;
        }
        
        // Only process objects named "air_pocket"
        if (obj.name !== "air_pocket") {
            // console.log(`Object is not named "air_pocket", skipping`);
            return null;
        }
        
        // console.log(`Processing air pocket at (${obj.x}, ${obj.y})`);
        
        // Extract variation from properties or use default
        let variation = 1;
        let oxygenAmount = null;
        let respawnTime = null;
        
        // Check for properties on the object itself
        if (obj.properties && Array.isArray(obj.properties)) {
            obj.properties.forEach(prop => {
                if (prop.name === 'variation') {
                    variation = parseInt(prop.value, 10) || 1;
                } else if (prop.name === 'amount') {
                    oxygenAmount = parseInt(prop.value, 10);
                } else if (prop.name === 'respawnTime') {
                    respawnTime = parseInt(prop.value, 10);
                }
            });
        }
        
        // Ensure variation is valid (1-3)
        variation = Math.max(1, Math.min(3, variation));
        
        // console.log(`Creating air pocket at (${obj.x}, ${obj.y}) with variation ${variation}`);

        // Create the air pocket
        const airPocket = this.createAirPocket(
            obj.x,
            obj.y,
            {
                type: variation,
                oxygenAmount: oxygenAmount
            },
            respawnTime
        );
        
        if (airPocket) {
            // Mark as processed
            if (!this.processedObjectIds) {
                this.processedObjectIds = [];
            }
            if (obj.id) {
                this.processedObjectIds.push(obj.id);
            }
            
            // console.log(`Successfully created air pocket at (${obj.x}, ${obj.y})`);
        return airPocket;
        }
        
        return null;
    }

    /**
     * Create an air pocket at the specified position
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Array|Object|number} properties - Can be properties array from Tiled, a simple type value, or explicit variation
     * @param {number} [explicitAmount] - Optional explicit amount (overrides properties)
     * @param {number} [explicitRespawnTime] - Optional explicit respawn time (overrides properties)
     * @returns {AirPocket} The created air pocket
     */
    createAirPocket(x, y, properties, explicitAmount, explicitRespawnTime) {
        try {
            // Default values
            let config = {
                type: 1,
                oxygenAmount: 20,
                respawnTime: 15000
            };
            
            // Log the incoming parameters for debugging
            /* 
            console.log('Air pocket creation parameters:', { 
                x, 
                y, 
                properties, 
                explicitAmount, 
                explicitRespawnTime 
            });
            */
            
            // Handle explicit parameters first if provided
            if (explicitAmount !== undefined && explicitAmount !== null) {
                config.oxygenAmount = parseInt(explicitAmount, 10) || 20;
            }
            
            if (explicitRespawnTime !== undefined && explicitRespawnTime !== null) {
                config.respawnTime = parseInt(explicitRespawnTime, 10) || 15000;
            }
            
            // Then handle properties which can be various formats
            if (properties) {
                if (Array.isArray(properties)) {
                    // Properties from Tiled come as an array of {name, value} objects
                    properties.forEach(prop => {
                        if (prop.name === 'type' || prop.name === 'airType' || prop.name === 'variation') {
                            config.type = parseInt(prop.value, 10) || 1;
                        } 
                        // Only apply these if not explicitly set above
                        else if ((prop.name === 'amount' || prop.name === 'airAmount' || prop.name === 'oxygenAmount') && explicitAmount === undefined) {
                            config.oxygenAmount = parseInt(prop.value, 10) || 20;
                        }
                        else if ((prop.name === 'respawnTime' || prop.name === 'respawnDelay') && explicitRespawnTime === undefined) {
                            config.respawnTime = parseInt(prop.value, 10) || 15000;
                        }
                    });
                }
                else if (typeof properties === 'object' && !Array.isArray(properties)) {
                    // Direct config object with properties
                    config.type = properties.type || properties.variation || config.type;
                    
                    // Only apply these if not explicitly set
                    if (explicitAmount === undefined) {
                        config.oxygenAmount = properties.oxygenAmount || properties.amount || config.oxygenAmount;
                    }
                    
                    if (explicitRespawnTime === undefined) {
                        config.respawnTime = properties.respawnTime || properties.respawn || config.respawnTime;
                    }
                }
                else if (typeof properties === 'number') {
                    // Simple variation number
                    config.type = properties;
                }
            }
            
            // Limit type to valid range 1-3
            config.type = Math.max(1, Math.min(3, config.type || 1));
            
            // Create the air pocket
            const airPocket = new AirPocket(
                this.scene,
                x, 
                y,
                {
                    type: config.type,
                    oxygenAmount: config.oxygenAmount,
                    respawnTime: config.respawnTime
                }
            );
            
            // Create sprite and add to group
            const sprite = airPocket.create();
            if (sprite) {
                // IMPORTANT: Store a reference to the AirPocket instance on the sprite
                // This fixes the 'markForRespawn is not a function' error
                sprite.airPocketInstance = airPocket;
                
                // Set up the physics for the air pocket
                this.setupAirPocketPhysics(sprite);
                
                // Add to our physics group
                this.group.add(sprite);
            }
            
            // Add to our collection
            this.airPockets.push(airPocket);
            
            // console.log(`Created air pocket at (${x}, ${y}) with type ${config.type}, oxygen amount ${config.oxygenAmount}`);
            
            return airPocket;
        } catch (error) {
            console.error('Error creating air pocket:', error);
            return null;
        }
    }

    /**
     * Set up physics properties for air pockets to make them collide with obstacles
     * @param {Phaser.GameObjects.Sprite} sprite - The air pocket sprite
     */
    setupAirPocketPhysics(sprite) {
        if (!sprite || !sprite.body) {
            // console.warn('Cannot setup physics - air pocket sprite has no physics body');
            return;
        }
        
        // Ensure the body is enabled
        sprite.body.enable = true;
        
        // IMPORTANT: Not a sensor - we want real collisions with obstacles
        sprite.body.isSensor = false;
        
        // CRITICAL FIX: NON-immovable so it can float until collision
        sprite.body.immovable = false;
        
        // Disable gravity - we'll use our own upward movement
        sprite.body.setAllowGravity(false);
        
        // HIGHER UPWARD VELOCITY - make them float up faster
        sprite.body.setVelocity(
            Phaser.Math.Between(-15, 15), // Slight random horizontal movement
            -70 // Faster upward movement to ensure they move
        );
        
        // Make sure it has slight bounce for better visual effect
        sprite.body.setBounce(0.3, 0.3);
        
        // Minimal friction
        sprite.body.setFriction(0, 0);
        
        // Low drag to make movement smoother
        sprite.body.setDrag(10, 10);
        
        // Update velocity continuously for more buoyant effect
        if (sprite.airPocketInstance) {
            const airPocket = sprite.airPocketInstance;
            
            // Stop any existing update timer
            if (airPocket.updateTimer) {
                airPocket.updateTimer.remove();
                airPocket.updateTimer = null;
            }
            
            // Create periodic update to maintain upward movement
            airPocket.updateTimer = this.scene.time.addEvent({
                delay: 100, // Shorter delay for more responsive movement
                callback: () => {
                    // Only apply movement if not collided yet
                    if (sprite.body && sprite.body.enable && !airPocket.hasCollided) {
                        // If it's slowing down, give it a stronger push upward
                        if (sprite.body.velocity.y > -50) {
                            sprite.body.velocity.y = -70;
                        }
                        
                        // Add slight wobble effect
                        sprite.body.velocity.x += Phaser.Math.Between(-5, 5);
                    }
                },
                callbackScope: this,
                loop: true
            });
        }
        
        // Log physics setup
        // console.log(`Air pocket physics configured: velocity.y=${sprite.body.velocity.y}, immovable=${sprite.body.immovable}`);
    }

    /**
     * Manually add an air pocket
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} variation - Air pocket variation (1-3)
     * @returns {AirPocket} The created air pocket
     */
    addAirPocket(x, y, variation = 1) {
        const airPocket = new AirPocket(this.scene, x, y, variation);
        const sprite = airPocket.create();
        this.group.add(sprite);
        this.airPockets.push(airPocket);
        return airPocket;
    }

    /**
     * Handle player overlapping with air pocket
     * @param {Object} player - The player entity or sprite
     * @param {Object} airPocket - The air pocket sprite
     */
    handlePlayerAirPocketOverlap(player, airPocketSprite) {
        // Safety check - ensure both objects still exist
        if (!player || !airPocketSprite || !airPocketSprite.active) {
            return;
        }
        
        try {
            // Determine the actual player entity (might be sprite or wrapper object)
            const playerEntity = this.player && this.player.sprite === player ? this.player : player;
            
            // Capture air pocket coordinates for effects before removing it
            const pocketX = airPocketSprite.x;
            const pocketY = airPocketSprite.y;
            
            // Get the air pocket instance from the sprite
            const airPocketInstance = airPocketSprite.airPocketInstance;
            
            if (!airPocketInstance) {
                return;
            }
            
            // Get the oxygen amount from the air pocket
            const oxygenAmount = airPocketInstance.oxygenAmount || 20;
            
            // Flag to track if oxygen was actually refilled
            let oxygenRefilled = false;
            
            // Handle oxygen refill
            if (playerEntity && typeof playerEntity.refillOxygen === 'function') {
                // Use dedicated refill method if available
                playerEntity.refillOxygen(oxygenAmount);
                oxygenRefilled = true;
            } else if (playerEntity && playerEntity.oxygen !== undefined) {
                // Direct property manipulation if no refill method
                const prevOxygen = playerEntity.oxygen;
                // Add the specified oxygen amount (or go to max)
                playerEntity.oxygen = Math.min(playerEntity.maxOxygen, playerEntity.oxygen + oxygenAmount);
                oxygenRefilled = (playerEntity.oxygen > prevOxygen);
                
                // Ensure proper events are emitted
                if (typeof playerEntity.emit === 'function') {
                playerEntity.emit('playerOxygenChanged', playerEntity.oxygen, playerEntity.maxOxygen);
                
                    // Emit collect event for sound/visual effects
                    playerEntity.emit('collectAirPocket', airPocketSprite);
                } else if (this.scene && this.scene.events) {
                    // Fall back to scene events if player can't emit
                    this.scene.events.emit('playerOxygenChanged', playerEntity.oxygen, playerEntity.maxOxygen);
                    this.scene.events.emit('collectAirPocket', airPocketSprite);
                }
            } else if (this.player && this.player.oxygen !== undefined) {
                // Alternative handling if player entity has separate sprite
                const prevOxygen = this.player.oxygen;
                // Add the specified oxygen amount (or go to max)
                this.player.oxygen = Math.min(this.player.maxOxygen, this.player.oxygen + oxygenAmount);
                oxygenRefilled = (this.player.oxygen > prevOxygen);
                
                if (typeof this.player.emit === 'function') {
                    this.player.emit('playerOxygenChanged', this.player.oxygen, this.player.maxOxygen);
                    this.player.emit('collectAirPocket', airPocketSprite);
                } else if (this.scene && this.scene.events) {
                    this.scene.events.emit('playerOxygenChanged', this.player.oxygen, this.player.maxOxygen);
                    this.scene.events.emit('collectAirPocket', airPocketSprite);
                }
            }
            
            if (oxygenRefilled) {
                // Create visual collect effect at the air pocket's position
                this.createCollectEffect(pocketX, pocketY);
                
                // Create a text popup showing oxygen increase
                this.createOxygenPopup(pocketX, pocketY, `+${oxygenAmount} O₂`);
                
                // Find and mark the corresponding spawn point as inactive
                if (this.scene.airPocketSpawnPoints) {
                    const spawnPoint = this.scene.airPocketSpawnPoints.find(sp => 
                        Math.abs(sp.x - pocketX) < 5 && Math.abs(sp.y - pocketY) < 5
                    );
                    if (spawnPoint) {
                        spawnPoint.active = false;
                        spawnPoint.lastSpawnTime = this.scene.time.now;
                        console.log(`Marked spawn point at (${pocketX}, ${pocketY}) as inactive`);
                    }
                }
                
                // Remove the air pocket
                this.removeAirPocket(airPocketSprite);
            }
            
        } catch (error) {
            console.error('Error in air pocket overlap handler:', error);
        }
    }
    
    /**
     * Remove/deactivate an air pocket when collected by player
     * @param {Object} airPocket - The air pocket sprite to remove
     */
    removeAirPocket(airPocket) {
        try {
            // Get the actual AirPocket instance
            const instance = airPocket.airPocketInstance;
            
            if (instance) {
                // Stop the update timer if it exists
                if (instance.updateTimer) {
                    instance.updateTimer.remove();
                    instance.updateTimer = null;
                }
                
                // Use the instance's deactivate method - this is for collection by player
                instance.deactivate();
                
                // console.log(`Air pocket at (${instance.x}, ${instance.y}) removed due to player collection`);
            } else {
                // Fallback for direct sprite handling
                if (airPocket && typeof airPocket.setVisible === 'function') {
                airPocket.setVisible(false);
                }
                
                if (airPocket && airPocket.body) {
                    airPocket.body.enable = false;
                }
                
                // console.log(`Air pocket removed (no instance reference)`);
            }
            
            // Note: We don't actually remove the sprite from the group 
            // since we're going to respawn it later
            
        } catch (error) {
            console.error('Error removing air pocket:', error);
        }
    }

    /**
     * Create a particle effect when collecting air pocket
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    createCollectEffect(x, y) {
        if (!this.scene.add || !this.scene.add.particles) return;
        
        try {
            // In Phaser 3.60, we need to create a ParticleEmitter differently
            // First create the particle emitter with the proper texture key
            const emitter = this.scene.add.particles(x, y, 'air_pocket1', {
                scale: { start: 0.5, end: 0.1 },
                speed: { min: 50, max: 100 },
                lifespan: 500,
                blendMode: 'ADD',
                quantity: 10,
                emitting: false // Don't start emitting automatically
            });
            
            // Store reference to manage collection effects
            if (!this.collectEffects) {
                this.collectEffects = [];
            }
            this.collectEffects.push(emitter);
            
            // Emit particles once using explode method
            emitter.explode(10, x, y);
            
            // Destroy emitter and remove from array after animation completes
            this.scene.time.delayedCall(600, () => {
                // Remove from the array first
                const index = this.collectEffects.indexOf(emitter);
                if (index !== -1) {
                    this.collectEffects.splice(index, 1);
                }
                
                // Then destroy the particles
                if (emitter && emitter.destroy) {
                    emitter.destroy();
                }
            });
        } catch (error) {
            console.error('Error creating collect effect:', error);
        }
    }

    /**
     * Update the air pocket system
     * @param {number} time - Current game time
     */
    update(time) {
        // Only update at fixed intervals to reduce CPU impact
        if (this.lastUpdateTime && time - this.lastUpdateTime < 100) {
            return;
        }
        this.lastUpdateTime = time;
        
        // Update air pocket physics
        this.airPockets.forEach(airPocket => {
            // Skip destroyed or inactive air pockets
            if (!airPocket || !airPocket.active || airPocket.isDestroyed) {
                return;
            }
            
            const sprite = airPocket.sprite;
            if (!sprite || !sprite.body) return;
            
            // Handle air pockets that have collided with obstacles
            if (airPocket.hasCollided) {
                // CRITICAL: Ensure collided air pockets remain in place
                sprite.body.setVelocity(0, 0);
                sprite.body.setAcceleration(0, 0);
                sprite.body.immovable = true;
                
                // CRITICAL: Double check sprite is visible and active
                if (!sprite.visible || !sprite.active) {
                    // console.log(`Ensuring collided air pocket remains visible at (${airPocket.x}, ${airPocket.y})`);
                    sprite.setVisible(true);
                    sprite.setActive(true);
                    sprite.body.enable = true;
                }
            } else {
                // Only apply upward movement to non-collided air pockets
                // Check if we need to refresh the upward velocity
                // Air pockets should continue to move upward until they hit an obstacle
                if (sprite.body.velocity.y > -20) {
                    sprite.body.setVelocityY(-70); // Stronger upward movement
                }
                
                // Add a slight random horizontal wobble
                if (Math.random() < 0.1) {
                    const wobble = Phaser.Math.Between(-25, 25);
                    sprite.body.setVelocityX(wobble);
                }
            }
        });
        
        // Check for bugs in the air pocket system every 5 seconds
        const checkInterval = 5000;
        if (!this.lastValidationTime || time - this.lastValidationTime > checkInterval) {
            this.validateAirPockets();
        }
    }
    
    /**
     * Validate that air pockets are set up correctly
     * This checks for any issues and attempts to resolve them
     */
    validateAirPockets() {
        // Prevent too frequent validation
        const now = this.scene.time.now;
        if (this.lastValidationTime && now - this.lastValidationTime < 5000) {
            return;
        }
        this.lastValidationTime = now;
        
        // console.log('Validating air pocket system...');
        
        // Check if we have any air pockets
        if (!this.airPockets || this.airPockets.length === 0) {
            // console.warn('No air pockets found during validation');
            
            // Try to get air pockets from the map again
            this.getAirPocketsFromMap();
            
            // If still no air pockets, create some fallback ones
            if (!this.airPockets || this.airPockets.length === 0) {
                // console.log('Creating fallback air pockets during validation');
                this.createFallbackAirPockets();
            }
        }
        
        // Count active vs inactive air pockets
        let activeCount = 0;
        let inactiveCount = 0;
        
        // Ensure all air pockets have proper physics bodies
        let fixedCount = 0;
        for (let i = 0; i < this.airPockets.length; i++) {
            const airPocket = this.airPockets[i];
            
            // Skip if the air pocket was legitimately collected by player
            if (airPocket.isDestroyed) {
                inactiveCount++;
                continue;
            }
            
            // CRITICAL: Ensure air pockets that collided with obstacles remain active
            if (airPocket.hasCollided && !airPocket.active) {
                // console.log(`Reactivating air pocket at (${airPocket.x}, ${airPocket.y}) that was incorrectly deactivated`);
                airPocket.active = true;
                fixedCount++;
            }
            
            if (airPocket.active) {
                activeCount++;
                
                // Check and fix the sprite if needed
                const sprite = airPocket.sprite;
                if (sprite) {
                    // CRITICAL: Ensure sprites for collided air pockets are visible
                    if (airPocket.hasCollided && (!sprite.visible || !sprite.active)) {
                        sprite.setVisible(true);
                        sprite.setActive(true);
                        fixedCount++;
                    }
                    
                    // Make sure physics body is enabled for active air pockets
                    if (sprite.body && !sprite.body.enable) {
                        sprite.body.enable = true;
                        fixedCount++;
                    }
                }
            } else {
                inactiveCount++;
            }
        }
        
        if (fixedCount > 0) {
            // console.log(`Fixed ${fixedCount} air pockets with issues`);
        }
        
        // console.log(`Air pocket status: ${activeCount} active, ${inactiveCount} inactive`);
        
        // Make sure the group contains all active air pockets
        if (this.group) {
            // Remove any sprites from the group that shouldn't be there
            const currentChildren = this.group.getChildren();
            for (let i = 0; i < currentChildren.length; i++) {
                const sprite = currentChildren[i];
                const instance = sprite.airPocketInstance;
                
                // Remove from group if:
                // 1. It has no instance reference, OR
                // 2. The instance is marked as destroyed
                if (!instance || instance.isDestroyed) {
                    this.group.remove(sprite, false, false);
                }
            }
            
            // Add any active sprites that should be in the group
            let addedCount = 0;
            this.airPockets.forEach(airPocket => {
                if (airPocket && airPocket.active && !airPocket.isDestroyed && airPocket.sprite) {
                    // Only add if not already in the group
                    if (!this.group.contains(airPocket.sprite)) {
                        this.group.add(airPocket.sprite);
                        addedCount++;
                    }
                }
            });
            
            if (addedCount > 0) {
                // console.log(`Added ${addedCount} missing air pockets to the physics group`);
            }
            
            // console.log(`Physics group now contains ${this.group.getLength()} air pockets`);
        }
        
        // Ensure player overlap is set up
        if (this.pendingOverlapSetup && this.player) {
            // console.log('Setting up pending player-air pocket overlap');
            this.setupPlayerOverlap(this.player);
            this.pendingOverlapSetup = false;
        }
        
        // console.log('Air pocket validation complete');
    }

    /**
     * Create fallback air pockets in case none were found in the map
     */
    createFallbackAirPockets() {
        // Only create fallbacks if we have no existing air pockets
        if (this.airPockets && this.airPockets.length > 0) {
            // console.log('Skipping fallback creation - air pockets already exist');
            return;
        }
        
        // console.log('Creating fallback air pockets');
        // console.log('==== FALLBACK AIR POCKET DEBUG ====');
        
        // Create some air pockets at fixed positions
        const fallbackPositions = [
            { x: 300, y: 200, type: 1, oxygen: 20 },
            { x: 600, y: 400, type: 2, oxygen: 35 },
            { x: 900, y: 600, type: 3, oxygen: 50 },
            { x: 1200, y: 300, type: 1, oxygen: 20 },
            { x: 400, y: 700, type: 2, oxygen: 35 }
        ];
        
        // Create air pockets at these positions
        fallbackPositions.forEach(pos => {
            // DEBUGGING: Log detailed information
            // console.log(`[DEBUG] Fallback Air Pocket at (${pos.x}, ${pos.y}): Variation=${pos.type}, Oxygen=${pos.oxygen}`);
            
            // DEBUGGING: Create visual indicator
            if (this.debugVisualsEnabled) {
                this.createDebugMarker(pos.x, pos.y, pos.type, pos.oxygen, pos.respawnTime, true);
            }
            
            this.createAirPocket(pos.x, pos.y, {
                type: pos.type,
                oxygenAmount: pos.oxygen,
                respawnTime: pos.respawnTime ? pos.respawnTime * 1000 : undefined
            });
        });
        
        // console.log(`Created ${fallbackPositions.length} fallback air pockets`);
        // console.log('==== END FALLBACK AIR POCKET DEBUG ====');
    }

    /**
     * Clean up resources
     */
    destroy() {
        // Clean up debug visuals
        if (this.debugGraphics) {
            this.debugGraphics.clear();
            this.debugGraphics.destroy();
            this.debugGraphics = null;
        }
        this.clearDebugTexts();
        
        // Clean up colliders
        if (this.colliders) {
            this.colliders.forEach(collider => {
                if (collider) this.scene.physics.world.removeCollider(collider);
            });
            this.colliders = [];
        }
        
        // Clean up physics group
        if (this.group) {
            this.group.clear(true, true);
            this.group = null;
        }
        
        // Clean up collect effects
        if (this.collectEffects) {
            this.collectEffects.forEach(effect => {
                if (effect && effect.destroy) effect.destroy();
            });
            this.collectEffects = [];
        }
        
        // Clean up air pockets
        if (this.airPockets) {
            this.airPockets.forEach(airPocket => {
                if (airPocket && airPocket.destroy) {
                    airPocket.destroy();
                }
            });
            this.airPockets = [];
        }
        
        // Clear references
        this.player = null;
    }

    /**
     * Create particle emitters for air pockets
     */
    createParticleEmitters() {
        if (!this.scene.add.particles) {
            // console.warn('Particles not available for air pocket effects');
            return;
        }
        
        try {
            // In Phaser 3.60, ParticleEmitterManager was removed in favor of the new ParticleSystem
            // We need to create a particle emitter config but not create actual particles yet
            
            // Store the default emitter configuration for later use
            this.defaultEmitterConfig = {
                scale: { start: 0.2, end: 0.1 },
                speed: { min: 20, max: 40 },
                alpha: { start: 0.6, end: 0 },
                lifespan: 1000,
                frequency: 500,
                blendMode: 'ADD'
            };
            
            // console.log('Air pocket particle emitter configuration created');
        } catch (error) {
            console.error('Error creating particle emitter configuration:', error);
        }
    }

    /**
     * Set up overlap detection between player and air pockets
     * @param {Player} player - The player entity
     */
    setupPlayerOverlap(player) {
        // console.log('Setting up player overlap with air pockets. Player:', player ? 'exists' : 'missing');
        
        if (!player || !player.sprite) {
            // console.error('Cannot set up player overlap - player or sprite not initialized');
            this.pendingOverlapSetup = true; // Mark for later setup
            return;
        }
        
        try {
            // Clear any existing overlap handlers first
            if (this.colliders && this.colliders.length > 0) {
                // console.log('Clearing existing air pocket colliders');
            this.colliders.forEach(collider => {
                    if (collider && collider.active) {
                        collider.destroy();
                }
            });
            this.colliders = [];
            }
            
            // Set up collision with the physics group
            // console.log(`Setting up overlap between player and ${this.airPockets.length} air pockets`);
            
            // IMPORTANT: Use a special overlap detection for air pockets
            // We use a collision detector BUT with a custom processCallback
            // This makes the air pockets solid but still collectable
            const newCollider = this.scene.physics.add.overlap(
                player.sprite,
                this.group,
                (playerSprite, airPocketSprite) => {
                    // This executes only when we have overlap AND our process callback returned true
                    this.handlePlayerAirPocketOverlap(player, airPocketSprite);
                },
                null, // No process callback - meaning all overlaps will trigger
                this
            );
            
            if (newCollider) {
                this.colliders.push(newCollider);
                // console.log('Successfully set up air pocket overlap detection');
                this.pendingOverlapSetup = false;
            } else {
                // console.error('Failed to create air pocket overlap detector');
            }
            
            // Double-check that physics bodies are enabled on all air pockets
            this.airPockets.forEach((ap, i) => {
                if (ap.sprite && ap.sprite.body) {
                    // Ensure the body is enabled
                    ap.sprite.body.enable = true;
                    // console.log(`Air pocket ${i} physics body: enabled=${ap.sprite.body.enable}, immovable=${ap.sprite.body.immovable}`);
                } else {
                    // console.warn(`Air pocket ${i} at (${ap.x}, ${ap.y}) has no physics body!`);
                }
            });
        } catch (error) {
            console.error('Error setting up player-air pocket overlap:', error);
        }
    }

    /**
     * Create a floating text popup showing oxygen gained
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} text - Text to show (default: +O₂)
     */
    createOxygenPopup(x, y, text = '+O₂') {
        try {
            if (!this.scene || !this.scene.add) return;
            
            // Create floating text showing oxygen gained
            const textObject = this.scene.add.text(x, y, text, {
                fontSize: '24px',
                fontFamily: 'Arial',
                color: '#00ffff',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center'
            });
            textObject.setOrigin(0.5);
            
            // Animate the text
            this.scene.tweens.add({
                targets: textObject,
                y: y - 50,
                alpha: 0,
                duration: 1500,
                ease: 'Power2',
                onComplete: () => {
                    textObject.destroy();
                }
            });
        } catch (error) {
            console.error('Error creating oxygen popup:', error);
        }
    }

    /**
     * DEBUGGING: Create a container for debug graphics
     */
    createDebugContainer() {
        // Clean up any existing debug graphics first
        if (this.debugGraphics) {
            this.debugGraphics.clear();
            this.clearDebugTexts();
        } else {
            this.debugGraphics = this.scene.add.graphics();
        }
        
        // Set a high depth to ensure visibility
        this.debugGraphics.setDepth(1000);
        
        // console.log('Air pocket debug visualization enabled');
    }
    
    /**
     * DEBUGGING: Create a visual marker at an air pocket spawn point
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} variation - Air pocket variation
     * @param {number} oxygen - Oxygen amount
     * @param {number} respawnTime - Respawn time in seconds
     * @param {boolean} isFallback - Whether this is a fallback air pocket
     */
    createDebugMarker(x, y, variation, oxygen, respawnTime, isFallback = false) {
        if (!this.debugGraphics) {
            this.debugGraphics = this.scene.add.graphics();
            this.debugGraphics.setDepth(1000);
        }
        
        // Choose color based on variation
        let color;
        if (isFallback) {
            color = 0xff00ff; // Magenta for fallback
        } else {
            switch (variation) {
                case 1: color = 0x00ff00; break; // Bright Green
                case 2: color = 0x00ffff; break; // Cyan
                case 3: color = 0xff9900; break; // Orange
                default: color = 0xffff00; break; // Yellow
            }
        }
        
        // Draw a larger, more visible circle at the spawn point
        this.debugGraphics.lineStyle(3, color, 1);
        this.debugGraphics.strokeCircle(x, y, 30);
        
        // Draw crosshair for better visibility
        this.debugGraphics.lineStyle(2, color, 1);
        this.debugGraphics.beginPath();
        this.debugGraphics.moveTo(x - 25, y);
        this.debugGraphics.lineTo(x + 25, y);
        this.debugGraphics.moveTo(x, y - 25);
        this.debugGraphics.lineTo(x, y + 25);
        this.debugGraphics.strokePath();
        
        // Add detailed text label showing all properties with color coding
        const labelText = [
            `\u{1F3C1} Type: ${variation}`, // Flag emoji
            `\u{1F4A1} O₂: ${oxygen || 'default'}`, // Light bulb emoji
            `\u{23F3} Respawn: ${respawnTime || 'default'}s` // Hourglass emoji
        ].join('\n');
        
        const text = this.scene.add.text(x, y - 60, labelText, {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center',
            backgroundColor: `#${color.toString(16).padStart(6, '0')}44` // Semi-transparent background matching circle color
        });
        text.setOrigin(0.5);
        text.setDepth(1001);
        
        // Add a pulsing effect to make it more noticeable
        this.scene.tweens.add({
            targets: text,
            alpha: { from: 1, to: 0.7 },
            duration: 1000,
            yoyo: true,
            repeat: -1
        });
        
        // Store reference for later cleanup
        if (!this.debugTexts) this.debugTexts = [];
        this.debugTexts.push(text);
    }
    
    /**
     * DEBUGGING: Clear all debug text objects
     */
    clearDebugTexts() {
        if (this.debugTexts && this.debugTexts.length > 0) {
            this.debugTexts.forEach(text => {
                if (text && text.destroy) {
                    text.destroy();
                }
            });
            this.debugTexts = [];
        }
    }
    
    /**
     * Enable or disable debug visualizations
     * @param {boolean} enabled - Whether debug visuals should be enabled
     */
    setDebugVisualsEnabled(enabled) {
        // Set the flag
        this.debugVisualsEnabled = enabled;
        
        if (!enabled) {
            // Clear all debug visuals
            if (this.debugGraphics) {
                this.debugGraphics.clear();
            }
            this.clearDebugTexts();
            // console.log('Air pocket debug visualization disabled');
        } else {
            // Re-create debug visuals
            this.createDebugContainer();
            
            // Re-visualize existing air pockets
            this.airPockets.forEach(airPocket => {
                if (airPocket) {
                    const x = airPocket.x;
                    const y = airPocket.y;
                    const variation = airPocket.variation || 1;
                    const oxygen = airPocket.oxygenAmount;
                    const respawnTime = airPocket.respawnTime ? airPocket.respawnTime / 1000 : null;
                    this.createDebugMarker(x, y, variation, oxygen, respawnTime);
                }
            });
            
            // console.log('Air pocket debug visualization enabled');
        }
    }

    /**
     * Register an air pocket object from the Tiled map
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} width - Width of the object (unused, for compatibility)
     * @param {number} height - Height of the object (unused, for compatibility)
     * @returns {AirPocket} The created air pocket
     */
    registerAirPocket(x, y, width, height) {
        // console.log(`Registering air pocket at (${x}, ${y})`);
        
        try {
            let variation = 1;
            let oxygenAmount = null;
            let respawnTime = null;
            
            // Look through map objects to find matching properties
            if (this.scene.tilemapSystem && this.scene.tilemapSystem.map) {
                const map = this.scene.tilemapSystem.map;
                const objectLayerNames = map.getObjectLayerNames();
                
                for (const layerName of objectLayerNames) {
                    const layer = map.getObjectLayer(layerName);
                    if (!layer || !layer.objects) continue;
                    
                    const obj = layer.objects.find(o => 
                        Math.abs(o.x - x) < 5 && Math.abs(o.y - y) < 5);
                    
                    if (obj && obj.properties && Array.isArray(obj.properties)) {
                        obj.properties.forEach(prop => {
                            if (prop.name === 'variation') {
                                variation = parseInt(prop.value, 10) || 1;
                            } else if (prop.name === 'oxygen') {
                                oxygenAmount = parseInt(prop.value, 10);
                            } else if (prop.name === 'respawn') {
                                respawnTime = parseInt(prop.value, 10);
                            }
                        });
                        
                        // Log the exact values found
                        console.log(`Air pocket at (${x}, ${y}):`, {
                            variation,
                            oxygen: oxygenAmount,
                            respawn: respawnTime
                        });
                        break;
                    }
                }
            }
            
            // Create debug visualization with all properties
            if (this.debugVisualsEnabled) {
                this.createDebugMarker(x, y, variation, oxygenAmount, respawnTime);
            }
            
            // Create the air pocket with all properties
            return this.createAirPocket(x, y, {
                type: variation,
                oxygenAmount: oxygenAmount,
                respawnTime: respawnTime ? respawnTime * 1000 : undefined // Convert seconds to milliseconds
            });
        } catch (error) {
            console.error('Error registering air pocket:', error);
            return null;
        }
    }
} 