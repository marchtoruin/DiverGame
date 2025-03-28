/**
 * Handles entity layers and object processing from Tiled maps
 */
export default class EntityLayerSystem {
    constructor(scene) {
        this.scene = scene;
        this.entityLayers = new Map();
        this.entityProcessors = new Map();
        this.spawnPoints = new Map();
        
        // Register default entity processors
        this.registerDefaultProcessors();
    }

    /**
     * Register the default entity processors
     */
    registerDefaultProcessors() {
        // Register default processors for common entity types
        this.registerEntityProcessor('playerspawn', (obj, layer) => {
            if (obj.name?.toLowerCase().includes('player') || 
                obj.type?.toLowerCase().includes('player') ||
                layer.name?.toLowerCase().includes('playerspawn')) {
                
                this.spawnPoints.set('player', { x: obj.x, y: obj.y });
                console.log('Registered player spawn point:', { x: obj.x, y: obj.y });
            }
        });
        
        // AirPocket processor - fixing to work with the correct key and variation
        this.registerEntityProcessor('airpocket', (obj, layer) => {
            // Skip if missing coordinates
            if (obj.x === undefined || obj.y === undefined) {
                console.warn('Skipping air pocket with undefined coordinates');
                return;
            }
            
            // Extract properties
            let variation = 1;  // Default to variation 1
            let oxygen = 50;    // Default oxygen amount
            let respawn = 30;   // Default respawn time (seconds)
            
            // Handle properties in array format
            if (obj.properties && Array.isArray(obj.properties)) {
                obj.properties.forEach(prop => {
                    if (prop.name === 'variation' || prop.name === 'type') {
                        variation = parseInt(prop.value, 10) || 1;
                    } else if (prop.name === 'oxygen') {
                        oxygen = parseInt(prop.value, 10) || 50;
                    } else if (prop.name === 'respawn') {
                        respawn = parseInt(prop.value, 10) || 30;
                    }
                });
            } 
            // Handle properties in object format
            else if (obj.properties && typeof obj.properties === 'object') {
                if (obj.properties.variation !== undefined) {
                    variation = parseInt(obj.properties.variation, 10) || 1;
                }
                if (obj.properties.type !== undefined) {
                    variation = parseInt(obj.properties.type, 10) || 1;
                }
                if (obj.properties.oxygen !== undefined) {
                    oxygen = parseInt(obj.properties.oxygen, 10) || 50;
                }
                if (obj.properties.respawn !== undefined) {
                    respawn = parseInt(obj.properties.respawn, 10) || 30;
                }
            }
            
            // Validate variation (1-3)
            variation = Math.max(1, Math.min(3, variation));
            
            // Create the AirPocket spawn points collection if it doesn't exist
            // Use correct casing to match Tiled layer name 'AirPockets'
            if (!this.spawnPoints.has('AirPockets')) {
                this.spawnPoints.set('AirPockets', []);
            }
            
            // Check for duplicates before adding
            const posKey = `${Math.round(obj.x)},${Math.round(obj.y)}`;
            const existingSpawnPoints = this.spawnPoints.get('AirPockets');
            const isDuplicate = existingSpawnPoints.some(sp => {
                const spPosKey = `${Math.round(sp.x)},${Math.round(sp.y)}`;
                return spPosKey === posKey;
            });
            
            if (isDuplicate) {
                console.warn(`Skipping duplicate AirPocket at ${posKey}`);
                return;
            }
            
            // Add a single spawn point with the correct properties
            console.log(`Adding AirPocket at (${obj.x}, ${obj.y}) with variation=${variation}`);
            this.spawnPoints.get('AirPockets').push({
                x: obj.x,
                y: obj.y,
                width: obj.width || 0,
                height: obj.height || 0,
                variation: variation,
                oxygen: oxygen,
                respawn: respawn
            });
        });
    }

    /**
     * Register a new entity processor
     * @param {string} type - The type of entity to process
     * @param {Function} processor - The processor function
     */
    registerEntityProcessor(type, processor) {
        this.entityProcessors.set(type.toLowerCase(), processor);
    }

    /**
     * Process object layers from a Tiled map
     * @param {Phaser.Tilemaps.Tilemap} map - The tilemap to process
     */
    processMapLayers(map) {
        if (!map.objects || !map.objects.length) {
            console.log('No object layers found in map');
            return;
        }

        map.objects.forEach(layer => {
            console.log(`Processing object layer: ${layer.name}`);
            this.entityLayers.set(layer.name.toLowerCase(), layer);

            if (!layer.objects?.length) {
                console.log(`No objects in layer ${layer.name}`);
                return;
            }

            layer.objects.forEach(obj => {
                this.processEntity(obj, layer);
            });
        });

        console.log('Entity processing complete:', {
            playerSpawn: this.spawnPoints.has('player'),
            airPockets: this.spawnPoints.get('airPockets')?.length || 0
        });
    }

    /**
     * Process a single entity
     * @param {Object} obj - The entity object from Tiled
     * @param {Object} layer - The layer containing the entity
     */
    processEntity(obj, layer) {
        const layerName = layer.name.toLowerCase();
        
        // Try to find a matching processor
        for (const [type, processor] of this.entityProcessors) {
            if (layerName.includes(type) || 
                obj.type?.toLowerCase().includes(type) ||
                obj.name?.toLowerCase().includes(type)) {
                
                processor(obj, layer);
                break;
            }
        }
    }

    /**
     * Extract properties from a Tiled properties array
     * @param {Array} properties - The properties array from Tiled
     * @returns {Object} Extracted properties
     */
    extractProperties(properties) {
        if (!Array.isArray(properties)) return {};

        return properties.reduce((acc, prop) => {
            acc[prop.name] = prop.value;
            return acc;
        }, {});
    }

    /**
     * Get a spawn point by type
     * @param {string} type - The type of spawn point
     * @returns {Object|Array} The spawn point data
     */
    getSpawnPoints(type) {
        return this.spawnPoints.get(type.toLowerCase());
    }

    /**
     * Get the player spawn point
     * @returns {Object} The player spawn coordinates
     */
    getPlayerSpawn() {
        return this.spawnPoints.get('player') || { x: 100, y: 100 }; // Default fallback
    }

    /**
     * Get all air pocket spawn points
     * @returns {Array} Array of air pocket spawn points
     */
    getAirPocketSpawns() {
        return this.spawnPoints.get('airPockets') || [];
    }
} 