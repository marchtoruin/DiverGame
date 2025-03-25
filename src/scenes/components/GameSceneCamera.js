import { CAMERA, PHYSICS } from '../../utils/Constants';

/**
 * Handles camera management for GameScene
 */
export class GameSceneCamera {
    constructor(scene) {
        this.scene = scene;
        this.camera = scene.cameras.main;
        this.originalBounds = null;
        this.updateListener = null;
    }

    /**
     * Initialize camera settings
     */
    initialize() {
        // Set initial background color
        this.camera.setBackgroundColor('rgba(0, 0, 40, 1)');
        this.setupCameraBounds();
        this.setupCameraFollow();
        this.setupUpdateListener();
    }

    /**
     * Set up camera bounds based on map dimensions
     */
    setupCameraBounds() {
        // Get the map dimensions from the tilemap or use default physics bounds
        const mapWidth = this.scene.map ? this.scene.map.widthInPixels : PHYSICS.WORLD_BOUNDS.WIDTH;
        const mapHeight = this.scene.map ? this.scene.map.heightInPixels : PHYSICS.WORLD_BOUNDS.HEIGHT;
        
        console.log('Setting camera bounds to match map dimensions:', { 
            width: mapWidth, 
            height: mapHeight, 
            physicsWorldBounds: { 
                width: this.scene.physics.world.bounds.width, 
                height: this.scene.physics.world.bounds.height 
            }
        });
        
        // Set camera bounds to match world bounds exactly
        this.camera.setBounds(0, 0, mapWidth, mapHeight);
        
        // Store original camera bounds for reference
        this.originalBounds = {
            x: 0,
            y: 0,
            width: mapWidth,
            height: mapHeight
        };
    }

    /**
     * Set up camera to follow player
     */
    setupCameraFollow() {
        if (!this.scene.player?.sprite) {
            console.error('Cannot setup camera follow: player not initialized');
            return;
        }

        // Remove deadzone to keep camera centered on player
        this.camera.startFollow(this.scene.player.sprite, true, 1, 1);
        
        // Set round pixels to prevent texture bleeding
        this.camera.roundPixels = true;
    }

    /**
     * Set up camera update listener for bounds checking
     */
    setupUpdateListener() {
        // Remove any existing update listener
        if (this.updateListener) {
            this.scene.events.off('update', this.updateListener);
        }

        // Create new update listener
        this.updateListener = () => {
            if (!this.scene.player?.sprite || !this.camera || !this.originalBounds) return;
            
            // Calculate the camera's view rectangle
            const halfWidth = this.camera.width * 0.5;
            const halfHeight = this.camera.height * 0.5;
            
            // Calculate desired camera position (centered on player)
            let cameraX = this.scene.player.sprite.x - halfWidth;
            let cameraY = this.scene.player.sprite.y - halfHeight;
            
            // Clamp camera position to world bounds
            cameraX = Phaser.Math.Clamp(cameraX, 0, this.originalBounds.width - this.camera.width);
            cameraY = Phaser.Math.Clamp(cameraY, 0, this.originalBounds.height - this.camera.height);
            
            // Set camera position directly if it would go out of bounds
            if (cameraX <= 0 || cameraX >= this.originalBounds.width - this.camera.width ||
                cameraY <= 0 || cameraY >= this.originalBounds.height - this.camera.height) {
                this.camera.setScroll(cameraX, cameraY);
            }
        };

        // Add the update listener
        this.scene.events.on('update', this.updateListener);
    }

    /**
     * Apply camera shake effect
     * @param {number} duration - Duration of shake effect in ms
     * @param {number} intensity - Intensity of shake effect
     */
    shake(duration = CAMERA.SHAKE.DURATION, intensity = CAMERA.SHAKE.INTENSITY) {
        if (this.camera) {
            this.camera.shake(duration, intensity);
        }
    }

    /**
     * Update camera viewport on resize
     */
    handleResize() {
        if (this.originalBounds) {
            this.setupCameraBounds();
        }
    }

    /**
     * Clean up camera resources
     */
    destroy() {
        if (this.updateListener) {
            this.scene.events.off('update', this.updateListener);
            this.updateListener = null;
        }
    }
} 