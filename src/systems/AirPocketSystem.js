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
        this.respawnTimers = new Map(); // NEW: Track respawn timers for air pockets
        this.originalDataMap = new Map(); // NEW: Store original air pocket data for respawning
        
        // DEBUGGING: Flag to control debug visualization
        // CRITICAL: DISABLE debug markers entirely - they cause visual bugs
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
        try {
            // Clear any markers from other systems
            this.clearTypeMarkers();
            
            // Create debug container if needed
            this.createDebugContainer();
            
            // Ensure textures are loaded
            this.ensureTexturesLoaded();
            
            // Clear all air pockets first
            if (Array.isArray(this.airPockets) && this.airPockets.length > 0) {
                this.airPockets.forEach(airPocket => {
                    if (airPocket && airPocket.destroy) {
                        airPocket.destroy();
                    }
                });
                this.airPockets = [];
            } else {
                this.airPockets = [];
            }
            
            // Create physics group if it doesn't exist yet
            if (!this.group) {
                this.group = this.scene.physics.add.group({
                    allowGravity: false,
                    immovable: true
                });
            }
            
            // Check if map is already available
            let mapAvailable = false;
            if (this.scene.tilemapSystem && this.scene.tilemapSystem.map && this.scene.tilemapSystem.isMapReady) {
                this.getAirPocketsFromMap();
                mapAvailable = true;
            }
            
            // Register for the tilemapCreated event regardless
            // This ensures we catch maps loaded after our initialization
            this.scene.events.once('tilemapCreated', (map, mapData) => {
                // Small delay to ensure map processing is complete
                this.scene.time.delayedCall(100, () => {
                    // Try to get air pockets from the map first
                    this.getAirPocketsFromMap();
                    
                    // If no air pockets found and we have access to the raw map data,
                    // try the direct JSON approach as a fallback
                    if (this.airPockets.length === 0 && mapData) {
                        this.createAirPocketsFromLevelData();
                    }
                });
            });
            
            // Also listen for the specific object layer event
            this.scene.events.once('mapObjectsReady', (objectLayers) => {
                // Check if we have an AirPockets layer in the object layers
                if (objectLayers && objectLayers.airpockets) {
                    this.processAirPockets(objectLayers.airpockets.objects);
                }
            });
            
            // If no map is available yet, also try the direct JSON approach
            if (!mapAvailable) {
                this.createAirPocketsFromLevelData();
            }
            
            // Create particle emitters
            this.createParticleEmitters();
            
            // Set up collisions with obstacles
            this.setupObstacleCollisions();
            
            // Try to set up player overlap, but don't fail if player isn't ready
            if (this.player && this.player.sprite) {
                this.setupPlayerOverlap(this.player);
            } else {
                this.pendingOverlapSetup = true;
            }
            
            // Re-clear type markers after map is loaded to ensure none remain
            this.clearTypeMarkers();
            
            // Reset validity check timer
            this.lastValidationTime = this.scene.time.now;
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
     * Get air pockets from the map
     * @returns {Array} Array of air pocket objects
     */
    getAirPocketsFromMap() {
        try {
            // Ensure tilemap system is available
            if (!this.scene.tilemapSystem) {
                console.error('[AIR] TilemapSystem not available for air pocket extraction');
                return [];
            }
            
            if (!this.scene.tilemapSystem.map) {
                console.error('[AIR] No map available in TilemapSystem');
                return [];
            }
            
            console.log('[AIR] Searching for air pockets in map...');
            
            // Try multiple approaches to find air pockets
            let foundObjects = null;
            
            // Method 1: Check tilemapSystem.objectLayers
            if (this.scene.tilemapSystem.objectLayers) {
                // Case-insensitive search for the layer
                const layerKey = Object.keys(this.scene.tilemapSystem.objectLayers)
                    .find(key => key.toLowerCase().includes('airpocket'));
                
                if (layerKey) {
                    const layer = this.scene.tilemapSystem.objectLayers[layerKey];
                    if (layer && layer.objects && layer.objects.length > 0) {
                        console.log(`[AIR] Found ${layer.objects.length} air pockets in objectLayers.${layerKey}`);
                        foundObjects = layer.objects;
                    }
                }
            }
            
            // Method 2: Check map.objects array
            if (!foundObjects && this.scene.tilemapSystem.map.objects) {
                const layer = this.scene.tilemapSystem.map.objects.find(layer => 
                    layer.name && layer.name.toLowerCase().includes('airpocket')
                );
                
                if (layer && layer.objects && layer.objects.length > 0) {
                    console.log(`[AIR] Found ${layer.objects.length} air pockets in map.objects layer "${layer.name}"`);
                    foundObjects = layer.objects;
                }
            }
            
            // Method 3: Check raw map data
            if (!foundObjects && this.scene.tilemapSystem.mapData) {
                const layer = this.scene.tilemapSystem.mapData.layers.find(layer => 
                    layer.name && layer.name.toLowerCase().includes('airpocket')
                );
                
                if (layer && layer.objects && layer.objects.length > 0) {
                    console.log(`[AIR] Found ${layer.objects.length} air pockets in mapData layer "${layer.name}"`);
                    foundObjects = layer.objects;
                }
            }
            
            // Process found objects if any
            if (foundObjects && foundObjects.length > 0) {
                return this.processDirectAirPocketObjects(foundObjects);
            }
            
            console.warn('[AIR] No air pockets found in map');
            return [];
        } catch (error) {
            console.error('[AIR] Error getting air pockets from map:', error);
            return [];
        }
    }

    /**
     * Process air pocket objects from map data directly
     * @param {Array} objects - Air pocket objects from map
     * @returns {Array} - Array of created air pockets
     */
    processDirectAirPocketObjects(objects) {
        console.log(`[AIR] Processing ${objects.length} air pocket objects`);
        
        let count = 0;
        const pocketPositions = new Set(); 
        const processedIds = new Set();
        
        objects.forEach(obj => {
            try {
                // Skip if we've already processed this object ID
                if (obj.id && processedIds.has(obj.id)) {
                    return;
                }
                
                // Skip objects with 'Type' in the name (enemy spawn points)
                if (obj.name && obj.name.includes('Type')) {
                    return;
                }
                
                // Must have valid position
                if (obj.x === undefined || obj.y === undefined) {
                    return;
                }
                
                // Track position to avoid duplicates
                const posKey = `${Math.round(obj.x)},${Math.round(obj.y)}`;
                if (pocketPositions.has(posKey)) {
                    console.warn(`[AIR] Skipping duplicate air pocket at ${posKey}`);
                    return;
                }
                
                // Extract properties with proper timer handling
                let variation = 1;
                let oxygen = 50;
                let timer = 30; // Default 30 seconds
                
                if (obj.properties && Array.isArray(obj.properties)) {
                    obj.properties.forEach(prop => {
                        const name = prop.name.toLowerCase();
                        if (name === 'variation') {
                            variation = parseInt(prop.value, 10) || 1;
                        } else if (name === 'oxygen') {
                            oxygen = parseInt(prop.value, 10) || 50;
                        } else if (name === 'timer') {
                            timer = parseInt(prop.value, 10) || 30;
                        }
                    });
                } else if (obj.properties && typeof obj.properties === 'object') {
                    variation = parseInt(obj.properties.variation, 10) || 1;
                    oxygen = parseInt(obj.properties.oxygen, 10) || 50;
                    timer = parseInt(obj.properties.timer, 10) || 30;
                }
                
                console.log(`[AIR] Creating pocket at (${obj.x}, ${obj.y}) with: variation=${variation}, oxygen=${oxygen}, timer=${timer}s`);
                
                // Create the air pocket
                const pocket = this.createAirPocket(obj.x, obj.y, {
                    type: variation,
                    oxygenAmount: oxygen,
                    respawnTime: timer * 1000, // Convert to milliseconds
                    originalObj: obj
                });
                
                if (pocket) {
                    count++;
                    pocketPositions.add(posKey);
                    if (obj.id) {
                        processedIds.add(obj.id);
                    }
                }
            } catch (error) {
                console.error('[AIR] Error processing air pocket object:', error);
            }
        });
        
        console.log(`[AIR] Created ${count} air pockets from map objects`);
        return this.airPockets;
    }

    /**
     * Extract properties from an object, handling various formats
     * @param {Object} obj - The object to extract properties from
     * @returns {Object} - The extracted properties
     */
    extractProperties(obj) {
        const props = {
            variation: 1,
            oxygen: 50,
            respawn: 30
        };
        
        // Handle properties array (Tiled format)
        if (obj.properties && Array.isArray(obj.properties)) {
            obj.properties.forEach(prop => {
                // IMPORTANT: variation is just the sprite type (1, 2, or 3)
                // NOT the number of air pockets to create
                if (prop.name === 'variation' || prop.name === 'type') {
                    // Make sure we interpret this as the sprite variation type
                    const variation = parseInt(prop.value, 10) || 1;
                    props.variation = variation;
                } else if (prop.name === 'oxygen') {
                    props.oxygen = parseInt(prop.value, 10) || 50;
                } else if (prop.name === 'respawn') {
                    props.respawn = parseInt(prop.value, 10) || 30;
                }
            });
        } 
        // Handle direct properties object
        else if (obj.properties && typeof obj.properties === 'object') {
            if (obj.properties.variation !== undefined) {
                props.variation = parseInt(obj.properties.variation, 10) || 1;
            }
            if (obj.properties.type !== undefined) {
                props.variation = parseInt(obj.properties.type, 10) || 1;
            }
            if (obj.properties.oxygen !== undefined) {
                props.oxygen = parseInt(obj.properties.oxygen, 10) || 50;
            }
            if (obj.properties.respawn !== undefined) {
                props.respawn = parseInt(obj.properties.respawn, 10) || 30;
            }
        }
        
        // Validate variation is between 1-3 (we only have 3 air pocket types)
        props.variation = Math.max(1, Math.min(3, props.variation));
        
        return props;
    }

    /**
     * Create an air pocket from a map object
     * @param {Object} obj - The map object
     * @returns {Object} The created air pocket
     */
    createAirPocketFromObject(obj) {
        try {
            // Skip if already processed
            if (this.processedObjectIds.includes(obj.id)) {
                console.log(`Air pocket at (${obj.x}, ${obj.y}) already processed`);
                return null;
            }
            
            // Skip any object containing 'Type' in name as these are enemy spawn points
            if (obj.name && obj.name.includes('Type')) {
                console.log(`Skipping object with Type in name: ${obj.name}`);
                return null;
            }
            
            // Skip if not named 'air_pocket'
            if (obj.name !== 'air_pocket') {
                console.log(`Skipping object not named 'air_pocket': ${obj.name}`);
                return null;
            }
            
            console.log(`Creating air pocket from object at (${obj.x}, ${obj.y})`);
            
            // Extract properties from the object
            let variation = 1;
            let oxygenAmount = 20;
            let respawnTime = 30; // Default respawn in seconds
            let timer = null; // Custom timer property in seconds
            
            // Handle Tiled properties (array of {name, value} objects)
            if (obj.properties && Array.isArray(obj.properties)) {
                // Extract values from properties array
                obj.properties.forEach(prop => {
                    if (prop.name === 'variation') {
                        variation = parseInt(prop.value, 10) || 1;
                    } else if (prop.name === 'oxygen') {
                        oxygenAmount = parseInt(prop.value, 10) || 20;
                    } else if (prop.name === 'respawn') {
                        respawnTime = parseInt(prop.value, 10) || 30;
                    } else if (prop.name === 'timer') {
                        // Check for the timer property (in seconds)
                        timer = parseInt(prop.value, 10);
                    }
                });
            } 
            // Handle direct object properties
            else if (obj.properties && typeof obj.properties === 'object') {
                variation = obj.properties.variation || 1;
                oxygenAmount = obj.properties.oxygen || 20;
                respawnTime = obj.properties.respawn || 30;
                timer = obj.properties.timer; // Get timer property in seconds
            }
            
            // Use timer if specified, otherwise fall back to respawnTime
            // Both values are converted from seconds to milliseconds
            const finalRespawnTime = timer !== null ? timer * 1000 : respawnTime * 1000;
            
            console.log(`Creating air pocket with properties: variation=${variation}, oxygen=${oxygenAmount}, respawn=${finalRespawnTime/1000}s`);
            
            // Create the air pocket with original object reference for respawning
            const airPocket = this.createAirPocket(
                obj.x, 
                obj.y, 
                {
                    type: variation,
                    oxygenAmount: oxygenAmount,
                    respawnTime: finalRespawnTime,
                    originalObj: obj  // Store original object
                }
            );
            
            // Mark as processed
            if (obj.id) {
                this.processedObjectIds.push(obj.id);
            }
            
            return airPocket;
        } catch (error) {
            console.error('Error creating air pocket from object:', error);
            return null;
        }
    }

    /**
     * Create a new air pocket
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Object} options - Configuration options
     * @returns {Object} The created air pocket
     */
    createAirPocket(x, y, options = {}) {
        try {
            // Generate a unique ID for this air pocket
            const pocketId = `air_pocket_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            
            // Store original data for respawning
            this.originalDataMap.set(pocketId, {
                x,
                y,
                options: { ...options }
            });
            
            console.log(`[AIR] Creating air pocket ${pocketId} at (${x}, ${y})`);
            
            // Create the air pocket instance with all options
            const airPocket = new AirPocket(
                this.scene, 
                x, 
                y, 
                options.type || 1,
                {
                    oxygenAmount: options.oxygenAmount || 20,
                    respawnTime: options.respawnTime || 30000
                }
            );
            
            // Create the sprite and physics body
            airPocket.create();
            
            // Set the ID on both the instance and its sprite
            airPocket.airPocketId = pocketId;
            if (airPocket.sprite) {
                airPocket.sprite.airPocketId = pocketId;
            }
            
            // Add to tracking arrays
            this.airPockets.push(airPocket);
            if (this.group && airPocket.sprite) {
                this.group.add(airPocket.sprite);
            }
            
            console.log(`[AIR] Successfully created air pocket ${pocketId}`);
            return airPocket;
        } catch (error) {
            console.error('Error creating air pocket:', error);
            return null;
        }
    }

    /**
     * Finalize air pocket creation with common setup
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Phaser.GameObjects.Sprite} sprite - The sprite object
     * @param {Object} options - Configuration options
     * @returns {Object} The completed air pocket object
     */
    finalizeAirPocket(x, y, sprite, options) {
        try {
            // Configure sprite
            sprite.setOrigin(0.5, 0.5);
            sprite.setScale(0.2); // Increased from 0.02 (10x larger)
            sprite.setDepth(25); // Above obstacles, below player
            
            // Add to physics group for collisions
            if (this.group) {
                this.group.add(sprite);
            } else {
                console.warn('Physics group not available for air pocket');
            }
            
            // Add properties to sprite
            const airPocket = {
                x,
                y,
                sprite,
                type: options.type,
                oxygenAmount: options.oxygenAmount,
                respawnTime: options.respawnTime, // NEW: Use the custom respawn time
                lastCollectTime: 0,
                active: true,
                isDestroyed: false,
                hasCollided: false,
                particles: null
            };
            
            // Store reference to air pocket on sprite for collision handler
            sprite.airPocketInstance = airPocket;
            
            // Add visual effects with adjusted scale values
            this.addVisualEffects(airPocket);
            
            // Add to air pockets array
            this.airPockets.push(airPocket);
            
            return airPocket;
        } catch (error) {
            console.error('Error finalizing air pocket:', error);
            return null;
        }
    }

    /**
     * Add visual effects to the air pocket
     * @param {Object} airPocket - The air pocket object
     */
    addVisualEffects(airPocket) {
        if (!airPocket || !airPocket.sprite) return;
        
        try {
            // Add blue glow effect
            const glowFX = airPocket.sprite.preFX.addGlow();
            glowFX.color = 0x00ffff;  // Cyan/blue color
            glowFX.outerStrength = 2;  // Outer glow intensity
            glowFX.innerStrength = 1;  // Inner glow intensity

            // Add a subtle pulsing effect to make the air pocket more noticeable
            this.scene.tweens.add({
                targets: airPocket.sprite,
                scale: { from: 0.2, to: 0.22 },
                alpha: { from: 0.9, to: 1 },
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            // Add a pulsing glow effect
            this.scene.tweens.add({
                targets: glowFX,
                outerStrength: { from: 2, to: 4 },
                duration: 1200,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            // Add a slight rotation for visual interest
            this.scene.tweens.add({
                targets: airPocket.sprite,
                angle: { from: -2, to: 2 },
                duration: 2000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            // Set up physics for buoyancy and collision
            this.setupAirPocketPhysics(airPocket.sprite);
            
            // Add bubble particle effect for all air pockets
            if (this.scene.add.particles) {
                // Create small bubble particles around the air pocket
                const bubbleEmitter = this.scene.add.particles(0, 0, 'bubble', {
                    follow: airPocket.sprite,  // Follow the sprite instead of static position
                    followOffset: { x: 0, y: 0 },
                    lifespan: 2500,
                    gravityY: -100,
                    speed: { min: 80, max: 120 },
                    scale: { start: 0.2, end: 0.1 },
                    alpha: { start: 0.6, end: 0 },
                    angle: { min: 265, max: 275 },
                    frequency: 120,
                    emitZone: { 
                        type: 'random',
                        source: new Phaser.Geom.Circle(0, 0, 25)
                    },
                    quantity: 1
                }).setDepth(2);

                // Store the emitter reference on the air pocket
                airPocket.particles = bubbleEmitter;
            }
        } catch (error) {
            console.error('Error adding visual effects to air pocket:', error);
        }
    }

    /**
     * Set up physics properties for air pockets to make them collide with obstacles
     * @param {Phaser.GameObjects.Sprite} sprite - The air pocket sprite
     */
    setupAirPocketPhysics(sprite) {
        if (!sprite || !sprite.body) {
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
            
            // Clean up any existing particles before collection
            if (airPocketInstance.particles) {
                airPocketInstance.particles.destroy();
                airPocketInstance.particles = null;
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
                    playerEntity.emit('collectAirPocket', airPocketSprite);
                } else if (this.scene && this.scene.events) {
                    this.scene.events.emit('playerOxygenChanged', playerEntity.oxygen, playerEntity.maxOxygen);
                    this.scene.events.emit('collectAirPocket', airPocketSprite);
                }
            }
            
            if (oxygenRefilled) {
                // Create visual collect effect at the air pocket's position
                this.createCollectEffect(pocketX, pocketY);
                
                // Create a text popup showing oxygen increase
                this.createOxygenPopup(pocketX, pocketY, `+${oxygenAmount} O₂`);
                
                // Remove the air pocket (this will start the respawn timer)
                this.removeAirPocket(airPocketSprite);
            }
        } catch (error) {
            console.error('Error in air pocket overlap handler:', error);
        }
    }
    
    /**
     * Remove an air pocket and start its respawn timer
     * @param {Object} airPocket - The air pocket to remove
     */
    removeAirPocket(airPocket) {
        try {
            const instance = airPocket.airPocketInstance || airPocket;
            
            if (instance) {
                // Store original spawn position
                const originalX = instance.x;
                const originalY = instance.y;
                
                // Get the air pocket ID from the sprite
                const pocketId = instance.sprite?.airPocketId;
                
                if (!pocketId) {
                    console.error('No airPocketId found on instance:', instance);
                    return;
                }
                
                console.log(`[AIR] Removing air pocket ${pocketId} at (${originalX}, ${originalY})`);
                
                // Deactivate the air pocket
                instance.active = false;
                instance.isDestroyed = true;
                
                if (instance.sprite) {
                    instance.sprite.setVisible(false);
                    if (instance.sprite.body) {
                        instance.sprite.body.enable = false;
                    }
                }

                // Clean up particles
                if (instance.particles) {
                    instance.particles.destroy();
                    instance.particles = null;
                }
                
                // Start respawn timer using the custom time or default
                if (this.scene && this.scene.time) {
                    // Get the respawn time from original data or use default
                    const originalData = this.originalDataMap.get(pocketId);
                    const respawnTime = (originalData?.options?.respawnTime) || 30000; // Default 30 seconds
                    
                    console.log(`[AIR] Starting ${respawnTime/1000}s respawn timer for pocket ${pocketId}`);
                    
                    // Cancel any existing timer for this pocket
                    if (this.respawnTimers.has(pocketId)) {
                        this.respawnTimers.get(pocketId).remove();
                    }
                    
                    // Create a new timer
                    const timerEvent = this.scene.time.delayedCall(respawnTime, () => {
                        console.log(`[AIR] Respawn timer completed for pocket ${pocketId}`);
                        
                        // Only respawn if system is still active
                        if (!this.scene || !this.scene.sys.isActive()) {
                            console.log('[AIR] Scene no longer active, skipping respawn');
                            return;
                        }
                        
                        // Pass original data to respawn function
                        this.respawnAirPocket(pocketId, originalX, originalY);
                        
                        // Clean up the timer
                        this.respawnTimers.delete(pocketId);
                    });
                    
                    // Store the timer reference
                    this.respawnTimers.set(pocketId, timerEvent);
                }
            }
        } catch (error) {
            console.error('Error removing air pocket:', error);
        }
    }

    /**
     * Respawn an air pocket
     * @param {string} pocketId - The ID of the air pocket to respawn
     * @param {number} x - X position to respawn at
     * @param {number} y - Y position to respawn at
     */
    respawnAirPocket(pocketId, x, y) {
        try {
            // Get the original data
            const originalData = this.originalDataMap.get(pocketId);
            
            if (originalData) {
                console.log(`[AIR] Respawning air pocket ${pocketId} at (${originalData.x}, ${originalData.y})`);
                
                // Create a new air pocket with the original data
                const newPocket = this.createAirPocket(
                    originalData.x,
                    originalData.y,
                    originalData.options
                );
                
                if (newPocket) {
                    console.log(`[AIR] Successfully respawned air pocket ${pocketId}`);
                } else {
                    console.error(`[AIR] Failed to respawn air pocket ${pocketId}`);
                }
                
                return;
            }
            
            // Fallback if no original data: create with basic settings at the provided position
            console.log(`[AIR] No original data found for ${pocketId}, respawning at (${x}, ${y}) with defaults`);
            
            const airPocket = this.createAirPocket(x, y, {
                type: 1,
                oxygenAmount: 20,
                respawnTime: 30000
            });
            
            if (airPocket) {
                console.log(`[AIR] Successfully created fallback air pocket at (${x}, ${y})`);
            } else {
                console.error(`[AIR] Failed to create fallback air pocket at (${x}, ${y})`);
            }
        } catch (error) {
            console.error('Error respawning air pocket:', error);
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
     * Update all air pockets
     * @param {number} time - Current game time
     */
    update(time) {
        // Skip if no air pockets
        if (!this.airPockets || this.airPockets.length === 0 || !time) {
            return;
        }
        
        // Run validation check periodically
        if (!this.lastValidationTime || time - this.lastValidationTime > 5000) {
            this.validateAirPockets();
            this.lastValidationTime = time;
        }
        
        // Setup player overlap if needed
        if (this.pendingOverlapSetup && this.player?.sprite) {
            this.setupPlayerOverlap(this.player);
        }
        
        // Update each air pocket
        this.airPockets.forEach(airPocket => {
            if (airPocket && airPocket.active) {
                // Call update method if it exists
                if (typeof airPocket.update === 'function') {
                    airPocket.update(time);
                }
                
                // Otherwise, apply standard movement if needed
                else if (airPocket.sprite && airPocket.sprite.body && !airPocket.hasCollided) {
                    // Apply slight wobble effect
                    if (Math.random() < 0.1) {
                        airPocket.sprite.body.velocity.x += Math.random() * 10 - 5;
                    }
                    
                    // Ensure upward movement
                    if (airPocket.sprite.body.velocity.y > -20) {
                        airPocket.sprite.body.velocity.y = -50;
                    }
                }
            }
        });
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
        
        console.log('Validating air pocket system...');
        
        // Check if we have any air pockets
        if (!this.airPockets || this.airPockets.length === 0) {
            console.warn('No air pockets found during validation - NONE WILL BE CREATED');
            console.warn('Air pockets must be defined in the map in the "AirPockets" layer');
            return;
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
                console.log(`Reactivating air pocket at (${airPocket.x}, ${airPocket.y}) that was incorrectly deactivated`);
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
            console.log(`Fixed ${fixedCount} air pockets with issues`);
        }
        
        console.log(`Air pocket status: ${activeCount} active, ${inactiveCount} inactive`);
    }

    /**
     * Create fallback air pockets in case none were found in the map
     * THIS METHOD IS DISABLED - NO FALLBACKS SHOULD BE CREATED
     */
    createFallbackAirPockets() {
        // CRITICAL: NEVER create fallback air pockets - they should only come from map data
        console.log('Fallback air pocket creation DISABLED - will NOT create any fallbacks');
        return; // Immediately return without creating any air pockets
    }

    /**
     * Clean up the air pocket system
     */
    destroy() {
        try {
            // Stop all timers first
            if (this.validationTimer) {
                this.validationTimer.remove();
                this.validationTimer = null;
            }
            
            // NEW: Cancel all respawn timers
            for (const timerEvent of this.respawnTimers.values()) {
                if (timerEvent) {
                    timerEvent.remove();
                }
            }
            this.respawnTimers.clear();
            this.originalDataMap.clear();
            
            // Clean up colliders
            if (this.colliders && this.colliders.length > 0) {
                this.colliders.forEach(collider => {
                    if (collider && collider.active) {
                        collider.destroy();
                    }
                });
                this.colliders = [];
            }
            
            // Remove event listeners
            this.scene.events.off('tilemapCreated');
            this.scene.events.off('mapObjectsReady');
            
            // Remove the preupdate event listener we added for high-speed overlap detection
            this.scene.events.off('preupdate', this.checkManualOverlap, this);
            
            // Destroy all emitters
            if (this.bubbleEmitters) {
                this.bubbleEmitters.forEach(emitter => {
                    if (emitter && emitter.destroy) {
                        emitter.destroy();
                    }
                });
                this.bubbleEmitters = [];
            }
            
            // Destroy all effects
            if (this.collectEffects) {
                this.collectEffects.forEach(emitter => {
                    if (emitter && emitter.destroy) {
                        emitter.destroy();
                    }
                });
                this.collectEffects = [];
            }
            
            // Destroy all air pockets
            if (this.airPockets) {
                this.airPockets.forEach(airPocket => {
                    if (airPocket && typeof airPocket.destroy === 'function') {
                        airPocket.destroy();
                    }
                });
                this.airPockets = [];
            }
            
            // Destroy the group
            if (this.group) {
                this.group.destroy(true);
                this.group = null;
            }
            
            // Clean up debug graphics
            if (this.debugGraphics) {
                this.debugGraphics.clear();
                this.debugGraphics.destroy();
                this.debugGraphics = null;
            }
            
            this.clearDebugTexts();
            
            // Clear reference to player
            this.player = null;
            
            console.log('AirPocketSystem cleaned up successfully');
        } catch (error) {
            console.error('Error destroying AirPocketSystem:', error);
        }
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
                
                // Add additional manual overlap check for high-speed movement
                this.scene.events.on('preupdate', this.checkManualOverlap, this);
            } else {
                // console.error('Failed to create air pocket overlap detector');
            }
            
            // Double-check that physics bodies are enabled on all air pockets
            this.airPockets.forEach((ap, i) => {
                if (ap.sprite && ap.sprite.body) {
                    // Ensure the body is enabled
                    ap.sprite.body.enable = true;
                    
                    // Make the air pocket's body slightly larger for better collision detection
                    const bodyWidth = ap.sprite.width * 1.5;  // 50% larger
                    const bodyHeight = ap.sprite.height * 1.5; // 50% larger
                    ap.sprite.body.setSize(bodyWidth, bodyHeight);
                    ap.sprite.body.setOffset(
                        (ap.sprite.width - bodyWidth) / 2,
                        (ap.sprite.height - bodyHeight) / 2
                    );
                    
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
     * Manual overlap check to catch high-speed tunneling
     * This runs on each pre-update to catch cases where the player might tunnel through air pockets
     */
    checkManualOverlap() {
        if (!this.player || !this.player.sprite || !this.player.active || !this.airPockets || this.airPockets.length === 0) {
            return;
        }
        
        // Get player position and velocity
        const playerSprite = this.player.sprite;
        const playerX = playerSprite.x;
        const playerY = playerSprite.y;
        const playerVelocity = playerSprite.body ? playerSprite.body.velocity : { x: 0, y: 0 };
        const playerSpeed = Math.sqrt(playerVelocity.x * playerVelocity.x + playerVelocity.y * playerVelocity.y);
        
        // Only perform expensive checks when player is moving at high speed (boosting)
        if (playerSpeed > 300) {
            // Store player's last position if not already tracked
            if (!this._lastPlayerPos) {
                this._lastPlayerPos = { x: playerX, y: playerY };
                return;
            }
            
            // Calculate direction of movement
            const moveX = playerX - this._lastPlayerPos.x;
            const moveY = playerY - this._lastPlayerPos.y;
            const moveDist = Math.sqrt(moveX * moveX + moveY * moveY);
            
            // Only check if there was significant movement
            if (moveDist > 10) {
                // Normalize movement vector
                const dirX = moveX / moveDist;
                const dirY = moveY / moveDist;
                
                // Check each air pocket
                for (let i = 0; i < this.airPockets.length; i++) {
                    const airPocket = this.airPockets[i];
                    if (!airPocket || !airPocket.sprite || !airPocket.active) continue;
                    
                    const airPocketSprite = airPocket.sprite;
                    
                    // Calculate distance to the air pocket
                    const dx = airPocketSprite.x - playerX;
                    const dy = airPocketSprite.y - playerY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // If the air pocket is within a reasonable range
                    if (distance < 200) {
                        // Project the player's movement onto the vector to the air pocket
                        const dotProduct = dx * dirX + dy * dirY;
                        
                        // If the player is moving toward the air pocket
                        if (dotProduct < 0) {
                            // Distance from player's path to the air pocket center
                            const projectX = playerX + dotProduct * dirX;
                            const projectY = playerY + dotProduct * dirY;
                            const perpDx = airPocketSprite.x - projectX;
                            const perpDy = airPocketSprite.y - projectY;
                            const perpDistSq = perpDx * perpDx + perpDy * perpDy;
                            
                            // Check if the player's path passes close to the air pocket
                            const collisionRadius = (airPocketSprite.width / 2 + playerSprite.width / 2) * 1.2;
                            if (perpDistSq < collisionRadius * collisionRadius) {
                                // Check if this air pocket was hit recently to avoid double processing
                                const now = this.scene.time.now;
                                if (!airPocket.lastHitTime || (now - airPocket.lastHitTime > 500)) {
                                    console.log("Manual overlap detected with air pocket during high-speed movement");
                                    airPocket.lastHitTime = now;
                                    this.handlePlayerAirPocketOverlap(this.player, airPocketSprite);
                                }
                            }
                        }
                    }
                }
            }
            
            // Update player's last position
            this._lastPlayerPos.x = playerX;
            this._lastPlayerPos.y = playerY;
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
        // CRITICAL: IMMEDIATELY return - debug visualization is disabled
        return;
        
        // Even if somehow code execution continues, the below checks should catch Type objects
        
        // CRITICAL: SKIP ANY TYPE OBJECTS - these are enemy spawn points
        // Never create debug markers for Type objects under any circumstances
        if (variation && typeof variation === 'string' && variation.includes('Type')) {
            console.log(`Skipping debug marker for Type variation at (${x}, ${y})`);
            return;
        }
        
        // Also check scene objects for Type in name
        if (this.scene.gameObjects && this.scene.gameObjects.length > 0) {
            // Check if there's any object at this position with 'Type' in the name
            const typeObject = this.scene.gameObjects.find(obj => 
                obj.x === x && obj.y === y && 
                obj.name && obj.name.includes('Type')
            );
            
            if (typeObject) {
                console.log(`Skipping debug marker for Type object at (${x}, ${y})`);
                return;
            }
        }
        
        // Skip if debug visuals are disabled to avoid creating useless graphics
        if (!this.debugVisualsEnabled) {
            return;
        }
        
        // Check for enemy spawn locations
        if (this.scene.enemySpawnLocations && this.scene.enemySpawnLocations.length > 0) {
            const isEnemyLocation = this.scene.enemySpawnLocations.some(loc => 
                Math.abs(loc.x - x) < 20 && Math.abs(loc.y - y) < 20
            );
            if (isEnemyLocation) {
                console.log(`Skipping debug marker for enemy spawn location at (${x}, ${y})`);
                return;
            }
        }
        
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
            `\u{1F4A1} O₂: ${oxygen || 'default'}`, // Light bulb emoji
            `\u{1F3C1} Type: ${variation}`, // Flag emoji
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

    /**
     * Clear any markers for objects with "Type" in their name 
     */
    clearTypeMarkers() {
        // Skip if no debug texts
        if (!this.debugTexts || this.debugTexts.length === 0) {
            return;
        }
        
        console.log('Clearing any Type markers that might be displayed as air pockets');
        
        // Find and destroy any debug texts containing "Type" in their text
        let removed = 0;
        
        this.debugTexts = this.debugTexts.filter(text => {
            if (text && text.text && text.text.includes('Type')) {
                text.destroy();
                removed++;
                return false;
            }
            return true;
        });
        
        if (removed > 0) {
            console.log(`Removed ${removed} Type markers from air pocket system`);
        }
    }

    /**
     * Process air pockets from the map
     * @param {Array} objects - Air pocket objects from the map
     */
    processAirPockets(objects) {
        // Skip if no objects provided
        if (!objects || !Array.isArray(objects) || objects.length === 0) {
            console.log('No air pocket objects to process');
            return;
        }
        
        // Filter out non-air pocket objects
        const validAirPocketObjects = objects.filter(obj => {
            // Skip objects with 'Type' in the name (those are enemy spawns)
            if (obj.name && obj.name.includes('Type')) {
                return false;
            }
            
            // Skip objects already processed
            if (obj.id && this.processedObjectIds.includes(obj.id)) {
                return false;
            }
            
            // Skip objects without positions
            if (obj.x === undefined || obj.y === undefined) {
                return false;
            }
            
            return true;
        });
        
        console.log(`Processing ${validAirPocketObjects.length} valid air pocket objects`);
        
        // Process only valid air pocket objects
        validAirPocketObjects.forEach(obj => {
            try {
                // Convert properties array to an object
                const props = {};
                if (obj.properties && Array.isArray(obj.properties)) {
                    obj.properties.forEach(prop => {
                        props[prop.name] = prop.value;
                    });
                } else if (obj.properties && typeof obj.properties === 'object') {
                    Object.assign(props, obj.properties);
                }
                
                // Use default values if properties are missing
                const oxygen = props.oxygen || 50;
                const variation = props.variation || 1;
                
                // Check for the timer property in seconds
                let respawnMs;
                if (props.timer !== undefined) {
                    // Use timer property directly (in seconds) and convert to milliseconds
                    respawnMs = props.timer * 1000;
                } else {
                    // Fall back to respawn property (also in seconds) and convert to milliseconds
                    respawnMs = props.respawn ? props.respawn * 1000 : 30000;
                }
                
                // Create the air pocket
                this.createAirPocket(obj.x, obj.y, {
                    type: variation,
                    oxygenAmount: oxygen,
                    respawnTime: respawnMs,
                    originalObj: obj  // Store original object
                });
                
                // Store the ID to prevent duplicate processing
                if (obj.id) {
                    this.processedObjectIds.push(obj.id);
                }
            } catch (error) {
                console.error('Error processing air pocket object:', error);
            }
        });
    }

    /**
     * Directly access and process air pockets from the Tiled map JSON
     * This should be much simpler as all the needed data is already in the map
     */
    createAirPocketsFromLevelData() {
        try {
            // First try to get the map instance from tilemapSystem
            if (this.scene.tilemapSystem && this.scene.tilemapSystem.map) {
                const map = this.scene.tilemapSystem.map;
                
                // Method 1: Try to get object layers through Phaser's TilemapLayer API
                const airPocketLayer = map.getObjectLayer('AirPockets') || 
                                     map.getObjectLayer('airpockets');
                                     
                if (airPocketLayer && Array.isArray(airPocketLayer.objects)) {
                    console.log(`Found AirPockets layer with ${airPocketLayer.objects.length} objects`);
                    return this.processDirectAirPocketObjects(airPocketLayer.objects);
                }
                
                // Method 2: Check if map has objects array
                if (Array.isArray(map.objects)) {
                    const airPocketLayerObj = map.objects.find(layer => 
                        layer.name === 'AirPockets' || 
                        layer.name.toLowerCase() === 'airpockets'
                    );
                    
                    if (airPocketLayerObj && Array.isArray(airPocketLayerObj.objects)) {
                        console.log(`Found AirPockets layer with ${airPocketLayerObj.objects.length} objects`);
                        return this.processDirectAirPocketObjects(airPocketLayerObj.objects);
                    }
                }
                
                // Method 3: If map has original data available
                if (map.data && map.data.layers) {
                    const airPocketDataLayer = map.data.layers.find(layer => 
                        layer.name === 'AirPockets' || 
                        layer.name.toLowerCase() === 'airpockets'
                    );
                    
                    if (airPocketDataLayer && Array.isArray(airPocketDataLayer.objects)) {
                        console.log(`Found AirPockets in map data with ${airPocketDataLayer.objects.length} objects`);
                        return this.processDirectAirPocketObjects(airPocketDataLayer.objects);
                    }
                }
                
                // If we got this far, we have a map but couldn't find the AirPockets layer
                console.warn('Map exists but AirPockets layer not found');
            }
            
            // If we couldn't get air pockets from an existing map,
            // log the issue without trying complex fallbacks
            console.warn('No air pockets found in map. Make sure you have an "AirPockets" object layer in Tiled');
            return false;
            
        } catch (error) {
            console.error('Error getting air pockets from map:', error);
            return false;
        }
    }

    /**
     * Clear all air pockets from the system
     */
    clearAllAirPockets() {
        if (Array.isArray(this.airPockets) && this.airPockets.length > 0) {
            this.airPockets.forEach(airPocket => {
                if (airPocket && airPocket.destroy) {
                    airPocket.destroy();
                }
            });
            this.airPockets = [];
        } else {
            this.airPockets = [];
        }
        
        // Also clear the physics group if it exists
        if (this.group) {
            this.group.clear(true, true);
        }
    }

    /**
     * Toggle visualization of air pocket physics bodies
     * @param {boolean} show - Whether to show physics bodies
     */
    showPhysicsBodies(show = true) {
        try {
            // Skip if no air pockets
            if (!this.airPockets || this.airPockets.length === 0) {
                return;
            }
            
            // Clean up any existing debug graphics
            if (this._debugPhysics) {
                this._debugPhysics.clear();
                this._debugPhysics.destroy();
                this._debugPhysics = null;
            }
            
            // Exit early if we're turning visualization off
            if (!show) {
                return;
            }
            
            // Create a new graphics object for physics debugging
            this._debugPhysics = this.scene.add.graphics();
            this._debugPhysics.setDepth(1000); // Make sure it's on top
            
            // Draw each air pocket's physics body
            this.airPockets.forEach(airPocket => {
                if (!airPocket || !airPocket.sprite || !airPocket.sprite.body) {
                    return;
                }
                
                const sprite = airPocket.sprite;
                const body = sprite.body;
                
                // Draw the physics body outline
                this._debugPhysics.lineStyle(2, 0xff00ff, 0.7);
                
                // If it's a circle
                if (body.isCircle) {
                    const radius = body.radius;
                    const centerX = sprite.x;
                    const centerY = sprite.y;
                    this._debugPhysics.strokeCircle(centerX, centerY, radius);
                } 
                // If it's a rectangle
                else {
                    const x = sprite.x - (sprite.displayWidth * sprite.originX) + body.offset.x;
                    const y = sprite.y - (sprite.displayHeight * sprite.originY) + body.offset.y;
                    this._debugPhysics.strokeRect(x, y, body.width, body.height);
                }
                
                // Add a path line showing movement vector
                if (body.velocity.x !== 0 || body.velocity.y !== 0) {
                    const speed = Math.sqrt(body.velocity.x * body.velocity.x + body.velocity.y * body.velocity.y);
                    const dirX = body.velocity.x / speed;
                    const dirY = body.velocity.y / speed;
                    
                    this._debugPhysics.lineStyle(1, 0x00ffff, 0.5);
                    this._debugPhysics.beginPath();
                    this._debugPhysics.moveTo(sprite.x, sprite.y);
                    this._debugPhysics.lineTo(
                        sprite.x + dirX * 50,
                        sprite.y + dirY * 50
                    );
                    this._debugPhysics.strokePath();
                }
            });
            
            // Update physics visualization once a second
            this.scene.time.addEvent({
                delay: 1000,
                callback: () => this.updatePhysicsVisualization(),
                callbackScope: this,
                loop: true
            });
            
            console.log(`Air pocket physics visualization ${show ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error toggling physics visualization:', error);
        }
    }
    
    /**
     * Update the physics visualization
     */
    updatePhysicsVisualization() {
        if (!this._debugPhysics || !this.airPockets) {
            return;
        }
        
        // Redraw with updated positions
        this.showPhysicsBodies(true);
    }
} // End of AirPocketSystem class