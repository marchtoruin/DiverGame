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
     * Create the swimming animation for the new spritesheet
     * @param {Object} options - Optional configuration options for the animation
     */
    createNewPlayerSwimAnimation(options = {}) {
        console.log('Creating new player swim animation...');
        
        // Make sure the spritesheet is loaded
        if (!this.scene.textures.exists(ANIMATIONS.IDLE_SWIM_NEW.TEXTURE_KEY)) {
            console.error(`Failed to load ${ANIMATIONS.IDLE_SWIM_NEW.TEXTURE_KEY} spritesheet`);
            return false;
        }

        try {
            // Remove existing animation if it exists
            if (this.scene.anims.exists(ANIMATIONS.IDLE_SWIM_NEW.KEY)) {
                this.scene.anims.remove(ANIMATIONS.IDLE_SWIM_NEW.KEY);
                console.log(`Removed existing animation: ${ANIMATIONS.IDLE_SWIM_NEW.KEY}`);
            }
            
            // Default animation options
            const frameRate = options.frameRate || ANIMATIONS.IDLE_SWIM_NEW.FRAME_RATE;
            const yoyo = options.yoyo || false; // Whether the animation should play in reverse after completion
            const repeat = options.repeat !== undefined ? options.repeat : -1; // Default to looping (-1)
            const frameDelay = options.frameDelay || 0; // Delay between frames for a more deliberate animation
            const ease = options.ease || 'Sine.easeInOut'; // Add easing function for smoother transitions
            const blendMode = options.blendMode || Phaser.BlendModes.NORMAL; // Default blend mode
            const useInterpolation = options.useInterpolation !== undefined ? options.useInterpolation : true; // Enable frame interpolation
            
            // Create the animation using the spritesheet with enhanced options
            this.scene.anims.create({
                key: ANIMATIONS.IDLE_SWIM_NEW.KEY,
                frames: this.scene.anims.generateFrameNumbers(ANIMATIONS.IDLE_SWIM_NEW.TEXTURE_KEY, { 
                    start: 0, 
                    end: ANIMATIONS.IDLE_SWIM_NEW.FRAMES - 1 
                }),
                frameRate: frameRate,
                yoyo: yoyo,
                repeat: repeat,
                delay: frameDelay,
                // Frame interpolation and blending options
                ease: ease,
                blendMode: blendMode,
                // The number of milliseconds to stay on each frame
                duration: options.duration, // If provided, this overrides frameRate
                // Higher sample values can create smoother transitions in some cases
                sample: options.sample || (useInterpolation ? 2 : 1)
            });
            
            console.log(`Created new animation: ${ANIMATIONS.IDLE_SWIM_NEW.KEY} with ${ANIMATIONS.IDLE_SWIM_NEW.FRAMES} frames at ${frameRate} fps`);
            console.log(`Animation options: yoyo=${yoyo}, repeat=${repeat}, interpolation=${useInterpolation}, ease=${ease}`);
            return true;
        } catch (error) {
            console.error('Error creating new animation:', error);
            return false;
        }
    }

    /**
     * Create all required animations
     */
    createAnimations() {
        console.log('Creating all animations');
        
        // Skip trying to create animations with the new spritesheet
        // Instead, directly create a placeholder animation
        console.log('Creating placeholder animation only');
        this.createPlaceholderAnimation();
        return true;
    }

    // Add a method to create the new armless swim animation
    createPlayerNewSwimAnimation(options = {}) {
        console.log('Creating new player swim animation');
        
        if (!this.scene.textures.exists('diver_swim_new')) {
            console.error('diver_swim_new texture not found');
            return false;
        }
        
        const animKey = 'swim';
        
        // Remove any existing animation with this key
        if (this.scene.anims.exists(animKey)) {
            this.scene.anims.remove(animKey);
            console.log(`Removed existing ${animKey} animation`);
        }
        
        try {
            // Create the animation with the new spritesheet
            this.scene.anims.create({
                key: animKey,
                frames: this.scene.anims.generateFrameNumbers('diver_swim_new', { 
                    start: 0, 
                    end: 7  // 8 frames total (0-7)
                }),
                frameRate: options.frameRate || 10,
                repeat: -1
            });
            
            console.log(`Created ${animKey} animation successfully with 8 frames`);
            return true;
        } catch (error) {
            console.error('Error creating animation:', error);
            return false;
        }
    }
} 