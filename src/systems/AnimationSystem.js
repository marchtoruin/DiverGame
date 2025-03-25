import { ANIMATIONS } from '../utils/Constants';

/**
 * Handles all animation-related functionality
 */
export default class AnimationSystem {
    /**
     * Create and initialize the animation system
     * @param {Phaser.Scene} scene - The scene this system belongs to
     */
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Create the swimming animation from a sprite strip
     * @param {string} fullImageKey - Key of the full sprite strip image
     */
    createPlayerSwimAnimation(fullImageKey) {
        console.log('Creating player swim animation...');
        
        // Make sure the full image is loaded
        if (!this.scene.textures.exists(fullImageKey)) {
            console.error(`Failed to load ${fullImageKey} image`);
            return false;
        }

        // Get the full image texture
        const fullTexture = this.scene.textures.get(fullImageKey);
        const source = fullTexture.source[0];
        
        // Calculate frames - use exact dimensions from Constants instead of calculating
        const frameWidth = ANIMATIONS.IDLE_SWIM.FRAME_WIDTH;  // 87
        const frameHeight = ANIMATIONS.IDLE_SWIM.FRAME_HEIGHT; // 102
        const frameCount = ANIMATIONS.IDLE_SWIM.FRAMES || 3;  // 3 frames
        
        console.log(`Animation frames: ${frameCount} frames at ${frameWidth}x${frameHeight} pixels`);
        console.log(`Source image dimensions: ${source.width}x${source.height} pixels`);
        
        try {
            // Remove existing texture and animation if they exist
            if (this.scene.textures.exists(ANIMATIONS.IDLE_SWIM.KEY)) {
                this.scene.textures.remove(ANIMATIONS.IDLE_SWIM.KEY);
                console.log(`Removed existing texture: ${ANIMATIONS.IDLE_SWIM.KEY}`);
            }
            
            if (this.scene.anims.exists(ANIMATIONS.IDLE_SWIM.KEY)) {
                this.scene.anims.remove(ANIMATIONS.IDLE_SWIM.KEY);
                console.log(`Removed existing animation: ${ANIMATIONS.IDLE_SWIM.KEY}`);
            }
            
            // Create the animation directly without creating a new texture
            this.scene.anims.create({
                key: ANIMATIONS.IDLE_SWIM.KEY,
                frames: this.scene.anims.generateFrameNumbers(fullImageKey, { 
                    start: 0, 
                    end: frameCount - 1 
                }),
                frameRate: ANIMATIONS.IDLE_SWIM.FRAME_RATE,
                repeat: -1
            });
            
            console.log(`Created animation: ${ANIMATIONS.IDLE_SWIM.KEY} with ${frameCount} frames`);
            return true;
        } catch (error) {
            console.error('Error creating animation:', error);
            return false;
        }
    }

    /**
     * Create a simple placeholder animation to prevent crashes when textures are missing
     */
    createPlaceholderAnimation() {
        console.log('Creating placeholder animation');
        
        try {
            // If the idle_swim key already exists as an animation, remove it first
            if (this.scene.anims.exists(ANIMATIONS.IDLE_SWIM.KEY)) {
                this.scene.anims.remove(ANIMATIONS.IDLE_SWIM.KEY);
            }
            
            // Create a single-frame animation that won't crash
            this.scene.anims.create({
                key: ANIMATIONS.IDLE_SWIM.KEY,
                frames: [{ key: 'player', frame: 0 }],
                frameRate: ANIMATIONS.IDLE_SWIM.FRAME_RATE,
                repeat: 0
            });
            
            console.log('Placeholder animation created successfully');
            return true;
        } catch (error) {
            console.error('Failed to create placeholder animation:', error);
            return false;
        }
    }

    /**
     * Clean up existing animations
     */
    cleanUpAnimations() {
        console.log('Cleaning up existing animations');
        
        // Remove idle_swim animation if it exists
        if (this.scene.anims.exists(ANIMATIONS.IDLE_SWIM.KEY)) {
            try {
                this.scene.anims.remove(ANIMATIONS.IDLE_SWIM.KEY);
                console.log(`Removed existing animation: ${ANIMATIONS.IDLE_SWIM.KEY}`);
            } catch (e) {
                console.warn(`Error removing animation ${ANIMATIONS.IDLE_SWIM.KEY}:`, e);
            }
        }
        
        // Remove any textures we've created
        if (this.scene.textures.exists(ANIMATIONS.IDLE_SWIM.KEY)) {
            try {
                this.scene.textures.remove(ANIMATIONS.IDLE_SWIM.KEY);
                console.log(`Removed texture: ${ANIMATIONS.IDLE_SWIM.KEY}`);
            } catch (e) {
                console.warn(`Error removing texture ${ANIMATIONS.IDLE_SWIM.KEY}:`, e);
            }
        }
    }

    /**
     * Create all required animations
     */
    createAnimations() {
        console.log('Creating all animations');
        
        // Create the swimming animation
        const animResult = this.createPlayerSwimAnimation('idle_swim_full');
        console.log(`Animation creation result: ${animResult ? 'Success' : 'Failed'}`);
        
        return animResult;
    }
} 