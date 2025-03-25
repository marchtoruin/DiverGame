/**
 * OxygenMeter - UI component to display player's oxygen level
 */
import { OXYGEN } from '../utils/Constants';

export default class OxygenMeter {
    /**
     * Create a new oxygen meter UI component
     * @param {Phaser.Scene} scene - The scene this component belongs to
     * @param {Object} config - Configuration options
     */
    constructor(scene, config = {}) {
        this.scene = scene;
        this.x = config.x || 10;
        this.y = config.y || 10;
        this.width = config.width || OXYGEN.MAX_DISPLAY_WIDTH;
        this.height = config.height || 40; // Increased height
        this.maxValue = config.maxValue || OXYGEN.MAX;
        this.value = config.initialValue !== undefined ? config.initialValue : this.maxValue;
        
        // Colors
        this.colors = {
            background: 0x000000,
            bar: 0x3498db, // Light blue color
            border: 0x000000,
            text: '#ffffff'
        };
        
        // Create container
        this.container = scene.add.container(this.x, this.y);
        
        // Create border (black outline)
        this.border = scene.add.rectangle(
            0,
            0,
            this.width + 4,
            this.height + 4,
            this.colors.border
        );
        this.border.setOrigin(0, 0);
        
        // Create black background
        this.background = scene.add.rectangle(
            2,
            2,
            this.width,
            this.height,
            this.colors.background
        );
        this.background.setOrigin(0, 0);
        
        // Create oxygen bar
        this.bar = scene.add.rectangle(
            2,
            2,
            this.width,
            this.height,
            this.colors.bar
        );
        this.bar.setOrigin(0, 0);
        
        // Add "O2" text on the bar
        this.label = scene.add.text(
            10,
            this.height / 2 + 2,
            'O2',
            {
                fontFamily: 'Arial',
                fontSize: '24px',
                color: '#000000',
                fontStyle: 'bold'
            }
        );
        this.label.setOrigin(0, 0.5);
        
        // Add percentage text to the right
        this.percentText = scene.add.text(
            this.width + 10,
            this.height / 2 + 2,
            '100%',
            {
                fontFamily: 'Arial',
                fontSize: '24px', // Smaller text size
                color: '#ffffff',
                fontStyle: 'bold'
            }
        );
        this.percentText.setOrigin(0, 0.5);
        
        // Add elements to container in correct order
        this.container.add([
            this.border,
            this.background,
            this.bar,
            this.label,
            this.percentText
        ]);
        
        // Set initial value
        this.updateValue(this.value, this.maxValue);
        
        // Set depth and scroll factor
        this.setScrollFactor(0);
        this.setDepth(1000);
        
        // Add event listeners
        this.scene.events.on('resize', this.handleResize, this);
        this.scene.events.on('postupdate', this.checkPosition, this);
        
        // Listen for player oxygen changes
        this.scene.events.on('playerOxygenChanged', this.updateValue, this);
        this.scene.events.on('playerBoostActivated', this.setBoostState, this);
        this.scene.events.on('playerBoostDeactivated', this.clearBoostState, this);
        this.scene.events.on('playerLowOxygen', this.setWarningState, this);
    }
    
    /**
     * Periodically check and fix position if needed
     */
    checkPosition() {
        if (this.container) {
            // We need to ensure the container is still at the top-left corner
            if (this.container.x !== this.x || this.container.y !== this.y) {
                console.log(`Fixing UI meter position from (${this.container.x}, ${this.container.y}) to (${this.x}, ${this.y})`);
                this.container.setPosition(this.x, this.y);
            }
            
            // Double check the scroll factor is still 0
            if (this.container.scrollFactorX !== 0 || this.container.scrollFactorY !== 0) {
                console.log('Fixing UI meter scroll factor');
                this.container.setScrollFactor(0);
            }
            
            // Ensure depth is correct
            if (this.container.depth < 1000) {
                console.log('Fixing UI meter depth');
                this.container.setDepth(1000);
            }
        }
    }
    
    /**
     * Handle resize events to keep the meter in the correct position
     */
    handleResize() {
        if (this.container) {
            const camera = this.scene.cameras.main;
            
            // Position in screen space coordinates (ignoring camera position and zoom)
            this.container.setPosition(this.x, this.y);
            
            // Ensure it stays fixed to camera
            this.container.setScrollFactor(0);
            
            // Ensure it stays on top
            this.container.setDepth(1000);
            
            // Log the position for debugging
            console.log(`UI meter positioned at (${this.container.x}, ${this.container.y}) with scroll factor (${this.container.scrollFactorX}, ${this.container.scrollFactorY})`);
        }
    }
    
    /**
     * Update the oxygen meter's value
     * @param {number} value - Current oxygen value
     * @param {number} maxValue - Maximum oxygen value
     */
    updateValue(value, maxValue = this.maxValue) {
        this.value = value;
        
        if (maxValue !== undefined) {
            this.maxValue = maxValue;
        }
        
        // Calculate the percentage of oxygen remaining
        const percent = Phaser.Math.Clamp(this.value / this.maxValue, 0, 1);
        
        // Update the bar width
        if (this.bar) {
            this.bar.width = this.width * percent;
        }
        
        // Update percentage text
        if (this.percentText) {
            this.percentText.setText(`${Math.round(percent * 100)}%`);
        }
    }
    
    /**
     * Set the oxygen bar to the warning/low state
     * @param {boolean} isWarning - Whether the oxygen is in warning state
     */
    setWarningState(isWarning) {
        // Implementation needed
    }
    
    /**
     * Set the oxygen bar to the boost state
     * @param {boolean} isBoost - Whether the boost is active
     */
    setBoostState(isBoost = true) {
        // Implementation needed
    }
    
    /**
     * Clear the boost state
     */
    clearBoostState() {
        // Implementation needed
    }
    
    /**
     * Set the depth of the container to ensure it renders on top
     * @param {number} depth - The depth value
     */
    setDepth(depth) {
        if (this.container) {
            this.container.setDepth(depth);
        }
    }
    
    /**
     * Set the scroll factor for the container (0 = fixed to camera)
     * @param {number} value - Scroll factor value
     */
    setScrollFactor(value) {
        if (this.container) {
            this.container.setScrollFactor(value);
        }
    }
    
    /**
     * Destroy the oxygen meter and clean up
     */
    destroy() {
        // Remove event listeners
        this.scene.events.off('playerOxygenChanged', this.updateValue, this);
        this.scene.events.off('playerBoostActivated', this.setBoostState, this);
        this.scene.events.off('playerBoostDeactivated', this.clearBoostState, this);
        this.scene.events.off('playerLowOxygen', this.setWarningState, this);
        this.scene.events.off('resize', this.handleResize, this);
        this.scene.events.off('postupdate', this.checkPosition, this);
        
        // Destroy container and all children
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
    }
} 