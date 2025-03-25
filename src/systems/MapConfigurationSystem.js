/**
 * Handles map configuration and layer settings
 */
export default class MapConfigurationSystem {
    constructor(scene) {
        this.scene = scene;
        this.config = null;
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
     * Configure a layer based on its name
     * @param {Phaser.Tilemaps.TilemapLayer} layer - The layer to configure
     * @param {string} layerName - The name of the layer
     */
    configureLayer(layer, layerName) {
        if (!layer) return;

        try {
            // Convert layer name to lowercase for matching
            const lowerName = layerName.toLowerCase();
            
            // Find matching layer type from config
            const layerType = Object.entries(this.config.layerTypes).find(([_, config]) => {
                const pattern = new RegExp(config.pattern || '', 'i');
                return pattern.test(lowerName);
            });

            if (layerType) {
                const [_, settings] = layerType;
                console.log(`Configuring layer ${layerName} with settings:`, settings);

                // Apply basic properties
                if (settings.depth !== undefined) layer.setDepth(settings.depth);
                if (settings.scrollFactor !== undefined) layer.setScrollFactor(settings.scrollFactor);
                if (settings.scale !== undefined) layer.setScale(settings.scale);

                // Handle collision if specified
                if (settings.collision) {
                    layer.setCollisionByExclusion([-1]);
                }

                // Ensure visibility
                layer.setVisible(true);
                layer.setAlpha(1);
            } else {
                // Default configuration if no match found
                console.log(`No specific configuration found for layer ${layerName}, using defaults`);
                layer.setDepth(25)
                    .setScrollFactor(1.0)
                    .setScale(1.0)
                    .setVisible(true)
                    .setAlpha(1);
            }
        } catch (error) {
            console.error(`Error configuring layer ${layerName}:`, error);
        }
    }
} 