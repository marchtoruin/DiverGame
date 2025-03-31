/**
 * JellyfishSystem - Manages jellyfish entities and their battery charge pickups
 */
export default class JellyfishSystem {
    /**
     * Create a new jellyfish system
     * @param {Phaser.Scene} scene - The game scene
     */
    constructor(scene) {
        this.scene = scene;
        this.player = scene.player;
        this.jellyfish = [];
        this.chargePickups = [];
        this.active = true;
        this.respawnTimers = new Map(); // Track respawn timers
        this.originalPositions = new Map(); // Store original positions and properties
        this.lastDamageTime = 0; // Track the last time player was damaged
        this.damageCooldown = 1000; // 1 second cooldown between damage
        
        // NEW: Track processed object IDs and positions to prevent duplicates
        this.processedObjectIds = new Set();
        this.jellyfishPositions = new Set();
        
        // Create physics groups
        this.jellyfishGroup = scene.physics.add.group({
            allowGravity: false
        });
        
        this.chargePickupGroup = scene.physics.add.group({
            allowGravity: false
        });
        
        // Reference to overlap handlers (for cleanup)
        this.playerPickupOverlap = null;
        this.bulletJellyfishOverlap = null;
        this.playerJellyfishOverlap = null; // NEW: Player-jellyfish collision
        
        // Initialize with a short delay to ensure map is fully processed
        if (scene.game.isBooted) {
            // Use delayed call to ensure map is loaded
            scene.time.delayedCall(200, () => this.init());
        } else {
            scene.game.events.once('ready', () => {
                scene.time.delayedCall(200, () => this.init());
            });
        }
        
        // Also listen for map ready events
        this.scene.events.once('tilemapCreated', () => {
            // When map is created, wait a bit to ensure objects are processed
            this.scene.time.delayedCall(300, () => {
                if (this.jellyfish.length === 0) {
                    console.log('JellyfishSystem - Map created event - spawning jellyfish');
                    this.spawnFromMap();
                }
            });
        });
        
        // Listen for the specific mapObjectsProcessed event
        this.scene.events.once('mapObjectsProcessed', () => {
            // When objects are fully processed, try to spawn
            this.scene.time.delayedCall(100, () => {
                if (this.jellyfish.length === 0) {
                    console.log('JellyfishSystem - Map objects processed event - spawning jellyfish');
                    this.spawnFromMap();
                }
            });
        });
    }
    
    /**
     * Initialize the system
     */
    init() {
        console.log('JellyfishSystem - Initializing system');
        
        try {
            // Check if scene is ready for initialization
            if (!this.scene || !this.scene.game) {
                console.error('JellyfishSystem - Cannot initialize: scene is not ready');
                
                // Attempt to initialize later
                if (this.scene) {
                    this.scene.time.delayedCall(500, () => this.init());
                }
                return;
            }
            
            // Log player and bullet depths for debugging
            if (this.scene.player?.sprite) {
                console.log(`[DEBUG] Player sprite depth: ${this.scene.player.sprite.depth}`);
            }
            
            if (this.scene.bulletSystem?.bullets) {
                const bulletSample = this.scene.bulletSystem.bullets.getFirstAlive();
                if (bulletSample) {
                    console.log(`[DEBUG] Bullet sprite depth: ${bulletSample.depth}`);
                } else {
                    console.log('[DEBUG] No active bullets to check depth');
                }
            }
            
            // Preload required textures if missing
            this.ensureTexturesLoaded();
            
            // Try to spawn jellyfish from the map if needed
            if (this.jellyfish.length === 0) {
                console.log('JellyfishSystem - No jellyfish yet, spawning from map');
                this.spawnFromMap();
            }
            
            // Make sure player reference is set correctly
            if (!this.player && this.scene.player) {
                this.player = this.scene.player;
                console.log(`[DEBUG] Player reference updated, sprite exists: ${!!this.player.sprite}`);
                if (this.player.sprite) {
                    console.log(`[DEBUG] Player depth: ${this.player.sprite.depth}`);
                }
            }
            
            // Setup collisions with player and bullets
            console.log('JellyfishSystem - Setting up collisions during init');
            this.setupCollisions();
            
            // Debug: Create a test jellyfish if none exist yet
            if (this.jellyfish.length === 0 && this.scene.textures.exists('jelly_fish')) {
                console.log('JellyfishSystem - Creating debug jellyfish for testing');
                // Create a test jellyfish in the visible area for debugging
                const testJellyfish = this.createJellyfish(400, 300, 25);
                if (testJellyfish) {
                    console.log('JellyfishSystem - Debug jellyfish created successfully');
                    console.log(`[DEBUG] Debug jellyfish depth: ${testJellyfish.depth}`);
                }
            }
            
            // Setup collision detection verification timer
            // Check every 2 seconds that collision detection is working
            this.collisionCheckTimer = this.scene.time.addEvent({
                delay: 2000,
                callback: this.ensureCollisionsExist,
                callbackScope: this,
                loop: true
            });
            
            // Log system state after initialization
            this.logSystemState();
            
            console.log('JellyfishSystem - Initialization complete');
        } catch (error) {
            console.error('JellyfishSystem - Error during initialization:', error);
            
            // Attempt recovery initialization after a delay
            this.scene.time.delayedCall(1000, () => {
                console.log('JellyfishSystem - Attempting recovery initialization');
                // Just try to setup collisions as a minimum
                this.setupCollisions();
            });
        }
    }
    
    /**
     * Ensure jellyfish textures are loaded
     */
    ensureTexturesLoaded() {
        const requiredTextures = ['jelly_fish', 'jelly_charge'];
        const missingTextures = requiredTextures.filter(
            texture => !this.scene.textures.exists(texture)
        );
        
        if (missingTextures.length > 0) {
            console.warn(`JellyfishSystem - Missing required textures: ${missingTextures.join(', ')}`);
            
            // Dynamically load the missing textures
            if (missingTextures.includes('jelly_fish')) {
                console.log('JellyfishSystem - Attempting to dynamically load jelly_fish texture');
                this.scene.load.image('jelly_fish', 'assets/jelly_fish.png');
            }
            
            if (missingTextures.includes('jelly_charge')) {
                console.log('JellyfishSystem - Attempting to dynamically load jelly_charge texture');
                this.scene.load.image('jelly_charge', 'assets/jelly_charge.png');
            }
            
            // Start the loader if we added any images
            if (this.scene.load.list.size > 0) {
                this.scene.load.start();
                console.log('JellyfishSystem - Starting dynamic texture load');
            }
        } else {
            console.log('JellyfishSystem - All required textures are loaded');
        }
    }
    
    /**
     * Spawn jellyfish from Tiled map objects
     */
    spawnFromMap() {
        try {
            console.log('[DEBUG] JellyfishSystem - Starting jellyfish spawning from map');
            
            // Debug: Check if scene.map exists
            console.log('JellyfishSystem - Map access check:', 
                this.scene.map ? 'scene.map exists' : 'scene.map is undefined');
            
            // Debug: Check tilemapSystem
            console.log('JellyfishSystem - TilemapSystem check:',
                this.scene.tilemapSystem ? 'tilemapSystem exists' : 'tilemapSystem is undefined',
                this.scene.tilemapSystem?.map ? 'and has map' : 'but has no map');
            
            // Try scene.map first, then tilemapSystem.map if needed
            let map = this.scene.map || (this.scene.tilemapSystem?.map);
            
            if (!map) {
                console.error('JellyfishSystem - No map available in scene or tilemapSystem');
                return;
            }
            
            // Debug: Verify texture exists
            const textureExists = this.scene.textures.exists('jelly_fish');
            console.log(`JellyfishSystem - 'jelly_fish' texture ${textureExists ? 'exists' : 'is missing'}`);
            
            // Debug: List all available object layers
            if (map.objects) {
                console.log('JellyfishSystem - All object layers:', 
                    map.objects.map(layer => layer.name));
            }
            
            // First try: Check if we can access the object layer directly
            let jellyfishLayer = null;
            
            // Try direct getObjectLayer method first
            if (map.getObjectLayer) {
                console.log('JellyfishSystem - Trying map.getObjectLayer("jellyfish")');
                jellyfishLayer = map.getObjectLayer('jellyfish');
            }
            
            // Fall back to manual search if direct method failed
            if (!jellyfishLayer && map.objects) {
                console.log('JellyfishSystem - Direct getObjectLayer failed, searching manually in map.objects');
                jellyfishLayer = map.objects.find(layer => 
                    layer.name && layer.name.toLowerCase() === 'jellyfish'
                );
            }
            
            // Try tilemapSystem's helper if available and previous methods failed
            if (!jellyfishLayer && this.scene.tilemapSystem?.getObjectLayer) {
                console.log('JellyfishSystem - Trying tilemapSystem.getObjectLayer("jellyfish")');
                jellyfishLayer = this.scene.tilemapSystem.getObjectLayer('jellyfish');
            }
            
            // Check if we found the layer
            console.log('JellyfishSystem - Jellyfish layer found:', jellyfishLayer ? 'yes' : 'no');
            
            // If we found a layer, try to get objects
            const jellyfishObjects = jellyfishLayer?.objects || [];
            console.log(`JellyfishSystem - Found ${jellyfishObjects.length} jellyfish objects`);
            
            if (jellyfishObjects.length > 0) {
                console.log(`JellyfishSystem - Processing ${jellyfishObjects.length} jellyfish objects`);
                
                // Process each jellyfish object
                this.processJellyfishObjects(jellyfishObjects);
            } else {
                // Last resort: Check objectLayers in tilemapSystem
                if (this.scene.tilemapSystem?.objectLayers) {
                    const layerNames = Object.keys(this.scene.tilemapSystem.objectLayers);
                    console.log('JellyfishSystem - Available layers in tilemapSystem.objectLayers:', layerNames);
                    
                    // Look for a jellyfish layer in tilemapSystem.objectLayers
                    const jellyfishLayerKey = layerNames.find(name => 
                        name.toLowerCase() === 'jellyfish');
                    
                    if (jellyfishLayerKey) {
                        const objects = this.scene.tilemapSystem.objectLayers[jellyfishLayerKey].objects || [];
                        console.log(`JellyfishSystem - Found ${objects.length} jellyfish objects in tilemapSystem.objectLayers`);
                        
                        this.processJellyfishObjects(objects);
                    } else {
                        console.log('JellyfishSystem - No jellyfish layer found in tilemapSystem.objectLayers');
                    }
                } else {
                    console.log('[DEBUG] JellyfishSystem - No jellyfish objects found in map (checked all sources)');
                    
                    // If no jellyfish found in the map and we're in debug/development, create a test jellyfish
                    if (this.scene.physics.config?.debug && this.scene.textures.exists('jelly_fish')) {
                        console.log('[DEBUG] JellyfishSystem - Creating test jellyfish for debugging');
                        this.createDebugJellyfish();
                    }
                }
            }
            
            // Log the result of spawning
            console.log(`[DEBUG] JellyfishSystem - Spawning complete. Created ${this.jellyfish.length} jellyfish`);
        } catch (error) {
            console.error('Error spawning jellyfish from map:', error);
        }
    }
    
    /**
     * Process jellyfish objects from the map and spawn them while avoiding duplicates
     * @param {Array} objects - Array of jellyfish objects from the map
     */
    processJellyfishObjects(objects) {
        console.log(`[DEBUG] JellyfishSystem - Processing ${objects.length} jellyfish objects`);
        
        objects.forEach((obj, index) => {
            // Must have valid position
            if (obj.x === undefined || obj.y === undefined) {
                console.log(`JellyfishSystem - Object ${index} has invalid position`);
                return;
            }
            
            // Generate ID or positional key for tracking
            const objId = obj.id !== undefined ? obj.id.toString() : null;
            const posKey = `${Math.round(obj.x)},${Math.round(obj.y)}`;
            
            // Check for duplicate object ID (if available)
            if (objId && this.processedObjectIds.has(objId)) {
                console.log(`[DEBUG] JellyfishSystem - Skipping duplicate object ID ${objId} at (${obj.x}, ${obj.y})`);
                return;
            }
            
            // Check for duplicate position (rounded to nearest integer)
            if (this.jellyfishPositions.has(posKey)) {
                console.log(`[DEBUG] JellyfishSystem - Skipping duplicate position at ${posKey}`);
                return;
            }
            
            // Track this object to prevent duplicates
            if (objId) this.processedObjectIds.add(objId);
            this.jellyfishPositions.add(posKey);
            
            console.log(`[DEBUG] JellyfishSystem - Processing jellyfish at (${obj.x}, ${obj.y}), ID: ${objId || 'none'}`);
            
            // Extract properties (default to 25 charge, 5 second respawn timer)
            let charge = 25;
            let timer = 5; // Default respawn timer of 5 seconds
            
            // Handle properties array (Tiled format)
            if (obj.properties && Array.isArray(obj.properties)) {
                // Find charge property
                const chargeProperty = obj.properties.find(prop => prop.name === 'charge');
                if (chargeProperty && typeof chargeProperty.value === 'number') {
                    charge = chargeProperty.value;
                }
                
                // Find timer property (in seconds)
                const timerProperty = obj.properties.find(prop => prop.name === 'timer');
                if (timerProperty && typeof timerProperty.value === 'number') {
                    timer = timerProperty.value;
                }
                
                console.log(`[DEBUG] JellyfishSystem - Jellyfish properties: charge=${charge}, respawn_timer=${timer}s`);
            }
            
            // Create the jellyfish with original object data at the exact position from Tiled
            const jellyfish = this.createJellyfish(obj.x, obj.y, charge, {
                originalObj: obj,
                timer: timer * 1000, // Convert seconds to milliseconds
                objectId: objId // Store the object ID if available
            });
            
            if (jellyfish) {
                console.log(`[DEBUG] JellyfishSystem - Successfully created jellyfish at (${obj.x}, ${obj.y})`);
            }
        });
    }
    
    /**
     * Create a jellyfish entity
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} charge - Battery charge amount
     * @param {Object} respawnData - Data needed for respawning
     */
    createJellyfish(x, y, charge, respawnData = null) {
        try {
            // Verify the texture exists before trying to create the sprite
            if (!this.scene.textures.exists('jelly_fish')) {
                console.error(`JellyfishSystem - Cannot create jellyfish at (${x}, ${y}): 'jelly_fish' texture is missing`);
                return null;
            }
            
            console.log(`[DEBUG] JellyfishSystem - Creating jellyfish at (${x}, ${y}) with charge ${charge}`);
            
            // Create the jellyfish sprite at the exact position from Tiled
            const jellyfish = this.scene.physics.add.sprite(x, y, 'jelly_fish');
            
            if (!jellyfish) {
                console.error(`JellyfishSystem - Failed to create jellyfish sprite at (${x}, ${y})`);
                return null;
            }
            
            // First add to group (before customizing properties)
            this.jellyfishGroup.add(jellyfish);
            
            // Configure the sprite
            jellyfish.setOrigin(0.5, 0.5);
            jellyfish.setScale(0.15);
            
            // FIXED: Always set consistent depth AFTER adding to group
            jellyfish.setDepth(5); // Above background, below player (assuming player at depth 10)
            console.log(`[DEBUG] Jellyfish created with depth: ${jellyfish.depth}`);
            
            // Apply enhanced blue glow effect
            try {
                if (jellyfish.preFX) {
                    const glowFX = jellyfish.preFX.addGlow(0x00bfff, 0.8, 0, false, 0.1, 22);
                    
                    // Animate the glow effect with a tween
                    this.scene.tweens.add({
                        targets: glowFX,
                        outerStrength: { from: 1, to: 2.5 },
                        alpha: { from: 0.8, to: 1.0 },
                        duration: 1800,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
            } catch (error) {
                console.warn('[DEBUG] Could not apply glow effect to jellyfish:', error);
            }
            
            // Re-enable physics after scaling
            this.scene.physics.world.enable(jellyfish);
            
            // Improved physics body setup - properly match visual size
            const circleRadius = jellyfish.displayWidth / 2;
            jellyfish.body.setCircle(circleRadius);
            jellyfish.body.setOffset(
                (jellyfish.width - jellyfish.displayWidth) / 2,
                (jellyfish.height - jellyfish.displayHeight) / 2
            );
            
            // Store original position for path calculations
            jellyfish.originalX = x;
            jellyfish.originalY = y;
            
            // Set up improved organic swimming behavior - CRITICAL - must be called for jellyfish to move
            console.log(`[DEBUG] Setting up movement for jellyfish at (${x}, ${y})`);
            this.setupJellyfishMovement(jellyfish);
            
            // Store charge value with the jellyfish
            jellyfish.charge = charge;
            
            // Initialize tweens array for tracking and cleanup
            jellyfish.tweens = [];
            
            // Store respawn data with the jellyfish
            if (respawnData) {
                jellyfish.respawnData = respawnData;
                
                // Generate a unique ID for this jellyfish based on position
                const jellyfishId = `jelly_${x}_${y}`;
                
                // Store original position and data for respawning
                this.originalPositions.set(jellyfishId, {
                    x: x,
                    y: y,
                    charge: charge,
                    respawnData: respawnData
                });
                
                // Store ID on the jellyfish for easy reference
                jellyfish.jellyfishId = jellyfishId;
            }
            
            // Store in our array
            this.jellyfish.push(jellyfish);
            
            // Add debug outline to visualize the sprite's bounds
            if (this.scene.physics.config?.debug) {
                jellyfish.setStrokeStyle(2, 0x00ff00);
            }
            
            return jellyfish;
        } catch (error) {
            console.error(`JellyfishSystem - Error creating jellyfish at (${x}, ${y}):`, error);
            return null;
        }
    }
    
    /**
     * Create a charge pickup at the specified position
     * @param {number} x - X position for the pickup
     * @param {number} y - Y position for the pickup
     * @param {number} charge - Battery charge amount this pickup provides
     * @param {Phaser.GameObjects.Sprite} parentJellyfish - The jellyfish that spawned this pickup
     */
    createChargePickup(x, y, charge, parentJellyfish = null) {
        try {
            console.log(`[DEBUG] Creating charge pickup at (${x}, ${y}) with charge ${charge}`);
            
            // Verify the texture exists before trying to create the sprite
            if (!this.scene.textures.exists('jelly_charge')) {
                console.error(`[DEBUG] Cannot create charge pickup: 'jelly_charge' texture is missing`);
                return null;
            }
            
            // Create the pickup sprite
            const pickup = this.scene.physics.add.sprite(x, y, 'jelly_charge');
            
            // First add to group (before customizing properties)
            if (this.chargePickupGroup) {
                this.chargePickupGroup.add(pickup);
            }
            
            // Configure the sprite
            pickup.setOrigin(0.5, 0.5);
            pickup.setScale(0.125); // Correct small size
            pickup.setDepth(6); // Above jellyfish
            
            // Apply blue glowing effect to charge pickup
            try {
                // Add glow effect using Phaser's FX
                if (pickup.preFX) {
                    const glowFX = pickup.preFX.addGlow(0x00bfff, 1.0, 0, false, 0.1, 24);
                    
                    // Add pulsating animation to the glow
                    this.scene.tweens.add({
                        targets: glowFX,
                        outerStrength: { from: 2, to: 4 },
                        alpha: { from: 0.7, to: 0.9 },
                        duration: 900 + Math.random() * 600,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
            } catch (error) {
                console.warn('[DEBUG] Could not add glow effect to charge pickup:', error);
            }
            
            // Re-enable physics after scaling
            this.scene.physics.world.enable(pickup);
            
            // Set charge amount
            pickup.charge = charge || 25;
            
            // Store parent reference if provided
            if (parentJellyfish && parentJellyfish.jellyfishId) {
                pickup.parentJellyfishId = parentJellyfish.jellyfishId;
            }
            
            // Make hitbox larger for easier collection (1.5x visual size for easy pickup)
            // Similar to how air_pocket is made easier to collect
            const circleRadius = pickup.displayWidth / 1.5;
            pickup.body.setCircle(circleRadius);
            pickup.body.setOffset(
                (pickup.width - pickup.displayWidth * 1.5) / 2,
                (pickup.height - pickup.displayHeight * 1.5) / 2
            );
            
            // Add hover animation
            this.scene.tweens.add({
                targets: pickup,
                y: y + 10,
                duration: 2000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            // Add gentle rotation
            this.scene.tweens.add({
                targets: pickup,
                angle: { from: -5, to: 5 },
                duration: 1800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            // Store in our array
            this.chargePickups.push(pickup);
            
            console.log(`[DEBUG] Created charge pickup at (${x}, ${y}) with charge ${charge}`);
            return pickup;
        } catch (error) {
            console.error('[DEBUG] Error creating charge pickup:', error);
            return null;
        }
    }
    
    /**
     * Handle player collecting a charge pickup
     * @param {Phaser.GameObjects.Sprite} player - The player sprite
     * @param {Phaser.GameObjects.Sprite} pickup - The charge pickup
     */
    handlePickupCollection(player, pickup) {
        // Early validation to prevent processing invalid pickups
        if (!pickup || !pickup.active || !this.active) return;
        
        try {
            console.log(`[DEBUG] Player collected pickup at (${pickup.x}, ${pickup.y})`);
            
            // Get the charge value
            const charge = pickup.charge || 25;
            console.log(`[DEBUG] Pickup charge value: ${charge}`);
            let batteryUpdated = false;
            let visuallyUpdated = false;
            
            // Store the parent jellyfish ID before doing anything else
            const parentJellyfishId = pickup.parentJellyfishId;
            
            // Create a collection effect
            try {
                const particles = this.scene.add.particles(pickup.x, pickup.y, 'bubble', {
                    speed: { min: 30, max: 80 },
                    scale: { start: 0.1, end: 0.02 },
                    lifespan: 600,
                    tint: 0x00ffff,
                    quantity: 5,
                    gravityY: -50,
                    emitting: false
                });
                
                // One-time collection burst
                particles.explode(10);
                
                // Destroy the particles after animation completes
                this.scene.time.delayedCall(600, () => {
                    if (particles && particles.active) {
                        particles.destroy();
                    }
                });
            } catch (error) {
                console.error('[DEBUG] Error creating pickup effect:', error);
            }
            
            // Remove pickup early to prevent double-collection
            try {
                // Stop drawing the pickup while we're updating batteries
                pickup.visible = false;
                pickup.body.enable = false;
                
                // Flag it for cleanup - we'll actually remove it at the end
                const pickupToRemove = pickup;
                
                // Clear from our tracking array
                this.chargePickups = this.chargePickups.filter(p => p !== pickup);
            } catch (error) {
                console.error('[DEBUG] Error pre-cleaning pickup:', error);
            }
            
            // BATTERY UPDATE - Limited to most essential options to prevent performance issues
            try {
                // Key insight: We need to identify the ACTUAL visual battery meter
                // 1. First priority: Direct battery system update (data model)
                const batterySystem = this.scene.batterySystem;
                if (batterySystem) {
                    try {
                        const oldLevel = batterySystem.currentBattery;
                        batterySystem.currentBattery = Math.min(100, oldLevel + charge);
                        
                        console.log(`[DEBUG] Updated batterySystem.currentBattery from ${oldLevel} to ${batterySystem.currentBattery}`);
                        
                        // Only call rechargeBattery if it's a simple method
                        if (typeof batterySystem.rechargeBattery === 'function') {
                            batterySystem.rechargeBattery(charge);
                        }
                        
                        batteryUpdated = true;
                    } catch (error) {
                        console.error('[DEBUG] Error updating battery system:', error);
                    }
                }
                
                // 2. Second priority: Update UI battery meter
                const uiBatteryMeter = this.scene.gameSceneUI?.batteryMeter;
                if (uiBatteryMeter) {
                    try {
                        // Simplified update with less error-prone operations
                        if (typeof uiBatteryMeter.setBatteryLevel === 'function') {
                            // Use the setter method if available
                            const currentLevel = typeof uiBatteryMeter.getBatteryLevel === 'function' ?
                                uiBatteryMeter.getBatteryLevel() : 
                                (uiBatteryMeter.currentBatteryLevel || 0);
                            
                            const newLevel = Math.min(100, currentLevel + charge);
                            uiBatteryMeter.setBatteryLevel(newLevel);
                            console.log(`[DEBUG] Set UI battery to ${newLevel}`);
                            visuallyUpdated = true;
                        } 
                        else if (uiBatteryMeter.currentBatteryLevel !== undefined) {
                            // Direct property update with safety check
                            uiBatteryMeter.currentBatteryLevel = Math.min(100, uiBatteryMeter.currentBatteryLevel + charge);
                            
                            // Force update if method exists
                            if (typeof uiBatteryMeter.updateBatteryLevel === 'function') {
                                uiBatteryMeter.updateBatteryLevel();
                            }
                            
                            visuallyUpdated = true;
                        }
                    } catch (error) {
                        console.error('[DEBUG] Error updating UI battery meter:', error);
                    }
                }
                
                // 3. Third priority: Try a simple event - most lightweight option
                if (!visuallyUpdated && !batteryUpdated) {
                    try {
                        this.scene.events.emit('batteryRecharge', charge);
                        this.scene.events.emit('batteryUpdate', charge);
                        console.log(`[DEBUG] Emitted battery update events`);
                    } catch (error) {
                        console.error('[DEBUG] Error emitting battery events:', error);
                    }
                }
            } catch (error) {
                console.error('[DEBUG] Error in battery update process:', error);
            }
            
            // Report result
            if (visuallyUpdated) {
                console.log('[DEBUG] ✅ BATTERY VISUALLY UPDATED');
            } else if (batteryUpdated) {
                console.log('[DEBUG] ⚠️ BATTERY DATA UPDATED BUT VISUAL UPDATE NOT CONFIRMED');
            } else {
                console.warn('[DEBUG] ❌ FAILED TO UPDATE ANY BATTERY COMPONENT');
            }
            
            // Final cleanup of pickup
            try {
                if (pickup.active) {
                    pickup.destroy();
                }
                
                // If this pickup was part of a destroyed jellyfish, schedule it for respawn
                if (parentJellyfishId && 
                    this.originalPositions.has(parentJellyfishId) && 
                    !this.respawnTimers.has(parentJellyfishId)) {
                    
                    // Use a delayed call to offset this potentially intensive operation
                    this.scene.time.delayedCall(100, () => {
                        if (this.active) {
                            this.scheduleJellyfishRespawn(parentJellyfishId);
                        }
                    });
                }
            } catch (error) {
                console.error('[DEBUG] Error in final pickup cleanup:', error);
            }
        } catch (error) {
            console.error('[DEBUG] Critical error in handlePickupCollection:', error);
        }
    }
    
    /**
     * Setup collisions between entities - CRITICAL for game functionality
     */
    setupCollisions() {
        try {
            console.log('[DEBUG] Setting up JellyfishSystem collision detection');
            
            // Ensure we have valid physics groups
            this.validatePhysicsGroups();
            
            // Setup bullet/jellyfish collisions if bullets exist
            if (this.scene.bulletSystem && this.scene.bulletSystem.bullets) {
                this.bulletJellyfishOverlap = this.scene.physics.add.overlap(
                    this.scene.bulletSystem.bullets,
                    this.jellyfishGroup,
                    this.handleJellyfishDestruction,
                    null,
                    this
                );
                console.log('[DEBUG] Bullet/jellyfish collision setup complete');
            } else {
                console.warn('[DEBUG] Bullet system not found, skipping bullet collision setup');
            }
            
            // Setup player/pickup collisions if player exists
            if (this.scene.player && this.scene.player.sprite) {
                this.playerPickupOverlap = this.scene.physics.add.overlap(
                    this.scene.player.sprite,
                    this.chargePickupGroup,
                    this.handlePickupCollection,
                    null,
                    this
                );
                
                // Setup player/jellyfish collisions for damage
                this.playerJellyfishOverlap = this.scene.physics.add.overlap(
                    this.scene.player.sprite,
                    this.jellyfishGroup,
                    this.handlePlayerJellyfishCollision,
                    null,
                    this
                );
                
                console.log('[DEBUG] Player collision setup complete');
            } else {
                console.warn('[DEBUG] Player not found, skipping player collision setup');
                
                // Try to set up collision once the player is created
                this.scene.events.once('playerCreated', this.setupCollisions, this);
            }
            
            console.log('[DEBUG] JellyfishSystem collision setup completed successfully');
            return true;
        } catch (error) {
            console.error('[DEBUG] Error setting up jellyfish collisions:', error);
            return false;
        }
    }
    
    /**
     * Validate and repair physics groups if needed
     */
    validatePhysicsGroups() {
        // Check if jellyfish group is valid
        if (!this.jellyfishGroup || !this.jellyfishGroup.scene) {
            console.log('JellyfishSystem - Recreating jellyfish physics group');
            this.jellyfishGroup = this.scene.physics.add.group({
                allowGravity: false
            });
            
            // Re-add existing jellyfish to the group
            this.jellyfish.forEach(jellyfish => {
                if (jellyfish && jellyfish.active) {
                    this.jellyfishGroup.add(jellyfish);
                }
            });
        }
        
        // Check if pickup group is valid
        if (!this.chargePickupGroup || !this.chargePickupGroup.scene) {
            console.log('JellyfishSystem - Recreating charge pickup physics group');
            this.chargePickupGroup = this.scene.physics.add.group({
                allowGravity: false
            });
            
            // Re-add existing pickups to the group
            this.chargePickups.forEach(pickup => {
                if (pickup && pickup.active) {
                    this.chargePickupGroup.add(pickup);
                }
            });
        }
    }
    
    /**
     * Handle player collision with jellyfish
     * @param {Phaser.GameObjects.Sprite} playerSprite - The player sprite
     * @param {Phaser.GameObjects.Sprite} jellyfish - The jellyfish sprite
     */
    handlePlayerJellyfishCollision(playerSprite, jellyfish) {
        // Safety check to prevent errors with invalid objects
        if (!playerSprite || !playerSprite.active || !jellyfish || !jellyfish.active || !this.active) {
            return;
        }
        
        try {
            console.log(`[DEBUG] Player collided with jellyfish at (${jellyfish.x}, ${jellyfish.y})`);
            
            // Damage cooldown check - prevent rapid damage from the same jellyfish
            const now = this.scene.time.now;
            const lastHitTime = jellyfish.lastPlayerHitTime || 0;
            
            // If we're still in cooldown period, skip damage
            if (now - lastHitTime < 1000) { // 1 second cooldown
                console.log('[DEBUG] Jellyfish damage cooldown active, skipping damage');
                return;
            }
            
            // Update the last hit time
            jellyfish.lastPlayerHitTime = now;
            
            // Apply damage to player through the healthSystem
            if (this.scene.healthSystem) {
                console.log('[DEBUG] Applying jellyfish damage via healthSystem');
                // Apply 20 damage to player
                this.scene.healthSystem.takeDamage(20);
                console.log('[DEBUG] Called healthSystem.takeDamage(20)');
                
                // Add screen shake effect
                this.scene.cameras.main.shake(100, 0.01);
                
                // Apply knockback to player sprite
                const knockbackForce = 200;
                const angle = Phaser.Math.Angle.Between(jellyfish.x, jellyfish.y, playerSprite.x, playerSprite.y);
                playerSprite.body.velocity.x += Math.cos(angle) * knockbackForce;
                playerSprite.body.velocity.y += Math.sin(angle) * knockbackForce;
            } else {
                console.warn('[DEBUG] No healthSystem found - cannot apply damage');
            }
            
            // Visual feedback: Flash the jellyfish
            this.scene.tweens.add({
                targets: jellyfish,
                alpha: 0.5,
                duration: 100,
                yoyo: true,
                repeat: 2
            });
            
            // Emit bubbles for impact effect (safely)
            this.emitBubblesSafely(
                (playerSprite.x + jellyfish.x) / 2,
                (playerSprite.y + jellyfish.y) / 2,
                4
            );
            
            console.log('[DEBUG] Jellyfish collision handling complete');
            
        } catch (error) {
            console.error('[DEBUG] Error handling player-jellyfish collision:', error);
        }
    }
    
    /**
     * Remove all jellyfish entities
     */
    clearJellyfish() {
        // Clean up jellyfish
        if (this.jellyfish.length > 0) {
            this.jellyfish.forEach(jellyfish => {
                if (jellyfish && jellyfish.destroy) {
                    jellyfish.destroy();
                }
            });
        }
        this.jellyfish = [];
        
        // Clean up charge pickups
        if (this.chargePickups.length > 0) {
            this.chargePickups.forEach(pickup => {
                if (pickup && pickup.destroy) {
                    pickup.destroy();
                }
            });
        }
        this.chargePickups = [];
    }
    
    /**
     * System update method - called every frame
     * @param {number} time - Current game time
     * @param {number} delta - Time since last update
     */
    update(time, delta) {
        if (!this.active) return;
        
        try {
            // Update jellyfish
            this.updateJellyfish(time, delta);

            // Check collision systems every few seconds
            const timeSeconds = Math.floor(time / 1000);
            if (timeSeconds % 5 === 0 && !this._lastCollisionCheck) {
                this._lastCollisionCheck = true;
                this.ensureCollisionsExist();
            } else if (timeSeconds % 5 !== 0) {
                this._lastCollisionCheck = false;
            }
            
            // Only log debug info once every 20 seconds to avoid performance issues
            if (this.scene.physics.config.debug && timeSeconds % 20 === 0 && !this._lastDebugTime) {
                this._lastDebugTime = true;
                this.logDebugInfo();
            } else if (timeSeconds % 20 !== 0) {
                this._lastDebugTime = false;
            }
        } catch (error) {
            console.error('[DEBUG] Error in JellyfishSystem update:', error);
        }
    }
    
    /**
     * Update all jellyfish entities
     * @param {number} time - Current game time
     * @param {number} delta - Time since last update
     */
    updateJellyfish(time, delta) {
        // Only do this every few frames to save performance
        if (this._lastJellyfishUpdate && time - this._lastJellyfishUpdate < 100) {
            return;
        }
        
        this._lastJellyfishUpdate = time;
        
        // Limit number of jellyfish processed per frame if there are many
        const jellyfishToUpdate = this.jellyfish.length > 20 ? 
            this.jellyfish.slice(0, 20) : this.jellyfish;
        
        // Process limited batch
        for (const jellyfish of jellyfishToUpdate) {
            if (!jellyfish || !jellyfish.active) continue;
            
            try {
                // Any per-jellyfish update logic would go here
                // Currently using tweens for movement, so no need for manual updates
            } catch (error) {
                console.warn('[DEBUG] Error updating individual jellyfish:', error);
            }
        }
    }
    
    /**
     * Make sure all collision overlaps are working
     */
    ensureCollisionsExist() {
        // If ANY collision system is missing, recreate all of them
        if (!this.bulletJellyfishOverlap || !this.playerPickupOverlap || !this.playerJellyfishOverlap) {
            console.log('[DEBUG] Missing collision systems detected - reinstantiating all systems');
            this.reinstantiateCollisionSystems();
            return;
        }
        
        // Additional check: if no bullets are being detected, recreate bullet collision
        if (this.scene.bulletSystem && this.bulletJellyfishOverlap && this.jellyfish.length > 0) {
            // Check if bulletSystem.bullets is still valid
            if (!this.scene.bulletSystem.bullets || !this.scene.bulletSystem.bullets.scene) {
                console.log('[DEBUG] Bullet group no longer valid - reinstantiating bullet collision');
                
                // Recreate bullet collision
                if (this.bulletJellyfishOverlap) {
                    this.bulletJellyfishOverlap.destroy();
                    this.bulletJellyfishOverlap = null;
                }
                
                this.bulletJellyfishOverlap = this.scene.physics.add.overlap(
                    this.scene.bulletSystem.bullets,
                    this.jellyfishGroup,
                    (bullet, jellyfish) => {
                        if (bullet.active && jellyfish.active) {
                            console.log(`[DEBUG] Bullet(${bullet.depth}) hit jellyfish(${jellyfish.depth}) from reinstantiated collision`);
                            this.handleJellyfishDestruction(bullet, jellyfish);
                            if (typeof bullet.deactivate === 'function') {
                                bullet.deactivate();
                            } else {
                                bullet.destroy();
                            }
                        }
                    }
                );
            }
        }
    }
    
    /**
     * Clean up resources when destroyed
     */
    destroy() {
        this.active = false;
        
        // Clean up event listeners
        this.scene.events.off('playerCreated', this.setupCollisions, this);
        
        // Clean up physics overlaps
        if (this.bulletJellyfishOverlap) {
            this.bulletJellyfishOverlap.destroy();
            this.bulletJellyfishOverlap = null;
        }
        
        if (this.playerPickupOverlap) {
            this.playerPickupOverlap.destroy();
            this.playerPickupOverlap = null;
        }
        
        if (this.playerJellyfishOverlap) {
            this.playerJellyfishOverlap.destroy();
            this.playerJellyfishOverlap = null;
        }
        
        // Stop all jellyfish movement by flagging them to stop swimming
        this.jellyfish.forEach(jellyfish => {
            if (jellyfish) {
                // Stop recursive tween movement by setting flag
                jellyfish.isSwimming = false;
                
                // Clean up all tweens
                if (jellyfish.tweens && jellyfish.tweens.length) {
                    jellyfish.tweens.forEach(tween => {
                        if (tween && tween.remove) {
                            tween.remove();
                        }
                    });
                    jellyfish.tweens = [];
                }
                
                // Compatibility with older code
                if (jellyfish.movementTimeline) {
                    jellyfish.movementTimeline.stop();
                    jellyfish.movementTimeline = null;
                }
            }
        });
        
        // Clear all respawn timers
        for (const timer of this.respawnTimers.values()) {
            if (timer) {
                timer.remove();
            }
        }
        this.respawnTimers.clear();
        this.originalPositions.clear();
        
        // Clear processed tracking sets
        this.processedObjectIds.clear();
        this.jellyfishPositions.clear();
        
        // Clear all entities
        this.clearJellyfish();
        
        // Destroy physics groups
        if (this.jellyfishGroup) {
            this.jellyfishGroup.destroy(true);
            this.jellyfishGroup = null;
        }
        
        if (this.chargePickupGroup) {
            this.chargePickupGroup.destroy(true);
            this.chargePickupGroup = null;
        }
    }
    
    /**
     * Create a test jellyfish for debugging purposes
     */
    createDebugJellyfish() {
        // Check if texture exists first
        if (!this.scene.textures.exists('jelly_fish')) {
            console.error('JellyfishSystem - Cannot create debug jellyfish: texture missing');
            return;
        }
        
        // Place jellyfish in visible area, near the center of screen
        const x = 400; 
        const y = 300;
        
        console.log(`JellyfishSystem - Creating debug jellyfish at (${x}, ${y})`);
        this.createJellyfish(x, y, 50);
    }
    
    /**
     * Set up swimming behavior for the jellyfish
     * @param {Phaser.GameObjects.Sprite} jellyfish - The jellyfish sprite
     */
    setupJellyfishMovement(jellyfish) {
        try {
            // Store the original position as the center point for swimming
            const originX = jellyfish.x;
            const originY = jellyfish.y;
            
            console.log(`[DEBUG] Setting up swimming pattern for jellyfish at (${originX}, ${originY})`);
            
            // Create random swimming radius - distance jellyfish will travel from origin (100-150px)
            const swimRadius = Phaser.Math.Between(100, 150);
            
            // Create a recursive movement pattern that repeats indefinitely
            const success = this.createSwimmingPattern(jellyfish, originX, originY, swimRadius);
            
            // Add gentle pulsing (scale) for more organic feel
            this.scene.tweens.add({
                targets: jellyfish,
                scaleX: { from: jellyfish.scaleX * 0.9, to: jellyfish.scaleX * 1.1 },
                scaleY: { from: jellyfish.scaleY * 0.9, to: jellyfish.scaleY * 1.1 },
                duration: 1800 + Math.random() * 800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            // Add subtle rotation
            this.scene.tweens.add({
                targets: jellyfish,
                angle: { from: -5, to: 5 },
                duration: 2500 + Math.random() * 1000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                delay: Math.random() * 500
            });
            
            console.log(`[DEBUG] Jellyfish movement setup complete with swim radius: ${swimRadius}px`);
            return success;
        } catch (error) {
            console.error('[DEBUG] Error setting up jellyfish movement:', error);
            return false;
        }
    }
    
    /**
     * Create a natural swimming pattern for a jellyfish using recursive tweens
     * @param {Phaser.GameObjects.Sprite} jellyfish - The jellyfish sprite
     * @param {number} originX - Original X position
     * @param {number} originY - Original Y position
     * @param {number} radius - Maximum swim radius from origin
     */
    createSwimmingPattern(jellyfish, originX, originY, radius) {
        try {
            // Safety check to prevent errors
            if (!jellyfish || !jellyfish.active || !this.active) {
                console.warn('[DEBUG] Cannot create swimming pattern - jellyfish invalid or system inactive');
                return false;
            }
            
            console.log(`[DEBUG] Starting recursive swimming pattern with radius ${radius}px`);
            
            // Set initial values for tracking
            jellyfish.originX = originX;
            jellyfish.originY = originY;
            jellyfish.swimRadius = radius;
            jellyfish.isSwimming = true;
            jellyfish.lastMovementTime = 0; // Track last movement to prevent rapid recursion
            jellyfish.moveCount = 0; // Track number of moves made
            
            // Start the first movement with a short delay to ensure initialization is complete
            this.scene.time.delayedCall(100, () => {
                if (jellyfish && jellyfish.active && jellyfish.isSwimming && this.active) {
                    this.moveToNextSwimPoint(jellyfish);
                }
            });
            
            return true;
        } catch (error) {
            console.error(`[DEBUG] Error creating swimming pattern:`, error);
            return false;
        }
    }
    
    /**
     * Move jellyfish to a random point within its swim radius
     * @param {Phaser.GameObjects.Sprite} jellyfish - The jellyfish sprite
     */
    moveToNextSwimPoint(jellyfish) {
        // Extensive safety checks
        if (!jellyfish || !jellyfish.active || !jellyfish.isSwimming || !this.active) {
            return;
        }
        
        // Prevent potential recursion issues - ensure minimum time between movements
        const now = this.scene.time.now;
        if (jellyfish.lastMovementTime && (now - jellyfish.lastMovementTime < 200)) {
            console.warn('[DEBUG] Preventing too rapid movement recursion');
            this.scene.time.delayedCall(300, () => {
                if (jellyfish && jellyfish.active && jellyfish.isSwimming && this.active) {
                    this.moveToNextSwimPoint(jellyfish);
                }
            });
            return;
        }
        
        jellyfish.lastMovementTime = now;
        jellyfish.moveCount++;
        
        try {
            // Generate random angle and distance within radius (full radius for more movement)
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const distance = Phaser.Math.FloatBetween(0.35, 1.0) * jellyfish.swimRadius;
            
            // Calculate target position
            const targetX = jellyfish.originX + Math.cos(angle) * distance;
            const targetY = jellyfish.originY + Math.sin(angle) * distance;
            
            // Randomize movement duration for more natural swimming (5-8 seconds)
            const baseSpeed = Phaser.Math.Between(5000, 8000);
            const normalizedDistance = distance / jellyfish.swimRadius;
            const moveDuration = baseSpeed * normalizedDistance;
            
            // Face the direction of movement by flipping the sprite
            if (targetX < jellyfish.x) {
                jellyfish.setFlipX(true);
            } else {
                jellyfish.setFlipX(false);
            }
            
            // Create the movement tween
            const tween = this.scene.tweens.add({
                targets: jellyfish,
                x: targetX,
                y: targetY,
                duration: moveDuration,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    // Safety check before proceeding
                    if (!jellyfish || !jellyfish.active || !jellyfish.isSwimming || !this.active) {
                        return;
                    }
                    
                    // Randomly emit bubbles with 30% chance
                    if (Math.random() < 0.3) {
                        this.emitBubblesSafely(jellyfish.x, jellyfish.y - 10, Phaser.Math.Between(1, 3));
                    }
                    
                    // Pause briefly before next movement
                    const pauseDuration = Phaser.Math.Between(300, 1000);
                    
                    // Schedule next movement after pause using safe delayed call
                    this.scene.time.delayedCall(pauseDuration, () => {
                        // Double-check everything is still valid
                        if (!jellyfish || !jellyfish.active || !jellyfish.isSwimming || !this.active) {
                            return;
                        }
                        
                        try {
                            // More unpredictable movement patterns
                            const rand = Math.random();
                            if (rand < 0.2) {
                                // 20% chance to return towards origin
                                this.returnTowardsOrigin(jellyfish);
                            } else if (rand < 0.3 && jellyfish.moveCount > 3) {
                                // 10% chance to do a quick dart movement, but only after a few normal moves
                                this.quickDartMovement(jellyfish);
                            } else {
                                // 70-80% normal movement
                                this.moveToNextSwimPoint(jellyfish);
                            }
                        } catch (error) {
                            console.error('[DEBUG] Error during next movement decision:', error);
                            // Failsafe - if error occurs, try again with basic movement after a delay
                            this.scene.time.delayedCall(1000, () => {
                                if (jellyfish && jellyfish.active && jellyfish.isSwimming && this.active) {
                                    this.moveToNextSwimPoint(jellyfish);
                                }
                            });
                        }
                    });
                }
            });
            
            // Safety feature: Store tween reference for cleanup
            if (!jellyfish.tweens) jellyfish.tweens = [];
            jellyfish.tweens.push(tween);
            
        } catch (error) {
            console.error('[DEBUG] Error in moveToNextSwimPoint:', error);
            
            // Try to recover by scheduling next movement with a longer delay
            this.scene.time.delayedCall(2000, () => {
                if (jellyfish && jellyfish.active && jellyfish.isSwimming && this.active) {
                    this.moveToNextSwimPoint(jellyfish);
                }
            });
        }
    }
    
    /**
     * Performs a quick darting movement for the jellyfish
     * @param {Phaser.GameObjects.Sprite} jellyfish - The jellyfish sprite
     */
    quickDartMovement(jellyfish) {
        if (!jellyfish || !jellyfish.active || !jellyfish.isSwimming || !this.active) return;
        
        try {
            // Calculate a relatively close point for a quick dart
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const distance = Phaser.Math.FloatBetween(0.2, 0.5) * jellyfish.swimRadius;
            
            const dartX = jellyfish.x + Math.cos(angle) * distance;
            const dartY = jellyfish.y + Math.sin(angle) * distance;
            
            // Make sure we don't go too far from origin
            const distFromOrigin = Phaser.Math.Distance.Between(
                dartX, dartY, jellyfish.originX, jellyfish.originY
            );
            
            let finalX = dartX;
            let finalY = dartY;
            
            // If too far, adjust back toward origin
            if (distFromOrigin > jellyfish.swimRadius) {
                const adjustAngle = Phaser.Math.Angle.Between(
                    dartX, dartY, jellyfish.originX, jellyfish.originY
                );
                const adjustDist = distFromOrigin - jellyfish.swimRadius;
                
                finalX = dartX + Math.cos(adjustAngle) * adjustDist;
                finalY = dartY + Math.sin(adjustAngle) * adjustDist;
            }
            
            // Face direction
            if (finalX < jellyfish.x) {
                jellyfish.setFlipX(true);
            } else {
                jellyfish.setFlipX(false);
            }
            
            // Quick dart movement (faster than normal)
            const tween = this.scene.tweens.add({
                targets: jellyfish,
                x: finalX,
                y: finalY,
                duration: Phaser.Math.Between(600, 1200), // Much faster
                ease: 'Cubic.easeOut', // Sharp acceleration
                onComplete: () => {
                    if (!jellyfish || !jellyfish.active || !jellyfish.isSwimming) return;
                    
                    // Emit more bubbles during a dart
                    this.emitBubblesSafely(jellyfish.x, jellyfish.y - 10, Phaser.Math.Between(2, 4));
                    
                    // Longer pause after a dart
                    const restDuration = Phaser.Math.Between(800, 1500);
                    
                    // Return to normal movement after rest
                    this.scene.time.delayedCall(restDuration, () => {
                        if (jellyfish && jellyfish.active && jellyfish.isSwimming) {
                            this.moveToNextSwimPoint(jellyfish);
                        }
                    });
                }
            });
            
            // Store tween for cleanup
            if (!jellyfish.tweens) jellyfish.tweens = [];
            jellyfish.tweens.push(tween);
            
        } catch (error) {
            console.error('[DEBUG] Error in quickDartMovement:', error);
            
            // Recover to normal movement
            this.scene.time.delayedCall(1000, () => {
                if (jellyfish && jellyfish.active && jellyfish.isSwimming) {
                    this.moveToNextSwimPoint(jellyfish);
                }
            });
        }
    }
    
    /**
     * Return jellyfish closer to its origin point
     * @param {Phaser.GameObjects.Sprite} jellyfish - The jellyfish sprite
     */
    returnTowardsOrigin(jellyfish) {
        // Safety check
        if (!jellyfish || !jellyfish.active || !jellyfish.isSwimming || !this.active) {
            return;
        }
        
        try {
            // Calculate a point close to but not exactly at the origin
            const returnX = jellyfish.originX + Phaser.Math.FloatBetween(-20, 20);
            const returnY = jellyfish.originY + Phaser.Math.FloatBetween(-20, 20);
            
            // Face the direction of movement
            if (returnX < jellyfish.x) {
                jellyfish.setFlipX(true);
            } else {
                jellyfish.setFlipX(false);
            }
            
            // Create the return tween with longer duration for a slow return
            const tween = this.scene.tweens.add({
                targets: jellyfish,
                x: returnX,
                y: returnY,
                duration: Phaser.Math.Between(5000, 7000),
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    // Safety check
                    if (!jellyfish || !jellyfish.active || !jellyfish.isSwimming || !this.active) {
                        return;
                    }
                    
                    // Longer pause at "home" position
                    const homePauseDuration = Phaser.Math.Between(800, 1500);
                    
                    // Emit bubbles more likely when at home
                    if (Math.random() < 0.5) {
                        this.emitBubblesSafely(jellyfish.x, jellyfish.y - 10, Phaser.Math.Between(2, 4));
                    }
                    
                    // Schedule next movement after home pause with safe delayed call
                    this.scene.time.delayedCall(homePauseDuration, () => {
                        if (!jellyfish || !jellyfish.active || !jellyfish.isSwimming || !this.active) {
                            return;
                        }
                        
                        try {
                            this.moveToNextSwimPoint(jellyfish);
                        } catch (error) {
                            console.error('[DEBUG] Error returning to swim pattern:', error);
                        }
                    });
                }
            });
            
            // Store tween for cleanup
            if (!jellyfish.tweens) jellyfish.tweens = [];
            jellyfish.tweens.push(tween);
            
        } catch (error) {
            console.error('[DEBUG] Error in returnTowardsOrigin:', error);
            
            // Try to recover with a longer delay
            this.scene.time.delayedCall(2000, () => {
                if (jellyfish && jellyfish.active && jellyfish.isSwimming && this.active) {
                    this.moveToNextSwimPoint(jellyfish);
                }
            });
        }
    }
    
    /**
     * Safely emit bubble particles, with error handling
     * @param {number} x - X position for bubbles
     * @param {number} y - Y position for bubbles
     * @param {number} count - Number of bubbles to emit
     */
    emitBubblesSafely(x, y, count = 3) {
        try {
            // Skip if system is not active
            if (!this.active || !this.scene) return;
            
            // Try multiple ways to emit bubbles, in order of preference
            
            // 1. Try particleSystem first if available
            if (this.scene.particleSystem && typeof this.scene.particleSystem.emitBubbles === 'function') {
                this.scene.particleSystem.emitBubbles(x, y, count);
                return;
            }
            
            // 2. Try the scene's direct emitBubbles method
            if (typeof this.scene.emitBubbles === 'function') {
                this.scene.emitBubbles(x, y, count);
                return;
            }
            
            // 3. Last resort: Create a simple temporary particle effect
            if (this.scene.add && this.scene.add.particles) {
                try {
                    // Check if bubble texture exists
                    if (!this.scene.textures.exists('bubble')) {
                        console.log('[DEBUG] No bubble texture available for particles');
                        return;
                    }
                    
                    // Create a simple bubble particle effect
                    const particles = this.scene.add.particles(x, y, 'bubble', {
                        speed: { min: 20, max: 40 },
                        scale: { start: 0.1, end: 0.01 },
                        lifespan: 800,
                        quantity: count,
                        gravityY: -30
                    });
                    
                    // Clean up after animation completes
                    this.scene.time.delayedCall(800, () => {
                        if (particles && particles.active) {
                            particles.destroy();
                        }
                    });
                } catch (error) {
                    console.warn('[DEBUG] Failed to create fallback bubble particles:', error);
                }
            }
        } catch (error) {
            console.warn('[DEBUG] Error emitting bubbles (non-critical):', error);
        }
    }
    
    /**
     * Log the current state of the jellyfish system for debugging
     */
    logSystemState() {
        console.log('JellyfishSystem - Current state:');
        console.log(`- Jellyfish count: ${this.jellyfish.length}`);
        console.log(`- Charge pickups count: ${this.chargePickups.length}`);
        console.log(`- Player reference exists: ${!!this.player}`);
        console.log(`- Player sprite exists: ${!!(this.player && this.player.sprite)}`);
        
        if (this.player && this.player.sprite) {
            console.log(`- Player sprite depth: ${this.player.sprite.depth}`);
        }
        
        if (this.jellyfish.length > 0) {
            console.log(`- Jellyfish sprite depth: ${this.jellyfish[0].depth}`);
        }
        
        if (this.chargePickups.length > 0) {
            console.log(`- Charge pickup sprite depth: ${this.chargePickups[0].depth}`);
        }
        
        console.log(`- BulletSystem reference exists: ${!!this.scene.bulletSystem}`);
        if (this.scene.bulletSystem && this.scene.bulletSystem.bullets) {
            const bullet = this.scene.bulletSystem.bullets.getFirstAlive();
            if (bullet) {
                console.log(`- Sample bullet depth: ${bullet.depth}`);
            }
        }
        
        console.log(`- bulletJellyfishOverlap exists: ${!!this.bulletJellyfishOverlap}`);
        console.log(`- playerPickupOverlap exists: ${!!this.playerPickupOverlap}`);
        console.log(`- playerJellyfishOverlap exists: ${!!this.playerJellyfishOverlap}`);
    }
    
    /**
     * Add debug information about bullet system and jellyfish state
     */
    logDebugInfo() {
        // Check if bullet system exists
        if (this.scene.bulletSystem) {
            const bulletCount = this.scene.bulletSystem.bullets?.getChildren()?.length || 0;
            console.log(`[DEBUG] Bullet system status: ${bulletCount} active bullets`);
        }
        
        // Log jellyfish count
        console.log(`[DEBUG] Jellyfish count: ${this.jellyfish.length}`);
        console.log(`[DEBUG] Charge pickups count: ${this.chargePickups.length}`);
        
        // Check collision overlaps
        console.log(`[DEBUG] Bullet-jellyfish overlap exists: ${!!this.bulletJellyfishOverlap}`);
        console.log(`[DEBUG] Player-pickup overlap exists: ${!!this.playerPickupOverlap}`);
        console.log(`[DEBUG] Player-jellyfish overlap exists: ${!!this.playerJellyfishOverlap}`);
    }
    
    /**
     * Completely recreate all collision systems from scratch
     * Call this if collision detection is not working properly
     */
    reinstantiateCollisionSystems() {
        console.log('[DEBUG] Force-reinstantiating ALL collision systems');
        
        try {
            // Clean up any existing collision systems
            if (this.bulletJellyfishOverlap) {
                this.bulletJellyfishOverlap.destroy();
                this.bulletJellyfishOverlap = null;
            }
            
            if (this.playerPickupOverlap) {
                this.playerPickupOverlap.destroy();
                this.playerPickupOverlap = null;
            }
            
            if (this.playerJellyfishOverlap) {
                this.playerJellyfishOverlap.destroy();
                this.playerJellyfishOverlap = null;
            }
            
            // Validate physics groups are still valid
            if (!this.jellyfishGroup || !this.jellyfishGroup.scene) {
                console.log('[DEBUG] Jellyfishgroup needs recreation');
                // Recreate the physics group if invalid
                this.jellyfishGroup = this.scene.physics.add.group({
                    allowGravity: false
                });
                
                // Re-add existing jellyfish to the group
                this.jellyfish.forEach(jellyfish => {
                    if (jellyfish && jellyfish.active) {
                        // Make sure depth is consistent
                        jellyfish.setDepth(5);
                        this.jellyfishGroup.add(jellyfish);
                    }
                });
            }
            
            if (!this.chargePickupGroup || !this.chargePickupGroup.scene) {
                console.log('[DEBUG] ChargePickupGroup needs recreation');
                // Recreate the physics group if invalid
                this.chargePickupGroup = this.scene.physics.add.group({
                    allowGravity: false
                });
                
                // Re-add existing pickups to the group
                this.chargePickups.forEach(pickup => {
                    if (pickup && pickup.active) {
                        // Make sure depth is consistent
                        pickup.setDepth(6);
                        this.chargePickupGroup.add(pickup);
                    }
                });
            }
            
            // Ensure player reference is updated
            if (this.scene.player && (!this.player || this.player !== this.scene.player)) {
                this.player = this.scene.player;
                console.log(`[DEBUG] Updated player reference during reinstantiation`);
            }
            
            // Completely re-setup collision systems
            this.setupCollisions();
            
            // Verify setup was successful
            const success = this.bulletJellyfishOverlap && this.playerPickupOverlap && this.playerJellyfishOverlap;
            console.log(`[DEBUG] Collision system reinstantiation ${success ? 'SUCCESSFUL' : 'FAILED'}`);
            
            return success;
        } catch (error) {
            console.error('[DEBUG] Error while reinstantiating collision systems:', error);
            return false;
        }
    }

    /**
     * Handle jellyfish destruction by bullet
     * @param {Phaser.GameObjects.Sprite} bullet - The bullet that hit the jellyfish
     * @param {Phaser.GameObjects.Sprite} jellyfish - The jellyfish that was hit
     */
    handleJellyfishDestruction(bullet, jellyfish) {
        console.log(`[DEBUG] handleJellyfishDestruction called - bullet active: ${bullet.active}, jellyfish active: ${jellyfish.active}`);
        console.log(`[DEBUG] Depths - Bullet: ${bullet.depth}, Jellyfish: ${jellyfish.depth}`);
        
        if (!jellyfish.active) {
            console.log('[DEBUG] Skipping destruction because jellyfish is inactive');
            return;
        }
        
        // Get the charge value before destroying the jellyfish
        const charge = jellyfish.charge || 25;
        const x = jellyfish.x;
        const y = jellyfish.y;
        console.log(`[DEBUG] Jellyfish at (${x}, ${y}) destroyed with charge ${charge}`);
        
        try {
            // Create a small explosion effect
            const particles = this.scene.add.particles(x, y, 'bubble', {
                speed: { min: 50, max: 150 },
                scale: { start: 0.2, end: 0.05 },
                lifespan: 800,
                quantity: 10,
                gravityY: -50,
                emitting: false
            });
            
            // One-time explosion burst
            particles.explode(15);
            
            // Destroy the particles after animation completes
            this.scene.time.delayedCall(800, () => {
                particles?.destroy();
            });
            
            // Store the jellyfish ID for respawning
            const jellyfishId = jellyfish.jellyfishId;
            
            // Create the charge pickup with parent jellyfish reference
            console.log('[DEBUG] Creating charge pickup from destroyed jellyfish');
            this.createChargePickup(x, y, charge, jellyfish);
            
            // Remove the jellyfish
            jellyfish.destroy();
            
            // Remove from our array
            this.jellyfish = this.jellyfish.filter(j => j !== jellyfish);
            
            // NEW: Schedule respawn if we have respawn data
            if (jellyfishId && this.originalPositions.has(jellyfishId)) {
                this.scheduleJellyfishRespawn(jellyfishId);
            }
        } catch (error) {
            console.error('[DEBUG] Error in handleJellyfishDestruction:', error);
        }
    }

    /**
     * NEW: Schedule a jellyfish to respawn after its timer
     * @param {string} jellyfishId - The ID of the jellyfish to respawn
     */
    scheduleJellyfishRespawn(jellyfishId) {
        // Get the original data
        const originalData = this.originalPositions.get(jellyfishId);
        if (!originalData) return;
        
        // Get the respawn timer value (already converted to milliseconds)
        const timer = originalData.respawnData?.timer || 5000;
        
        console.log(`JellyfishSystem - Scheduling jellyfish ${jellyfishId} to respawn in ${timer/1000} seconds`);
        
        // Cancel any existing timer for this jellyfish
        if (this.respawnTimers.has(jellyfishId)) {
            this.respawnTimers.get(jellyfishId).remove();
            this.respawnTimers.delete(jellyfishId);
        }
        
        // Create a new timer
        const timerEvent = this.scene.time.delayedCall(timer, () => {
            // Only respawn if system is still active
            if (!this.active) return;
            
            this.respawnJellyfish(jellyfishId);
            this.respawnTimers.delete(jellyfishId);
        });
        
        // Store the timer reference
        this.respawnTimers.set(jellyfishId, timerEvent);
    }

    /**
     * NEW: Respawn a jellyfish at its original position
     * @param {string} jellyfishId - The ID of the jellyfish to respawn
     */
    respawnJellyfish(jellyfishId) {
        // Get the original data
        const originalData = this.originalPositions.get(jellyfishId);
        if (!originalData) {
            console.warn(`JellyfishSystem - Cannot respawn jellyfish ${jellyfishId}: no original data found`);
            return;
        }
        
        console.log(`JellyfishSystem - Respawning jellyfish at (${originalData.x}, ${originalData.y})`);
        
        // Create a new jellyfish with the original data
        this.createJellyfish(
            originalData.x,
            originalData.y,
            originalData.charge,
            originalData.respawnData
        );
    }

    /**
     * Clean up a jellyfish entity and its resources
     * @param {Phaser.GameObjects.Sprite} jellyfish - The jellyfish to destroy
     */
    destroyJellyfish(jellyfish) {
        if (!jellyfish) return;
        
        try {
            console.log(`[DEBUG] Destroying jellyfish at (${jellyfish.x}, ${jellyfish.y})`);
            
            // Stop swimming
            jellyfish.isSwimming = false;
            
            // Clean up any tweens
            if (jellyfish.tweens && Array.isArray(jellyfish.tweens)) {
                jellyfish.tweens.forEach(tween => {
                    if (tween && tween.isPlaying) {
                        tween.stop();
                        tween.remove();
                    }
                });
                jellyfish.tweens = [];
            }
            
            // Create a charge pickup to replace the jellyfish if it had a charge value
            if (jellyfish.charge > 0) {
                this.createChargePickup(jellyfish.x, jellyfish.y, jellyfish.charge, jellyfish);
            }
            
            // Remove from our tracking arrays
            const index = this.jellyfish.indexOf(jellyfish);
            if (index !== -1) {
                this.jellyfish.splice(index, 1);
            }
            
            // Destroy the sprite
            jellyfish.destroy();
            
        } catch (error) {
            console.error('[DEBUG] Error in destroyJellyfish:', error);
        }
    }
} 