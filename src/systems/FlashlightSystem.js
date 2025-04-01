/**
 * FlashlightSystem - Handles the flashlight cone effect and pin light
 * This system only manages the visual effect of the flashlight cutting through darkness
 */
export default class FlashlightSystem {
    /**
     * Create a new FlashlightSystem
     * @param {Phaser.Scene} scene - The game scene
     * @param {Phaser.GameObjects.Rectangle} darknessOverlay - The darkness overlay to mask
     */
    constructor(scene, darknessOverlay) {
        this.scene = scene;
        this.darknessOverlay = darknessOverlay;
        this.enabled = false;
        
        // Flashlight components
        this.maskImage = null;
        this.maskBitmap = null;
        this.pinLight = null;
        
        // Listen for events
        this.scene.events.on('armUpdated', this.updateFlashlight, this);
        this.scene.events.on('batteryLevelChanged', this.updatePinLightColor, this);
        this.scene.events.once('shutdown', this.destroy, this);
    }
    
    /**
     * Toggle the flashlight on/off
     */
    toggle() {
        this.enabled = !this.enabled;
        
        if (this.enabled) {
            this.initializeMask();
            this.initializePinLight();
        } else {
            this.clearMask();
            if (this.pinLight) {
                this.pinLight.setVisible(false);
            }
        }
        
        // Emit event for other systems
        this.scene.events.emit('flashlightToggled', this.enabled);
        return this.enabled;
    }
    
    /**
     * Initialize the flashlight mask
     */
    initializeMask() {
        // Clean up any existing mask
        this.clearMask();
        
        // Create the mask image using the custom cone texture
        this.maskImage = this.scene.make.image({
            x: 0,
            y: 0,
            key: 'flashlight_cone1',
            add: false
        });
        
        // Set origin to center for proper rotation
        this.maskImage.setOrigin(0.5, 0.5);
        
        // Create bitmap mask from the image
        this.maskBitmap = this.maskImage.createBitmapMask();
        
        // Apply mask to darkness overlay
        if (this.darknessOverlay) {
            this.darknessOverlay.setMask(this.maskBitmap);
        }
    }
    
    /**
     * Initialize the pin light
     */
    initializePinLight() {
        if (!this.pinLight) {
            // Create the magenta pin light
            this.pinLight = this.scene.add.sprite(0, 0, 'bullet')
                .setScale(0.4)
                .setAlpha(0.8)
                .setTint(0xff00ff)
                .setBlendMode(Phaser.BlendModes.ADD)
                .setDepth(902);
        }
        this.pinLight.setVisible(this.enabled);
    }
    
    /**
     * Update flashlight position and rotation based on arm data
     * @param {Object} armData - Data about arm position and rotation
     */
    updateFlashlight(armData) {
        if (!this.enabled || !this.maskImage) return;
        
        // Update mask position and rotation
        this.maskImage.setPosition(armData.tipX, armData.tipY);
        this.maskImage.setRotation(armData.trueDirection);
        
        // Update pin light position
        if (this.pinLight) {
            this.pinLight.setPosition(armData.tipX, armData.tipY);
            this.pinLight.setRotation(armData.trueDirection);
        }
    }
    
    /**
     * Update pin light color based on battery level
     * @param {number} batteryLevel - The current battery level
     */
    updatePinLightColor(batteryLevel) {
        if (!this.pinLight) return;
        
        // Use the same color logic as before
        let color;
        if (batteryLevel > 75) color = 0x00ff00;      // Green
        else if (batteryLevel > 50) color = 0xffff00;  // Yellow
        else if (batteryLevel > 25) color = 0xff8800;  // Orange
        else color = 0xff0000;                         // Red
        
        this.pinLight.setTint(color);
    }
    
    /**
     * Clear the flashlight mask
     */
    clearMask() {
        if (this.darknessOverlay) {
            this.darknessOverlay.clearMask();
        }
        
        if (this.maskImage) {
            this.maskImage.destroy();
            this.maskImage = null;
        }
        
        this.maskBitmap = null;
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        this.clearMask();
        if (this.pinLight) {
            this.pinLight.destroy();
            this.pinLight = null;
        }
        this.scene.events.off('armUpdated', this.updateFlashlight, this);
        this.scene.events.off('batteryLevelChanged', this.updatePinLightColor, this);
    }
} 