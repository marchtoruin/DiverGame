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

    createFromTiledJSON(key) {
        try {
            console.log('Starting tilemap creation with key:', key);
            
            // Check if the key is available in the cache
            const cache = this.scene.cache.tilemap;
            
            if (!cache.has(key)) {
                console.error('ERROR: Tilemap with key', key, 'not found in cache!');
                this.createFallbackMap();
                return false;
            }
            
            const cacheData = cache.get(key);
            
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
                
                // Validate layer types
                const invalidLayers = layers.filter(layer => {
                    const isObjectGroup = layer.class === 'objectgroup' || 
                                        layer.type === 'objectgroup' || 
                                        Array.isArray(layer.objects);
                                        
                    const isTileLayer = layer.class === 'tilelayer' || 
                                      layer.type === 'tilelayer' || 
                                      Array.isArray(layer.data);
                                      
                    return !isObjectGroup && !isTileLayer;
                });
                
                if (invalidLayers.length > 0) {
                    console.error(`Found ${invalidLayers.length} layers with invalid types:`, 
                        invalidLayers.map(l => l.name));
                    console.warn('These layers will be skipped');
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
                
                // Get all tileset data from the map
                const tilesetData = this.map.tilesets || [];
                if (tilesetData.length === 0) {
                    console.error('Map has no tilesets!');
                }
                
                // Add tilesets using AssetManagementSystem
                const addedTilesets = [];
                let tilesetLoadingSuccess = false;
                
                // Process embedded tilesets for special collection-based (tile-based) tilesets
                const collectionTilesets = tilesetData.filter(ts => ts.tiles && ts.tiles.length > 0);
                if (collectionTilesets.length > 0) {
                    console.log(`Found ${collectionTilesets.length} collection-based tilesets`);
                    
                    for (const tileset of collectionTilesets) {
                        console.log(`Processing collection tileset: ${tileset.name} (firstgid: ${tileset.firstgid})`);
                        
                        // Collection tilesets store individual images for each tile
                        // Try to find a common image format all tiles use
                        const tileImageKeys = new Set();
                        
                        // Extract image keys from the individual tiles
                        tileset.tiles.forEach(tile => {
                            if (tile.image) {
                                // Get filename without path
                                const imagePath = tile.image;
                                const fileName = imagePath.split('/').pop().split('\\').pop();
                                const fileNameNoExt = fileName.split('.')[0];
                                
                                // Store both with/without extension
                                tileImageKeys.add(fileName);
                                tileImageKeys.add(fileNameNoExt);
                                
                                // Also add mapped keys if available
                                if (this.imageKeyMap[imagePath]) tileImageKeys.add(this.imageKeyMap[imagePath]);
                                if (this.imageKeyMap[fileName]) tileImageKeys.add(this.imageKeyMap[fileName]);
                                if (this.imageKeyMap[fileNameNoExt]) tileImageKeys.add(this.imageKeyMap[fileNameNoExt]);
                            }
                        });
                        
                        // Try to add the collection tileset using each possible image key
                        let collectionAdded = false;
                        for (const imageKey of tileImageKeys) {
                            if (availableTextures.includes(imageKey)) {
                                try {
                                    const addedTileset = this.addTilesetToMap(this.map, tileset);
                                    if (addedTileset) {
                                        console.log(`Successfully added collection tileset: ${tileset.name} with key ${imageKey}`);
                                        addedTilesets.push(addedTileset);
                                        collectionAdded = true;
                                        tilesetLoadingSuccess = true;
                                        break;
                                    }
                                } catch (e) {
                                    // Continue to next key
                                }
                            }
                        }
                        
                        // If no image key worked, try with the tileset name as key
                        if (!collectionAdded && availableTextures.includes(tileset.name)) {
                            try {
                                const addedTileset = this.addTilesetToMap(this.map, tileset);
                                if (addedTileset) {
                                    console.log(`Successfully added collection tileset using its own name as key`);
                                    addedTilesets.push(addedTileset);
                                    tilesetLoadingSuccess = true;
                                }
                            } catch (e) {
                                // Continue to next approach
                            }
                        }
                    }
                }
                
                // APPROACH 1: Try each standard tileset by its name directly (most reliable)
                const standardTilesets = tilesetData.filter(ts => !ts.tiles || ts.tiles.length === 0);
                for (const tileset of standardTilesets) {
                    const tilesetName = tileset.name;
                    
                    // First, try with the exact tileset name directly (best match)
                    try {
                        if (availableTextures.includes(tilesetName)) {
                            const addedTileset = this.addTilesetToMap(this.map, tileset);
                            
                            if (addedTileset) {
                                console.log(`Added tileset with exact name: ${tilesetName}`);
                                addedTilesets.push(addedTileset);
                                tilesetLoadingSuccess = true;
                                continue; // Skip other attempts for this tileset
                            }
                        }
                    } catch (e) {
                        // Try the next approach
                    }
                    
                    // If embedded image is present, extract the filename and try with that
                    if (tileset.image) {
                        const imagePath = tileset.image;
                        const fileName = imagePath.split('/').pop().split('\\').pop();
                        const fileNameNoExt = fileName.split('.')[0];
                        
                        try {
                            // First try with mapped key from the path
                            if (this.imageKeyMap[imagePath] && availableTextures.includes(this.imageKeyMap[imagePath])) {
                                const mappedKey = this.imageKeyMap[imagePath];
                                const addedTileset = this.addTilesetToMap(this.map, tileset);
                                
                                if (addedTileset) {
                                    console.log(`Added tileset ${tilesetName} with mapped image path key: ${mappedKey}`);
                                    addedTilesets.push(addedTileset);
                                    tilesetLoadingSuccess = true;
                                    continue; // Skip other attempts for this tileset
                                }
                            }
                        } catch (e) {
                            // Try the next approach
                        }
                        
                        try {
                            // Try with mapped key from the filename
                            if (this.imageKeyMap[fileName] && availableTextures.includes(this.imageKeyMap[fileName])) {
                                const mappedKey = this.imageKeyMap[fileName];
                                const addedTileset = this.addTilesetToMap(this.map, tileset);
                                
                                if (addedTileset) {
                                    console.log(`Added tileset ${tilesetName} with mapped filename key: ${mappedKey}`);
                                    addedTilesets.push(addedTileset);
                                    tilesetLoadingSuccess = true;
                                    continue; // Skip other attempts for this tileset
                                }
                            }
                        } catch (e) {
                            // Try the next approach
                        }
                        
                        try {
                            // Try with the filename (without extension)
                            if (availableTextures.includes(fileNameNoExt)) {
                                const addedTileset = this.addTilesetToMap(this.map, tileset);
                                
                                if (addedTileset) {
                                    console.log(`Added tileset ${tilesetName} with filename (no ext): ${fileNameNoExt}`);
                                    addedTilesets.push(addedTileset);
                                    tilesetLoadingSuccess = true;
                                    continue; // Skip other attempts for this tileset
                                }
                            }
                        } catch (e) {
                            // Try the next approach
                        }
                        
                        try {
                            // Try with the filename (with extension)
                            if (availableTextures.includes(fileName)) {
                                const addedTileset = this.addTilesetToMap(this.map, tileset);
                                
                                if (addedTileset) {
                                    console.log(`Added tileset ${tilesetName} with filename: ${fileName}`);
                                    addedTilesets.push(addedTileset);
                                    tilesetLoadingSuccess = true;
                                    continue; // Skip other attempts for this tileset
                                }
                            }
                        } catch (e) {
                            // Try the next approach
                        }
                    }
                    
                    // APPROACH 2: Try with firstgid-based mapping as a last resort
                    try {
                        const firstGidKey = `firstgid_${tileset.firstgid}`;
                        if (this.imageKeyMap[firstGidKey] && availableTextures.includes(this.imageKeyMap[firstGidKey])) {
                            const mappedKey = this.imageKeyMap[firstGidKey];
                            const addedTileset = this.addTilesetToMap(this.map, tileset);
                            
                            if (addedTileset) {
                                console.log(`Added tileset ${tilesetName} with firstgid mapping: ${mappedKey}`);
                                addedTilesets.push(addedTileset);
                                tilesetLoadingSuccess = true;
                                continue; // Skip other attempts for this tileset
                            }
                        }
                    } catch (e) {
                        // Final approach failed, will try with the next tileset
                    }
                    
                    console.log(`Failed to add tileset: ${tilesetName}`);
                }
                
                // APPROACH 3: Final attempt - try to add all known texture keys
                if (!tilesetLoadingSuccess) {
                    console.warn('Failed to load tilesets with direct mappings, trying all available textures...');
                    
                    // Try all known textures as a fallback
                    for (const textureKey of availableTextures) {
                        try {
                            // Skip system textures
                            if (textureKey.startsWith('__') || textureKey === 'missing') continue;
                            
                            for (const tileset of tilesetData) {
                                try {
                                    const addedTileset = this.addTilesetToMap(this.map, tileset);
                                    if (addedTileset) {
                                        console.log(`Added tileset ${tileset.name} with texture key: ${textureKey}`);
                                        addedTilesets.push(addedTileset);
                                        tilesetLoadingSuccess = true;
                                    }
                                } catch (e) {
                                    // Try next combination
                                }
                            }
                        } catch (e) {
                            // Continue to next texture key
                        }
                    }
                }
                
                // If no tilesets were loaded, use fallback map
                if (!tilesetLoadingSuccess) {
                    console.error('Failed to load any tilesets. Using fallback map...');
                    this.createFallbackMap();
                    return false;
                }
                
                // Get all layer names from the map
                const layersToCreate = this.map.layers.map(l => l.name);
                console.log(`Attempting to create ${layersToCreate.length} layers:`, layersToCreate);
                
                // Create each layer
                for (const layerName of layersToCreate) {
                    try {
                        console.log(`Creating layer: ${layerName}`);
                        const layer = this.map.createLayer(layerName, addedTilesets);
                        
                        if (layer) {
                            console.log(`SUCCESS! Created layer: ${layerName}`);
                            
                            // Use MapConfigurationSystem to configure the layer if available
                            if (this.scene.mapConfigSystem) {
                                this.scene.mapConfigSystem.configureLayer(layer, layerName);
                            } else {
                                // Fallback to old configuration if MapConfigurationSystem is not available
                                const lowerName = layerName.toLowerCase();
                                
                                if (lowerName === 'background') {
                                    layer.setDepth(10);
                                    layer.setScrollFactor(0.1);
                                    layer.setScale(1.0);
                                } 
                                else if (lowerName.includes('background_sprites')) {
                                    layer.setDepth(20);
                                    layer.setScrollFactor(0.3);
                                    layer.setScale(1.0);
                                }
                                else if (lowerName.includes('midground')) {
                                    layer.setDepth(30);
                                    layer.setScrollFactor(0.7);
                                    layer.setScale(1.0);
                                }
                                else if (lowerName.includes('obstacle')) {
                                    layer.setDepth(40);
                                    layer.setScrollFactor(1.0);
                                    layer.setCollisionByExclusion([-1]);
                                }
                                else {
                                    layer.setDepth(25);
                                    layer.setScrollFactor(1.0);
                                }
                                
                                layer.setVisible(true);
                                layer.setAlpha(1);
                            }
                            
                            // Store in our layers object with normalized name
                            const normalizedName = lowerName.replace(/[^a-z0-9_]/g, '_');
                            this.layers[normalizedName] = layer;
                            console.log(`Stored layer as ${normalizedName}`);
                        } else {
                            console.error(`Failed to create layer ${layerName} - returned null`);
                        }
                    } catch (e) {
                        console.error(`Error creating layer ${layerName}:`, e.message);
                    }
                }
                
                // Set world bounds based on map size
                const mapWidth = this.map.widthInPixels;
                const mapHeight = this.map.heightInPixels;
                this.scene.physics.world.setBounds(0, 0, mapWidth, mapHeight);
                this.scene.cameras.main.setBounds(0, 0, mapWidth, mapHeight);
                
                // Check if we created any layers
                console.log(`Created ${Object.keys(this.layers).length} layers`);
                
                // If at least one layer was created, the tilemap was loaded successfully
                if (Object.keys(this.layers).length > 0) {
                    // Try to process objects (like spawn points)
                    this.processMapObjects();
                    
                    return true;
                }
                
                // If we get here, loading failed even with the tilesets, so use fallback
                console.log('Failed to create any layers. Using fallback map...');
                this.createFallbackMap();
                return false;
            }
        } catch (e) {
            console.error('Error in createFromTiledJSON:', e);
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
            
            if (objectLayer.name === 'PlayerSpawn') {
                // Validate spawn point objects
                const spawnPoints = objectLayer.objects.filter(obj => 
                    obj.name === 'PlayerSpawn' || obj.type === 'PlayerSpawn' ||
                    obj.name === 'player' || obj.type === 'player' ||
                    obj.name === 'spawn' || obj.type === 'spawn' ||
                    obj.name === 'start' || obj.type === 'start'
                );
                
                if (spawnPoints.length === 0) {
                    console.error('No valid player spawn point found in PlayerSpawn layer');
                    return;
                }
                
                if (spawnPoints.length > 1) {
                    console.warn(`Found ${spawnPoints.length} spawn points, using the first one`);
                }
                
                const spawnPoint = spawnPoints[0];
                this.playerSpawnPoint = {
                    x: spawnPoint.x,
                    y: spawnPoint.y
                };
                console.log(`Found player spawn point at ${this.playerSpawnPoint.x}, ${this.playerSpawnPoint.y}`);
            }
            
            if (objectLayer.name === 'AirPockets') {
                console.log('Found AirPockets layer, processing air pocket objects...');
                
                // Validate air pocket objects - they must be point objects with required properties
                const validAirPockets = objectLayer.objects.filter(obj => {
                    // Must be a point object
                    if (!obj.point) {
                        console.warn(`Air pocket at (${obj.x}, ${obj.y}) is not a point object - skipping`);
                        return false;
                    }
                    
                    // Must have valid position
                    if (typeof obj.x !== 'number' || typeof obj.y !== 'number') {
                        console.warn(`Air pocket has invalid position - skipping`);
                        return false;
                    }
                    
                    // Must have properties array
                    if (!Array.isArray(obj.properties)) {
                        console.warn(`Air pocket at (${obj.x}, ${obj.y}) missing properties array - skipping`);
                        return false;
                    }
                    
                    return true;
                });
                
                if (validAirPockets.length < objectLayer.objects.length) {
                    console.warn(`Filtered out ${objectLayer.objects.length - validAirPockets.length} invalid air pockets`);
                }
                
                // Create air pockets from valid objects - preserve exact property access logic
                this.airPockets = validAirPockets.map(obj => {
                    const props = {
                        x: obj.x,
                        y: obj.y,
                        variation: 1,
                        oxygen: 20,
                        respawn: 30
                    };

                    // Extract properties from the object
                    if (obj.properties) {
                        obj.properties.forEach(prop => {
                            if (prop.name === 'variation') {
                                props.variation = parseInt(prop.value, 10) || 1;
                            } else if (prop.name === 'oxygen') {
                                props.oxygen = parseInt(prop.value, 10) || 20;
                            } else if (prop.name === 'respawn') {
                                props.respawn = parseInt(prop.value, 10) || 30;
                            }
                        });
                    }

                    console.log('Creating air pocket with properties:', props);
                    return props;
                });
                
                console.log(`Processed ${this.airPockets.length} valid air pockets`);
            }
        });
    }
    
    // Add helper method to get object layer
    getObjectLayer(name) {
        const normalizedName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        return this.objectLayers[normalizedName];
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
                pattern: /^background_sprites$/i,
                setup: (layer) => {
                    console.log(`Setting up background sprites layer: ${layer.layer.name}`);
                    return layer.setDepth(1)
                        .setScrollFactor(0.4)
                        .setScale(1.0);
                }
            },
            midground: {
                pattern: /^midground/i,
                setup: (layer) => {
                    console.log(`Setting up midground layer: ${layer.layer.name}`);
                    return layer.setDepth(2)
                        .setScrollFactor(0.8)
                        .setScale(1.0);
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
                    return layer.setDepth(15)
                        .setScrollFactor(1.0)
                        .setScale(1.0);
                }
            },
            // Default for any unrecognized layer
            default: {
                setup: (layer) => {
                    console.log(`Setting up generic layer: ${layer.layer.name}`);
                    return layer.setDepth(1)
                        .setScrollFactor(1.0)
                        .setScale(1.0);
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

    createAirPocket(x, y, properties) {
        try {
            // Default values
            let config = {
                type: 1,
                oxygenAmount: 20,
                respawn: 30 // Default 30 seconds
            };
            
            // Handle properties which can be various formats
            if (properties) {
                if (Array.isArray(properties)) {
                    // Properties from Tiled come as an array of {name, value} objects
                    properties.forEach(prop => {
                        if (prop.name === 'type' || prop.name === 'variation') {
                            config.type = parseInt(prop.value, 10) || 1;
                        } 
                        else if (prop.name === 'oxygen') {
                            config.oxygenAmount = parseInt(prop.value, 10) || 20;
                        }
                        else if (prop.name === 'respawn') {
                            config.respawn = parseInt(prop.value, 10) || 30;
                        }
                    });
                }
                else if (typeof properties === 'object') {
                    // Direct config object
                    config.type = properties.type || properties.variation || config.type;
                    config.oxygenAmount = properties.oxygenAmount || properties.oxygen || config.oxygenAmount;
                    config.respawn = properties.respawn || config.respawn;
                }
            }

            console.log('Creating air pocket with config:', config);
            
            // Create the air pocket with the config - IMPORTANT: respawn is in seconds, needs to be converted to ms
            const airPocket = new AirPocket(
                this.scene,
                x, 
                y,
                {
                    type: config.type,
                    oxygenAmount: config.oxygenAmount,
                    respawn: config.respawn // This is in seconds, AirPocket will convert to ms
                }
            );
            
            // Create sprite and add to group
            const sprite = airPocket.create();
            if (sprite) {
                sprite.airPocketInstance = airPocket;
                this.setupAirPocketPhysics(sprite);
                this.group.add(sprite);
            }
            
            return airPocket;
        } catch (error) {
            console.error('Error creating air pocket:', error);
            return null;
        }
    }
} 