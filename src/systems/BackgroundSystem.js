export default class BackgroundSystem {
    constructor(scene) {
        this.scene = scene;
        this.backgrounds = new Map();
    }

    createFullScreenBackground() {
        try {
            // Create a solid color background that fills the entire camera view
            const fixedBgRect = this.scene.add.rectangle(
                0, 0,
                this.scene.cameras.main.width,
                this.scene.cameras.main.height,
                0x000066
            );
            fixedBgRect.setScrollFactor(0);
            fixedBgRect.setDepth(-30);
            fixedBgRect.setOrigin(0, 0);
            this.backgrounds.set('fixed', fixedBgRect);
            
            // Create a second background that scrolls with the camera but more slowly
            const scrollingBgRect = this.scene.add.rectangle(
                -1000, -1000,
                this.scene.game.config.width + 2000,
                this.scene.game.config.height + 2000,
                0x000088
            );
            scrollingBgRect.setDepth(-20);
            scrollingBgRect.setOrigin(0, 0);
            scrollingBgRect.setScrollFactor(0.2);
            this.backgrounds.set('scrolling', scrollingBgRect);
            
            console.log('Created background layers successfully');
        } catch (error) {
            console.error('Error creating full screen background:', error);
        }
    }

    handleResize() {
        try {
            const fixedBg = this.backgrounds.get('fixed');
            if (fixedBg) {
                fixedBg.width = this.scene.cameras.main.width;
                fixedBg.height = this.scene.cameras.main.height;
            }

            const scrollingBg = this.backgrounds.get('scrolling');
            if (scrollingBg) {
                scrollingBg.width = this.scene.game.config.width + 2000;
                scrollingBg.height = this.scene.game.config.height + 2000;
            }
        } catch (error) {
            console.error('Error handling background resize:', error);
        }
    }

    cleanup() {
        this.backgrounds.forEach(bg => {
            if (bg && bg.destroy) {
                bg.destroy();
            }
        });
        this.backgrounds.clear();
    }

    adjustLayers(tilemapSystem) {
        if (!tilemapSystem?.map) {
            throw new Error('BackgroundSystem: No tilemap available - layers cannot be adjusted');
        }

        if (!tilemapSystem?.layers) {
            throw new Error('BackgroundSystem: No layers found in tilemap');
        }

        // Log tilemap properties for debugging
        console.log('Tilemap properties:', {
            tileWidth: tilemapSystem.map.tileWidth,
            tileHeight: tilemapSystem.map.tileHeight,
            width: tilemapSystem.map.width,
            height: tilemapSystem.map.height,
            widthInPixels: tilemapSystem.map.widthInPixels,
            heightInPixels: tilemapSystem.map.heightInPixels,
            layers: Object.keys(tilemapSystem.layers)
        });

        // Define strict layer configurations - no fallbacks
        const layerConfigs = {
            'Background': {
                depth: 0,
                scrollFactor: 0.0,
                scale: 1.0,
                alpha: 1.0,
                blendMode: Phaser.BlendModes.NORMAL
            },
            'Background_sprites': {
                depth: 1,
                scrollFactor: 0.3,
                scale: 1.0,
                alpha: 1.0
            },
            'Midground_sprites': {
                depth: 5,
                scrollFactor: 0.7,
                scale: 1.0,
                alpha: 1.0
            },
            'Obstacles': {
                depth: 40,
                scrollFactor: 1.0,
                scale: 1.0,
                alpha: 1.0
            }
        };

        // Apply configurations to layers
        Object.entries(tilemapSystem.layers).forEach(([name, layer]) => {
            if (!layer) {
                throw new Error(`BackgroundSystem: Layer "${name}" is null or undefined`);
            }

            const config = layerConfigs[name];
            if (!config) {
                throw new Error(`BackgroundSystem: No configuration found for layer "${name}"`);
            }

            // Log layer state before adjustment
            console.log(`Layer ${name} before adjustment:`, {
                scale: layer.scale,
                scaleX: layer.scaleX,
                scaleY: layer.scaleY,
                scrollFactorX: layer.scrollFactorX,
                scrollFactorY: layer.scrollFactorY,
                visible: layer.visible,
                alpha: layer.alpha,
                depth: layer.depth
            });

            // Clear any existing tweens
            this.scene.tweens.killTweensOf(layer);

            // Apply strict configuration
            layer.setVisible(true)
                .setDepth(config.depth)
                .setScrollFactor(config.scrollFactor)
                .setScale(config.scale)
                .setAlpha(config.alpha);

            if (config.blendMode !== undefined) {
                layer.setBlendMode(config.blendMode);
            }

            // Log layer state after adjustment
            console.log(`Layer ${name} after adjustment:`, {
                scale: layer.scale,
                scaleX: layer.scaleX,
                scaleY: layer.scaleY,
                scrollFactorX: layer.scrollFactorX,
                scrollFactorY: layer.scrollFactorY,
                visible: layer.visible,
                alpha: layer.alpha,
                depth: layer.depth
            });
        });
    }
} 