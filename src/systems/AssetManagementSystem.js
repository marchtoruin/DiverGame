/**
 * Manages game assets, including loading, mapping, and access
 */
export default class AssetManagementSystem {
    constructor(scene) {
        this.scene = scene;
        this.assetMappings = new Map();
        this.tilesetMappings = new Map();
        this.loadedAssets = new Map();
        
        // Initialize with default mappings
        this.initializeDefaultMappings();
    }

    /**
     * Initialize default asset mappings
     */
    initializeDefaultMappings() {
        // Tileset mappings (maintaining existing functionality)
        this.tilesetMappings.set('Blue_background', 'underwater_bg');
        this.tilesetMappings.set('blue_background', 'underwater_bg');
        this.tilesetMappings.set('blue_background1', 'underwater_bg');
        this.tilesetMappings.set('Background', 'underwater_bg');
        this.tilesetMappings.set('background', 'underwater_bg');
        this.tilesetMappings.set('blackAndBlue', 'black_and_blue');
        this.tilesetMappings.set('blackAndBlue1', 'black_and_blue');
        this.tilesetMappings.set('black_and_blue', 'black_and_blue');
        this.tilesetMappings.set('black_and_blue1', 'black_and_blue');
        this.tilesetMappings.set('Rocks_Small', 'rock2');
        this.tilesetMappings.set('rocks_small', 'rock2');
        this.tilesetMappings.set('Rocks_Large', 'rock3');
        this.tilesetMappings.set('rocks_large', 'rock3');
        this.tilesetMappings.set('Air_Pocket', 'air_pocket1');
        this.tilesetMappings.set('air_pocket', 'air_pocket1');
        this.tilesetMappings.set('Air_Pocket1', 'air_pocket1');
        this.tilesetMappings.set('air_pocket1', 'air_pocket1');
        this.tilesetMappings.set('Air_Pocket2', 'air_pocket2');
        this.tilesetMappings.set('air_pocket2', 'air_pocket2');
        this.tilesetMappings.set('Air_Pocket3', 'air_pocket3');
        this.tilesetMappings.set('air_pocket3', 'air_pocket3');

        // Image path mappings (for embedded tilesets)
        this.tilesetMappings.set('../underwater_bg.png', 'underwater_bg');
        this.tilesetMappings.set('../black_and_blue.png', 'black_and_blue');
        this.tilesetMappings.set('../rock2.png', 'rock2');
        this.tilesetMappings.set('../rock3.png', 'rock3');
        this.tilesetMappings.set('../air_pocket1.png', 'air_pocket1');
        this.tilesetMappings.set('../air_pocket2.png', 'air_pocket2');
        this.tilesetMappings.set('../air_pocket3.png', 'air_pocket3');
        this.tilesetMappings.set('../danger_currents_small.png', 'danger_currents_small');
        this.tilesetMappings.set('danger_currents_small', 'danger_currents_small');
        this.tilesetMappings.set('danger_currents_small.png', 'danger_currents_small');

        // Asset type mappings
        this.assetMappings.set('images', {
            'underwater_bg': 'underwater_bg.png',
            'black_and_blue': 'black_and_blue.png',
            'rock2': 'rock2.png',
            'rock3': 'rock3.png',
            'air_pocket1': 'air_pocket1.png',
            'air_pocket2': 'air_pocket2.png',
            'air_pocket3': 'air_pocket3.png',
            'danger_currents_small': 'danger_currents_small.png',
            'player': 'diver2.png',
            'bubble': 'bubble.png',
            'heart': 'heart.png',
            'badFish': 'enemies/badFish01.png',
            'bg_bubble1': 'bg_bubble1.png',
            'bg_bubble2': 'bg_bubble2.png',
            'bg_bubble3': 'bg_bubble3.png',
            'bullet': 'laser_sprites/03.png',
            'seaweed': 'seaweed.png'
        });

        this.assetMappings.set('audio', {
            'music': 'music/bg_music.mp3',
            'ambience': 'music/ambience_underwater.wav'
        });

        this.assetMappings.set('tilemaps', {
            'level1': 'maps/level1.json',
            'level2': 'maps/level2.json'
        });
    }

    /**
     * Load all required game assets
     * @returns {Promise} Resolves when all assets are loaded
     */
    loadAssets() {
        return new Promise((resolve, reject) => {
            try {
                // We don't need to load the assets here since they're imported in GameScene
                // Just mark them as loaded
                const assetKeys = [
                    'underwater_bg',
                    'black_and_blue',
                    'rock2',
                    'rock3',
                    'air_pocket1',
                    'air_pocket2',
                    'air_pocket3',
                    'danger_currents_small',
                    'player',
                    'bubble',
                    'heart',
                    'badFish',
                    'bg_bubble1',
                    'bg_bubble2',
                    'bg_bubble3',
                    'bullet',
                    'seaweed',
                    'level1',
                    'level2',
                    'music',
                    'ambience'
                ];

                assetKeys.forEach(key => {
                    this.loadedAssets.set(key, { type: 'loaded', path: key });
                });

                console.log('Assets marked as loaded:', assetKeys);
                resolve();
            } catch (error) {
                console.error('Error in loadAssets:', error);
                reject(error);
            }
        });
    }

    /**
     * Get the mapped key for a tileset name
     * @param {string} tilesetName - The name of the tileset from Tiled
     * @returns {string} The mapped texture key
     */
    getTilesetKey(tilesetName) {
        // First try direct mapping
        if (this.tilesetMappings.has(tilesetName)) {
            return this.tilesetMappings.get(tilesetName);
        }

        // Try without extension
        const nameWithoutExt = tilesetName.replace(/\.png$/, '');
        if (this.tilesetMappings.has(nameWithoutExt)) {
            return this.tilesetMappings.get(nameWithoutExt);
        }

        // Try without path
        const nameWithoutPath = tilesetName.split('/').pop();
        if (this.tilesetMappings.has(nameWithoutPath)) {
            return this.tilesetMappings.get(nameWithoutPath);
        }

        // Return original name if no mapping found
        console.warn(`No mapping found for tileset: ${tilesetName}`);
        return tilesetName;
    }

    /**
     * Check if an asset is loaded
     * @param {string} key - The asset key
     * @returns {boolean} True if the asset is loaded
     */
    isAssetLoaded(key) {
        return this.loadedAssets.has(key);
    }

    /**
     * Get all loaded assets of a specific type
     * @param {string} type - The asset type ('image', 'audio', 'tilemap')
     * @returns {Array} Array of asset keys of the specified type
     */
    getLoadedAssetsByType(type) {
        return Array.from(this.loadedAssets.entries())
            .filter(([_, data]) => data.type === type)
            .map(([key]) => key);
    }

    /**
     * Add a new tileset mapping
     * @param {string} tilesetName - The name from Tiled
     * @param {string} textureKey - The texture key in Phaser
     */
    addTilesetMapping(tilesetName, textureKey) {
        this.tilesetMappings.set(tilesetName, textureKey);
    }

    /**
     * Add a new asset mapping
     * @param {string} type - The asset type ('images', 'audio', 'tilemaps')
     * @param {string} key - The asset key
     * @param {string} path - The asset path
     */
    addAssetMapping(type, key, path) {
        if (!this.assetMappings.has(type)) {
            this.assetMappings.set(type, {});
        }
        this.assetMappings.get(type)[key] = path;
    }
} 