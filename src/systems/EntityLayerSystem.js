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
        // PlayerSpawn processor - preserving existing functionality
        this.registerEntityProcessor('playerspawn', (obj, layer) => {
            if (obj.name?.toLowerCase().includes('player') || 
                obj.type?.toLowerCase().includes('player') ||
                layer.name?.toLowerCase().includes('playerspawn')) {
                
                this.spawnPoints.set('player', { x: obj.x, y: obj.y });
                console.log('Registered player spawn point:', { x: obj.x, y: obj.y });
            }
        });

        // AirPocket processor
        this.registerEntityProcessor('airpocket', (obj, layer) => {
            if (!obj.point) {
                console.warn(`Air pocket at (${obj.x}, ${obj.y}) is not a point object - skipping`);
                return;
            }

            const properties = {
                variation: 1,
                oxygen: 20,
                respawn: 30,
                ...this.extractProperties(obj.properties)
            };

            if (!this.spawnPoints.has('airPockets')) {
                this.spawnPoints.set('airPockets', []);
            }
            
            this.spawnPoints.get('airPockets').push({
                x: obj.x,
                y: obj.y,
                ...properties,
                active: true,
                lastSpawnTime: this.scene.time.now
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