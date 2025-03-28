import { GAME_WIDTH, GAME_HEIGHT } from '../utils/Constants';

/**
 * Manages tilemap creation and processing from Tiled JSON
 */
export default class TilemapSystem {
    constructor(scene) {
        console.log('TilemapSystem constructor called');
        
        if (!scene) {
            console.error('TilemapSystem created without a valid scene!');
            throw new Error('TilemapSystem requires a valid scene');
        }
        
        this.scene = scene;
        this.map = null;
        this.layers = {};
        this.objectLayers = {}; // Add storage for object layers
        this.playerSpawnPoint = { x: 200, y: 200 }; // Default spawn point
        this.layerDebug = false;
        
        // Map from tileset image paths to texture keys
        // This maps the embedded tileset image paths to our preloaded texture keys
        this.imageKeyMap = {
            // Direct mappings from tileset names to image keys
            'Blue_background': 'underwater_bg',
            'blue_background': 'underwater_bg',
            'blue_background1': 'underwater_bg',
            'Background': 'underwater_bg',
            'background': 'underwater_bg',
            'blackAndBlue': 'black_and_blue',
            'blackAndBlue1': 'black_and_blue',
            'black_and_blue': 'black_and_blue',
            'black_and_blue1': 'black_and_blue',
            'Rocks_Small': 'rock2',
            'rocks_small': 'rock2',
            'Rocks_Large': 'rock3',
            'rocks_large': 'rock3',
            'Air_Pocket': 'air_pocket1',
            'air_pocket': 'air_pocket1',
            'Air_Pocket1': 'air_pocket1',
            'air_pocket1': 'air_pocket1',
            'Air_Pocket2': 'air_pocket2',
            'air_pocket2': 'air_pocket2',
            'Air_Pocket3': 'air_pocket3',
            'air_pocket3': 'air_pocket3',
            
            // Image path mappings (for embedded tilesets)
            '../underwater_bg.png': 'underwater_bg', 
            '../black_and_blue.png': 'black_and_blue',
            '../rock2.png': 'rock2',
            '../rock3.png': 'rock3',
            '../air_pocket1.png': 'air_pocket1',
            '../air_pocket2.png': 'air_pocket2', 
            '../air_pocket3.png': 'air_pocket3',
            
            // Filename-only mappings
            'underwater_bg.png': 'underwater_bg',
            'black_and_blue.png': 'black_and_blue',
            'rock2.png': 'rock2',
            'rock3.png': 'rock3',
            'air_pocket1.png': 'air_pocket1',
            'air_pocket2.png': 'air_pocket2',
            'air_pocket3.png': 'air_pocket3',
            
            // FirstGID-based mappings (fallbacks for specific tilesets)
            'firstgid_1': 'underwater_bg',
            'firstgid_1901': 'black_and_blue',
            'firstgid_3801': 'rock2',
            'firstgid_4201': 'rock3'
        };
    }

    addTilesetToMap(map, tileset) {
        try {
            // Use AssetManagementSystem to get the correct texture key
            const textureKey = this.scene.assetSystem.getTilesetKey(tileset.name);
            
            console.log(`Adding tileset ${tileset.name} with texture key: ${textureKey}`);
            return map.addTilesetImage(tileset.name, textureKey);
        } catch (error) {
            console.error(`Error adding tileset ${tileset.name}:`, error);
            return null;
        }
    }

    /**
     * Process the map creation and emit the event once everything is ready
     * @param {string} key - The key of the map to create
     * @returns {boolean} Whether the map was created successfully
     */
    createFromTiledJSON(key) {
        try {
            console.log('Starting tilemap creation with key:', key);
            
            // Set the current level in MapConfigurationSystem
            if (this.scene.mapConfigSystem) {
                this.scene.mapConfigSystem.setCurrentLevel(key);
            }
            
            // Check if the key is available in the cache
            const cache = this.scene.cache.tilemap;
            
            if (!cache.has(key)) {
                console.error('ERROR: Tilemap with key', key, 'not found in cache!');
                this.createFallbackMap();
                return false;
            }
            
            const cacheData = cache.get(key);
            
            // ENHANCED DEBUGGING: Print debug info about the AirPockets layer
            console.log('Analyzing map data for air pockets:');
            if (cacheData.data && cacheData.data.layers) {
                const airPocketsLayer = cacheData.data.layers.find(layer => 
                    layer.name === 'AirPockets' || layer.name.toLowerCase() === 'airpockets'
                );
                
                if (airPocketsLayer) {
                    console.log('AirPockets layer found:', {
                        id: airPocketsLayer.id,
                        name: airPocketsLayer.name,
                        objectCount: airPocketsLayer.objects?.length || 0
                    });
                    
                    if (airPocketsLayer.objects && airPocketsLayer.objects.length > 0) {
                        console.log('AirPocket objects in JSON:', airPocketsLayer.objects.length);
                        airPocketsLayer.objects.forEach((obj, idx) => {
                            console.log(`AirPocket #${idx} JSON:`, JSON.stringify(obj, null, 2));
                        });
                    } else {
                        console.error('AirPockets layer exists but has no objects!');
                    }
                } else {
                    console.error('No AirPockets layer found in map JSON!');
                }
            }
            
            // Validate required layers exist
            if (cacheData.data && cacheData.data.layers) {
                const layers = cacheData.data.layers;
                const requiredLayers = ['Background', 'Obstacles'];
                const missingLayers = requiredLayers.filter(required => 
                    !layers.some(layer => 
                        layer.name.toLowerCase() === required.toLowerCase() ||
                        layer.name.toLowerCase().includes(required.toLowerCase())
                    )
                );
                
                if (missingLayers.length > 0) {
                    console.error(`Missing required layers: ${missingLayers.join(', ')}`);
                    console.warn('Will attempt to continue, but map may not function correctly');
                }
            }
            
            // Get available texture keys for all checks
            const availableTextures = this.scene.textures.getTextureKeys();
            
            if (cacheData.data) {
                const mapData = this.createEmbeddedTilemapData();
                
                // Create a Phaser.Tilemaps.Tilemap instance from the processed JSON
                this.map = this.scene.make.tilemap({ 
                    data: mapData || cacheData.data, 
                    tileWidth: cacheData.data.tilewidth, 
                    tileHeight: cacheData.data.tileheight,
                    width: cacheData.data.width,
                    height: cacheData.data.height,
                    insertNull: false // CRITICAL: Don't insert nulls - causes rendering issues
                });
                
                // CRITICAL: Prevent texture tiling that causes the repeating background
                this.map.setRenderOrder('right-down');
                
                // Set the map origin to 0,0 to ensure proper alignment
                this.map.setPosition(0, 0);
                
                // Create layers using the helper method
                this.layers = this.createLayers(this.map);
                
                // Try to process objects (like spawn points)
                this.processMapObjects();
                
                // CRITICAL: Make sure the tilemapSystem is available to other systems by setting it on the scene
                this.scene.tilemapSystem = this;
                
                // CRITICAL: Store the original map data for direct access if needed
                this.mapData = cacheData.data;
                
                // Only emit the tilemapCreated event if the map and layers were created successfully
                if (this.map && this.layers) {
                    console.log('Tilemap creation successful - emitting tilemapCreated event with full map');
                    
                    // Set a flag that tilemap is ready
                    this.isMapReady = true;
                    
                    // Add a small delay to ensure all systems are ready to receive the event
                    this.scene.time.delayedCall(50, () => {
                        // Emit the event with the full map data so systems can access it directly
                        this.scene.events.emit('tilemapCreated', this.map, cacheData.data);
                        
                        // Emit a subsequent event specifically for object processing
                        this.scene.events.emit('mapObjectsReady', this.objectLayers);
                    });
                } else {
                    console.warn('Failed to create complete tilemap');
                }
                
                return true;
            } else {
                console.error('Invalid tilemap data for key:', key);
                this.createFallbackMap();
                return false;
            }
        } catch (error) {
            console.error('Error creating tilemap from Tiled JSON:', error);
            this.createFallbackMap();
            return false;
        }
    }
    
    createEmbeddedTilemapData() {
        // Return null to use the existing data from the cache directly
        return null;
    }
    
    processMapObjects() {
        if (!this.map || !this.map.objects) {
            console.log('No objects to process in the map');
            return;
        }
        
        console.log(`Map has ${this.map.objects.length} object layers`);
        
        // Log ALL layer names in the map for debugging
        console.log('Map contains these object layers:');
        this.map.objects.forEach(layer => {
            console.log(`- Layer: "${layer.name}" with ${layer.objects?.length || 0} objects`);
        });
        
        // Process each object layer
        this.map.objects.forEach(objectLayer => {
            console.log(`Processing object layer: ${objectLayer.name} with ${objectLayer.objects.length} objects`);
            
            // Store object layer in objectLayers collection
            const normalizedName = objectLayer.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            this.objectLayers[normalizedName] = objectLayer;
            
            // Validate object layer
            if (!objectLayer.objects || objectLayer.objects.length === 0) {
                console.warn(`Object layer ${objectLayer.name} has no objects`);
                return;
            }
            
            // Process each layer by its specific name to ensure proper handling
            switch(objectLayer.name) {
                case 'Lighting':
                    console.log('Processing Lighting layer with object types: dim/dark/black');
                    // Pass lighting objects to the LightingSystem
                    if (this.scene.lightingSystem) {
                        this.scene.lightingSystem.processLightingObjects(objectLayer.objects);
                    }
                    break;
                    
                case 'PlayerSpawn':
                    console.log('Processing PlayerSpawn layer');
                    // We expect only one spawn point in this layer
                    const spawnPoint = objectLayer.objects[0]; // Just use the first one
                    if (spawnPoint) {
                        this.playerSpawnPoint = {
                            x: spawnPoint.x,
                            y: spawnPoint.y
                        };
                        console.log(`Found player spawn point at ${this.playerSpawnPoint.x}, ${this.playerSpawnPoint.y}`);
                    } else {
                        console.warn('No spawn point found in PlayerSpawn layer');
                    }
                    break;
                    
                case 'AirPockets':
                    console.log('Processing AirPockets layer with air_pocket objects');
                    // Show details of all objects in this layer
                    objectLayer.objects.forEach((obj, index) => {
                        // Convert properties array to object for easier viewing
                        const props = {};
                        if (obj.properties && Array.isArray(obj.properties)) {
                            obj.properties.forEach(prop => {
                                props[prop.name] = prop.value;
                            });
                        } else if (obj.properties) {
                            Object.assign(props, obj.properties);
                        }
                        
                        console.log(`AirPocket object ${index}:`, {
                            name: obj.name,
                            x: obj.x, 
                            y: obj.y,
                            properties: props
                        });
                        
                        // Fix common naming issues - ensure objects have the right name
                        if (!obj.name || obj.name === '' || obj.name.toLowerCase() === 'airpocket') {
                            console.log(`Fixing unnamed air pocket object at (${obj.x}, ${obj.y}) to have name 'air_pocket'`);
                            obj.name = 'air_pocket';
                        }
                    });
                    
                    // Count objects with the correct name
                    const validAirPockets = objectLayer.objects.filter(obj => 
                        obj.name === 'air_pocket' || 
                        obj.name.toLowerCase() === 'airpocket' || 
                        obj.name === ''
                    );
                    
                    console.log(`Found ${validAirPockets.length} objects that could be air_pockets in AirPockets layer`);
                    
                    // If we have objects with no name or incorrect names, fix them
                    if (validAirPockets.length !== objectLayer.objects.length) {
                        console.log(`Warning: ${objectLayer.objects.length - validAirPockets.length} objects in AirPockets layer are not named 'air_pocket'`);
                    }
                    
                    // Send air pocket objects to the AirPocketSystem
                    if (this.scene.airPocketSystem) {
                        // Add the layer name to each object for filtering
                        const airPocketObjects = objectLayer.objects.map(obj => ({
                            ...obj,
                            layerName: 'AirPockets'
                        }));
                        
                        // Use the specialized method for processing air pockets
                        this.scene.airPocketSystem.processAirPockets(airPocketObjects);
                    }
                    break;
                    
                default:
                    console.log(`Skipping unrecognized layer: ${objectLayer.name}`);
            }
        });
        
        // Notify game systems that map objects have been processed
        this.scene.events.emit('mapObjectsProcessed', this.objectLayers);
    }
    
    /**
     * Get an object layer by name with exact matching
     * @param {string} name - The name of the object layer to retrieve
     * @returns {object|null} The object layer or null if not found
     */
    getObjectLayer(name) {
        // First try direct lookup with normalized name
        const normalizedName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        
        if (this.objectLayers[normalizedName]) {
            return this.objectLayers[normalizedName];
        }
        
        // If direct lookup fails, try to find it in the map objects
        if (this.map && this.map.objects && this.map.objects.length > 0) {
            // First look for exact name match (preferred)
            const exactMatch = this.map.objects.find(layer => layer.name === name);
            if (exactMatch) {
                return exactMatch;
            }
            
            // If no exact match, try case-insensitive match
            const caseInsensitiveMatch = this.map.objects.find(layer => 
                layer.name.toLowerCase() === name.toLowerCase()
            );
            if (caseInsensitiveMatch) {
                return caseInsensitiveMatch;
            }
        }
        
        console.warn(`Object layer "${name}" not found`);
        return null;
    }
    
    // Add the missing setMap method
    setMap(map) {
        this.map = map;
    }
    
    // Add the missing registerLayer method
    registerLayer(layerName, layer) {
        console.log(`Registering layer ${layerName} in TilemapSystem`);
        if (!this.layers) {
            this.layers = {};
        }
        this.layers[layerName] = layer;
        return layer;
    }
    
    createFallbackMap() {
        console.log('Creating fallback map...');
        
        try {
            // Create a simple tilemap with a 20x15 grid of 32x32 tiles
            const width = 20;
            const height = 15;
            const tileSize = 32;
            
            this.map = this.scene.make.tilemap({
                tileWidth: tileSize,
                tileHeight: tileSize,
                width: width,
                height: height
            });
            
            // Add a simple tileset for the fallback map
            let tileset;
            try {
                // Try with a background image we know exists
                tileset = this.map.addTilesetImage('fallback', 'underwater_bg');
            } catch (e) {
                console.error('Failed to add underwater_bg tileset:', e);
                
                // Try with any available texture as a last resort
                const textures = this.scene.textures.getTextureKeys();
                for (const key of textures) {
                    if (key.startsWith('__') || key === 'missing') continue;
                    
                    try {
                        tileset = this.map.addTilesetImage('fallback', key);
                        if (tileset) {
                            console.log(`Using ${key} as fallback tileset`);
                            break;
                        }
                    } catch (e) {
                        // Try next texture
                    }
                }
            }
            
            // Create a background layer
            try {
                const layer = this.map.createBlankLayer('Background', tileset, 0, 0, width, height);
                if (layer) {
                    // Fill with a basic background tile
                    layer.fill(1);
                    this.layers['Background'] = layer;
                }
                
                // Create an empty obstacles layer
                const obstaclesLayer = this.map.createBlankLayer('Obstacles', tileset, 0, 0, width, height);
                if (obstaclesLayer) {
                    this.layers['Obstacles'] = obstaclesLayer;
                }
                
                // Create world bounds
                this.scene.physics.world.setBounds(0, 0, width * tileSize, height * tileSize);
                
                // Set a default spawn point
                this.playerSpawnPoint = { x: 100, y: 100 };
                
                console.log('Fallback map created successfully');
                return true;
            } catch (e) {
                console.error('Error creating fallback map layers:', e);
                return false;
            }
        } catch (e) {
            console.error('Error in createFallbackMap:', e);
            return false;
        }
    }

    /**
     * Enhanced method to process map layers automatically based on their names
     * @param {Phaser.Tilemaps.Tilemap} map - The tilemap to process
     * @param {Array} tilesets - Array of loaded tilesets
     * @param {Object} options - Configuration options
     * @returns {Object} Object containing processed layers
     */
    processMapLayers(map, tilesets, options = {}) {
        const processedLayers = {};
        
        // Default layer configuration patterns - can be overridden with options
        const layerConfigs = {
            background: {
                pattern: /^background$/i,
                setup: (layer) => {
                    console.log(`Setting up main background layer: ${layer.layer.name}`);
                    return layer.setDepth(0)
                        .setScrollFactor(0.3)
                        .setScale(3.0)
                        .setPosition(-map.tileWidth * 25, -map.tileHeight * 25);
                }
            },
            backgroundSprites: {
                // Make pattern more flexible to match with or without underscore and case insensitive
                pattern: /^background[_]?sprites$/i,
                setup: (layer) => {
                    console.log(`Setting up background sprites layer: ${layer.layer.name}`);
                    // Make sure the layer is fully visible
                    return layer.setDepth(10)
                        .setScrollFactor(0.4)
                        .setScale(1.0)
                        .setVisible(true)
                        .setAlpha(1);
                }
            },
            midground: {
                // Make sure we catch the exact midground_sprites layer
                pattern: /^midground[_]?sprites$/i,
                setup: (layer) => {
                    console.log(`Setting up midground sprites layer: ${layer.layer.name}`);
                    // Make sure the layer is fully visible
                    return layer.setDepth(20)
                        .setScrollFactor(0.8)
                        .setScale(1.0)
                        .setVisible(true)
                        .setAlpha(1);
                }
            },
            obstacles: {
                pattern: /^obstacles$/i,
                setup: (layer) => {
                    console.log(`Setting up obstacle layer: ${layer.layer.name}`);
                    
                    // Debug visualization
                    console.log('Obstacle layer details:', {
                        visible: layer.visible,
                        alpha: layer.alpha,
                        tilesets: layer.tilemap.tilesets.map(t => ({
                            name: t.name,
                            firstgid: t.firstgid,
                            total: t.total
                        }))
                    });

                    // Enable debug rendering if in debug mode
                    if (layer.scene.physics.config.debug) {
                        const debugGraphics = layer.scene.add.graphics();
                        layer.renderDebug(debugGraphics, {
                            tileColor: null,
                            collidingTileColor: new Phaser.Display.Color(243, 134, 48, 128),
                            faceColor: new Phaser.Display.Color(40, 39, 37, 128)
                        });
                    }

                    layer.setCollisionByExclusion([-1]);
                    const result = layer.setDepth(40)  // Standardized to 40 to match highest value
                        .setScrollFactor(1.0)
                        .setScale(1.0)
                        .setVisible(true)
                        .setAlpha(1);
                        
                    // Debug log the final state
                    console.log('Obstacle layer setup complete:', {
                        depth: layer.depth,
                        visible: layer.visible,
                        alpha: layer.alpha,
                        scrollFactor: layer.scrollFactorX
                    });
                    
                    return result;
                }
            },
            foreground: {
                pattern: /^foreground/i,
                setup: (layer) => {
                    console.log(`Setting up foreground layer: ${layer.layer.name}`);
                    return layer.setDepth(50)
                        .setScrollFactor(1.0)
                        .setScale(1.0)
                        .setVisible(true)
                        .setAlpha(1);
                }
            },
            // Default for any unrecognized layer
            default: {
                setup: (layer) => {
                    console.log(`Setting up generic layer: ${layer.layer.name}`);
                    return layer.setDepth(30)
                        .setScrollFactor(1.0)
                        .setScale(1.0)
                        .setVisible(true)
                        .setAlpha(1);
                }
            }
        };
        
        // Get all layer names from the map
        const mapLayerNames = map.layers.map(l => l.name);
        console.log('Available map layers:', mapLayerNames);
        
        // Process each layer in the map
        mapLayerNames.forEach(layerName => {
            try {
                // Skip object layers - they're processed separately
                const layerData = map.layers.find(l => l.name === layerName);
                if (layerData.type === 'objectgroup') {
                    console.log(`Skipping object layer ${layerName} - will be processed separately`);
                    return;
                }
                
                console.log(`Creating layer: ${layerName}`);
                
                // Attempt to create the layer
                const layer = map.createLayer(layerName, tilesets);
                
                if (layer) {
                    // Find appropriate configuration for this layer
                    let matchedConfig = null;
                    
                    // Try to match layer name to a configuration pattern
                    for (const [configKey, config] of Object.entries(layerConfigs)) {
                        if (configKey === 'default') continue; // Skip default config in matching phase
                        
                        if (config.pattern && config.pattern.test(layerName)) {
                            matchedConfig = config;
                            break;
                        }
                    }
                    
                    // If no specific config matched, use default
                    if (!matchedConfig) {
                        console.log(`No specific configuration for layer "${layerName}", using default setup`);
                        matchedConfig = layerConfigs.default;
                    }
                    
                    // Apply the matched configuration
                    matchedConfig.setup(layer);
                    
                    // Make sure layer is visible
                    layer.setVisible(true).setAlpha(1);
                    
                    // Register with system
                    this.registerLayer(layerName, layer);
                    processedLayers[layerName] = layer;
                    
                    console.log(`Layer "${layerName}" created and configured successfully`);
                } else {
                    console.error(`Failed to create layer: ${layerName}`);
                }
            } catch (err) {
                console.error(`Error creating layer ${layerName}:`, err);
            }
        });
        
        // After successfully creating all layers
        console.log('All map layers created successfully, emitting tilemapCreated event');
        this.scene.events.emit('tilemapCreated', this.map);
        return processedLayers;
    }

    /**
     * Process all object layers in the map
     * @param {Phaser.Tilemaps.Tilemap} map - The tilemap to process
     * @returns {Object} Object containing extracted object data
     */
    processObjectLayers(map) {
        const objectData = {
            airPockets: [],
            playerSpawns: [],
            enemySpawns: [],
            collectibles: [],
            triggers: [],
            other: []
        };
        
        if (!map.objects || !map.objects.length) {
            console.log('No object layers found in map');
            return objectData;
        }
        
        // Process each object layer
        map.objects.forEach(objectLayer => {
            console.log(`Processing object layer: ${objectLayer.name}`);
            
            if (!objectLayer.objects || !objectLayer.objects.length) {
                console.log(`No objects in layer ${objectLayer.name}`);
                return;
            }
            
            // Process objects based on layer name patterns
            objectLayer.objects.forEach(obj => {
                // Copy the object to avoid reference issues
                const objCopy = { ...obj };
                
                // Add the layer name to the object for reference
                objCopy.layerName = objectLayer.name;
                
                // Categorize by layer name
                if (objectLayer.name.toLowerCase().includes('airpocket')) {
                    objectData.airPockets.push(objCopy);
                } else if (objectLayer.name.toLowerCase().includes('spawn')) {
                    if (obj.name && obj.name.toLowerCase().includes('player')) {
                        objectData.playerSpawns.push(objCopy);
                    } else if (obj.name && obj.name.toLowerCase().includes('enemy')) {
                        objectData.enemySpawns.push(objCopy);
                    } else {
                        objectData.other.push(objCopy);
                    }
                } else if (objectLayer.name.toLowerCase().includes('collectible')) {
                    objectData.collectibles.push(objCopy);
                } else if (objectLayer.name.toLowerCase().includes('trigger')) {
                    objectData.triggers.push(objCopy);
                } else {
                    objectData.other.push(objCopy);
                }
            });
        });
        
        console.log('Object layer processing complete:', {
            airPockets: objectData.airPockets.length,
            playerSpawns: objectData.playerSpawns.length,
            enemySpawns: objectData.enemySpawns.length,
            collectibles: objectData.collectibles.length,
            triggers: objectData.triggers.length,
            other: objectData.other.length
        });
        
        return objectData;
    }

    /**
     * Create an air pocket at the specified location - forwards to AirPocketSystem
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {Object} properties - Properties for the air pocket
     * @returns {Object} The created air pocket
     */
    createAirPocket(x, y, properties) {
        try {
            console.log(`TilemapSystem.createAirPocket called at (${x}, ${y})`);
            
            // Default values
            let config = {
                type: 1,
                oxygenAmount: 20,
                respawnTime: 30000 // in milliseconds
            };
            
            // Process properties
            if (properties) {
                if (Array.isArray(properties)) {
                    properties.forEach(prop => {
                        if (prop.name === 'type' || prop.name === 'variation') {
                            config.type = parseInt(prop.value, 10) || 1;
                        } else if (prop.name === 'oxygen') {
                            config.oxygenAmount = parseInt(prop.value, 10) || 20;
                        } else if (prop.name === 'respawn') {
                            config.respawnTime = parseInt(prop.value, 10) * 1000 || 30000;
                        }
                    });
                } else {
                    // Handle direct property object
                    if (properties.type !== undefined) {
                        config.type = parseInt(properties.type, 10) || 1;
                    }
                    if (properties.variation !== undefined) {
                        config.type = parseInt(properties.variation, 10) || 1;
                    }
                    if (properties.oxygen !== undefined) {
                        config.oxygenAmount = parseInt(properties.oxygen, 10) || 20;
                    }
                    if (properties.oxygenAmount !== undefined) {
                        config.oxygenAmount = parseInt(properties.oxygenAmount, 10) || 20;
                    }
                    if (properties.respawn !== undefined) {
                        config.respawnTime = parseInt(properties.respawn, 10) * 1000 || 30000;
                    }
                    if (properties.respawnTime !== undefined) {
                        config.respawnTime = parseInt(properties.respawnTime, 10) || 30000;
                    }
                }
            }
            
            console.log(`Forwarding air pocket creation to AirPocketSystem with config:`, config);
            
            // Forward to AirPocketSystem if available
            if (this.scene.airPocketSystem) {
                return this.scene.airPocketSystem.createAirPocket(x, y, config);
            } else {
                console.error('Cannot create air pocket - AirPocketSystem not initialized');
                return null;
            }
        } catch (error) {
            console.error('Error in TilemapSystem.createAirPocket:', error);
            return null;
        }
    }

    /**
     * Check if a position is blocked by an obstacle
     * @param {number} x - X position to check
     * @param {number} y - Y position to check
     * @returns {boolean} True if position is blocked, false otherwise
     */
    isPositionBlocked(x, y) {
        try {
            // Check if map and layers exist
            if (!this.map || !this.layers) {
                console.warn('No map or layers available for collision check');
                return false;
            }
            
            // Use the Obstacles layer for collision checks
            const obstaclesLayer = this.layers.Obstacles;
            if (!obstaclesLayer) {
                console.warn('No Obstacles layer found for collision check');
                return false;
            }
            
            // Check if position has a tile in the Obstacles layer
            const tile = obstaclesLayer.getTileAtWorldXY(x, y);
            
            // Returns true if there is a tile (position is blocked)
            return !!tile;
        } catch (error) {
            console.error('Error checking position blocked:', error);
            return false;
        }
    }
} 