/**
 * Handles map configuration and layer settings
 */
export default class MapConfigurationSystem {
    constructor(scene) {
        this.scene = scene;
        this.config = null;
        this.currentLevel = null;
        this.loadConfig();
    }

    /**
     * Load the map configuration
     */
    loadConfig() {
        try {
            // Get the config from the cache
            this.config = this.scene.cache.json.get('mapConfig');
            if (!this.config) {
                console.warn('Map configuration not found in cache');
                this.config = {
                    layerTypes: {
                        background: {
                            depth: 10,
                            scrollFactor: 0.1,
                            scale: 1.0
                        },
                        obstacles: {
                            depth: 40,
                            scrollFactor: 1.0,
                            scale: 1.0,
                            collision: true
                        }
                    }
                };
            }
        } catch (error) {
            console.error('Error loading map configuration:', error);
        }
    }

    /**
     * Set the current level being configured
     * @param {string} levelKey - The level key (e.g., 'level1', 'level2')
     */
    setCurrentLevel(levelKey) {
        this.currentLevel = levelKey;
        console.log(`Set current level to: ${levelKey}`);
    }

    /**
     * Configure a layer based on its name and the current configuration
     * @param {Phaser.Tilemaps.TilemapLayer} layer - The layer to configure
     * @param {string} layerName - The name of the layer
     */
    configureLayer(layer, layerName) {
        if (!layer) {
            console.error('Cannot configure null layer');
            return;
        }

        const lowerName = layerName.toLowerCase();
        let config = null;

        // First check for level-specific configuration
        if (this.currentLevel && 
            this.config.levelSpecific && 
            this.config.levelSpecific[this.currentLevel]) {
            
            // Find matching layer type
            for (const [type, settings] of Object.entries(this.config.layerTypes)) {
                if (settings.pattern && new RegExp(settings.pattern).test(lowerName)) {
                    // Merge level-specific settings with default settings
                    const levelSpecific = this.config.levelSpecific[this.currentLevel][type];
                    if (levelSpecific) {
                        config = { ...settings, ...levelSpecific };
                        console.log(`Applied level-specific config for ${layerName} in ${this.currentLevel}`);
                        break;
                    }
                }
            }
        }

        // If no level-specific config found, use default
        if (!config) {
            for (const [type, settings] of Object.entries(this.config.layerTypes)) {
                if (settings.pattern && new RegExp(settings.pattern).test(lowerName)) {
                    config = settings;
                    break;
                }
            }
        }

        // Apply configuration if found
        if (config) {
            console.log(`Configuring layer ${layerName} with:`, config);
            if (typeof config.depth === 'number') layer.setDepth(config.depth);
            if (typeof config.scrollFactor === 'number') layer.setScrollFactor(config.scrollFactor);
            if (typeof config.scale === 'number') layer.setScale(config.scale);
            if (config.collision) layer.setCollisionByExclusion([-1]);
        } else {
            console.warn(`No configuration found for layer: ${layerName}`);
        }
    }
} 