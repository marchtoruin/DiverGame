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
        this.currentZoneType = null; // Track the current zone type the player is in
        
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
        this.checkInterval = 100; // Check every 100ms to avoid too many checks
        
        console.log('LightingSystem initialized with flashlight support');
        
        // Add a debug visualization method call after a delay
        // to help verify zone creation
        if (this.scene.physics.config.debug) {
            this.scene.time.delayedCall(1000, this.debugZones, [], this);
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
            
            // Enable the light pipeline
            this.scene.cameras.main.setRenderToTexture('Light2D');
            console.log('Light2D pipeline enabled');
            
            // Create the light mask for obstacles
            this.createLightMask();
            
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
            
            // If still not found, try the first object layer for testing
            if (!lightingLayer && map.objects.length > 0) {
                console.warn('No lighting layer found, using first object layer for testing:', map.objects[0].name);
                lightingLayer = map.objects[0];
            }
            
            // Process the lighting layer if found
            if (lightingLayer && lightingLayer.objects && lightingLayer.objects.length > 0) {
                console.log(`Processing ${lightingLayer.objects.length} objects from layer: ${lightingLayer.name}`);
                
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
                    
                    // Add to zones collection
                    this.lightingZones.push(zone);
                    console.log(`Added ${zoneType} lighting zone at (${obj.x}, ${obj.y}) with size ${obj.width}x${obj.height}`);
                    
                    // Create debug visualization
                    this.createDebugVisual(zone);
                });
                
                console.log(`Processed ${this.lightingZones.length} lighting zones`);
            } else {
                console.warn('No valid lighting layer found in the map, or layer has no objects');
            }
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
            'default': 0x0000ff,
            'dim': 0x00ff00,
            'dark': 0xffff00,
            'black': 0xff0000
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
        
        this.debugText.setText(`Lighting: ${this.currentZoneType || 'default'} (${this.currentLightLevel.toFixed(2)})${progressText}`);
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
     * Update lighting based on player position
     * @param {number} delta - Time elapsed since last update
     */
    update(delta) {
        if (!this.player || !this.overlay) return;
        
        // Always update the zone-based lighting, even with flashlight on
        // to maintain the proper darkness levels
        
        // Normalize delta to prevent jerky transitions on frame drops
        const normalizedDelta = Math.min(delta, 32); // Cap at ~30fps equivalent to avoid huge jumps
        
        // Make sure we're getting the right player coordinates
        const playerX = this.player.sprite ? this.player.sprite.x : this.player.x;
        const playerY = this.player.sprite ? this.player.sprite.y : this.player.y;
        
        // Get player velocity for fast movement prediction
        let playerVelocityX = 0;
        let playerVelocityY = 0;
        
        if (this.player.sprite && this.player.sprite.body) {
            playerVelocityX = this.player.sprite.body.velocity.x;
            playerVelocityY = this.player.sprite.body.velocity.y;
        } else if (this.player.body) {
            playerVelocityX = this.player.body.velocity.x;
            playerVelocityY = this.player.body.velocity.y;
        }
        
        // Check velocity magnitude to see if player is moving fast (likely boosting)
        const velocityMagnitude = Math.sqrt(
            (playerVelocityX * playerVelocityX) + 
            (playerVelocityY * playerVelocityY)
        );
        
        // Calculate if this is mainly vertical movement (for boosting detection)
        const isMainlyVertical = Math.abs(playerVelocityY) > Math.abs(playerVelocityX * 1.5);
        const isMovingDown = playerVelocityY > 0;
        const isVerticalBoosting = isMainlyVertical && isMovingDown && velocityMagnitude > 500;
        
        // Update flashlight rotation based on player's direction
        if (this.flashlightEnabled && this.player) {
            // First, check if player has sprite with flipX property
            if (this.player.sprite && this.player.sprite.flipX !== undefined) {
                // Use the same logic as bullets - flipX determines left/right direction
                this.flashlightRotation = this.player.sprite.flipX ? Math.PI : 0; // left or right
            } 
            // Then check if the flashlightRotation has been set directly from GameScene
            else if (this.scene.flashlightRotation !== undefined) {
                this.flashlightRotation = this.scene.flashlightRotation;
            }
            // Fallback to other properties if sprite.flipX isn't available
            else if (this.player.sprite && this.player.sprite.rotation !== undefined) {
                this.flashlightRotation = this.player.sprite.rotation;
            } else if (this.player.rotation !== undefined) {
                this.flashlightRotation = this.player.rotation;
            } else if (this.player.direction) {
                // Convert direction to rotation if needed
                const directions = {
                    'left': Math.PI, // left is Pi radians (180 degrees)
                    'right': 0,      // right is 0 radians (0 degrees)
                    'up': -Math.PI/2,// up is -Pi/2 radians (-90 degrees)
                    'down': Math.PI/2 // down is Pi/2 radians (90 degrees)
                };
                this.flashlightRotation = directions[this.player.direction] || 0;
            } else if (this.player.facing) {
                // Try to use facing direction
                const directions = {
                    'left': Math.PI,
                    'right': 0,
                    'up': -Math.PI/2,
                    'down': Math.PI/2
                };
                this.flashlightRotation = directions[this.player.facing] || 0;
            }
        }
        
        // COMPLETELY NEW APPROACH: For vertical boost detection, we'll use position tracking
        // between frames and more aggressive checking
        let shouldCheckZones = true;
        let inAnyZone = false;
        let highestLightLevel = 0;
        let enteredNewZone = false;
        let currentZoneType = null;
        
        // Initialize previous position if it's the first frame
        if (this.prevPlayerX === null || this.prevPlayerY === null) {
            this.prevPlayerX = playerX;
            this.prevPlayerY = playerY;
        }
        
        // Check if we need to perform a comprehensive zone check
        const currentTime = this.scene.time.now;
        const timeSinceLastCheck = currentTime - this.lastCheckTime;
        const distanceMoved = Phaser.Math.Distance.Between(
            this.prevPlayerX, this.prevPlayerY,
            playerX, playerY
        );
        
        // Check if we have a vertical boost situation that requires special handling
        if (isVerticalBoosting && distanceMoved > 50) {
            // Debug visualization
            if (this.scene.physics.config.debug) {
                // Clean up any previous debug graphics
                if (this.debugBoostLines) {
                    this.debugBoostLines.destroy();
                }
                
                // Create new debug graphics
                this.debugBoostLines = this.scene.add.graphics();
                this.debugBoostLines.lineStyle(2, 0xff0000, 1);
                this.debugBoostLines.moveTo(this.prevPlayerX, this.prevPlayerY);
                this.debugBoostLines.lineTo(playerX, playerY);
                this.debugBoostLines.setDepth(1000);
                
                // Add debug text
                if (this.debugBoostText) {
                    this.debugBoostText.destroy();
                }
                this.debugBoostText = this.scene.add.text(
                    10, 100,
                    `BOOSTING: Down ${distanceMoved.toFixed(0)}px, Speed: ${velocityMagnitude.toFixed(0)}`,
                    { fontSize: '14px', fill: '#ff0000', backgroundColor: '#000000' }
                ).setScrollFactor(0).setDepth(1000);
                
                // Clean up after a delay
                this.scene.time.delayedCall(500, () => {
                    if (this.debugBoostLines) {
                        this.debugBoostLines.destroy();
                        this.debugBoostLines = null;
                    }
                    if (this.debugBoostText) {
                        this.debugBoostText.destroy();
                        this.debugBoostText = null;
                    }
                });
            }
            
            // Check all potential zones between previous and current position
            // by creating a series of check points along the movement path
            const checkPoints = [];
            const segmentCount = Math.max(5, Math.ceil(distanceMoved / 30)); // At least one check every 30px
            
            // Generate check points along the movement path
            for (let i = 0; i <= segmentCount; i++) {
                const ratio = i / segmentCount;
                const checkX = this.prevPlayerX + (playerX - this.prevPlayerX) * ratio;
                const checkY = this.prevPlayerY + (playerY - this.prevPlayerY) * ratio;
                checkPoints.push({ x: checkX, y: checkY });
            }
            
            // Also add perpendicular check points for wider detection
            const extendedCheckPoints = [...checkPoints];
            
            if (isMainlyVertical) {
                // For vertical movement, add points to left and right
                const spacing = 40; // Spacing between parallel lines
                
                checkPoints.forEach(point => {
                    extendedCheckPoints.push({ x: point.x - spacing, y: point.y });
                    extendedCheckPoints.push({ x: point.x + spacing, y: point.y });
                    extendedCheckPoints.push({ x: point.x - spacing*2, y: point.y });
                    extendedCheckPoints.push({ x: point.x + spacing*2, y: point.y });
                });
            }
            
            // Check each zone against all check points
            for (const zone of this.lightingZones) {
                // Skip default zones
                if (zone.type === 'default') continue;
                
                // Check if any of our check points are inside this zone
                for (const point of extendedCheckPoints) {
                    if (Phaser.Geom.Rectangle.Contains(zone.rect, point.x, point.y)) {
                        inAnyZone = true;
                        currentZoneType = zone.type;
                        
                        // Get the light level for this zone
                        const zoneLevel = this.zoneLevels[zone.type] || 0;
                        
                        // Track the highest (darkest) light level
                        if (zoneLevel > highestLightLevel) {
                            highestLightLevel = zoneLevel;
                        }
                        
                        // Check if this is a different zone than we were in previously
                        if (this.currentZoneType !== zone.type) {
                            enteredNewZone = true;
                            
                            if (this.scene.physics.config.debug) {
                                console.log(`Player entered new ${zone.type} zone (boost check)`);
                            }
                        }
                        
                        // Once we've found a zone match, we can stop checking this zone
                        break;
                    }
                }
            }
            
            // Mark that we've done a special boost check
            this.lastCheckTime = currentTime;
            shouldCheckZones = false; // Skip the regular zone check
        }
        // Regular movement - check every interval or if significant position change
        else if (timeSinceLastCheck > this.checkInterval || distanceMoved > 30) {
            // Standard position-based detection for normal speeds
            for (const zone of this.lightingZones) {
                // Skip default zones for checking
                if (zone.type === 'default') continue;
                
                // Check if player is in this zone
                if (Phaser.Geom.Rectangle.Contains(zone.rect, playerX, playerY)) {
                    inAnyZone = true;
                    currentZoneType = zone.type;
                    
                    // Get the light level for this zone
                    const zoneLevel = this.zoneLevels[zone.type] || 0;
                    
                    // Track the highest (darkest) light level
                    if (zoneLevel > highestLightLevel) {
                        highestLightLevel = zoneLevel;
                    }
                    
                    // Check if this is a different zone than we were in previously
                    if (this.currentZoneType !== zone.type) {
                        enteredNewZone = true;
                        
                        if (this.scene.physics.config.debug) {
                            console.log(`Player entered new ${zone.type} zone`);
                        }
                    }
                }
            }
            
            // Mark that we've done a regular check
            this.lastCheckTime = currentTime;
            shouldCheckZones = false; // Skip additional checks
        }
        
        // Update the previous position for next frame check
        this.prevPlayerX = playerX;
        this.prevPlayerY = playerY;
        
        // Only update target light level if:
        // 1. We entered a new zone OR
        // 2. We weren't in any zone before and now we are
        if (enteredNewZone || (inAnyZone && !this.currentZoneType)) {
            this.targetLightLevel = highestLightLevel;
            this.currentZoneType = currentZoneType;
            
            // Store the transition start time and value for smooth easing
            this.transitionStartTime = this.scene.time.now;
            this.transitionStartValue = this.currentLightLevel;
            this.transitionDuration = Math.abs(this.targetLightLevel - this.currentLightLevel) * 5000; // Dynamic duration based on distance
            
            if (this.scene.physics.config.debug) {
                console.log(`Set lighting level to ${currentZoneType} (${this.targetLightLevel})`);
                console.log(`Transition duration: ${this.transitionDuration}ms`);
            }
        } 
        // ADDED: Keep track of the deepest level reached for darkness persistence
        // This prevents returning to brightness when leaving all zones
        else if (inAnyZone && this.currentZoneType) {
            // Update to the highest level if a darker zone is entered
            if (highestLightLevel > this.targetLightLevel) {
                this.targetLightLevel = highestLightLevel;
                this.currentZoneType = currentZoneType;
                
                // Store the transition start time and value for smooth easing
                this.transitionStartTime = this.scene.time.now;
                this.transitionStartValue = this.currentLightLevel;
                this.transitionDuration = Math.abs(this.targetLightLevel - this.currentLightLevel) * 5000;
                
                if (this.scene.physics.config.debug) {
                    console.log(`Updating to deeper darkness level: ${currentZoneType} (${this.targetLightLevel})`);
                }
            }
            // ADDED: When ascending, we should transition to the lighter zone
            // But only when we're actually in that zone (controlled ascent)
            else if (highestLightLevel < this.targetLightLevel && currentZoneType) {
                // Track which zones we've passed through while ascending
                if (!this.ascendingZoneHistory) {
                    this.ascendingZoneHistory = {};
                }
                
                // Record that we've been in this zone during ascent
                this.ascendingZoneHistory[currentZoneType] = true;
                
                // Only switch to a lighter level if we're in a zone with appropriate light level
                // This prevents instantly going to full brightness when briefly outside any zone
                this.targetLightLevel = highestLightLevel;
                this.currentZoneType = currentZoneType;
                
                // Store the transition start time and value for smooth easing
                this.transitionStartTime = this.scene.time.now;
                this.transitionStartValue = this.currentLightLevel;
                // Slower transition when getting brighter (twice as slow)
                this.transitionDuration = Math.abs(this.targetLightLevel - this.currentLightLevel) * 10000;
                
                if (this.scene.physics.config.debug) {
                    console.log(`Ascending to lighter level: ${currentZoneType} (${this.targetLightLevel})`);
                }
            }
        }
        
        // Process vertical boost detection specially for ascent as well
        if (isVerticalBoosting) {
            // Calculate if this is mainly upward vertical movement (for ascent detection)
            const isAscending = isMainlyVertical && !isMovingDown;
            
            // If ascending rapidly, we need to detect all zones we pass through
            if (isAscending && this.currentZoneType !== 'default' && this.targetLightLevel > 0) {
                // Check each zone against all check points to see if we're passing through lighter zones
                for (const zone of this.lightingZones) {
                    // Skip default and darker zones
                    if (zone.type === 'default') continue;
                    
                    // Get zone light level
                    const zoneLevel = this.zoneLevels[zone.type] || 0;
                    
                    // Only consider lighter zones than our current state
                    if (zoneLevel >= this.targetLightLevel) continue;
                    
                    // If any of our extended check points are in this zone while ascending
                    for (const point of extendedCheckPoints) {
                        if (Phaser.Geom.Rectangle.Contains(zone.rect, point.x, point.y)) {
                            // We're passing through a lighter zone while ascending
                            // Use it as our new target if we haven't already
                            if (zoneLevel < this.targetLightLevel) {
                                this.targetLightLevel = zoneLevel;
                                this.currentZoneType = zone.type;
                                
                                // Store the transition start time and value for smooth easing
                                this.transitionStartTime = this.scene.time.now;
                                this.transitionStartValue = this.currentLightLevel;
                                // Slower transition when getting brighter (twice as slow)
                                this.transitionDuration = Math.abs(this.targetLightLevel - this.currentLightLevel) * 10000;
                                
                                if (this.scene.physics.config.debug) {
                                    console.log(`Rapid ascent - moving to lighter zone: ${zone.type} (${zoneLevel})`);
                                }
                            }
                            break; // No need to check other points for this zone
                        }
                    }
                }
            }
        }
        
        // Gradually transition to target light level with advanced easing
        if (this.currentLightLevel !== this.targetLightLevel) {
            this.transitionActive = true;
            
            // Calculate progress based on time elapsed (time-based easing instead of step-based)
            const elapsed = this.scene.time.now - (this.transitionStartTime || 0);
            const progress = Math.min(1, elapsed / Math.max(1, this.transitionDuration));
            
            // Apply cubic easing function: t³ (cubic ease-in-out)
            // This creates very slow starts and ends with a gradual acceleration in the middle
            let easedProgress;
            
            if (progress < 0.5) {
                // First half - ease in (cubic)
                easedProgress = 4 * Math.pow(progress, 3);
            } else {
                // Second half - ease out (cubic)
                easedProgress = 1 - Math.pow(-2 * progress + 2, 3) / 2;
            }
            
            // Apply additional fine-grained easing for extra smoothness at transition endpoints
            if (progress < 0.1) {
                // Extra slow at the very beginning (0-10%)
                easedProgress = easedProgress * (progress * 10); // Linear ramp up
            } else if (progress > 0.9) {
                // Extra slow at the very end (90-100%)
                const endProgress = (1 - progress) * 10; // 1.0 at 90%, 0.0 at 100%
                easedProgress = 1 - ((1 - easedProgress) * endProgress); // Linear ramp down
            }
            
            // Calculate the new light level by interpolating between start and target values
            this.currentLightLevel = this.transitionStartValue + (this.targetLightLevel - this.transitionStartValue) * easedProgress;
            
            // Update overlay alpha with rounded value to prevent visual glitches
            const roundedAlpha = Math.round(this.currentLightLevel * 1000) / 1000;
            this.overlay.setAlpha(roundedAlpha);
            
            // Check if transition is complete (with a small threshold)
            if (Math.abs(this.currentLightLevel - this.targetLightLevel) < 0.001 || progress >= 1) {
                this.currentLightLevel = this.targetLightLevel;
                this.transitionActive = false;
                
                if (this.scene.physics.config.debug) {
                    console.log(`Lighting transition complete: ${this.currentZoneType} (${this.currentLightLevel})`);
                }
            }
        }
        
        // Update flashlight if enabled
        if (this.flashlightEnabled) {
            this.updateFlashlightCone();
        }
        
        // Update any dynamic point lights
        this.updatePointLights(delta);
        
        // Update debug text if enabled
        this.updateDebugText();
    }
    
    /**
     * Update all point lights
     * @param {number} delta - Time elapsed since last update
     */
    updatePointLights(delta) {
        if (!this.playerLight) return;
        
        // Update the player light position
        this.playerLight.update();
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
        
        // Initialize graphics object for the mask
        // This will be used either directly or as a fallback
        this.flashlightMask = this.scene.make.graphics({add: false});
        
        // Create the magenta point light at the origin for visual effect
        this.flashlightPointLight = this.scene.add.sprite(0, 0, 'bullet')
            .setScale(0.6)
            .setAlpha(0.8)
            .setTint(0xff00ff) // Magenta color
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(902) 
            .setVisible(false);
            
        // Add a simple glow effect for the flashlight origin
        this.flashlightGlow = this.scene.add.sprite(0, 0, 'bullet')
            .setScale(1.1)
            .setAlpha(0.7)
            .setTint(0xff40ff) // Slightly lighter magenta
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(901)
            .setVisible(false);
            
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

        // Get player position
        const playerX = this.player?.sprite ? this.player.sprite.x : this.player?.x || 0;
        const playerY = this.player?.sprite ? this.player.sprite.y : this.player?.y || 0;

        // Directly check if player is facing left using sprite.flipX 
        const isFacingLeft = this.player.sprite && this.player.sprite.flipX;
        
        // Position the magenta light
        let lightX, lightY;
        
        if (this.markerOffsetX !== undefined && this.markerOffsetY !== undefined) {
            // Use the magenta marker position from the sprite
            const markerX = isFacingLeft ? -this.markerOffsetX : this.markerOffsetX;
            lightX = playerX + markerX;
            lightY = playerY + this.markerOffsetY;
        } else {
            // Fallback to the hard-coded values
            const lightOffsetX = isFacingLeft ? -15 : 15;
            const lightOffsetY = 115;
            lightX = playerX + lightOffsetX;
            lightY = playerY + lightOffsetY;
        }
        
        // Position the point light and glow
        if (this.flashlightPointLight) {
            this.flashlightPointLight.setPosition(lightX, lightY);
        }
        
        if (this.flashlightGlow) {
            this.flashlightGlow.setPosition(lightX, lightY);
            
            // Add pulsing effect to the glow
            if (!this.flashlightGlow.timeline) {
                this.flashlightGlow.timeline = this.scene.tweens.add({
                    targets: this.flashlightGlow,
                    alpha: { from: 0.5, to: 0.9 },
                    scale: { from: 1.0, to: 1.5 },
                    duration: 500,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
        }
        
        if (this.usingCustomMask && this.customMaskImage) {
            // Update custom image mask position
            // Move the mask in the direction the player is facing, but not too far
            const extraOffset = isFacingLeft ? -500 : 500; // Move it 500 pixels in facing direction
            this.customMaskImage.setPosition(lightX + extraOffset, lightY);
            
            // Flip the mask image based on direction
            this.customMaskImage.setScale(isFacingLeft ? -1 : 1, 1);
            
            // Proper origin should be set on the image itself
            // If needed, adjust rotation here
        } else {
            // Update the geometry mask with the cone shape
            this.flashlightMask.clear();
            this.flashlightMask.fillStyle(0xffffff, 1);
            
            // Calculate the cone's end points
            const coneLength = 600; // Length of the cone
            const coneWidth = 350;  // Width at the end of the cone
            
            // Draw a cone/triangle shape
            if (isFacingLeft) {
                // Facing left: cone opens to the left
                this.flashlightMask.beginPath();
                this.flashlightMask.moveTo(lightX, lightY); // Start at light origin
                this.flashlightMask.lineTo(lightX - coneLength, lightY - coneWidth/2); // Top end point
                this.flashlightMask.lineTo(lightX - coneLength, lightY + coneWidth/2); // Bottom end point
                this.flashlightMask.closePath();
                this.flashlightMask.fillPath();
            } else {
                // Facing right: cone opens to the right
                this.flashlightMask.beginPath();
                this.flashlightMask.moveTo(lightX, lightY); // Start at light origin
                this.flashlightMask.lineTo(lightX + coneLength, lightY - coneWidth/2); // Top end point
                this.flashlightMask.lineTo(lightX + coneLength, lightY + coneWidth/2); // Bottom end point
                this.flashlightMask.closePath();
                this.flashlightMask.fillPath();
            }
        }
    }

    /**
     * Toggle the flashlight on/off
     * @param {string} customMaskKey - Optional key for a custom mask image
     */
    toggleFlashlight(customMaskKey = null) {
        this.flashlightEnabled = !this.flashlightEnabled;
        
        // Create flashlight if needed
        if (this.flashlightEnabled && !this.lightMask) {
            this.initializeFlashlight(customMaskKey);
        }
        
        if (this.flashlightEnabled) {
            // If the player has a sprite, check flipX first to determine direction
            if (this.player && this.player.sprite) {
                if (this.player.sprite.flipX !== undefined) {
                    // Use flipX to determine direction (same as bullets)
                    this.flashlightRotation = this.player.sprite.flipX ? Math.PI : 0;
                    console.log(`Flashlight enabled, using player flipX: ${this.player.sprite.flipX}`);
                }
                // If no flipX, try rotation
                else if (this.player.rotation !== undefined) {
                    this.flashlightRotation = this.player.rotation;
                } else if (this.player.sprite.rotation !== undefined) {
                    this.flashlightRotation = this.player.sprite.rotation;
                } else {
                    // Default to right-facing if no rotation found
                    this.flashlightRotation = 0;
                }
            } else {
                // Default to right-facing if no player sprite
                this.flashlightRotation = 0;
            }
            
            // Show the point light and glow at the flashlight origin
            if (this.flashlightPointLight) this.flashlightPointLight.setVisible(true);
            if (this.flashlightGlow) this.flashlightGlow.setVisible(true);
            
            // Make sure to apply the mask to the overlay
            if (this.lightMask && this.overlay) {
                this.overlay.setMask(this.lightMask);
            }
            
            // Update flashlight position and rotation
            this.updateFlashlightCone();
            
            console.log(`Flashlight enabled with ${this.usingCustomMask ? 'custom image' : 'graphics-based'} mask`);
        } else {
            // Hide all flashlight elements when turning it off
            if (this.flashlightPointLight) this.flashlightPointLight.setVisible(false);
            if (this.flashlightGlow) this.flashlightGlow.setVisible(false);
            
            // CRITICAL FIX: Clear the mask from the overlay when turning off
            if (this.overlay) {
                this.overlay.clearMask();
            }
            
            console.log(`Flashlight disabled`);
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
        }
        
        // Clean up existing mask if any
        if (this.lightMask) {
            this.overlay.clearMask();
            this.lightMask = null;
        }
        
        // Reinitialize with the custom mask
        this.initializeFlashlight(imageKey);
        
        // Restore the previous state
        this.flashlightEnabled = wasEnabled;
        
        // Update visibility of elements
        if (this.flashlightPointLight) {
            this.flashlightPointLight.setVisible(wasEnabled);
        }
        if (this.flashlightGlow) {
            this.flashlightGlow.setVisible(wasEnabled);
        }
        
        // Update position if enabled
        if (wasEnabled) {
            this.updateFlashlightCone();
        }
        
        return true;
    }
} 