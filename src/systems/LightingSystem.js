/**
 * LightingSystem - Handles lighting effects and zone-based darkness transitions
 * 
 * This system manages the lighting levels based on object zones defined in Tiled maps.
 * It supports smooth transitions between different lighting states.
 */
import { LIGHTING } from '../utils/Constants';

export default class LightingSystem {
    /**
     * Create a new LightingSystem
     * @param {Phaser.Scene} scene - The scene this system belongs to
     */
    constructor(scene) {
        this.scene = scene;
        this.player = null;
        
        // Lighting overlay
        this.overlay = null;
        
        // Current lighting state
        this.currentLightLevel = 0; // 0 = default/full brightness
        this.targetLightLevel = 0;
        this.currentZoneType = 'default'; // Track the current zone type the player is in
        
        // Enhanced transition properties
        this.transitionStartTime = 0;
        this.transitionStartValue = 0;
        this.transitionDuration = 2000; // Default duration in milliseconds
        
        // Lighting zones from Tiled
        this.lightingZones = [];
        
        // Transition settings
        this.transitionSpeed = LIGHTING.TRANSITION_SPEED;
        this.transitionActive = false;
        
        // Lighting zone types and their darkness levels
        this.zoneLevels = {
            'default': LIGHTING.ZONE_LEVELS.DEFAULT,
            'bright': LIGHTING.ZONE_LEVELS.BRIGHT,
            'dim': LIGHTING.ZONE_LEVELS.DIM,
            'dark': LIGHTING.ZONE_LEVELS.DARK,
            'black': LIGHTING.ZONE_LEVELS.BLACK
        };
        
        // Point lights collection
        this.pointLights = [];
        
        // Custom lights collection (pin lights, ambient lights, etc.)
        this.customLights = [];
        
        // Light masks for obstacles
        this.lightMask = null;
        
        // Flashlight properties
        this.flashlightEnabled = false;
        this.flashlightMask = null;
        this.flashlightRotation = 0;
        
        // Previous position tracking for boost detection
        this.prevPlayerX = null;
        this.prevPlayerY = null;
        this.prevPlayerTime = 0;
        
        // Important new values for tracking zones
        this.shouldResetToDefault = false; // Added flag to control resets to default lighting
        this.lastNonDefaultZoneType = null; // Track the last non-default zone for persistence
        this.lastNonDefaultZoneLevel = 0; // Store the level too
        this.persistentMode = true; // CRITICAL: Always use persistent lighting mode
        this.inDebugMode = true; // Always log debug info for lighting zones
        this.forceZonePersistence = true; // Don't allow resets to default
        
        // Debug graphics and text
        this.debugGraphics = null;
        this.debugText = null;
        
        console.log('LightingSystem initialized with PERSISTENT lighting zone handling');
        
        // Add a debug visualization method call after a delay
        // to help verify zone creation
        if (this.scene.physics.config.debug) {
            this.scene.time.delayedCall(1000, this.debugZones, [], this);
            this.setupDebugVisuals();
        }
    }
    
    /**
     * Initialize the advanced lighting pipeline
     */
    initLightPipeline() {
        try {
            // Check if the renderer supports the light pipeline
            if (!this.scene.sys.renderer || !this.scene.sys.renderer.pipelines || 
                !this.scene.sys.game.renderer.pipelines.get('Light2D')) {
                console.warn('Light2D pipeline not available in this browser or Phaser build');
                return false;
            }
            
            // Enable the lighting system
            this.scene.lights.enable();
            this.scene.lights.setAmbientColor(0x808080); // Set ambient light to 50% gray
            
            // Get the obstacles layer from tilemap system
            if (this.scene.tilemapSystem && this.scene.tilemapSystem.map) {
                const obstaclesLayer = this.scene.tilemapSystem.map.getLayer('Obstacles')?.tilemapLayer;
                
                if (obstaclesLayer) {
                    // Set up Light2D pipeline for obstacles
                    obstaclesLayer.setPipeline('Light2D');
                    
                    // Get all tilesets used by the obstacles layer
                    const tilesets = obstaclesLayer.tileset;
                    
                    // Check each tileset for normal maps
                    tilesets.forEach(tileset => {
                        // Check if the tileset has a normal map defined
                        const normalMapKey = `${tileset.name}_n`;
                        if (this.scene.textures.exists(normalMapKey)) {
                            console.log(`Found normal map for tileset: ${tileset.name}`);
                            // Set the normal map for this tileset
                            tileset.setNormalMap(normalMapKey);
                        } else {
                            console.log(`No normal map found for tileset: ${tileset.name}`);
                        }
                    });
                }
            }
            
            console.log('Light2D pipeline enabled for obstacles');
            return true;
            
        } catch (error) {
            console.error('Error initializing light pipeline:', error);
            return false;
        }
    }
    
    /**
     * Create the light mask for obstacles
     */
    createLightMask() {
        // Find the obstacles layer from the tilemap system
        if (!this.scene.tilemapSystem || !this.scene.tilemapSystem.layers) {
            console.warn('No tilemap system available for light masking');
            return;
        }
        
        // Try to find obstacles layer (case-insensitive)
        const obstaclesLayerKey = Object.keys(this.scene.tilemapSystem.layers)
            .find(key => key.toLowerCase().includes('obstacle'));
            
        if (!obstaclesLayerKey) {
            console.warn('No obstacles layer found for light masking');
            return;
        }
        
        const obstaclesLayer = this.scene.tilemapSystem.layers[obstaclesLayerKey];
        
        // Enable the mask for the obstacles layer
        if (obstaclesLayer && obstaclesLayer.setPipeline) {
            obstaclesLayer.setPipeline('Light2D');
            this.lightMask = obstaclesLayer;
            console.log('Light mask applied to obstacles layer');
        }
    }
    
    /**
     * Create a point light
     * @param {number} x - X position of the light
     * @param {number} y - Y position of the light
     * @param {number} color - Light color (hexadecimal)
     * @param {number} radius - Light radius
     * @param {number} intensity - Light intensity (0-1)
     * @returns {Phaser.GameObjects.Light} The created light
     */
    createPointLight(x, y, color = 0xffffff, radius = 200, intensity = 1) {
        try {
            // Skip if the light pipeline is not available
            if (!this.scene.sys.game.renderer.pipelines.get('Light2D')) {
                console.warn('Light2D pipeline not available');
                return null;
            }
            
            // Create the light
            const light = this.scene.lights.addLight(x, y, radius, color, intensity);
            
            // Store the light for later reference
            this.pointLights.push(light);
            
            console.log(`Created point light at (${x}, ${y}) with radius ${radius}`);
            return light;
        } catch (error) {
            console.error('Error creating point light:', error);
            return null;
        }
    }
    
    /**
     * Create a player light that follows the player
     * @param {number} radius - Light radius
     * @param {number} color - Light color (hexadecimal)
     * @param {number} intensity - Light intensity (0-1)
     * @returns {Object} An object containing the light and update method
     */
    createPlayerLight(radius = 150, color = 0xffff99, intensity = 0.8) {
        if (!this.player) {
            console.warn('No player available for player light');
            return null;
        }
        
        // Create the light at the player's current position
        const playerX = this.player.sprite ? this.player.sprite.x : this.player.x;
        const playerY = this.player.sprite ? this.player.sprite.y : this.player.y;
        
        const light = this.createPointLight(playerX, playerY, color, radius, intensity);
        if (!light) return null;
        
        // Create an object to track this specific light
        const playerLight = {
            light,
            radius,
            color,
            intensity,
            offsetX: 0,
            offsetY: -20, // Slightly above player
            
            // Update method to follow player
            update: () => {
                if (!this.player || !light) return;
                
                const playerX = this.player.sprite ? this.player.sprite.x : this.player.x;
                const playerY = this.player.sprite ? this.player.sprite.y : this.player.y;
                
                light.x = playerX + playerLight.offsetX;
                light.y = playerY + playerLight.offsetY;
            }
        };
        
        console.log('Created player light');
        return playerLight;
    }
    
    /**
     * Update all point lights
     */
    updatePointLights() {
        // This method is called in the main update loop
        // to update any dynamic lights (like the player light)
        
        // For now we have nothing to do here since our lights
        // either have their own update methods or are static
    }
    
    /**
     * Set the player reference
     * @param {Object} player - The player entity
     */
    setPlayer(player) {
        if (!player) {
            console.warn('LightingSystem.setPlayer: No player provided');
            return;
        }
        
        this.player = player;
        
        // Log player properties to help with debugging
        if (this.scene.physics.config.debug) {
            console.log('LightingSystem player reference set:', {
                hasSprite: Boolean(player.sprite),
                type: typeof player,
                keys: Object.keys(player)
            });
            
            // Get player position for validation
            const x = player.sprite ? player.sprite.x : player.x;
            const y = player.sprite ? player.sprite.y : player.y;
            
            console.log(`LightingSystem player position: (${x}, ${y})`);
        }
        
        // Once the player is set, try to find the magenta marker
        if (player.sprite) {
            // Wait a short time to ensure the texture is fully loaded
            this.scene.time.delayedCall(100, () => {
                this.findMagentaMarkerPosition();
            });
        }
    }
    
    /**
     * Process lighting zones from map data
     * @param {Phaser.Tilemaps.Tilemap} map - The tilemap containing lighting zones
     */
    processLightingZones(map) {
        // Clear existing zones first
        this.lightingZones = [];
        
        if (!map) {
            console.error('No map provided to process lighting zones');
            return;
        }
        
        // Preload any custom mask images that might be used by lights
        this.preloadCustomMaskImages(map);
        
        try {
            console.log('Processing lighting zones from map...');
            
            // Check if map has object layers
            if (!map.objects || !map.objects.length) {
                console.warn('Map has no object layers');
                return;
            }
            
            // Try to get all object layer names first using map.getObjectLayerNames() if available
            let objectLayerNames = [];
            if (typeof map.getObjectLayerNames === 'function') {
                objectLayerNames = map.getObjectLayerNames();
                console.log('Available object layers:', objectLayerNames.join(', '));
            } else {
                // Fallback if getObjectLayerNames is not available
                objectLayerNames = map.objects.map(layer => layer.name);
                console.log('Object layers from map.objects:', objectLayerNames.join(', '));
            }
            
            // Look for specific lighting layer names (case-insensitive)
            const potentialLayerNames = ['Lighting', 'lighting', 'LIGHTING', 'light', 'lights'];
            let lightingLayer = null;
            
            // First try to find exact matches using getObjectLayer
            if (typeof map.getObjectLayer === 'function') {
                for (const layerName of potentialLayerNames) {
                    if (objectLayerNames.some(name => name.toLowerCase() === layerName.toLowerCase())) {
                        lightingLayer = map.getObjectLayer(
                            objectLayerNames.find(name => name.toLowerCase() === layerName.toLowerCase())
                        );
                        if (lightingLayer) {
                            console.log(`Found lighting layer: ${lightingLayer.name}`);
                            break;
                        }
                    }
                }
            }
            
            // If still not found, look through all object layers
            if (!lightingLayer && map.objects) {
                lightingLayer = map.objects.find(layer => 
                    layer.name && layer.name.toLowerCase() === 'lighting'
                );
                
                if (lightingLayer) {
                    console.log(`Found custom lights layer: ${lightingLayer.name}`);
                }
            }
            
            if (!lightingLayer) {
                console.log('No custom lights layer found in map');
                return;
            }
            
            // Process the lighting layer if found
            if (lightingLayer && lightingLayer.objects && lightingLayer.objects.length > 0) {
                console.log(`Processing ${lightingLayer.objects.length} objects from layer: ${lightingLayer.name}`);
                
                // First process bright zones to ensure they're at the start of the array
                const brightZones = [];
                const otherZones = [];
                
                lightingLayer.objects.forEach(obj => {
                    // Lighting zones must be rectangle objects with width and height
                    if (!obj.width || !obj.height) {
                        console.warn(`Skipping non-rectangle lighting zone at (${obj.x}, ${obj.y})`);
                        return;
                    }
                    
                    // Get zone type (from properties, type, or name)
                    let zoneType = 'default';
                    
                    // First check object properties array
                    if (obj.properties && Array.isArray(obj.properties)) {
                        const typeProperty = obj.properties.find(prop => 
                            prop.name === 'type' || prop.name === 'lightType'
                        );
                        
                        if (typeProperty) {
                            zoneType = typeProperty.value.toLowerCase();
                        }
                    }
                    
                    // Then check object type field
                    if (zoneType === 'default' && obj.type) {
                        zoneType = obj.type.toLowerCase();
                    }
                    
                    // Finally check object name
                    if (zoneType === 'default' && obj.name) {
                        zoneType = obj.name.toLowerCase();
                    }
                    
                    // Validate the zone type
                    if (!this.zoneLevels.hasOwnProperty(zoneType)) {
                        console.warn(`Unknown lighting zone type: ${zoneType}, defaulting to 'default'`);
                        zoneType = 'default'; 
                    }
                    
                    // Create the lighting zone
                    const zone = {
                        x: obj.x,
                        y: obj.y,
                        width: obj.width,
                        height: obj.height,
                        type: zoneType,
                        rect: new Phaser.Geom.Rectangle(obj.x, obj.y, obj.width, obj.height)
                    };
                    
                    // Sort zones by type
                    if (zoneType === 'bright') {
                        brightZones.push(zone);
                    } else {
                        otherZones.push(zone);
                    }
                    
                    console.log(`Added ${zoneType} lighting zone at (${obj.x}, ${obj.y}) with size ${obj.width}x${obj.height}`);
                });
                
                // Combine zones with bright zones first
                this.lightingZones = [...brightZones, ...otherZones];
                
                console.log(`Processed ${this.lightingZones.length} lighting zones (${brightZones.length} bright zones)`);
                
                // Create debug visuals for all zones
                this.lightingZones.forEach(zone => this.createDebugVisual(zone));
            } else {
                console.warn('No valid lighting layer found in the map, or layer has no objects');
            }
            
            console.log('Lighting zones processed with bright zones prioritized');
            
        } catch (error) {
            console.error('Error processing lighting zones:', error);
        }
    }
    
    /**
     * Create debug visuals for lighting zones
     * @param {Object} zone - The lighting zone
     */
    createDebugVisual(zone) {
        // Only create if debug is enabled
        if (!this.scene.physics.config.debug) return;
        
        const colors = {
            'default': 0x0000ff,   // Blue
            'bright': 0x00ffff,    // Cyan
            'dim': 0x00ff00,       // Green
            'dark': 0xffff00,      // Yellow
            'black': 0xff0000      // Red
        };
        
        const color = colors[zone.type] || 0x0000ff;
        const graphics = this.scene.add.graphics();
        graphics.lineStyle(2, color, 0.5);
        graphics.strokeRect(zone.x, zone.y, zone.width, zone.height);
        graphics.setDepth(100);
        
        // Add text label
        const text = this.scene.add.text(
            zone.x + zone.width / 2, 
            zone.y + zone.height / 2, 
            zone.type, 
            { 
                font: '14px Arial',
                fill: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 3, y: 3 }
            }
        );
        text.setOrigin(0.5, 0.5);
        text.setDepth(100);
    }
    
    /**
     * Create the lighting overlay
     */
    createOverlay() {
        if (this.overlay) return;
        
        const camera = this.scene.cameras.main;
        
        // Create a full-screen black rectangle for lighting effects
        this.overlay = this.scene.add.rectangle(
            camera.width / 2,
            camera.height / 2,
            camera.width,
            camera.height,
            0x000000
        );
        
        // Set the alpha to 0 initially (fully transparent)
        this.overlay.setAlpha(0);
        
        // Make sure it stays on top of the game world
        this.overlay.setScrollFactor(0);
        
        // Fix the overlay to the camera
        this.overlay.setDepth(900);
        
        // Make sure it's actually visible
        this.overlay.setVisible(true);

        // The flashlight mask will be applied later when initialized
        
        // Create debug text display if debug is enabled
        if (this.scene.physics.config.debug) {
            this.debugText = this.scene.add.text(
                10, 10, 
                'Lighting: default', 
                { 
                    font: '16px Arial',
                    fill: '#ffffff',
                    backgroundColor: '#000000',
                    padding: { x: 5, y: 5 }
                }
            );
            this.debugText.setScrollFactor(0);
            this.debugText.setDepth(1000);
        }
        
        console.log('Created lighting overlay');
        
        // Apply lighting to obstacles without changing how they were loaded
        this.scene.time.delayedCall(100, () => {
            console.log('[LIGHT] Applying lighting to obstacles...');
            this.applyLightingToObstacles();
        });
        
        // Set up listener for jellyfish to apply lighting when they're spawned
        this.scene.time.delayedCall(500, () => {
            console.log('[LIGHT] Checking for jellyfish to apply lighting...');
            this.applyLightingToJellyfish();
        });
        
        // Also set up a timer to periodically check for new jellyfish
        this.jellyfishCheckTimer = this.scene.time.addEvent({
            delay: 2000,
            callback: () => this.applyLightingToJellyfish(),
            callbackScope: this,
            loop: true
        });
    }
    
    /**
     * Update the debug text display
     */
    updateDebugText() {
        if (!this.debugText || !this.scene.physics.config.debug) return;
        
        let progressText = '';
        if (this.transitionActive) {
            const elapsed = this.scene.time.now - (this.transitionStartTime || 0);
            const progress = Math.min(1, elapsed / Math.max(1, this.transitionDuration));
            progressText = ` (${(progress * 100).toFixed(0)}%)`;
        }
        
        // Enhanced debug information with zone count and current zone status
        this.debugText.setText(
            `Lighting: ${this.currentZoneType || 'default'} (${this.currentLightLevel.toFixed(2)})${progressText}\n` +
            `Total Zones: ${this.lightingZones.length}, Target: ${this.targetLightLevel.toFixed(2)}`
        );
    }
    
    /**
     * Handle window resize events
     */
    handleResize() {
        if (!this.overlay) return;
        
        const camera = this.scene.cameras.main;
        
        // Update the overlay size to match the camera
        this.overlay.width = camera.width;
        this.overlay.height = camera.height;
        this.overlay.setPosition(camera.width / 2, camera.height / 2);
        
        // Update flashlight overlay if it exists
        if (this.flashlightOverlay) {
            this.flashlightOverlay.setPosition(
                camera.scrollX + camera.width / 2,
                camera.scrollY + camera.height / 2
            );
            this.flashlightOverlay.setSize(camera.width, camera.height);
        }
        
        // Force redraw
        this.overlay.setAlpha(this.overlay.alpha);
        
        // Reposition debug text if it exists
        if (this.debugText) {
            this.debugText.setPosition(10, 10);
        }
        
        console.log('Resized lighting overlay and flashlight');
    }
    
    /**
     * Handle player vertical boost transitions
     * Called when player is detected to be vertically boosting through zones
     * @param {string} targetZoneType - The target zone type 
     * @param {number} targetLevel - The target light level
     * @param {boolean} enteringDarkArea - Whether we're entering a dark area
     * @param {number} distanceMoved - How far the player moved this frame
     */
    handleVerticalBoostTransition(targetZoneType, targetLevel, enteringDarkArea, distanceMoved) {
        // Current time for tracking
        const currentTime = this.scene.time.now;
        
        console.log(`VERTICAL BOOST TRANSITION: to ${targetZoneType} zone`);
        console.log(`  Distance moved: ${distanceMoved.toFixed(2)} pixels`);
        console.log(`  Entering dark area: ${enteringDarkArea}`);
        
        // Store transition start state
        this.transitionStartTime = currentTime;
        this.transitionStartValue = this.currentLightLevel;
        
        // Set target light level and zone type
        this.targetLightLevel = targetLevel;
        this.currentZoneType = targetZoneType;
        this.lastProcessedZoneType = targetZoneType;
        
        // CRITICAL: Update the last non-default zone when we transition
        this.lastNonDefaultZoneType = targetZoneType;
        this.lastNonDefaultZoneLevel = targetLevel;
        
        // CRITICAL: Immediate transition for boosting to make sure effect is visible
        this.transitionDuration = Math.max(100, 200 / Math.min(3, Math.max(1, distanceMoved / 100)));
        
        // Extended cooldown to prevent immediate reversion
        this.lastZoneEnterTime = currentTime + 5000; // Add significant extra cooldown
        
        console.log(`  Fast transition: ${this.transitionDuration}ms`);
        console.log(`  Extended cooldown until: ${(this.lastZoneEnterTime - currentTime)}ms from now`);
    }

    /**
     * Update lighting based on player position
     * @param {number} delta - Time elapsed since last update
     */
    update(delta) {
        // Debug log for persistence mode (only once)
        if (!this.persistenceLogged && this.scene.time.now > 2000) {
            console.log(`[LIGHTING] Persistence mode is ${this.persistentMode ? 'ENABLED' : 'DISABLED'}`);
            console.log(`[LIGHTING] Lighting will ${this.persistentMode ? 'PERSIST when leaving zones' : 'RESET to default when leaving zones'}`);
            this.persistenceLogged = true;
        }
        
        // Update player light position if available
        if (this.playerLight) {
            this.playerLight.update();
        }
        
        // Update default player light that prevents initial darkness
        this.updatePlayerDefaultLight();
        
        // Update custom lights
        this.updateCustomLights(this.scene.time.now, delta);
        
        // Skip the rest of the update if no player is available
        if (!this.player) return;
        
        // Update flashlight position and rotation if enabled
        if (this.flashlightEnabled) {
            this.updateFlashlight();
        }
        
        // Map objects loaded - check for lighting zones
        if (this.lightingZones.length > 0) {
            this.updatePlayerZone();
        }
        
        // Handle any active transitions
        if (this.transitionActive) {
            this.updateTransition(delta);
        }
        
        // ADDED: Apply lighting to jellyfish if we have any
        if (this.scene.jellyfishSystem && this.scene.jellyfishSystem.jellyfish?.length > 0) {
            // Check if we've already applied lighting
            let jellyfishLit = false;
            if (this.jellyfishGlows && this.jellyfishGlows.length > 0) {
                jellyfishLit = true;
                // Update existing jellyfish lighting positions
                this.updateJellyfishGlows();
            }
            
            // If no jellyfish are lit yet, apply lighting
            if (!jellyfishLit) {
                this.applyLightingToJellyfish();
            }
        }
        
        // ADDED: Apply lighting to charge pickups if we have any
        if (this.scene.jellyfishSystem && this.scene.jellyfishSystem.chargePickups?.length > 0) {
            // Check if we need to update existing charge pickups or add new ones
            if (this.chargePickupGlows && this.chargePickupGlows.length > 0) {
                // Update existing charge pickup lighting positions
                this.updateChargePickupGlows();
                
                // Check for any new pickups that need lighting
                if (this.scene.jellyfishSystem.chargePickups.length > this.chargePickupGlows.length) {
                    this.applyLightingToChargePickups();
                }
            } else {
                // No charge pickups lit yet, apply lighting
                this.applyLightingToChargePickups();
            }
        }
        
        // Debug text updates
        if (this.debugText && this.debugMode) {
            this.updateDebugText();
        }
    }
    
    /**
     * Process light objects from a Tiled map
     * @param {Phaser.Tilemaps.Tilemap} map - The map containing light objects
     */
    processLightObjects(map) {
        if (!map || !map.objects) {
            console.warn('No map objects found for creating lights');
            return;
        }
        
        // Try to get the Lights object layer
        let lightsLayer = null;
        
        // Try different approaches to find the lights layer
        if (typeof map.getObjectLayer === 'function') {
            // Try different common names for lights layer
            ['Lights', 'lights', 'LightObjects', 'lightObjects'].forEach(name => {
                if (!lightsLayer) {
                    const layer = map.getObjectLayer(name);
                    if (layer) {
                        lightsLayer = layer;
                        console.log(`Found lights layer using getObjectLayer('${name}')`);
                    }
                }
            });
        }
        
        // If not found with getObjectLayer, try the objects array directly
        if (!lightsLayer && map.objects) {
            // Find any layer with a name containing 'light' (case insensitive)
            lightsLayer = map.objects.find(layer => 
                layer.name && layer.name.toLowerCase().includes('light') &&
                !layer.name.toLowerCase().includes('lighting') // Exclude the lighting zones layer
            );
            
            if (lightsLayer) {
                console.log(`Found lights layer in objects array: ${lightsLayer.name}`);
            }
        }
        
        if (!lightsLayer) {
            console.warn('No Lights layer found in map for creating point lights');
            return;
        }
        
        console.log(`Processing ${lightsLayer.objects?.length || 0} light objects`);
        
        // Initialize the light pipeline if we have light objects
        if (lightsLayer.objects && lightsLayer.objects.length > 0) {
            const pipelineReady = this.initLightPipeline();
            
            if (!pipelineReady) {
                console.warn('Light pipeline initialization failed, skipping point lights');
                return;
            }
            
            // Process each light object
            lightsLayer.objects.forEach(obj => {
                // Extract light properties
                let color = 0xffffff;
                let radius = 200;
                let intensity = 1;
                
                // Check for custom properties
                if (obj.properties && Array.isArray(obj.properties)) {
                    obj.properties.forEach(prop => {
                        if (prop.name === 'color' && prop.value) {
                            // Handle color in different formats
                            if (typeof prop.value === 'string') {
                            if (prop.value.startsWith('#')) {
                                color = parseInt(prop.value.substring(1), 16);
                            } else if (prop.value.startsWith('0x')) {
                                color = parseInt(prop.value, 16);
                                } else if (prop.value.startsWith('[') && prop.value.includes(',')) {
                                    // Handle Tiled's RGB array format: [r, g, b] (a)
                                    try {
                                        // Extract the RGB values from the string
                                        const rgbMatch = prop.value.match(/\[(\d+),\s*(\d+),\s*(\d+)\]/);
                                        if (rgbMatch && rgbMatch.length >= 4) {
                                            const r = parseInt(rgbMatch[1], 10);
                                            const g = parseInt(rgbMatch[2], 10);
                                            const b = parseInt(rgbMatch[3], 10);
                                            
                                            // Convert RGB to hex format
                                            color = (r << 16) | (g << 8) | b;
                                            console.log(`Parsed Tiled RGB color [${r}, ${g}, ${b}] to hex: 0x${color.toString(16)}`);
                                        }
                                    } catch (e) {
                                        console.error('Error parsing Tiled RGB color format:', e);
                                    }
                            } else {
                                color = parseInt(prop.value);
                                }
                            } else if (typeof prop.value === 'number') {
                                color = prop.value;
                            } else if (Array.isArray(prop.value) && prop.value.length >= 3) {
                                // Handle array of RGB values directly
                                const [r, g, b] = prop.value;
                                color = (r << 16) | (g << 8) | b;
                                console.log(`Parsed Tiled RGB array [${r}, ${g}, ${b}] to hex: 0x${color.toString(16)}`);
                            }
                        } else if (prop.name === 'radius') {
                            radius = parseInt(prop.value, 10) || radius;
                        } else if (prop.name === 'intensity') {
                            intensity = parseFloat(prop.value) || intensity;
                        }
                    });
                }
                
                // Create the point light
                this.createPointLight(obj.x, obj.y, color, radius, intensity);
            });
            
            console.log(`Created ${this.pointLights.length} point lights`);
        }
    }
    
    /**
     * Add a light that follows the player
     */
    addPlayerLight() {
        if (!this.player) {
            console.warn('Cannot add player light - no player available');
            return;
        }
        
        // No need for pipeline initialization
        this.playerLight = {
            update: () => {
                // Update will be handled in the main update method
            }
        };
        
        console.log('Added player light');
    }
    
    /**
     * Debug method to visualize lighting zones and check map structure
     */
    debugZones() {
        console.log('=== LIGHTING SYSTEM DEBUG ===');
        console.log('Lighting zones:', this.lightingZones.length);
        console.log('Current lighting state:', {
            currentZoneType: this.currentZoneType,
            currentLightLevel: this.currentLightLevel,
            targetLightLevel: this.targetLightLevel
        });
        console.log('Player reference:', this.player ? 'Set' : 'Not set');
        
        if (this.player) {
            console.log('Player type:', typeof this.player);
            console.log('Player properties:', Object.keys(this.player));
            if (this.player.sprite) {
                console.log('Player position:', {
                    x: this.player.sprite.x,
                    y: this.player.sprite.y
                });
            }
        }
        
        if (this.scene.map && this.scene.map.objects) {
            console.log('Map object layers:');
            this.scene.map.objects.forEach((layer, index) => {
                console.log(`Layer ${index}: ${layer.name} - ${layer.objects?.length || 0} objects`);
                if (layer.objects && layer.objects.length > 0) {
                    console.log('First object properties:', {
                        type: layer.objects[0].type,
                        name: layer.objects[0].name,
                        x: layer.objects[0].x,
                        y: layer.objects[0].y,
                        width: layer.objects[0].width,
                        height: layer.objects[0].height,
                        properties: layer.objects[0].properties || 'none'
                    });
                }
            });
        } else if (this.scene.tilemapSystem && this.scene.tilemapSystem.map) {
            const map = this.scene.tilemapSystem.map;
            console.log('Map from tilemapSystem - object layers:');
            map.objects.forEach((layer, index) => {
                console.log(`Layer ${index}: ${layer.name} - ${layer.objects?.length || 0} objects`);
            });
        }
        
        console.log('Overlay status:', this.overlay ? {
            visible: this.overlay.visible,
            alpha: this.overlay.alpha,
            depth: this.overlay.depth,
            position: { x: this.overlay.x, y: this.overlay.y }
        } : 'Not created');
        
        console.log('=== END DEBUG ===');
    }

    /**
     * Initialize the flashlight effect
     * @param {string} customMaskKey - Optional key for a custom mask image
     */
    initializeFlashlight(customMaskKey = null) {
        console.log('Initializing flashlight');
        
        // Make sure we have an overlay
        if (!this.overlay) {
            this.createOverlay();
        }
        
        // Ensure any previous mask is cleaned up
        if (this.flashlightMask) {
            this.flashlightMask.destroy();
        }
        
        // Create a fresh graphics object for the mask
        this.flashlightMask = this.scene.make.graphics({add: false});
        
        // Important: Reset the mask's position
        this.flashlightMask.x = 0;
        this.flashlightMask.y = 0;
        
        // Create the magenta point light at the origin for visual effect
        if (!this.flashlightPointLight) {
            this.flashlightPointLight = this.scene.add.sprite(0, 0, 'bullet')
                .setScale(0.4)
                .setAlpha(0.8)
                .setTint(0xff00ff) // Magenta color
                .setBlendMode(Phaser.BlendModes.ADD)
                .setDepth(902)
                .setOrigin(0.5, 0.5) // IMPORTANT: Center origin for rotation
                .setVisible(false);
        }
            
        // Add a simple glow effect for the flashlight origin
        if (!this.flashlightGlow) {
            this.flashlightGlow = this.scene.add.sprite(0, 0, 'bullet')
                .setScale(0.7)
                .setAlpha(0.7)
                .setTint(0xff40ff) // Slightly lighter magenta
                .setBlendMode(Phaser.BlendModes.ADD)
                .setDepth(901)
                .setOrigin(0.5, 0.5) // IMPORTANT: Center origin for rotation
                .setVisible(false);
        }
            
        // Check if we're using a custom mask image
        if (customMaskKey && this.scene.textures.exists(customMaskKey)) {
            console.log(`Using custom mask image: ${customMaskKey}`);
            
            // Create the mask from the custom image
            this.customMaskImage = this.scene.make.image({
                x: 0,
                y: 0,
                key: customMaskKey,
                add: false // Important: don't add to display list
            });
            
            // Create a bitmap mask from the image
            this.lightMask = this.customMaskImage.createBitmapMask();
            
            // Important fix: Bitmap masks use invertAlpha property, not setInvertAlpha method
            this.lightMask.invertAlpha = true;
            
            // We're using a custom image mask
            this.usingCustomMask = true;
        } else {
            console.log('Using geometry-based mask');
            
            // Draw a default cone shape
            this.flashlightMask.clear();
            this.flashlightMask.fillStyle(0xffffff);
            
            // Draw a directional cone shape
            const defaultAngle = 0; // Default facing right
            const coneAngle = Math.PI / 2.5; // Wider cone (~72 degrees)
            const coneLength = 250; // Longer cone
            
            // Draw the main cone with gradient
            const steps = 5; // Add gradient steps
            for (let step = 0; step < steps; step++) {
                const stepLength = coneLength * (1 - step/steps);
                const stepWidth = coneAngle * (1 - step/(steps*2));
                const alpha = 1 - (step/steps) * 0.2; // Fade slightly at each step
                
                this.flashlightMask.fillStyle(0xffffff, alpha);
                this.flashlightMask.beginPath();
                this.flashlightMask.moveTo(0, 0);
                this.flashlightMask.lineTo(
                    Math.cos(defaultAngle - stepWidth/2) * stepLength,
                    Math.sin(defaultAngle - stepWidth/2) * stepLength
                );
                this.flashlightMask.arc(
                    0, 0,
                    stepLength,
                    defaultAngle - stepWidth/2,
                    defaultAngle + stepWidth/2
                );
                this.flashlightMask.lineTo(0, 0);
                this.flashlightMask.fillPath();
            }
            
            // Add a bright inner cone
            this.flashlightMask.fillStyle(0xffffff, 1);
            this.flashlightMask.beginPath();
            this.flashlightMask.moveTo(0, 0);
            this.flashlightMask.lineTo(
                Math.cos(defaultAngle - coneAngle/4) * (coneLength/2),
                Math.sin(defaultAngle - coneAngle/4) * (coneLength/2)
            );
            this.flashlightMask.arc(
                0, 0,
                coneLength/2,
                defaultAngle - coneAngle/4,
                defaultAngle + coneAngle/4
            );
            this.flashlightMask.lineTo(0, 0);
            this.flashlightMask.fillPath();
            
            // Add a bright center point
            this.flashlightMask.fillStyle(0xffffff, 1);
            this.flashlightMask.fillCircle(0, 0, 10);
            
            // Create a geometry mask from the graphics object
            this.lightMask = this.flashlightMask.createGeometryMask();
            
            // We're using the geometry-based mask
            this.usingCustomMask = false;
            
            // For geometry masks, use setInvertAlpha method
            this.lightMask.setInvertAlpha(true);
        }
        
        // Apply the mask to the darkness overlay
        this.overlay.setMask(this.lightMask);
        
        // Try to locate the magenta marker pixel
        this.findMagentaMarkerPosition();
        
        console.log('Flashlight initialized');
    }
    
    /**
     * Find the position of the magenta marker (#FF00FF) in the player sprite
     * This will be used as the origin point for the flashlight
     */
    findMagentaMarkerPosition() {
        if (!this.player || !this.player.sprite) return;
        
        try {
            // Get the texture key of the player sprite
            const textureKey = this.player.sprite.texture.key;
            
            // Use Phaser's getPixel function to analyze the texture
            const texture = this.scene.textures.get(textureKey);
            
            if (!texture) {
                console.warn(`Could not find texture for player: ${textureKey}`);
                return;
            }
            
            // Get the frame dimensions
            const sourceImage = texture.source[0].image;
            const frameWidth = texture.frames.__BASE.width;
            const frameHeight = texture.frames.__BASE.height;
            
            console.log(`Analyzing player texture: ${textureKey} (${frameWidth}x${frameHeight})`);
            
            // Create a canvas to draw the texture for pixel analysis
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = frameWidth;
            canvas.height = frameHeight;
            
            // Draw the image to the canvas
            ctx.drawImage(sourceImage, 0, 0);
            
            // Get image data
            const imageData = ctx.getImageData(0, 0, frameWidth, frameHeight);
            const pixels = imageData.data;
            
            // The #FF00FF color in RGBA is [255, 0, 255, 255]
            // Look for this specific color
            let markerX = -1;
            let markerY = -1;
            
            for (let y = 0; y < frameHeight; y++) {
                for (let x = 0; x < frameWidth; x++) {
                    const i = (y * frameWidth + x) * 4;
                    
                    // Check if this pixel is #FF00FF (magenta)
                    if (pixels[i] === 255 && pixels[i+1] === 0 && pixels[i+2] === 255 && pixels[i+3] === 255) {
                        markerX = x;
                        markerY = y;
                        console.log(`Found magenta marker at local coordinates: (${x}, ${y})`);
                        break;
                    }
                }
                if (markerX !== -1) break; // Stop if we found the marker
            }
            
            if (markerX !== -1 && markerY !== -1) {
                // Store the marker position as relative offsets from the sprite center
                // This accounts for the sprite's origin point
                this.markerOffsetX = markerX - (frameWidth * this.player.sprite.originX);
                this.markerOffsetY = markerY - (frameHeight * this.player.sprite.originY);
                
                console.log(`Marker offset from sprite center: (${this.markerOffsetX}, ${this.markerOffsetY})`);
                return true;
            } else {
                console.warn('No magenta marker (#FF00FF) found in player sprite');
                return false;
            }
        } catch (error) {
            console.error('Error finding magenta marker:', error);
            return false;
        }
    }

    /**
     * Update the flashlight position and rotation
     * This method serves as a bridge to the updateFlashlightCone method
     */
    updateFlashlight() {
        // Simply call the existing flashlight cone update method
        this.updateFlashlightCone();
    }

    /**
     * Update the flashlight cone position and rotation
     */
    updateFlashlightCone() {
        if (!this.flashlightEnabled || !this.player) return;

        // Get diver arm directly from scene
        const diverArm = this.scene.diverArm;
        if (!diverArm) return;

        // Use raw angle (trueDirection) for both position and rotation
        const angle = diverArm.trueDirection;
        
        // Check if player is facing left
        const isFacingLeft = diverArm.isFacingLeft;
        
        // Use the arm's tip position directly
        let x, y;
        
        // Check if tip position is available from the arm
        if (diverArm.tipX !== undefined && diverArm.tipY !== undefined) {
            // Use the pre-calculated tip position directly
            x = diverArm.tipX;
            y = diverArm.tipY;
        } else {
            // Fallback calculation if tip position is not available
            const armLength = 70;
            x = diverArm.x + Math.cos(angle) * armLength;
            y = diverArm.y + Math.sin(angle) * armLength;
        }

        // Update flashlight position and rotation using raw angle
        this.flashlightPointLight.setPosition(x, y);
        this.flashlightPointLight.setRotation(angle);
        
        if (this.flashlightGlow) {
            this.flashlightGlow.setPosition(x, y);
            this.flashlightGlow.setRotation(angle);
        }

        // Define cone angle before using it - this was missing
        const coneAngle = Math.PI / 2.5; // ~72 degree cone
        const coneLength = 250;

        // Handle mask based on whether we're using a custom mask or not
        if (this.usingCustomMask && this.customMaskImage) {
            // For custom image masks, update position and rotation directly
            this.customMaskImage.setPosition(x, y);
            this.customMaskImage.setRotation(angle);
            
            // Recreate the bitmap mask to ensure it's properly updated
            this.overlay.clearMask();
            this.lightMask = this.customMaskImage.createBitmapMask();
            this.lightMask.invertAlpha = true;
            this.overlay.setMask(this.lightMask);
        } else {
            // For geometry-based masks, completely recreate
            this.overlay.clearMask();
            if (this.flashlightMask) {
                this.flashlightMask.destroy();
            }
            this.flashlightMask = this.scene.make.graphics({add: false});
            
            // Position the mask at the exact same coordinates as the pin light
            this.flashlightMask.x = x;
            this.flashlightMask.y = y;
            
            // Create cone shape pointing in the direction of angle
            const graphics = this.flashlightMask;
            graphics.fillStyle(0xffffff, 1);
            
            // Draw arc for the cone
            
            // Draw the main cone with gradient
            const steps = 5; // Add gradient steps
            for (let step = 0; step < steps; step++) {
                const stepLength = coneLength * (1 - step/steps);
                const stepWidth = coneAngle * (1 - step/(steps*2));
                const alpha = 1 - (step/steps) * 0.2; // Fade slightly at each step
                
                graphics.fillStyle(0xffffff, alpha);
                graphics.beginPath();
                graphics.moveTo(0, 0);
                graphics.lineTo(
                    Math.cos(angle - stepWidth/2) * stepLength,
                    Math.sin(angle - stepWidth/2) * stepLength
                );
                graphics.arc(
                    0, 0,
                    stepLength,
                    angle - stepWidth/2,
                    angle + stepWidth/2
                );
                graphics.lineTo(0, 0);
                graphics.fillPath();
            }
            
            // Add a bright inner cone
            graphics.fillStyle(0xffffff, 1);
            graphics.beginPath();
            graphics.moveTo(0, 0);
            graphics.lineTo(
                Math.cos(angle - coneAngle/4) * (coneLength/2),
                Math.sin(angle - coneAngle/4) * (coneLength/2)
            );
            graphics.arc(
                0, 0,
                coneLength/2,
                angle - coneAngle/4,
                angle + coneAngle/4
            );
            graphics.lineTo(0, 0);
            graphics.fillPath();
            
            // For better visualization, add an inner circle at origin
            graphics.fillStyle(0xffffff, 1);
            graphics.fillCircle(0, 0, 10); // Small circle at origin
            
            // Create a fresh geometry mask
            this.lightMask = this.flashlightMask.createGeometryMask();
            this.lightMask.setInvertAlpha(true);
            
            // Apply the mask to the overlay
            this.overlay.setMask(this.lightMask);
        }
        
        // Calculate if the flashlight is illuminating other objects
        // This is for visual effect only and doesn't affect the mask
        // First, check if the flashlight is pointing at the player or another target
        this.applyFlashlightIllumination(x, y, angle, coneAngle, coneLength);
        
        // Debug logging
        if (this.scene?.physics?.config?.debug) {
            console.log(`Flashlight updated - angle: ${Phaser.Math.RadToDeg(angle).toFixed(1)}°, ` +
                       `position: (${x.toFixed(1)}, ${y.toFixed(1)}), ` +
                       `using: ${this.usingCustomMask ? 'custom image mask' : 'geometry mask'}`);
        }
    }
    
    /**
     * Apply illumination effect to objects in the flashlight beam
     * @param {number} x - Flashlight origin X
     * @param {number} y - Flashlight origin Y
     * @param {number} angle - Beam direction angle
     * @param {number} coneAngle - Beam cone angle
     * @param {number} coneLength - Beam length
     */
    applyFlashlightIllumination(x, y, angle, coneAngle = Math.PI / 2.5, coneLength = 250) {
        if (!this.player || !this.player.sprite) return;
        
        // Cache current time
        const currentTime = this.scene.time.now;
        
        // Calculate player position
        const playerCenterX = this.player.sprite.x;
        const playerCenterY = this.player.sprite.y;
        
        // Vector from flashlight to player center
        const flashToPlayerX = playerCenterX - x;
        const flashToPlayerY = playerCenterY - y;
        
        // Distance from flashlight to player
        const distance = Math.sqrt(flashToPlayerX * flashToPlayerX + flashToPlayerY * flashToPlayerY);
        
        // If player is too far away, skip further calculations
        if (distance > coneLength) {
            // Clear any flashlight tint if this was the source
            if (this.lastFlashlightTime && currentTime - this.lastFlashlightTime > 100) {
                if (!this.lastInfluencingLight) {
                    this.player.sprite.clearTint();
                    if (this.scene.diverArm) {
                        this.scene.diverArm.clearTint();
                    }
                }
                this.lastFlashlightTime = null;
            }
            return;
        }
        
        // Calculate angle between flashlight and player
        const flashToPlayerAngle = Math.atan2(flashToPlayerY, flashToPlayerX);
        
        // Normalize angles for comparison
        const normalizedBeamAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const normalizedTargetAngle = ((flashToPlayerAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        
        // Calculate angular difference (accounting for 2π wrap-around)
        let angleDiff = Math.abs(normalizedBeamAngle - normalizedTargetAngle);
        if (angleDiff > Math.PI) {
            angleDiff = 2 * Math.PI - angleDiff;
        }
        
        // Check if player is within the cone angle
        if (angleDiff <= coneAngle / 2) {
            // Calculate influence based on distance and angle
            // Closer to center of beam = stronger influence
            const distanceFactor = 1 - Math.min(1, distance / coneLength);
            const angleFactor = 1 - (angleDiff / (coneAngle / 2));
            const influence = distanceFactor * angleFactor * 0.7;
            
            // Calculate illumination color (purple/magenta for flashlight)
            const tintR = Math.floor(255 - ((255 - 255) * influence));
            const tintG = Math.floor(255 - ((255 - 100) * influence));
            const tintB = Math.floor(255 - ((255 - 255) * influence));
            
            // Convert RGB back to hex
            const tintColor = (tintR << 16) | (tintG << 8) | tintB;
            
            // Apply tint to player
            this.player.sprite.setTint(tintColor);
            if (this.scene.diverArm) {
                this.scene.diverArm.setTint(tintColor);
            }
            
            // Store the last application time for flashlight
            this.lastFlashlightTime = currentTime;
        } else {
            // Clear any flashlight tint if this was the source
            if (this.lastFlashlightTime && currentTime - this.lastFlashlightTime > 100) {
                if (!this.lastInfluencingLight) {
                    this.player.sprite.clearTint();
                    if (this.scene.diverArm) {
                        this.scene.diverArm.clearTint();
                    }
                }
                this.lastFlashlightTime = null;
            }
        }
    }

    /**
     * Toggle the flashlight on/off
     * @param {string} customMaskKey - Optional key for a custom mask image
     */
    toggleFlashlight(customMaskKey = null) {
        this.flashlightEnabled = !this.flashlightEnabled;
        
        // Clean up any existing resources
        if (this.lightMask) {
            if (this.overlay) {
                this.overlay.clearMask();
            }
            this.lightMask = null;
        }
        
        if (this.flashlightMask) {
            this.flashlightMask.destroy();
            this.flashlightMask = null;
        }
        
        if (this.customMaskImage) {
            this.customMaskImage.destroy();
            this.customMaskImage = null;
        }
        
        if (this.flashlightEnabled) {
            // Create the basic flashlight elements
            // The magenta pin light at origin
            if (!this.flashlightPointLight) {
                this.flashlightPointLight = this.scene.add.sprite(0, 0, 'bullet')
                    .setScale(0.4)
                    .setAlpha(0.8)
                    .setTint(0xff00ff) // Magenta color
                    .setBlendMode(Phaser.BlendModes.ADD)
                    .setDepth(902)
                    .setOrigin(0.5, 0.5)
                    .setVisible(true);
            } else {
                this.flashlightPointLight.setVisible(true);
            }
            
            // Add glow effect around the origin point
            if (!this.flashlightGlow) {
                this.flashlightGlow = this.scene.add.sprite(0, 0, 'bullet')
                    .setScale(0.7)
                    .setAlpha(0.7)
                    .setTint(0xff40ff) // Slightly lighter magenta
                    .setBlendMode(Phaser.BlendModes.ADD)
                    .setDepth(901)
                    .setOrigin(0.5, 0.5)
                    .setVisible(true);
            } else {
                this.flashlightGlow.setVisible(true);
            }
            
            // Check if we should use a custom mask
            if (customMaskKey && this.scene.textures.exists(customMaskKey)) {
                console.log(`Using custom mask image: ${customMaskKey}`);
                this.usingCustomMask = true;
                
                // Create the custom mask image
                this.customMaskImage = this.scene.make.image({
                    x: 0,
                    y: 0,
                    key: customMaskKey,
                    add: false // Important: don't add to display list
                });
                
                // Make sure the custom mask has its origin at the center
                this.customMaskImage.setOrigin(0.5, 0.5);
                
                // Create the bitmap mask from the image
                this.lightMask = this.customMaskImage.createBitmapMask();
                this.lightMask.invertAlpha = true;
            } else {
                // Use geometry-based mask
                this.usingCustomMask = false;
                this.flashlightMask = this.scene.make.graphics({add: false});
            }
            
            // Immediately update the position and create the mask
            try {
                this.updateFlashlightCone();
            } catch (error) {
                console.error('Error initializing flashlight cone:', error);
            }
            
            console.log(`Flashlight enabled with ${this.usingCustomMask ? 'custom image mask' : 'geometry-based mask'}`);
        } else {
            // Turn off the flashlight
            if (this.flashlightPointLight) {
                this.flashlightPointLight.setVisible(false);
            }
            
            if (this.flashlightGlow) {
                this.flashlightGlow.setVisible(false);
            }
            
            // Clear the mask
            if (this.overlay) {
                this.overlay.clearMask();
            }
            
            console.log('Flashlight disabled');
        }
    }

    /**
     * Set a custom mask image for the flashlight
     * @param {string} imageKey - The texture key for the mask image
     */
    setCustomFlashlightMask(imageKey) {
        if (!imageKey || !this.scene.textures.exists(imageKey)) {
            console.warn(`Custom mask image '${imageKey}' not found!`);
            return false;
        }
        
        // Reinitialize the flashlight with the custom mask
        // First turn it off if it was on
        const wasEnabled = this.flashlightEnabled;
        if (wasEnabled) {
            this.flashlightEnabled = false;
            
            // Hide flashlight elements
            if (this.flashlightPointLight) this.flashlightPointLight.setVisible(false);
            if (this.flashlightGlow) this.flashlightGlow.setVisible(false);
        }
        
        // Clean up existing mask if any
        if (this.lightMask) {
            if (this.overlay) {
                this.overlay.clearMask();
            }
            this.lightMask = null;
        }
        
        // Clean up any existing custom mask image
        if (this.customMaskImage) {
            this.customMaskImage.destroy();
            this.customMaskImage = null;
        }
        
        // Reinitialize with the custom mask
        console.log(`Reinitializing flashlight with custom mask: ${imageKey}`);
        
        // Set the custom mask key
        this.usingCustomMask = true;
        
        // Create the custom mask image
        this.customMaskImage = this.scene.make.image({
            x: 0,
            y: 0,
            key: imageKey,
            add: false
        });
        
        // CRITICAL: Make sure the origin is at the center for proper rotation
        // For flashlight_cone1.png, this ensures the mask origin is at the
        // center of the image, which should align with the magenta pin light.
        //
        // When creating custom masks in Photoshop:
        // 1. The mask origin should be at the exact center of the image (50%, 50%)
        // 2. White areas will be visible, black areas will be masked out
        // 3. The cone should point to the right (0 degrees) from the center
        this.customMaskImage.setOrigin(0.5, 0.5);
        
        // Restore the previous state
        this.flashlightEnabled = wasEnabled;
        
        // Update visibility of elements
        if (this.flashlightPointLight) {
            this.flashlightPointLight.setVisible(wasEnabled);
        }
        if (this.flashlightGlow) {
            this.flashlightGlow.setVisible(wasEnabled);
        }
        
        // Update position if enabled (safely)
        if (wasEnabled) {
            try {
                this.updateFlashlightCone();
            } catch (error) {
                console.error('Error updating flashlight cone:', error);
            }
        }
        
        return true;
    }

    /**
     * Create a custom flashlight mask template
     * This is a utility function to help create a properly formatted flashlight mask image
     */
    createCustomFlashlightMaskTemplate() {
        try {
            // Create a new graphics object for the template
            const templateGraphics = this.scene.add.graphics();
            
            // Set canvas size
            const width = 512;
            const height = 512;
            
            // Clear any previous content
            templateGraphics.clear();
            
            // Draw a black background (will be masked out)
            templateGraphics.fillStyle(0x000000, 1);
            templateGraphics.fillRect(0, 0, width, height);
            
            // Calculate center point
            const centerX = width / 2;
            const centerY = height / 2;
            
            // Draw the main cone shape (white will be visible)
            templateGraphics.fillStyle(0xffffff, 1);
            
            // Draw cone pointing right from center (0 degrees)
            templateGraphics.beginPath();
            templateGraphics.moveTo(centerX, centerY); // Start at center
            
            // Draw cone with gradient
            const coneAngle = Math.PI / 2.5; // ~72 degree cone
            const coneLength = width / 2; // Half the width
            
            // Draw arc for end of cone
            templateGraphics.arc(
                centerX, centerY,
                coneLength,
                -coneAngle/2,
                coneAngle/2
            );
            
            // Close path back to center
            templateGraphics.lineTo(centerX, centerY);
            templateGraphics.fillPath();
            
            // Add inner circle at origin for the light source
            templateGraphics.fillStyle(0xffffff, 1);
            templateGraphics.fillCircle(centerX, centerY, 20);
            
            // Generate texture from this graphics object
            const rt = this.scene.add.renderTexture(0, 0, width, height);
            rt.draw(templateGraphics);
            
            // Generate a key name
            const key = 'custom_flashlight_mask';
            
            // Save as a texture in the texture manager
            rt.saveTexture(key);
            
            // Clean up
            rt.destroy();
            templateGraphics.destroy();
            
            console.log(`Created custom flashlight mask template with key: '${key}'`);
            console.log(`To use: call lightingSystem.setCustomFlashlightMask('${key}')`);
            
            return key;
        } catch (error) {
            console.error('Error creating custom flashlight mask template:', error);
            return null;
        }
    }

    /**
     * Initialize debug visualizations for lighting zones
     */
    setupDebugVisuals() {
        if (!this.scene.physics.config.debug) return;
        
        // Create debug graphics for zone visualization
        this.debugGraphics = this.scene.add.graphics();
        this.debugGraphics.setDepth(10000); // Very high depth to ensure visibility
        
        // Create debug text for lighting state
        this.debugText = this.scene.add.text(10, 120, '', {
            font: '14px Arial',
            fill: '#00ff00',
            backgroundColor: '#000000',
            padding: { x: 5, y: 5 }
        });
        this.debugText.setScrollFactor(0);
        this.debugText.setDepth(10001);
        this.debugText.setAlpha(0.8);
    }

    /**
     * Debug method to visualize all lighting zones
     */
    debugZones() {
        if (!this.scene.physics.config.debug || !this.debugGraphics) return;
        
        console.log('Visualizing lighting zones:', this.lightingZones.length);
        
        // Clear previous visualizations
        this.debugGraphics.clear();
        
        // Draw each zone with different colors based on type
        this.lightingZones.forEach((zone, index) => {
            let color;
            let alpha = 0.15;
            
            switch(zone.type) {
                case 'bright':
                    color = 0xffff00; // Yellow
                    break;
                case 'dim':
                    color = 0x00ffff; // Cyan
                    break;
                case 'dark':
                    color = 0x0000ff; // Blue
                    break;
                case 'black':
                    color = 0xff00ff; // Magenta
                    alpha = 0.25;
                    break;
                default:
                    color = 0x00ff00; // Green for default zones
                    alpha = 0.1;
            }
            
            // Draw zone outline
            this.debugGraphics.lineStyle(2, color, 1);
            this.debugGraphics.strokeRect(
                zone.rect.x, zone.rect.y,
                zone.rect.width, zone.rect.height
            );
            
            // Fill zone with semi-transparent color
            this.debugGraphics.fillStyle(color, alpha);
            this.debugGraphics.fillRect(
                zone.rect.x, zone.rect.y,
                zone.rect.width, zone.rect.height
            );
            
            // Add text label with zone type
            const labelX = zone.rect.x + 10;
            const labelY = zone.rect.y + 10;
            const label = this.scene.add.text(
                labelX, labelY,
                `${zone.type} (${index})`,
                { font: '12px Arial', fill: '#ffffff', backgroundColor: '#000000' }
            );
            label.setDepth(10001);
        });
        
        console.log('Zones visualization complete');
    }

    /**
     * Update debug text with current lighting information
     */
    updateDebugText() {
        if (!this.debugText) return;
        
        const now = this.scene.time.now;
        
        const text = [
            `Lighting Zone: ${this.currentZoneType || 'none'}`,
            `Light Level: ${this.currentLightLevel.toFixed(2)}`,
            `Target Level: ${this.targetLightLevel.toFixed(2)}`,
            `Transition: ${this.transitionActive ? 'Active' : 'Inactive'}`,
            `Last Zone: ${this.lastNonDefaultZoneType || 'none'}`,
            `Persistence: ${this.persistentMode ? 'ON' : 'OFF'}`,
            `Cooldown: ${Math.max(0, this.lastZoneEnterTime - now)}ms left`
        ].join('\n');
        
        this.debugText.setText(text);
    }

    /**
     * Process custom light objects from the map
     * @param {Phaser.Tilemaps.Tilemap} map - The tilemap
     */
    processCustomLights(map) {
        // First clear any existing custom lights
        this.clearCustomLights();
        
        // Check if the map and object layers exist
        if (!map || !map.objects) {
            console.log('No objects found in map for custom lights');
            return;
        }
        
        // Try to find a layer named 'lights' or similar
        const lightLayers = map.objects.filter(layer => 
            layer.name.toLowerCase().includes('light'));
        
        // If no light layers found, exit
        if (lightLayers.length === 0) {
            console.log('No light layers found in map');
            return;
        }
        
        // Process each light layer
        let totalLights = 0;
        
        lightLayers.forEach(layer => {
            console.log(`Processing light layer: ${layer.name}`);
            
            // Process each object in the layer
            const lightObjects = layer.objects || [];
            
            console.log(`Found ${lightObjects.length} objects in light layer:`, 
                       lightObjects.map(o => `${o.name || 'unnamed'} (type: ${o.type || 'none'})`));
            
            lightObjects.forEach(obj => {
                // Get properties from object (handle both property arrays and direct properties)
                const getProperty = (obj, name, defaultValue) => {
                    // First check if properties array exists
                    if (obj.properties && Array.isArray(obj.properties)) {
                        const prop = obj.properties.find(p => p.name === name);
                        if (prop !== undefined) return prop.value;
                    }
                    
                    // Then check direct properties on the object
                    if (obj[name] !== undefined) return obj[name];
                    
                    // Return default if not found
                    return defaultValue;
                };
                
                // Extract all light properties
                const lightOptions = {
                    radius: getProperty(obj, 'radius', getProperty(obj, 'size', 150)),
                    intensity: getProperty(obj, 'intensity', 1),
                    color: getProperty(obj, 'color', 0xffffff),
                    blinking: getProperty(obj, 'blinking', false),
                    flickering: getProperty(obj, 'flickering', false),
                    texture: getProperty(obj, 'texture', null),
                    image: getProperty(obj, 'image', null)
                };
                
                console.log(`Light properties:`, lightOptions);
                
                // Create the appropriate light based on type
                if (obj.type?.toLowerCase().includes('pin_light') || 
                    obj.name?.toLowerCase().includes('pin_light')) {
                    console.log(`Creating pin light at (${obj.x}, ${obj.y})`);
                    const light = this.createPinLight(obj.x, obj.y, lightOptions);
                    this.customLights.push(light);
                    totalLights++;
                    console.log('Pin light created successfully');
                }
                else if (obj.type?.toLowerCase().includes('ambient') || 
                         obj.name?.toLowerCase().includes('ambient')) {
                    console.log(`Creating ambient light at (${obj.x}, ${obj.y})`);
                    const light = this.createAmbientLight(obj.x, obj.y, lightOptions);
                    this.customLights.push(light);
                    totalLights++;
                    console.log('Ambient light created successfully');
                }
                else if (obj.type?.toLowerCase().includes('spotlight') || 
                         obj.name?.toLowerCase().includes('spotlight')) {
                    console.log(`Creating spotlight at (${obj.x}, ${obj.y})`);
                    const light = this.createSpotlight(obj.x, obj.y, lightOptions);
                    this.customLights.push(light);
                    totalLights++;
                    console.log('Spotlight created successfully');
                }
                else {
                    console.log(`Unknown light type: ${obj.type || obj.name}`);
                }
            });
        });
        
        console.log(`Processed ${totalLights} custom lights from the map`);
        
        // Make sure the obstacle layer has the Light2D pipeline applied so our lights affect it
        this.scene.time.delayedCall(100, () => {
            console.log('[LIGHT] Ensuring obstacles have lighting pipeline after custom lights are created');
            this.applyLightingToObstacles();
            
            // Also check for jellyfish that might be in the scene
            this.applyLightingToJellyfish();
        });
        
        // If debug mode, add visualizations
        if (this.scene.physics.config.debug) {
            this.customLights.forEach((light, index) => {
                // Add debug circle around each light
                const graphics = this.scene.add.graphics();
                graphics.lineStyle(2, 0xff00ff, 0.5);
                graphics.strokeCircle(light.x, light.y, light.radius);
                graphics.setDepth(900);
                
                const text = this.scene.add.text(
                    light.x, 
                    light.y - light.radius - 10, 
                    `Light #${index + 1}`, 
                    { fontSize: '12px', fill: '#ff00ff' }
                );
                text.setOrigin(0.5, 1);
                text.setDepth(900);
            });
        }
    }
    
    /**
     * Clears all custom lights and their resources
     */
    clearCustomLights() {
        // Clean up any existing custom lights
        if (this.customLights.length > 0) {
            console.log(`Cleaning up ${this.customLights.length} existing custom lights`);
            
            this.customLights.forEach(light => {
                if (light && typeof light.destroy === 'function') {
                    light.destroy();
                }
            });
            
            this.customLights = [];
        }
    }
    
    /**
     * Update all custom lights
     * @param {number} time - Current game time
     * @param {number} delta - Time elapsed since last update
     */
    updateCustomLights(time, delta) {
        // Update each custom light
        this.customLights.forEach(light => {
            if (!light) return;
            
            // Call the light's update method
            if (typeof light.update === 'function') {
                light.update(time, delta);
            }
            
            // Apply light influence on player if within range
            if (this.player && this.player.sprite) {
                this.applyLightToPlayer(light, time);
            }
            
            // Update container position if needed
            if (light.container) {
                light.container.setPosition(light.x, light.y);
            }
            
            // Update mask position if it exists
            if (light.lightMask) {
                if (light.lightMask.container) {
                    light.lightMask.container.setPosition(light.x, light.y);
                }
                if (light.lightMask.rect) {
                    // Rectangle should stay centered on the screen
                    light.lightMask.rect.setPosition(
                        this.scene.cameras.main.centerX,
                        this.scene.cameras.main.centerY
                    );
                }
            }
            
            // Legacy support for older light format
            if (light.customMaskImage && light.lightCutout && light.lightCutout.maskImage) {
                light.lightCutout.maskImage.setPosition(light.x, light.y);
                
                // Update glows if they exist
                if (light.lightCutout.outerGlow) {
                    light.lightCutout.outerGlow.setPosition(light.x, light.y);
                }
                if (light.lightCutout.innerGlow) {
                    light.lightCutout.innerGlow.setPosition(light.x, light.y);
                }
            }
        });
    }
    
    /**
     * Apply light influence on player sprite when in range
     * @param {Object} light - The light object
     * @param {number} time - Current game time
     */
    applyLightToPlayer(light, time) {
        if (!this.player || !this.player.sprite || !light) return;
        
        // Get player position
        const playerX = this.player.sprite.x;
        const playerY = this.player.sprite.y;
        
        // Light position
        const lightX = light.x;
        const lightY = light.y;
        
        // Calculate distance between player and light
        const distance = Phaser.Math.Distance.Between(playerX, playerY, lightX, lightY);
        
        // Light's influence radius (slightly larger than visual radius)
        const influenceRadius = light.radius * 1.5;
        
        // Only apply if player is within influence radius
        if (distance <= influenceRadius) {
            // Calculate influence factor (1 at center, 0 at edge)
            const influence = 1 - (distance / influenceRadius);
            
            // Calculate an interaction color based on light color and influence
            // We'll extract R, G, B components from the hex color
            const r = (light.color >> 16) & 0xFF;
            const g = (light.color >> 8) & 0xFF;
            const b = light.color & 0xFF;
            
            // Create a tint color based on the light's color but less intense
            // This ensures the player sprite still looks natural
            const tintR = Math.floor(255 - ((255 - r) * influence * 0.6));
            const tintG = Math.floor(255 - ((255 - g) * influence * 0.6));
            const tintB = Math.floor(255 - ((255 - b) * influence * 0.6));
            
            // Convert RGB back to hex
            const tintColor = (tintR << 16) | (tintG << 8) | tintB;
            
            // Apply tint to player sprite
            this.player.sprite.setTint(tintColor);
            
            // Also apply to arm sprite if it exists
            if (this.scene.diverArm) {
                this.scene.diverArm.setTint(tintColor);
            }
            
            // Store the last application time and light
            this.lastLightInfluenceTime = time;
            this.lastInfluencingLight = light;
            
        } else if (this.lastInfluencingLight === light && 
                  (time - this.lastLightInfluenceTime) > 100) {
            // Clear tint if this was the last influencing light
            // and player has moved away for at least 100ms
            this.player.sprite.clearTint();
            
            if (this.scene.diverArm) {
                this.scene.diverArm.clearTint();
            }
            
            this.lastInfluencingLight = null;
        }
    }
    
    /**
     * Create a pin light - a small, focused point light
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} color - Light color (hex)
     * @param {number} radius - Light radius
     * @param {number} intensity - Light intensity
     * @param {Object} options - Additional options
     * @returns {Object} The created light object
     */
    createPinLight(x, y, options = {}) {
        console.log(`Creating pin light at (${x}, ${y}) with options:`, options);
        
        const textureKey = options.texture || options.image || 'bullet';
        const radius = options.radius || options.size || 100;
        const intensity = options.intensity || 0.8;
        const color = options.color || 0xffffff;
        
        console.log(`Pin light using textureKey: ${textureKey}, radius: ${radius}`);
        
        // Try multiple variations of the texture key
        const possibleKeys = [
            textureKey,
            `${textureKey}.png`,
        ];
        
        // If the texture key includes a path, also try just the filename
        if (textureKey.includes('/')) {
            const filename = textureKey.split('/').pop();
            possibleKeys.push(filename);
            possibleKeys.push(filename.split('.')[0]);
        } else {
            possibleKeys.push(textureKey.split('.')[0]);
        }
        
        // Add numeric key for laser_sprites
        if (textureKey.includes('laser_sprites')) {
            const matches = textureKey.match(/(\d+)/);
            if (matches && matches[1]) {
                possibleKeys.push(matches[1]);
            }
        }
        
        console.log(`Trying texture keys:`, possibleKeys);
        
        let foundTexture = null;
        for (const key of possibleKeys) {
            if (this.scene.textures.exists(key)) {
                foundTexture = key;
                console.log(`✅ Found texture: ${key}`);
                break;
            }
        }
        
        if (!foundTexture) {
            console.warn(`⚠️ None of the texture keys exist. Falling back to 'bullet'`);
            foundTexture = 'bullet';
        }
        
        // Create container for visual elements
        const container = this.scene.add.container(x, y);
        
        // Create visual light sprite
        const visualLight = this.scene.add.sprite(0, 0, foundTexture);
        visualLight.setOrigin(0.5, 0.5);
        visualLight.setScale(radius / Math.max(visualLight.width, visualLight.height) * 0.5);
        visualLight.setTint(color);
        visualLight.setAlpha(intensity * 0.8);
        
        // Add visual light to container
        container.add(visualLight);
        
        // Create actual light source for lighting pipeline
        let light = null;
        if (this.scene.sys.game.renderer.pipelines.get('Light2D')) {
            light = this.scene.lights.addLight(x, y, radius, color, intensity);
            this.pointLights.push(light);
        }
        
        // Create brighter core glow
        const coreLight = this.scene.add.sprite(0, 0, foundTexture);
        coreLight.setOrigin(0.5, 0.5);
        coreLight.setScale(radius / Math.max(coreLight.width, coreLight.height) * 0.3);
        coreLight.setTint(color);
        coreLight.setAlpha(intensity * 1.2);
        coreLight.setBlendMode(Phaser.BlendModes.ADD);
        container.add(coreLight);
        
        // Create a mask that cuts through darkness
        let lightMask = null;
        if (this.overlay) {
            // Check if there's a custom mask image specified
            const maskImagePath = options.image || options.maskImage || options.texture;
            
            if (maskImagePath) {
                console.log(`Trying to use custom mask image: ${maskImagePath}`);
                
                // Try multiple variations of the mask image key
                const possibleMaskKeys = [
                    maskImagePath,
                    `${maskImagePath}.png`,
                    '10',      // Special case for laser_sprites/10.png
                    '10.png'   // Special case for the known image path
                ];
                
                // If the path includes a filename, also try just the filename
                if (maskImagePath.includes('/')) {
                    const filename = maskImagePath.split('/').pop();
                    possibleMaskKeys.push(filename);
                    possibleMaskKeys.push(filename.split('.')[0]);
                }
                
                console.log(`Trying mask image keys:`, possibleMaskKeys);
                
                // Find the first valid texture key
                let foundMaskKey = null;
                for (const key of possibleMaskKeys) {
                    if (this.scene.textures.exists(key)) {
                        foundMaskKey = key;
                        console.log(`✅ Found mask texture: ${key}`);
                        break;
                    }
                }
                
                if (foundMaskKey) {
                    // Create a container for the mask
                    const maskContainer = this.scene.add.container(x, y);
                    maskContainer.setDepth(this.overlay.depth + 1);
                    
                    // Create an image using the found texture key
                    const customMaskImage = this.scene.add.image(0, 0, foundMaskKey);
                    
                    // Scale to match the desired radius
                    const maskScale = (radius * 2) / Math.max(customMaskImage.width, customMaskImage.height);
                    customMaskImage.setScale(maskScale);
                    
                    // Add the image to the container
                    maskContainer.add(customMaskImage);
                    
                    // Create the bitmap mask
                    const maskBitmap = customMaskImage.createBitmapMask();
                    
                    // Create a rectangle that covers the screen to be masked
                    const maskRect = this.scene.add.rectangle(
                        this.scene.cameras.main.centerX,
                        this.scene.cameras.main.centerY,
                        this.scene.cameras.main.width,
                        this.scene.cameras.main.height,
                        0xffffff, 1
                    );
                    
                    // Apply the mask to the rectangle
                    maskRect.setMask(maskBitmap);
                    maskRect.setDepth(this.overlay.depth + 1);
                    
                    // Set the container's depth to be above the overlay
                    container.setDepth(this.overlay.depth + 3);
                    
                    // Store mask elements for cleanup
                    lightMask = {
                        image: customMaskImage,
                        container: maskContainer,
                        bitmap: maskBitmap,
                        rect: maskRect
                    };
                    
                    return {
                        physicalLight: light,
                        container,
                        visualLight,
                        coreLight,
                        lightMask,
                        x, y, 
                        
                        // Method to update the light
                        update: (time, delta) => {
                            // Any ongoing updates can be handled here
                        },
                        
                        // Method to destroy the light
                        destroy: () => {
                            if (light) {
                                const index = this.pointLights.indexOf(light);
                                if (index !== -1) {
                                    this.pointLights.splice(index, 1);
                                }
                                light.destroy();
                            }
                            
                            if (lightMask) {
                                if (lightMask.container) lightMask.container.destroy();
                                if (lightMask.image) lightMask.image.destroy();
                                if (lightMask.rect) lightMask.rect.destroy();
                            }
                            
                            container.destroy();
                        }
                    };
                }
            }
            
            // Default circle mask if no custom mask was found or specified
            console.log(`Using default circle mask for pin light`);
            
            // Create a circle that will cut through darkness
            const maskGraphics = this.scene.add.graphics();
            maskGraphics.fillStyle(0xffffff);
            maskGraphics.fillCircle(0, 0, radius * 0.8);
            
            // Use this as a mask for a container that will be above the overlay
            const maskContainer = this.scene.add.container(x, y);
            maskContainer.setDepth(this.overlay.depth + 1);
            
            // Add the graphics to the container
            maskContainer.add(maskGraphics);
            
            // Create outer glow effect
            const outerGlow = this.scene.add.graphics();
            outerGlow.fillStyle(color, 0.2);
            outerGlow.fillCircle(0, 0, radius * 1.2);
            
            maskContainer.add(outerGlow);
            
            // Set the container's depth to be above the overlay
            container.setDepth(this.overlay.depth + 2);
            
            // Store mask elements for cleanup
            lightMask = {
                graphics: maskGraphics,
                container: maskContainer,
                glow: outerGlow
            };
        }
        
        // Handle blinking or flickering
        if (options.blinking || options.flickering) {
            const minAlpha = options.flickering ? 0.5 : 0.0;
            const maxAlpha = intensity;
            const duration = options.flickering ? 
                Phaser.Math.Between(500, 1500) : 
                Phaser.Math.Between(2000, 5000);
            
            this.scene.tweens.add({
                targets: [visualLight, coreLight],
                alpha: { from: maxAlpha, to: minAlpha },
                duration: duration,
                yoyo: true,
                repeat: -1,
                ease: options.flickering ? 'Sine.easeInOut' : 'Linear'
            });
        }
        
        // Return the light object with update and destroy methods
        return {
            physicalLight: light,
            container,
            visualLight,
            coreLight,
            lightMask,
            x, y, 
            
            // Method to update the light
            update: (time, delta) => {
                // Any ongoing updates can be handled here
            },
            
            // Method to destroy the light
            destroy: () => {
                if (light) {
                    const index = this.pointLights.indexOf(light);
                    if (index !== -1) {
                        this.pointLights.splice(index, 1);
                    }
                    light.destroy();
                }
                
                if (lightMask) {
                    lightMask.container.destroy();
                    lightMask.graphics.destroy();
                    lightMask.glow.destroy();
                }
                
                container.destroy();
            }
        };
    }
    
    /**
     * Create an ambient light - a large, subtle area light
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} color - Light color (hex)
     * @param {number} radius - Light radius
     * @param {number} intensity - Light intensity
     * @param {Object} options - Additional options (like texture)
     * @returns {Object} The created light object
     */
    createAmbientLight(x, y, color = 0xffeecc, radius = 300, intensity = 0.5, options = {}) {
        // Try to create a real point light if the pipeline is available
        let light = null;
        let usePhysicalLight = this.scene.sys.game.renderer.pipelines.get('Light2D');
        
        if (usePhysicalLight) {
            light = this.createPointLight(x, y, color, radius, intensity);
        }
        
        // Check for custom texture
        const textureKey = options.texture || 'bullet';
        
        // Verify the texture exists
        if (!this.scene.textures.exists(textureKey)) {
            console.warn(`Light texture "${textureKey}" not found for ambient light, using fallback`);
        }
        
        // Get the texture to use (with fallback)
        const useTextureKey = this.scene.textures.exists(textureKey) ? textureKey : 'bullet';
        console.log(`Creating ambient light with texture: ${useTextureKey}`);
        
        // Always create a visual light effect (as fallback or enhancement)
        const visualLight = this.scene.add.sprite(x, y, useTextureKey);
        
        // Scale based on radius (sprite is around 50px)
        const baseSize = 50;
        const visualScale = Math.max(0.2, radius / baseSize);
        
        // For ambient light, use a lower alpha but large size
        visualLight.setScale(visualScale * 2.0) // Much larger for ambient
            .setAlpha(Math.min(0.7, intensity * 1.2)) // Higher alpha to better cut through darkness
            .setTint(color)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(800) // Lower depth than pin lights
            .setOrigin(0.5, 0.5);
        
        // Create a cutout in the darkness for this ambient light
        let lightCutout = null;
        if (this.overlay) {
            // Create a circle-shaped cutout for the ambient area
            const lightHole = this.scene.add.circle(x, y, radius * 1.2, 0x000000, 0);
            
            // Create a soft glow effect around the cutout
            const outerGlow = this.scene.add.circle(x, y, radius * 1.5, 0xffffff, 0.03);
            outerGlow.setDepth(this.overlay.depth - 1);
            
            const innerGlow = this.scene.add.circle(x, y, radius * 1.0, 0xffffff, 0.05);
            innerGlow.setDepth(this.overlay.depth - 1);
            
            // Place the visual light above the overlay
            visualLight.setDepth(this.overlay.depth + 1);
            
            // Store these objects for later cleanup
            lightCutout = {
                lightHole,
                outerGlow,
                innerGlow
            };
        }
        
        // Add pulse effect for ambient lights
        this.scene.tweens.add({
            targets: visualLight,
            scale: visualScale * 2.2, // Slight pulse effect
            duration: 2000 + Math.random() * 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onUpdate: (tween) => {
                // Update cutout glow to match the light intensity/size
                if (lightCutout) {
                    if (lightCutout.outerGlow) {
                        const progress = tween.progress;
                        const pulseIntensity = 0.03 + (progress * 0.02);
                        lightCutout.outerGlow.setAlpha(pulseIntensity);
                    }
                    if (lightCutout.innerGlow) {
                        const progress = tween.progress;
                        const pulseIntensity = 0.05 + (progress * 0.03);
                        lightCutout.innerGlow.setAlpha(pulseIntensity);
                    }
                }
            }
        });
        
        // Create a light object to return
        const lightObject = {
            physicalLight: light,
            visualLight: visualLight,
            lightCutout: lightCutout,
            x, y, color, radius, intensity,
            
            // Method to update the light
            update: (time, delta) => {
                // Any ongoing updates can be handled here
            },
            
            // Method to destroy the light
            destroy: () => {
                if (light) {
                    const index = this.pointLights.indexOf(light);
                    if (index !== -1) {
                        this.pointLights.splice(index, 1);
                    }
                    light.destroy();
                }
                
                visualLight.destroy();
                
                // Clean up cutout if we created one
                if (lightCutout) {
                    if (lightCutout.lightHole) lightCutout.lightHole.destroy();
                    if (lightCutout.outerGlow) lightCutout.outerGlow.destroy();
                    if (lightCutout.innerGlow) lightCutout.innerGlow.destroy();
                }
            }
        };
        
        return lightObject;
    }
    
    /**
     * Create a spotlight - a directional cone of light
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} color - Light color (hex)
     * @param {number} length - Spotlight length
     * @param {number} intensity - Light intensity
     * @param {number} direction - Direction in radians
     * @param {Object} options - Additional options like texture
     * @returns {Object} The created light object
     */
    createSpotlight(x, y, color = 0xffffff, length = 200, intensity = 1, direction = 0, options = {}) {
        // Create a container to hold all spotlight elements
        const container = this.scene.add.container(x, y);
        
        // Define cone parameters
        const coneAngle = Math.PI / 4; // 45 degree cone
        
        // Create the visual cone shape with higher intensity
        const graphicsObject = this.scene.add.graphics();
        graphicsObject.fillStyle(color, intensity * 0.7); // Higher intensity
        graphicsObject.beginPath();
        graphicsObject.moveTo(0, 0);
        graphicsObject.arc(
            0, 0,
            length,
            -coneAngle/2,
            coneAngle/2
        );
        graphicsObject.lineTo(0, 0);
        graphicsObject.fillPath();
        
        // Add the cone to the container
        container.add(graphicsObject);
        container.setRotation(direction);
        
        // Create a cutout effect for the spotlight cone that cuts through darkness
        let lightCutout = null;
        if (this.overlay) {
            // Create the cutout effect
            // Draw the cone shape in a different way
            const cutoutShape = this.scene.add.graphics();
            cutoutShape.clear();
            
            // Create multiple gradient layers to give a soft edge to the cone
            for (let i = 0; i < 5; i++) {
                const gradLength = length * (1 - i/5 * 0.4);
                const gradAngle = coneAngle * (1 - i/5 * 0.3);
                const alpha = 0.12 - (i/5) * 0.02;
                
                cutoutShape.fillStyle(0xffffff, alpha);
                cutoutShape.beginPath();
                cutoutShape.moveTo(0, 0);
                cutoutShape.arc(0, 0, gradLength, -gradAngle/2, gradAngle/2);
                cutoutShape.lineTo(0, 0);
                cutoutShape.fillPath();
            }
            
            // Add to container
            container.add(cutoutShape);
            
            // Place graphics above the overlay
            container.setDepth(this.overlay.depth + 1);
            
            // Store for cleanup
            lightCutout = {
                cutoutShape
            };
        } else {
            // If no overlay, just set a standard depth
            container.setDepth(840);
        }
        
        // Add a point light at the origin (can use custom texture)
        const pinLightOptions = {
            ...options,
            texture: options.texture || 'bullet'
        };
        
        // Create a smaller point light at the origin
        const pinLight = this.createPinLight(x, y, color, 50, intensity * 1.2, pinLightOptions);
        
        // Create a light object to return
        const lightObject = {
            container,
            graphicsObject,
            pinLight,
            lightCutout,
            x, y, color, length, intensity, direction,
            options,
            
            // Method to update the light
            update: (time, delta) => {
                // Update the pin light
                pinLight.update(time, delta);
            },
            
            // Method to destroy the light
            destroy: () => {
                container.destroy();
                pinLight.destroy();
                
                // Graphics is destroyed automatically with container
            }
        };
        
        return lightObject;
    }

    /**
     * Update player zone based on position
     */
    updatePlayerZone() {
        if (!this.player || !this.overlay) return;
        
        // Get player coordinates
        const playerX = this.player.sprite ? this.player.sprite.x : this.player.x;
        const playerY = this.player.sprite ? this.player.sprite.y : this.player.y;
        
        let highestPriorityZone = null;
        let highestPriority = -1;
        
        // Check all lighting zones
        for (const zone of this.lightingZones) {
            if (Phaser.Geom.Rectangle.Contains(zone.rect, playerX, playerY)) {
                // Assign priorities based on zone type
                let priority;
                switch (zone.type) {
                    case 'bright': priority = 5; break;
                    case 'black': priority = 4; break;
                    case 'dark': priority = 3; break;
                    case 'dim': priority = 2; break;
                    default: priority = 1; break;
                }
                
                if (priority > highestPriority) {
                    highestPriority = priority;
                    highestPriorityZone = zone;
                }
            }
        }
        
        // If we found a zone, transition to it
        if (highestPriorityZone && this.currentZoneType !== highestPriorityZone.type) {
            this.transitionStartTime = this.scene.time.now;
            this.transitionStartValue = this.currentLightLevel;
            this.targetLightLevel = this.zoneLevels[highestPriorityZone.type];
            this.currentZoneType = highestPriorityZone.type;
            this.transitionActive = true;
            
            // Store this non-default zone as the last one we've encountered
            this.lastNonDefaultZoneType = highestPriorityZone.type;
            this.lastNonDefaultZoneLevel = this.targetLightLevel;
            
            // Determine transition speed based on zone type
            if (highestPriorityZone.type === 'bright') {
                this.transitionDuration = 500; // Quick transition to bright
            } else {
                this.transitionDuration = 1000; // Slower transition to darkness
            }
            
            console.log(`Transitioning to ${highestPriorityZone.type} zone`);
            
            // Update debug text if enabled
            if (this.debugText) {
                this.debugText.setText(`Lighting: ${highestPriorityZone.type}`);
            }
        }
        
        // No more "else if" clause - we've completely removed the transition back to default
        // This ensures lighting levels always persist until a new zone is entered
        
        // Reset player tint if no light is influencing 
        // and we're not in a bright zone
        if (!this.lastInfluencingLight && 
            this.currentZoneType !== 'bright' && 
            this.player.sprite && 
            this.scene.time.now - (this.lastLightInfluenceTime || 0) > 200) {
            this.player.sprite.clearTint();
            
            if (this.scene.diverArm) {
                this.scene.diverArm.clearTint();
            }
        }
    }
    
    /**
     * Update lighting transition
     * @param {number} delta - Time elapsed since last update
     */
    updateTransition(delta) {
        if (!this.overlay) return;
        
        // Calculate transition progress
        const elapsed = this.scene.time.now - this.transitionStartTime;
        const progress = Math.min(1, elapsed / this.transitionDuration);
        
        // Apply smooth easing
        let easedProgress;
        if (progress < 0.5) {
            easedProgress = 4 * Math.pow(progress, 3);
        } else {
            easedProgress = 1 - Math.pow(-2 * progress + 2, 3) / 2;
        }
        
        // Update light level
        this.currentLightLevel = this.transitionStartValue + 
            (this.targetLightLevel - this.transitionStartValue) * easedProgress;
        
        // Update overlay with rounded alpha to prevent visual glitches
        const roundedAlpha = Math.round(this.currentLightLevel * 1000) / 1000;
        this.overlay.setAlpha(roundedAlpha);
        
        // Check if transition is complete
        if (progress >= 1) {
            this.currentLightLevel = this.targetLightLevel;
            this.transitionActive = false;
            
            console.log(`Transition complete - now at ${this.currentZoneType} lighting`);
        }
    }

    /**
     * Clean up resources when the system is destroyed
     */
    destroy() {
        console.log('Cleaning up lighting system resources');
        
        // Clean up jellyfish lighting first
        this.cleanupAllJellyfishLights();
        
        // Remove all event listeners
        if (this.jellyfishDestroyListenerAdded) {
            this.scene.events.off('jellyfishDestroyed', this.cleanupJellyfishLight, this);
            this.jellyfishDestroyListenerAdded = false;
        }
        
        // Stop any timers
        if (this.jellyfishCheckTimer) {
            this.jellyfishCheckTimer.remove();
            this.jellyfishCheckTimer = null;
        }
        
        // Clean up point lights
        this.pointLights.forEach(light => {
            if (light) {
                this.scene.lights.removeLight(light);
            }
        });
        this.pointLights = [];
        
        // Clean up custom lights
        this.clearCustomLights();
        
        // Clean up overlay
        if (this.overlay) {
            this.overlay.destroy();
            this.overlay = null;
        }
        
        // Clean up debug text
        if (this.debugText) {
            this.debugText.destroy();
            this.debugText = null;
        }
        
        // Reset the pipeline on obstacle layer if we applied it
        if (this.obstacleLayerWithLighting) {
            console.log('[LIGHT] Resetting pipeline on obstacle layer');
            try {
                // Try to restore the default pipeline
                this.obstacleLayerWithLighting.resetPipeline();
            } catch (e) {
                console.warn('[LIGHT] Error resetting pipeline:', e);
            }
            this.obstacleLayerWithLighting = null;
        }
        
        // Clean up flashlight resources
        if (this.flashlightMask) {
            this.flashlightMask.destroy();
            this.flashlightMask = null;
        }
        
        if (this.flashlightPointLight) {
            this.flashlightPointLight.destroy();
            this.flashlightPointLight = null;
        }
        
        if (this.flashlightGlow) {
            this.flashlightGlow.destroy();
            this.flashlightGlow = null;
        }
        
        if (this.customMaskImage) {
            this.customMaskImage.destroy();
            this.customMaskImage = null;
        }
        
        // Disable lighting system if it was enabled
        if (this.scene.lights) {
            this.scene.lights.disable();
        }
    }

    /**
     * Preload custom mask images from the map
     * @param {Phaser.Tilemaps.Tilemap} map - The tilemap to scan for mask images
     */
    preloadCustomMaskImages(map) {
        if (!map || !map.objects) return;
        
        // Set of image keys to preload (to avoid duplicates)
        const imagesToLoad = new Set();
        
        // Find all light layers
        const lightLayers = map.objects.filter(layer => 
            layer.name.toLowerCase().includes('light'));
            
        // Process each layer
        lightLayers.forEach(layer => {
            if (!layer.objects) return;
            
            // Check each object for mask image properties
            layer.objects.forEach(obj => {
                if (!obj.properties) return;
                
                // Look for 'image', 'mask', or 'maskimage' properties
                obj.properties.forEach(prop => {
                    const propName = prop.name.toLowerCase();
                    const value = prop.value;
                    
                    if ((propName === 'image' || propName === 'mask' || propName === 'maskimage') && 
                        typeof value === 'string' && 
                        value.trim() !== '') {
                        
                        // Add to set of images to preload
                        imagesToLoad.add(value);
                        console.log(`Found custom mask image to preload: ${value}`);
                    }
                });
            });
        });
        
        // Check if we need to preload any images
        if (imagesToLoad.size > 0) {
            console.log(`Preloading ${imagesToLoad.size} custom light mask images`);
            
            // Load each image
            imagesToLoad.forEach(imageKey => {
                // Verify the image isn't already loaded
                if (!this.scene.textures.exists(imageKey)) {
                    try {
                        // Extract actual filename without path for the texture key
                        let textureKey = imageKey;
                        const lastSlashIndex = imageKey.lastIndexOf('/');
                        if (lastSlashIndex >= 0) {
                            textureKey = imageKey.substring(lastSlashIndex + 1);
                        }
                        
                        // Handle Tiled's "../" path format
                        let imagePath = imageKey;
                        
                        // If path starts with "../", convert to absolute project path
                        if (imagePath.startsWith('../')) {
                            // Remove the "../" prefix
                            imagePath = imagePath.substring(3);
                            console.log(`Adjusted path from Tiled: ${imagePath}`);
                        }
                        
                        console.log(`Loading mask image: ${textureKey} from path: ${imagePath}`);
                        this.scene.load.image(textureKey, imagePath);
                        
                        // Store the mapping of original path to texture key
                        if (!this.imageMappings) {
                            this.imageMappings = new Map();
                        }
                        this.imageMappings.set(imageKey, textureKey);
                        
                    } catch (e) {
                        console.error(`Error loading mask image ${imageKey}:`, e);
                    }
                } else {
                    console.log(`Image already loaded: ${imageKey}`);
                }
            });
            
            // Wait for images to load if needed
            const firstImage = [...imagesToLoad][0];
            const firstImageKey = this.imageMappings ? this.imageMappings.get(firstImage) || firstImage : firstImage;
            
            if (!this.scene.textures.exists(firstImageKey)) {
                console.log('Starting image load process');
                
                // Set up load complete handler to log success
                this.scene.load.once('complete', () => {
                    console.log('Custom mask images loaded successfully');
                    
                    // Verify loaded textures
                    imagesToLoad.forEach(imageKey => {
                        const textureKey = this.imageMappings ? this.imageMappings.get(imageKey) || imageKey : imageKey;
                        if (this.scene.textures.exists(textureKey)) {
                            console.log(`✓ Image loaded: ${imageKey} as ${textureKey}`);
                        } else {
                            console.warn(`✗ Failed to load image: ${imageKey}`);
                        }
                    });
                });
                
                // Start the load
                this.scene.load.start();
            }
        }
    }

    /**
     * Apply lighting to obstacles layer
     * This finds the obstacle layer and applies the Light2D pipeline to it
     * without modifying how the layer was originally loaded
     */
    applyLightingToObstacles() {
        try {
            // Enable the lighting system at full intensity
            if (this.scene.lights) {
                console.log('[LIGHT] Enabling lighting system with bright ambient light');
                this.scene.lights.enable();
                this.scene.lights.setAmbientColor(0x555555); // Medium ambient light
            }
            
            // Find layers from the tilemap system using multiple approaches for reliability
            if (this.scene.tilemapSystem?.layers) {
                // First check if we can find a layer with 'obstacle' in its name
                let obstacleLayer = null;
                
                // Try multiple approaches to find the obstacles layer
                // 1. Check tilemapSystem.layers for an Obstacles key
                if (this.scene.tilemapSystem.layers.Obstacles) {
                    obstacleLayer = this.scene.tilemapSystem.layers.Obstacles;
                    console.log('[LIGHT] Found obstacles layer via direct key access');
                } 
                // 2. Check for any layer with "obstacle" in the name
                else {
                    const obstacleKey = Object.keys(this.scene.tilemapSystem.layers)
                        .find(key => key.toLowerCase().includes('obstacle'));
                    if (obstacleKey) {
                        obstacleLayer = this.scene.tilemapSystem.layers[obstacleKey];
                        console.log(`[LIGHT] Found obstacles layer with key: ${obstacleKey}`);
                    }
                }
                
                // If still not found, try to get it directly from the map
                if (!obstacleLayer && this.scene.map) {
                    console.log('[LIGHT] Trying to find obstacles layer via map...');
                    // Try getting layer by name
                    const layerData = this.scene.map.getLayer('Obstacles');
                    if (layerData?.tilemapLayer) {
                        obstacleLayer = layerData.tilemapLayer;
                        console.log('[LIGHT] Found obstacles layer via map.getLayer()');
                    } 
                    // Try via getAllLayers
                    else if (typeof this.scene.map.getAllLayers === 'function') {
                        const allLayers = this.scene.map.getAllLayers();
                        const obstacleLayerData = allLayers.find(layer => 
                            layer.name?.toLowerCase().includes('obstacle'));
                        if (obstacleLayerData?.tilemapLayer) {
                            obstacleLayer = obstacleLayerData.tilemapLayer;
                            console.log('[LIGHT] Found obstacles layer via map.getAllLayers()');
                        }
                    }
                }
                
                // Apply the Light2D pipeline if found
                if (obstacleLayer) {
                    console.log('[LIGHT] Applying Light2D pipeline to existing obstacle layer');
                    
                    // Get the renderer and check if Light2D is available
                    const renderer = this.scene.sys.game.renderer;
                    if (renderer && renderer.pipelines && renderer.pipelines.get('Light2D')) {
                        // Look for any associated normal maps for better lighting
                        const tilesets = obstacleLayer.tileset;
                        
                        // Log available tilesets for debugging
                        console.log('[LIGHT] Obstacle layer tilesets:', tilesets ? tilesets.map(t => t.name) : 'none');
                        
                        // If we have tilesets, check for potential normal maps
                        let hasNormalMaps = false;
                        if (tilesets && tilesets.length > 0) {
                            tilesets.forEach(tileset => {
                                // Check possible normal map variations (_n, _normal, etc.)
                                const normalVariations = [
                                    `${tileset.name}_n`,
                                    `${tileset.name}_norm`,
                                    `${tileset.name}_normal`,
                                    `${tileset.name}Normal`
                                ];
                                
                                // Try each possible normal map name
                                for (const normalKey of normalVariations) {
                                    if (this.scene.textures.exists(normalKey)) {
                                        console.log(`[LIGHT] Found normal map for tileset: ${normalKey}`);
                                        tileset.setNormalMap(normalKey);
                                        hasNormalMaps = true;
                                        break;
                                    }
                                }
                            });
                        }
                        
                        // Apply Light2D pipeline to the obstacle layer
                        obstacleLayer.setPipeline('Light2D');
                        
                        // Force the pipeline to use normals and configure light properties
                        obstacleLayer.setPipelineData('light2d', { 
                            normalsEnabled: true,
                            lightInfluence: 1.0, // Full light influence
                            normalMap: true      // Use normal maps if available
                        });
                        
                        // If no normal maps were found, we can create procedural ones
                        if (!hasNormalMaps) {
                            console.log('[LIGHT] No normal maps found, enabling procedural lighting');
                            
                            // Create a stronger diffuse and ambient light setup
                            this.scene.lights.setAmbientColor(0x222255); // Deeper blue ambient light
                            
                            // Add default point light with larger radius if none exist
                            if (!this.pointLights || this.pointLights.length === 0) {
                                console.log('[LIGHT] Adding default point light for obstacle visibility');
                                const defaultLight = this.scene.lights.addLight(
                                    this.scene.cameras.main.width / 2,
                                    this.scene.cameras.main.height / 2,
                                    400, // Very large radius for better visibility
                                    0xffffff,
                                    1.0 // Full intensity
                                );
                                this.pointLights = this.pointLights || [];
                                this.pointLights.push(defaultLight);
                            }
                        }
                        
                        // Store reference for cleanup
                        this.obstacleLayerWithLighting = obstacleLayer;
                        
                        // Make sure lights are enabled with proper settings
                        this.scene.lights.enable();
                        
                        // Set stronger ambient light
                        this.scene.lights.setAmbientColor(0x333355); // Bluish ambient light
                        
                        // Update point lights to ensure they have higher intensity
                        if (this.pointLights && this.pointLights.length > 0) {
                            console.log(`[LIGHT] Boosting intensity of ${this.pointLights.length} point lights`);
                            this.pointLights.forEach(light => {
                                if (light) {
                                    // Increase light intensity and radius for better visibility
                                    light.intensity = Math.min(3.0, light.intensity * 2.0);
                                    light.radius = Math.max(light.radius, 200); // Ensure minimum size
                                }
                            });
                        }
                        
                        // Also apply lighting to player
                        this.applyLightingToPlayer();
                        
                        return true;
                    } else {
                        console.warn('[LIGHT] Light2D pipeline not available');
                    }
                } else {
                    console.warn('[LIGHT] Could not find obstacle layer to apply lighting');
                }
            }
        } catch (err) {
            console.error('[LIGHT] Error applying lighting to obstacles:', err);
        }
        
        return false;
    }

    /**
     * Apply lighting to player sprite
     * Makes the player sprite react to light sources
     */
    applyLightingToPlayer() {
        try {
            if (!this.player || !this.player.sprite) {
                console.warn('[LIGHT] No player sprite available for lighting');
                return false;
            }
            
            console.log('[LIGHT] Applying Light2D pipeline to player sprite');
            
            // Get the renderer and check if Light2D is available
            const renderer = this.scene.sys.game.renderer;
            if (renderer && renderer.pipelines && renderer.pipelines.get('Light2D')) {
                // Apply the pipeline to the player sprite
                this.player.sprite.setPipeline('Light2D');
                
                // Configure pipeline data
                this.player.sprite.setPipelineData('light2d', {
                    normalsEnabled: true,
                    lightInfluence: 0.8,   // Reduce light influence slightly to prevent over-darkening
                    normalMap: true        // Use normal maps if available
                });
                
                // Also apply to diver arm if it exists
                if (this.scene.diverArm) {
                    this.scene.diverArm.setPipeline('Light2D');
                    this.scene.diverArm.setPipelineData('light2d', {
                        normalsEnabled: true,
                        lightInfluence: 0.8,
                        normalMap: true
                    });
                }
                
                // IMPORTANT: Create a default player light to ensure player is visible
                if (!this.playerDefaultLight) {
                    console.log('[LIGHT] Creating default player light to prevent initial darkness');
                    this.playerDefaultLight = this.scene.lights.addLight(
                        this.player.sprite.x,
                        this.player.sprite.y,
                        150,        // Good radius to light up the player
                        0xaaddff,   // Slightly blue-tinted light
                        0.7         // Medium intensity
                    );
                    
                    // Add to point lights array for management
                    if (!this.pointLights) this.pointLights = [];
                    this.pointLights.push(this.playerDefaultLight);
                }
                
                // Make sure ambient light is set to a reasonable value
                this.scene.lights.setAmbientColor(0x444466); // Medium-bright blue-tinted ambient
                
                // Store references for cleanup
                this.playerWithLighting = this.player.sprite;
                this.armWithLighting = this.scene.diverArm;
                
                return true;
            } else {
                console.warn('[LIGHT] Light2D pipeline not available for player');
            }
        } catch (err) {
            console.error('[LIGHT] Error applying lighting to player:', err);
        }
        
        return false;
    }

    /**
     * Update the player's default light position and properties
     * Called from update method
     */
    updatePlayerDefaultLight() {
        if (!this.playerDefaultLight || !this.player || !this.player.sprite) return;
        
        // Update position to follow player
        this.playerDefaultLight.x = this.player.sprite.x;
        this.playerDefaultLight.y = this.player.sprite.y;
    }

    /**
     * Apply lighting and glow effects to jellyfish
     * This adds visual glow effects to jellyfish without modifying the JellyfishSystem
     */
    applyLightingToJellyfish() {
        try {
            if (!this.scene.jellyfishSystem) {
                console.warn('[LIGHT] No jellyfish system available');
                return false;
            }
            
            // Complete cleanup of previous effects
            console.log('[LIGHT] Making jellyfish emit light directly - no separate sprites');
            this.cleanupAllJellyfishLights();
            
            // Remove all event listeners
            this.scene.events.off('jellyfishDestroyed', null, this);
            this.scene.events.off('update', this.updateJellyfishGlows, this);
            
            // Reset flags
            this.jellyfishDestroyListenerAdded = false;
            this.jellyfishGlowUpdateAdded = false;
            
            // Get all jellyfish from the system
            const jellyfishObjects = this.scene.jellyfishSystem?.jellyfish || [];
            
            // Exit early if no jellyfish
            if (jellyfishObjects.length === 0) {
                return false;
            }
            
            console.log(`[LIGHT] Making ${jellyfishObjects.length} jellyfish emit light through darkness`);
            
            // Create fresh empty array for tracking
            this.jellyfishGlows = [];
            
            // Add cleanup listeners
            this.scene.events.on('jellyfishDestroyed', (jellyfish) => {
                if (jellyfish && jellyfish.hasGlowEffect) {
                    this.cleanupJellyfishLightEffects(jellyfish);
                }
            }, this);
            
            this.scene.events.once('shutdown', () => {
                this.cleanupAllJellyfishLights();
            });
            
            this.jellyfishDestroyListenerAdded = true;
            
            // Light punch-through configuration
            jellyfishObjects.forEach(jellyfish => {
                // Skip if not valid
                if (!jellyfish || !jellyfish.active) return;
                
                // Save original properties for restoration later
                jellyfish.originalDepth = jellyfish.depth;
                jellyfish.originalTint = jellyfish.tint;
                jellyfish.originalBlendMode = jellyfish.blendMode;
                jellyfish.originalAlpha = jellyfish.alpha;
                jellyfish.originalPipeline = jellyfish.pipeline;
                
                try {
                    // 1. Make jellyfish itself have emissive properties
                    // Ensure jellyfish is rendered ABOVE the dark overlay
                    const overlayDepth = this.overlay ? this.overlay.depth : 10;
                    jellyfish.setDepth(overlayDepth + 5);
                    
                    // Add bright glow effect to the jellyfish
                    jellyfish.setBlendMode(Phaser.BlendModes.ADD);
                    jellyfish.setTint(0x50C0FF); // Bright cyan-blue
                    
                    // CRITICAL: Remove the jellyfish from the Light2D pipeline to prevent 
                    // the flashlight from causing layering effects
                    if (jellyfish.resetPipeline) {
                        // Store current pipeline if any
                        if (jellyfish.pipeline) {
                            jellyfish.originalPipeline = jellyfish.pipeline;
                        }
                        
                        // Remove from the Light2D pipeline to prevent flashlight interaction
                        jellyfish.resetPipeline();
                        console.log(`[LIGHT] Removed jellyfish from Light2D pipeline to prevent double lighting`);
                    }
                    
                    // 2. Add a separate point light near the jellyfish (not affecting the jellyfish itself)
                    let pointLight = null;
                    if (this.scene.lights) {
                        pointLight = this.scene.lights.addLight(
                            jellyfish.x, 
                            jellyfish.y, 
                            100,        // Radius for the light
                            0x50C0FF,   // Matching color
                            0.7         // Slightly reduced intensity to prevent overbrightening
                        );
                        
                        if (this.pointLights) this.pointLights.push(pointLight);
                    }
                    
                    // 3. Creating a hole in the darkness by adding the jellyfish directly to the overlay mask
                    if (this.overlay && this.overlay.mask) {
                        // Create a clone of the jellyfish at the same position
                        const jellyfishMask = this.scene.add.image(jellyfish.x, jellyfish.y, 'jelly_fish');
                        jellyfishMask.setScale(jellyfish.scaleX * 1.2, jellyfish.scaleY * 1.2); // Slightly larger
                        jellyfishMask.setAlpha(1);
                        jellyfishMask.setTint(0xFFFFFF); // White for mask
                        
                        // Keep the mask INVISIBLE to the player but used for masking
                        jellyfishMask.setVisible(false);
                        
                        // Add this to the bitmapMask that's already cutting through the darkness
                        // This effectively makes the jellyfish shape cut a hole in the darkness
                        if (typeof this.overlay.mask.bitmapMask?.add === 'function') {
                            this.overlay.mask.bitmapMask.add(jellyfishMask);
                            console.log(`[LIGHT] Added jellyfish shape to darkness mask`);
                        } else {
                            // If we can't add to existing mask, create a dedicated mask just for this jellyfish
                            const jellyfishCutout = this.scene.add.renderTexture(
                                this.scene.cameras.main.centerX,
                                this.scene.cameras.main.centerY,
                                this.scene.cameras.main.width,
                                this.scene.cameras.main.height
                            );
                            
                            // Clear with transparent
                            jellyfishCutout.clear();
                            
                            // Draw white where the jellyfish is
                            jellyfishCutout.draw(jellyfishMask, 
                                jellyfishMask.x, 
                                jellyfishMask.y
                            );
                            
                            // Create bitmap mask from this render texture
                            const jellyfishMaskBitmap = jellyfishCutout.createBitmapMask();
                            
                            // Apply to a rectangle over the scene
                            const jellyfishMaskRect = this.scene.add.rectangle(
                                this.scene.cameras.main.centerX,
                                this.scene.cameras.main.centerY,
                                this.scene.cameras.main.width,
                                this.scene.cameras.main.height,
                                0xFFFFFF, 0 // Invisible
                            );
                            
                            jellyfishMaskRect.setMask(jellyfishMaskBitmap);
                            jellyfishMaskRect.setDepth(this.overlay.depth + 1);
                            
                            // Store for updates and cleanup
                            jellyfish.maskImage = jellyfishMask;
                            jellyfish.maskTexture = jellyfishCutout;
                            jellyfish.maskBitmap = jellyfishMaskBitmap;
                            jellyfish.maskRect = jellyfishMaskRect;
                        }
                    }
                    
                    // Store references for cleanup and updates
                    jellyfish.pointLight = pointLight;
                    jellyfish.hasGlowEffect = true;
                    jellyfish.glowId = jellyfish.id || `jellyfish_${this.jellyfishGlows.length}`;
                    
                    // Add to tracking array
                    this.jellyfishGlows.push({
                        jellyfish,
                        pointLight,
                        id: jellyfish.glowId
                    });
                    
                    console.log(`[LIGHT] Made jellyfish at (${jellyfish.x}, ${jellyfish.y}) self-illuminating`);
                } catch (err) {
                    console.warn(`[LIGHT] Could not make jellyfish self-illuminating:`, err);
                }
            });
            
            // Set up update handler
            this.scene.events.on('update', this.updateJellyfishGlows, this);
            this.jellyfishGlowUpdateAdded = true;
            
            return true;
        } catch (err) {
            console.error('[LIGHT] Error making jellyfish self-illuminating:', err);
            return false;
        }
    }

    /**
     * Clean up all jellyfish light effects
     */
    cleanupAllJellyfishLights() {
        if (!this.jellyfishGlows) {
            this.jellyfishGlows = [];
            return;
        }
        
        console.log(`[LIGHT] Restoring ${this.jellyfishGlows.length} jellyfish to original state`);
        
        try {
            // Clean up all tracked jellyfish effects
            this.jellyfishGlows.forEach(glowData => {
                if (glowData.jellyfish) {
                    this.cleanupJellyfishLightEffects(glowData.jellyfish);
                } else if (glowData.pointLight && this.pointLights) {
                    // Clean up orphaned point light
                    const lightIndex = this.pointLights.indexOf(glowData.pointLight);
                    if (lightIndex !== -1) {
                        this.pointLights.splice(lightIndex, 1);
                    }
                }
            });
            
            // Also check all jellyfish directly
            if (this.scene.jellyfishSystem?.jellyfish) {
                this.scene.jellyfishSystem.jellyfish.forEach(jellyfish => {
                    if (jellyfish && (jellyfish.hasGlowEffect || jellyfish.pointLight)) {
                        this.cleanupJellyfishLightEffects(jellyfish);
                    }
                });
            }
            
            // Clear tracking array
            this.jellyfishGlows = [];
        } catch (err) {
            console.error('[LIGHT] Error in cleanupAllJellyfishLights:', err);
            this.jellyfishGlows = [];
        }
    }

    /**
     * Helper method to clean up a jellyfish's light effects
     */
    cleanupJellyfishLightEffects(jellyfish) {
        if (!jellyfish) return;
        
        try {
            // Check if jellyfish is still a valid game object before accessing properties
            if (!jellyfish.scene || !jellyfish.active) {
                console.log('[LIGHT] Skipping cleanup for destroyed jellyfish');
                return;
            }
            
            // Restore original sprite properties
            if (jellyfish.originalDepth !== undefined) {
                jellyfish.setDepth(jellyfish.originalDepth);
            }
            
            if (jellyfish.originalBlendMode !== undefined) {
                jellyfish.setBlendMode(jellyfish.originalBlendMode);
            } else {
                jellyfish.setBlendMode(Phaser.BlendModes.NORMAL);
            }
            
            if (jellyfish.originalTint !== undefined) {
                jellyfish.setTint(jellyfish.originalTint);
            } else {
                jellyfish.clearTint();
            }
            
            if (jellyfish.originalAlpha !== undefined) {
                jellyfish.setAlpha(jellyfish.originalAlpha);
            } else {
                jellyfish.setAlpha(1.0);
            }
            
            // Restore original pipeline if we changed it
            if (jellyfish.originalPipeline !== undefined && jellyfish.setPipeline) {
                jellyfish.setPipeline(jellyfish.originalPipeline);
            }
            
            // Clean up light
            if (jellyfish.pointLight) {
                if (this.pointLights) {
                    const lightIndex = this.pointLights.indexOf(jellyfish.pointLight);
                    if (lightIndex !== -1) {
                        this.pointLights.splice(lightIndex, 1);
                    }
                }
                jellyfish.pointLight = null;
            }
            
            // Clean up mask components
            ['maskImage', 'maskTexture', 'maskBitmap', 'maskRect'].forEach(prop => {
                if (jellyfish[prop]) {
                    if (jellyfish[prop].destroy) {
                        jellyfish[prop].destroy();
                    }
                    jellyfish[prop] = null;
                }
            });
            
            // Clear flags
            jellyfish.hasGlowEffect = false;
            jellyfish.glowId = null;
            jellyfish.originalDepth = undefined;
            jellyfish.originalBlendMode = undefined;
            jellyfish.originalTint = undefined;
            jellyfish.originalAlpha = undefined;
            jellyfish.originalPipeline = undefined;
        } catch (err) {
            console.error('[LIGHT] Error cleaning up jellyfish effects:', err);
        }
    }

    /**
     * Update jellyfish glow positions
     */
    updateJellyfishGlows() {
        if (!this.jellyfishGlows || this.jellyfishGlows.length === 0) return;
        
        this.jellyfishGlows.forEach(glowData => {
            if (!glowData || !glowData.jellyfish || !glowData.jellyfish.active) return;
            
            const { jellyfish, pointLight } = glowData;
            
            // Update point light position
            if (pointLight) {
                pointLight.x = jellyfish.x;
                pointLight.y = jellyfish.y;
            }
            
            // Update mask image position if it exists
            if (jellyfish.maskImage && jellyfish.maskImage.active) {
                jellyfish.maskImage.x = jellyfish.x;
                jellyfish.maskImage.y = jellyfish.y;
            }
        });
    }

    /**
     * Apply lighting to jellyfish charge pickups to make them glow in darkness
     * Similar to jellyfish lighting but optimized for smaller charge pickup objects
     */
    applyLightingToChargePickups() {
        try {
            if (!this.scene.jellyfishSystem) {
                return false;
            }
            
            // Get all charge pickups from the jellyfish system
            const chargePickups = this.scene.jellyfishSystem.chargePickups || [];
            
            // Exit early if no pickups
            if (chargePickups.length === 0) {
                return false;
            }
            
            console.log(`[LIGHT] Making ${chargePickups.length} charge pickups emit light through darkness`);
            
            // Create or ensure tracking array exists
            if (!this.chargePickupGlows) {
                this.chargePickupGlows = [];
            }
            
            // Clean up any stale references first
            this.cleanupStaleChargePickups();
            
            // Add event listener for scene shutdown if not already added
            if (!this.chargePickupCleanupListenerAdded) {
                this.scene.events.once('shutdown', () => {
                    this.cleanupAllChargePickupLights();
                });
                this.chargePickupCleanupListenerAdded = true;
            }
            
            // Apply lighting effects to each charge pickup
            chargePickups.forEach(pickup => {
                // Skip if not valid or already processed
                if (!pickup || !pickup.active || pickup.hasGlowEffect) return;
                
                // Save original properties for restoration later
                pickup.originalDepth = pickup.depth;
                pickup.originalTint = pickup.tint;
                pickup.originalBlendMode = pickup.blendMode;
                pickup.originalAlpha = pickup.alpha;
                pickup.originalPipeline = pickup.pipeline;
                
                try {
                    // 1. Make charge pickup itself have emissive properties
                    // Ensure pickup is rendered ABOVE the dark overlay
                    const overlayDepth = this.overlay ? this.overlay.depth : 10;
                    pickup.setDepth(overlayDepth + 5);
                    
                    // SIGNIFICANTLY ENHANCED bright green glow effect
                    pickup.setBlendMode(Phaser.BlendModes.ADD);
                    pickup.setTint(0x80FF40); // Much brighter, more vivid green that will stand out more
                    pickup.setAlpha(3.5); // Higher alpha for more intense glow
                    
                    // Remove from the Light2D pipeline to prevent flashlight interaction
                    if (pickup.resetPipeline) {
                        pickup.resetPipeline();
                    }
                    
                    // 2. Creating a hole in the darkness with the charge pickup shape
                    if (this.overlay && this.overlay.mask) {
                        // Create a clone of the pickup at the same position
                        const pickupMask = this.scene.add.image(pickup.x, pickup.y, 'jelly_charge');
                        pickupMask.setScale(pickup.scaleX * 2.5, pickup.scaleY * 2.5); // Larger mask for more glow effect
                        pickupMask.setAlpha(1);
                        pickupMask.setTint(0xFFFFFF);
                        pickupMask.setVisible(false); // Invisible but used for masking
                        
                        // Create a dedicated mask for this pickup
                        const pickupCutout = this.scene.add.renderTexture(
                            this.scene.cameras.main.centerX,
                            this.scene.cameras.main.centerY,
                            this.scene.cameras.main.width,
                            this.scene.cameras.main.height
                        );
                        
                        // Clear with transparent
                        pickupCutout.clear();
                        
                        // Draw white where the pickup is
                        pickupCutout.draw(pickupMask, pickupMask.x, pickupMask.y);
                        
                        // Create bitmap mask
                        const pickupMaskBitmap = pickupCutout.createBitmapMask();
                        
                        // Apply to rectangle
                        const pickupMaskRect = this.scene.add.rectangle(
                            this.scene.cameras.main.centerX,
                            this.scene.cameras.main.centerY,
                            this.scene.cameras.main.width,
                            this.scene.cameras.main.height,
                            0xFFFFFF, 0 // Invisible
                        );
                        
                        pickupMaskRect.setMask(pickupMaskBitmap);
                        pickupMaskRect.setDepth(this.overlay.depth + 1);
                        
                        // Store for updates and cleanup
                        pickup.maskImage = pickupMask;
                        pickup.maskTexture = pickupCutout;
                        pickup.maskBitmap = pickupMaskBitmap;
                        pickup.maskRect = pickupMaskRect;
                    }
                    
                    // Make pulsing effect more intense with higher alpha values
                    if (pickup.scene) {
                        pickup.glowTween = pickup.scene.tweens.add({
                            targets: pickup,
                            alpha: { from: 1.4, to: 2.0 }, // Higher alpha range for more intense pulsing
                            duration: 600, // Faster pulsing
                            yoyo: true,
                            repeat: -1,
                            ease: 'Sine.easeInOut'
                        });
                    }
                    
                    // Store references for cleanup and updates
                    pickup.hasGlowEffect = true;
                    pickup.glowId = `charge_${this.chargePickupGlows.length}`;
                    
                    // Add to tracking array
                    this.chargePickupGlows.push({
                        pickup,
                        id: pickup.glowId
                    });
                    
                    console.log(`[LIGHT] Made charge pickup at (${pickup.x}, ${pickup.y}) self-illuminating with INTENSE green glow`);
                } catch (err) {
                    console.warn(`[LIGHT] Could not make charge pickup self-illuminating:`, err);
                }
            });
            
            return true;
        } catch (err) {
            console.error('[LIGHT] Error making charge pickups self-illuminating:', err);
            return false;
        }
    }

    /**
     * Clean up all charge pickup light effects
     */
    cleanupAllChargePickupLights() {
        if (!this.chargePickupGlows) {
            this.chargePickupGlows = [];
            return;
        }
        
        console.log(`[LIGHT] Cleaning up ${this.chargePickupGlows.length} charge pickup light effects`);
        
        try {
            // Clean up all tracked charge pickup effects
            this.chargePickupGlows.forEach(glowData => {
                if (glowData.pickup) {
                    this.cleanupChargePickupLightEffects(glowData.pickup);
                }
            });
            
            // Clear tracking array
            this.chargePickupGlows = [];
        } catch (err) {
            console.error('[LIGHT] Error in cleanupAllChargePickupLights:', err);
            this.chargePickupGlows = [];
        }
    }

    /**
     * Helper method to clean up a charge pickup's light effects
     */
    cleanupChargePickupLightEffects(pickup) {
        if (!pickup) return;
        
        try {
            // Check if pickup is still a valid game object before accessing properties
            if (!pickup.scene || !pickup.active) {
                console.log('[LIGHT] Skipping cleanup for destroyed charge pickup');
                return;
            }
            
            // Stop any active tweens
            if (pickup.glowTween) {
                pickup.glowTween.stop();
                pickup.glowTween = null;
            }
            
            // Restore original sprite properties
            if (pickup.originalDepth !== undefined) {
                pickup.setDepth(pickup.originalDepth);
            }
            
            if (pickup.originalBlendMode !== undefined) {
                pickup.setBlendMode(pickup.originalBlendMode);
            } else {
                pickup.setBlendMode(Phaser.BlendModes.NORMAL);
            }
            
            if (pickup.originalTint !== undefined) {
                pickup.setTint(pickup.originalTint);
            } else {
                pickup.clearTint();
            }
            
            if (pickup.originalAlpha !== undefined) {
                pickup.setAlpha(pickup.originalAlpha);
            } else {
                pickup.setAlpha(1.0);
            }
            
            // Restore original pipeline if we changed it
            if (pickup.originalPipeline !== undefined && pickup.setPipeline) {
                pickup.setPipeline(pickup.originalPipeline);
            }
            
            // Clean up mask components
            ['maskImage', 'maskTexture', 'maskBitmap', 'maskRect'].forEach(prop => {
                if (pickup[prop]) {
                    if (pickup[prop].destroy) {
                        pickup[prop].destroy();
                    }
                    pickup[prop] = null;
                }
            });
            
            // Clear flags
            pickup.hasGlowEffect = false;
            pickup.glowId = null;
            pickup.originalDepth = undefined;
            pickup.originalBlendMode = undefined;
            pickup.originalTint = undefined;
            pickup.originalAlpha = undefined;
            pickup.originalPipeline = undefined;
        } catch (err) {
            console.error('[LIGHT] Error cleaning up charge pickup effects:', err);
        }
    }

    /**
     * Update charge pickup glow positions
     */
    updateChargePickupGlows() {
        if (!this.chargePickupGlows || this.chargePickupGlows.length === 0) return;
        
        this.chargePickupGlows.forEach(glowData => {
            if (!glowData || !glowData.pickup || !glowData.pickup.active) return;
            
            const { pickup } = glowData;
            
            // Update mask image position if it exists
            if (pickup.maskImage && pickup.maskImage.active) {
                pickup.maskImage.x = pickup.x;
                pickup.maskImage.y = pickup.y;
            }
        });
    }

    /**
     * Clean up stale charge pickup references
     */
    cleanupStaleChargePickups() {
        if (!this.chargePickupGlows) return;
        
        try {
            // Remove any pickups that no longer exist or are inactive
            this.chargePickupGlows = this.chargePickupGlows.filter(glowData => {
                if (!glowData.pickup || !glowData.pickup.active) {
                    // Clean up mask components if they exist
                    ['maskImage', 'maskTexture', 'maskBitmap', 'maskRect'].forEach(prop => {
                        if (glowData.pickup && glowData.pickup[prop]) {
                            if (glowData.pickup[prop].destroy) {
                                glowData.pickup[prop].destroy();
                            }
                            glowData.pickup[prop] = null;
                        }
                    });
                    
                    return false; // Remove from array
                }
                return true; // Keep in array
            });
        } catch (err) {
            console.error('[LIGHT] Error cleaning up stale charge pickups:', err);
        }
    }
} 