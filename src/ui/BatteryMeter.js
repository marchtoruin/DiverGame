/**
 * BatteryMeter - UI component to display flashlight's battery level
 */
export default class BatteryMeter {
    /**
     * Create a new battery meter UI component
     * @param {Phaser.Scene} scene - The scene this component belongs to
     * @param {Object} config - Configuration options
     */
    constructor(scene, config = {}) {
        this.scene = scene;
        this.x = config.x || 10;
        this.y = config.y || 100; // Position below health bar
        this.width = config.width || 200;
        this.height = config.height || 40;
        this.maxValue = config.maxValue || 100;
        this.value = config.initialValue !== undefined ? config.initialValue : this.maxValue;
        
        // Colors
        this.colors = {
            background: 0x000000,
            bar: 0xff40ff, // Magenta color to match flashlight
            border: 0x000000,
            text: '#ffffff'
        };
        
        // Create container
        this.container = scene.add.container(this.x, this.y);
        
        // Create white border
        this.whiteBorder = scene.add.rectangle(
            -2,
            -2,
            this.width + 8,
            this.height + 8,
            0xffffff
        );
        this.whiteBorder.setOrigin(0, 0);
        
        // Create black border
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
        
        // Create battery bar
        this.bar = scene.add.rectangle(
            2,
            2,
            this.width,
            this.height,
            this.colors.bar
        );
        this.bar.setOrigin(0, 0);
        
        // Add battery icon and text
        this.label = scene.add.text(
            15,
            this.height / 2 + 2,
            '🔋', // Battery emoji as placeholder, can be replaced with a sprite
            {
                fontFamily: 'Verdana',
                fontSize: '20px',
                color: '#ffffff',
                fontStyle: 'bold',
                resolution: 4,
                padding: { x: 1, y: 1 }
            }
        );
        this.label.setOrigin(0, 0.5);
        
        // Add percentage text to the right
        this.percentText = scene.add.text(
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
        
        // Add elements to container in correct order
        this.container.add([
            this.whiteBorder,
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
    }
    
    /**
     * Periodically check and fix position if needed
     */
    checkPosition() {
        if (this.container) {
            if (this.container.x !== this.x || this.container.y !== this.y) {
                this.container.setPosition(this.x, this.y);
            }
            
            if (this.container.scrollFactorX !== 0 || this.container.scrollFactorY !== 0) {
                this.container.setScrollFactor(0);
            }
            
            if (this.container.depth < 1000) {
                this.container.setDepth(1000);
            }
        }
    }
    
    /**
     * Handle resize events to keep the meter in the correct position
     */
    handleResize() {
        if (this.container) {
            this.container.setPosition(this.x, this.y);
            this.container.setScrollFactor(0);
            this.container.setDepth(1000);
        }
    }
    
    /**
     * Update the battery meter's value
     * @param {number} value - Current battery value
     * @param {number} maxValue - Maximum battery value
     */
    updateValue(value, maxValue = this.maxValue) {
        this.value = value;
        
        if (maxValue !== undefined) {
            this.maxValue = maxValue;
        }
        
        // Calculate the percentage of battery remaining
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
     * Destroy the battery meter and clean up
     */
    destroy() {
        // Remove event listeners
        this.scene.events.off('resize', this.handleResize, this);
        this.scene.events.off('postupdate', this.checkPosition, this);
        
        // Destroy container and all children
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
    }
} 