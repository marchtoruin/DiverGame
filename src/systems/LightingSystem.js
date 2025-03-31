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
        
        // Light masks for obstacles
        this.lightMask = null;
        
        // Flashlight properties
        this.flashlightEnabled = false;
        this.flashlightMask = null;
        this.flashlightRotation = 0;
        
        // Previous position tracking for boost detection
        this.prevPlayerX = null;
        this.prevPlayerY = null;
        this.lastCheckTime = 0;
        this.checkInterval = 0; // CHANGED: Set to 0 to check every frame always
        this.highSpeedThreshold = 50; // CHANGED: Lowered to catch more high-speed movement
        this.intermediatePointCount = 20; // INCREASED: More sampling points
        this.lastProcessedZoneType = 'default'; // Track last processed zone for state validation
        this.zoneExitCooldown = 10000; // INCREASED: Much longer persistence for lighting zones
        this.lastZoneEnterTime = 0; // When we last entered a non-default zone
        
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
            
            // If still not found, try to find any layer containing the word 'light'
            if (!lightingLayer) {
                for (const layer of map.objects) {
                    if (layer.name && layer.name.toLowerCase().includes('light')) {
                        lightingLayer = layer;
                        console.log(`Found lighting layer by partial match: ${layer.name}`);
                        break;
                    }
                }
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
        if (!this.player || !this.overlay) return;

        // Normalize delta to prevent jerky transitions on frame drops
        const normalizedDelta = Math.min(delta, 32);

        // Get player coordinates
        const playerX = this.player.sprite ? this.player.sprite.x : this.player.x;
        const playerY = this.player.sprite ? this.player.sprite.y : this.player.y;

        // Calculate distance moved since last check
        const distanceMoved = this.prevPlayerX !== null ? 
            Phaser.Math.Distance.Between(
                this.prevPlayerX, this.prevPlayerY,
                playerX, playerY
            ) : 0;
        
        // Check if movement is primarily vertical
        const isVerticalMovement = this.prevPlayerX !== null && 
            Math.abs(playerY - this.prevPlayerY) > Math.abs(playerX - this.prevPlayerX) * 1.2;
            
        // High-speed movement detection - boost or falling quickly
        const isHighSpeedMovement = distanceMoved > this.highSpeedThreshold;
        
        // Special case for vertical boosting - requires even more careful handling
        const isVerticalBoosting = isVerticalMovement && isHighSpeedMovement && 
            Math.abs(playerY - this.prevPlayerY) > 100; // Reduced threshold to catch more vertical boosts
            
        // DEBUG OUTPUT: Log vertical boost detection
        if (isVerticalBoosting && this.inDebugMode) {
            console.log(`%c🚀 VERTICAL BOOST DETECTED - ${Math.abs(playerY - this.prevPlayerY).toFixed(0)}px`, 
                         'background: #300; color: #f80; font-weight: bold');
        }
        
        // CRITICAL CHANGE: Always check zones every frame during vertical movement
        const shouldCheckZones = true;
        
        if (shouldCheckZones) {
            // Track zones we pass through
            const detectedZones = [];
            
            // When moving at high speed, check intermediate positions along the path
            const positionsToCheck = [];
            
            // Always check current position first
            positionsToCheck.push({ x: playerX, y: playerY, isCurrent: true });
            
            // If moving fast and we have previous position data, add several intermediate points
            if ((isHighSpeedMovement || isVerticalMovement) && this.prevPlayerX !== null) {
                // Add many more intermediate positions for fast movements
                // CRITICAL IMPROVEMENT: Use many more sampling points for vertical movement
                const pointCount = Math.min(
                    120, // INCREASED: Much higher sample density for vertical boosts
                    Math.max(
                        this.intermediatePointCount,
                        isVerticalBoosting ? Math.floor(distanceMoved / 4) : // INCREASED: Much denser sampling 
                        isVerticalMovement ? Math.floor(distanceMoved / 10) : 
                        Math.floor(distanceMoved / 30)
                    )
                );
                
                if (this.inDebugMode && isVerticalMovement) {
                    console.log(`Using ${pointCount} sampling points for ${distanceMoved.toFixed(0)}px movement`);
                }
                
                // Create a dense sampling grid between previous and current position
                for (let i = 1; i <= pointCount; i++) {
                    const ratio = i / (pointCount + 1);
                    const intermediateX = this.prevPlayerX + (playerX - this.prevPlayerX) * ratio;
                    const intermediateY = this.prevPlayerY + (playerY - this.prevPlayerY) * ratio;
                    positionsToCheck.push({ x: intermediateX, y: intermediateY, ratio });
                }
                
                // Sort positions from previous to current to check in order of movement
                positionsToCheck.sort((a, b) => {
                    if (a.isCurrent) return 1; // Current position always last
                    if (b.isCurrent) return -1;
                    return (a.ratio || 0) - (b.ratio || 0); // Sort by ratio otherwise
                });
            }
            
            // Check each position against all lighting zones
            // Important: we need to check ALL zones at each position, not stop at first match
            for (const position of positionsToCheck) {
                let positionZones = [];
                
                // First pass: check for bright zones which override all other zone types
                for (const zone of this.lightingZones) {
                    if (zone.type === 'bright' && Phaser.Geom.Rectangle.Contains(zone.rect, position.x, position.y)) {
                        positionZones.push({
                            type: zone.type,
                            level: 0, // Explicit full brightness
                            priority: 10, // Highest priority
                            position: { ...position }
                        });
                    }
                }
                
                // If no bright zone found, check for other zone types
                if (positionZones.length === 0) {
                    // Check all zones and collect them
                    for (const zone of this.lightingZones) {
                        // Skip default zones
                        if (zone.type === 'default') continue;
                        
                        if (Phaser.Geom.Rectangle.Contains(zone.rect, position.x, position.y)) {
                            // Higher priority for dark zones during vertical boosting
                            const basePriority = zone.type === 'black' ? 9 : 
                                              zone.type === 'dark' ? 8 : 
                                              zone.type === 'dim' ? 7 : 5;
                            
                            // Boost priority for darkness zones during vertical boost
                            const priority = isVerticalBoosting && (zone.type === 'black' || zone.type === 'dark') ? 
                                          basePriority + 2 : basePriority;
                                           
                            positionZones.push({
                                type: zone.type,
                                level: this.zoneLevels[zone.type],
                                priority: priority,
                                position: { ...position }
                            });
                        }
                    }
                }
                
                // If we found any zones at this position, add the highest priority one to our detected zones
                if (positionZones.length > 0) {
                    // Sort by priority (highest first)
                    positionZones.sort((a, b) => b.priority - a.priority);
                    detectedZones.push(positionZones[0]);
                    
                    // Store the last non-default zone we found
                    this.lastNonDefaultZoneType = positionZones[0].type;
                    this.lastNonDefaultZoneLevel = positionZones[0].level;
                    
                    if (this.inDebugMode && position.isCurrent) {
                        console.log(`Current position in ${positionZones[0].type} zone`);
                    }
                }
            }
            
            // Update the previous position for next frame check
            this.prevPlayerX = playerX;
            this.prevPlayerY = playerY;
            this.lastCheckTime = this.scene.time.now;
            
            // Now determine which zone to transition to
            let targetZoneType = null; // Changed from 'default' to null to indicate no new zone detected
            let targetLevel = null;
            let enteredNewZone = false;
            
            // If we found any zones, use the highest priority one for the target
            if (detectedZones.length > 0) {
                // CRITICAL: Sort all detected zones by priority
                detectedZones.sort((a, b) => b.priority - a.priority);
                
                // Get the target zone (highest priority for darkness)
                const targetZone = detectedZones[0]; 
                
                targetZoneType = targetZone.type;
                targetLevel = targetZone.level;
                
                // CRITICAL: Always update the last non-default zone we've seen
                if (targetZoneType !== 'default') {
                    this.lastNonDefaultZoneType = targetZoneType;
                    this.lastNonDefaultZoneLevel = targetLevel;
                    this.lastZoneEnterTime = this.scene.time.now;
                }
                
                // Check if we've entered a new zone type that's different from current
                if (this.currentZoneType !== targetZoneType) {
                    enteredNewZone = true;
                    
                    if (this.inDebugMode) {
                        console.log(`%c🔄 Zone Change: ${this.currentZoneType} → ${targetZoneType}`, 
                                    'background: #003; color: #0ff; font-weight: bold');
                    }
                }
            } else {
                // CRITICAL CHANGE: Don't reset to default if no zone found - retain last zone
                if (this.persistentMode && this.lastNonDefaultZoneType) {
                    // Keep using the last non-default zone we found
                    if (this.inDebugMode) {
                        console.log(`No zone detected - persisting previous zone: ${this.lastNonDefaultZoneType}`);
                    }
                } 
            }
            
            // Handle zone transitions - ONLY when we have a valid target or need to change
            if (enteredNewZone && targetZoneType) {
                // For vertical boosting into darkness, use special handling
                const enteringDarkArea = targetLevel > this.currentLightLevel;
                
                if (isVerticalBoosting) {
                    // Always log vertical boost transitions
                    console.log(`%c⬇️ VERTICAL BOOST into ${targetZoneType} zone`,
                                'background: #300; color: #ff0; font-weight: bold');
                    
                    // Use specialized vertical boost transition handler
                    this.handleVerticalBoostTransition(targetZoneType, targetLevel, enteringDarkArea, distanceMoved);
                } else {
                    // Normal transition for other movement
                    this.transitionStartTime = this.scene.time.now;
                    this.transitionStartValue = this.currentLightLevel;
                    
                    // Set target light level based on new zone
                    this.targetLightLevel = targetLevel;
                    this.currentZoneType = targetZoneType;
                    this.lastProcessedZoneType = targetZoneType;

                    // Calculate transition duration based on light level difference and movement speed
                    if (targetZoneType === 'bright') {
                        // Force immediate transition to full brightness
                        this.transitionDuration = 400; // Quick transition for bright zones
                    } else {
                        const levelDifference = Math.abs(this.targetLightLevel - this.currentLightLevel);
                        
                        // Faster transitions for vertical movement
                        if (isVerticalMovement && enteringDarkArea) {
                            this.transitionDuration = Math.max(200, levelDifference * 400);
                        } 
                        // Fast transitions for entering darkness with any high-speed
                        else if (isHighSpeedMovement && enteringDarkArea) {
                            this.transitionDuration = Math.max(250, levelDifference * 500);
                        } 
                        // Normal high-speed transitions for other cases
                        else if (isHighSpeedMovement) {
                            this.transitionDuration = Math.max(400, levelDifference * 800);
                        } 
                        // Default transition speed
                        else {
                            this.transitionDuration = Math.max(500, levelDifference * 1000);
                        }
                    }

                    if (this.inDebugMode) {
                        console.log(`Transitioning to ${targetZoneType} (${this.targetLightLevel}) over ${this.transitionDuration}ms`);
                    }
                }
            } 
            // CRITICAL ADDITION: Special case when no zone found but we have a last non-default zone
            else if (!targetZoneType && this.persistentMode && this.lastNonDefaultZoneType && 
                    this.currentZoneType !== this.lastNonDefaultZoneType) {
                // We should return to our last non-default zone
                console.log(`%c🔒 Persisting last non-default zone: ${this.lastNonDefaultZoneType}`,
                           'background: #030; color: #0f0; font-weight: bold');
                
                this.transitionStartTime = this.scene.time.now;
                this.transitionStartValue = this.currentLightLevel;
                this.targetLightLevel = this.lastNonDefaultZoneLevel;
                this.currentZoneType = this.lastNonDefaultZoneType;
                this.transitionDuration = 400; // Fast transition back to last valid zone
            }
        }

        // Handle the actual transition
        if (this.currentLightLevel !== this.targetLightLevel) {
            this.transitionActive = true;

            // Calculate transition progress
            const elapsed = this.scene.time.now - (this.transitionStartTime || 0);
            const progress = Math.min(1, elapsed / Math.max(1, this.transitionDuration));

            // Apply smooth easing
            let easedProgress;
            if (this.currentZoneType === 'bright') {
                // Linear transition for bright zones
                easedProgress = progress;
            } else {
                // Smooth easing for other transitions
                if (progress < 0.5) {
                    easedProgress = 4 * Math.pow(progress, 3);
                } else {
                    easedProgress = 1 - Math.pow(-2 * progress + 2, 3) / 2;
                }
            }

            // Update light level
            this.currentLightLevel = this.transitionStartValue + 
                (this.targetLightLevel - this.transitionStartValue) * easedProgress;

            // Update overlay with rounded alpha to prevent visual glitches
            const roundedAlpha = Math.round(this.currentLightLevel * 1000) / 1000;
            this.overlay.setAlpha(roundedAlpha);

            // Check if transition is complete
            if (Math.abs(this.currentLightLevel - this.targetLightLevel) < 0.001 || progress >= 1) {
                this.currentLightLevel = this.targetLightLevel;
                this.transitionActive = false;
                
                if (this.inDebugMode) {
                    console.log(`Transition complete - now at ${this.currentZoneType} lighting level ${this.currentLightLevel.toFixed(2)}`);
                }
            }
        }

        // Update flashlight if enabled
        if (this.flashlightEnabled) {
            this.updateFlashlightCone();
        }

        // Update debug text if enabled
        this.updateDebugText();
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
                            if (prop.value.startsWith('#')) {
                                color = parseInt(prop.value.substring(1), 16);
                            } else if (prop.value.startsWith('0x')) {
                                color = parseInt(prop.value, 16);
                            } else {
                                color = parseInt(prop.value);
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
            const coneAngle = Math.PI / 2.5; // ~72 degree cone
            const coneLength = 250;
            
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
        
        // Debug logging
        if (this.scene?.physics?.config?.debug) {
            console.log(`Flashlight updated - angle: ${Phaser.Math.RadToDeg(angle).toFixed(1)}°, ` +
                       `position: (${x.toFixed(1)}, ${y.toFixed(1)}), ` +
                       `using: ${this.usingCustomMask ? 'custom image mask' : 'geometry mask'}`);
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
            `Persistent: ${this.persistentMode ? 'ON' : 'OFF'}`,
            `Cooldown: ${Math.max(0, this.lastZoneEnterTime - now)}ms left`
        ].join('\n');
        
        this.debugText.setText(text);
    }
} 