/**
 * OxygenMeterSystem - Handles the oxygen UI element
 * Displays and manages a player's oxygen level in the top-left corner of the screen
 */
import { OXYGEN } from '../utils/Constants';

export default class OxygenMeterSystem {
    /**
     * Creates a new oxygen meter system
     * @param {Phaser.Scene} scene - The scene this system belongs to
     * @param {Object} config - Optional configuration
     */
    constructor(scene, config = {}) {
        this.scene = scene;
        
        // Configuration
        this.width = config.width || 200;
        this.height = config.height || 40; // Match health bar height
        this.x = 10;
        this.y = 10;
        
        // Oxygen values
        this.maxOxygen = config.maxOxygen || OXYGEN.MAX;
        this.oxygen = config.startingOxygen || this.maxOxygen;
        
        // Create the UI meter
        this.createUI();
    }
    
    /**
     * Creates the UI elements
     */
    createUI() {
        // Create container for all UI elements
        this.container = this.scene.add.container(this.x, this.y);
        this.container.setDepth(1000);
        this.container.setScrollFactor(0);
        
        // Create white border
        this.whiteBorder = this.scene.add.rectangle(
            -2,
            -2,
            this.width + 8,
            this.height + 8,
            0xffffff
        );
        this.whiteBorder.setOrigin(0, 0);
        
        // Create black border
        this.border = this.scene.add.rectangle(
            0,
            0,
            this.width + 4,
            this.height + 4,
            0x000000
        );
        this.border.setOrigin(0, 0);
        
        // Create black background
        this.background = this.scene.add.rectangle(
            2,
            2,
            this.width,
            this.height,
            0x000000
        );
        this.background.setOrigin(0, 0);
        
        // Create oxygen bar
        this.bar = this.scene.add.rectangle(
            2,
            2,
            this.width,
            this.height,
            0x3498db // Light blue color
        );
        this.bar.setOrigin(0, 0);
        
        // Add "O2" text on the bar
        this.label = this.scene.add.text(
            15,
            this.height / 2 + 2,
            'O2',
            {
                fontFamily: 'Verdana',
                fontSize: '20px',
                color: '#000000',
                fontStyle: 'bold',
                resolution: 4,
                padding: { x: 1, y: 1 }
            }
        );
        this.label.setOrigin(0, 0.5);
        
        // Add percentage text to the right
        this.percentText = this.scene.add.text(
            this.width + 10,
            this.height / 2 + 2,
            '100%',
            {
                fontFamily: 'Verdana',
                fontSize: '16px',
                color: '#ffffff',
                fontStyle: 'bold',
                resolution: 4,
                padding: { x: 1, y: 1 }
            }
        );
        this.percentText.setOrigin(0, 0.5);
        
        // Add all elements to container in correct order
        this.container.add([
            this.whiteBorder,
            this.border,
            this.background,
            this.bar,
            this.label,
            this.percentText
        ]);
        
        // Initial UI update
        this.updateUI();
        
        // Handle window resize
        this.scene.scale.on('resize', this.handleResize, this);
    }
    
    handleResize() {
        if (this.container) {
            this.container.setPosition(this.x, this.y);
            this.container.setScrollFactor(0);
        }
    }
    
    /**
     * Updates the oxygen level
     * @param {number} amount - New oxygen amount
     * @param {number} maxAmount - Maximum oxygen amount (optional)
     */
    updateOxygen(amount, maxAmount = null) {
        // Update values
        this.oxygen = amount;
        if (maxAmount !== null) {
            this.maxOxygen = maxAmount;
        }
        
        // Update the UI
        this.updateUI();
    }
    
    /**
     * Updates the UI to reflect the current oxygen level
     */
    updateUI() {
        if (!this.bar || !this.percentText) return;
        
        // Calculate percentage
        const percentage = Math.max(0, Math.min(100, (this.oxygen / this.maxOxygen) * 100));
        
        // Update the bar width
        this.bar.width = (percentage / 100) * this.width;
        
        // Update percentage text
        this.percentText.setText(`${Math.floor(percentage)}%`);
    }
    
    /**
     * Update method called every frame by the scene
     */
    update() {
        // This method can be used for any per-frame updates if needed
    }
    
    /**
     * Destroys the UI elements
     */
    destroy() {
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        this.scene.scale.off('resize', this.handleResize, this);
    }
} 