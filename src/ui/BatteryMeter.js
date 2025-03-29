/**
 * BatteryMeter - UI component to display battery icon and level
 */
export default class BatteryMeter {
    /**
     * Create a new battery meter UI component
     * @param {Phaser.Scene} scene - The scene this component belongs to
     * @param {Object} config - Configuration options
     */
    constructor(scene, config = {}) {
        this.scene = scene;
        
        // Battery level configuration
        this.maxBatteryLevel = 100;
        this.currentBatteryLevel = 100;
        this.drainRate = config.drainRate || 1; // 1% per interval
        this.rechargeRate = config.rechargeRate || 0.5; // Recharge 0.5% per interval (half speed of drain)
        this.drainInterval = config.drainInterval || 250; // 4 times per second
        this.isFlashlightActive = false;
        
        // Position configuration
        this.targetX = 25;
        this.targetY = 195; // Moved down 50px from original 145
        
        // Color thresholds and values
        this.colorThresholds = {
            low: 0.3,    // 30% - transition to red
            medium: 0.6  // 60% - transition to yellow
        };
        
        this.colors = {
            high: 0x00ff00,   // Green
            medium: 0xffff00, // Yellow
            low: 0xff0000     // Red
        };
        
        // Create container for battery elements
        this.container = scene.add.container(this.targetX, this.targetY);
        this.container.setScrollFactor(0);
        this.container.setDepth(999);
        
        // Create battery icon (60x108px)
        this.icon = scene.add.sprite(0, -80, 'battery');
        this.icon.setOrigin(0, 0.5);
        this.icon.setScale(0.5);
        
        // Create battery level bar
        this.levelBar = scene.add.rectangle(
            8,      // X offset
            -55,    // Y offset adjusted to match new sprite position
            16,     // Width
            42,     // Height reduced from 50 to 35 to fit battery sprite better
            this.colors.high
        );
        this.levelBar.setOrigin(0, 1);
        this.levelBar.setDepth(-1);
        
        // Add elements to container
        this.container.add([this.levelBar, this.icon]);
        
        // Set up keyboard input
        this.keyF = this.scene.input.keyboard.addKey('F');
        this.keyF.on('down', this.toggleFlashlight, this);
        
        // Start battery drain timer (but won't drain unless active)
        this.startDrain();
        
        // Add event listeners
        this.scene.events.on('resize', this.handleResize, this);
        this.scene.events.on('postupdate', this.checkPosition, this);
        
        // Debug: Test initial update
        this.updateBatteryLevel();
    }
    
    /**
     * Toggle flashlight state on F key press
     */
    toggleFlashlight() {
        this.isFlashlightActive = !this.isFlashlightActive;
        console.log('BatteryMeter: Flashlight toggled:', this.isFlashlightActive);
    }
    
    /**
     * Start the battery drain timer
     */
    startDrain() {
        this.drainTimer = this.scene.time.addEvent({
            delay: this.drainInterval,
            callback: this.updateBatteryLevel,
            callbackScope: this,
            loop: true
        });
    }
    
    /**
     * Update the battery level and visual representation
     */
    updateBatteryLevel() {
        // Handle battery drain when flashlight is active
        if (this.isFlashlightActive && this.currentBatteryLevel > 0) {
            // Reduce battery level
            this.currentBatteryLevel = Math.max(0, this.currentBatteryLevel - this.drainRate);
            
            // If battery is depleted, emit event
            if (this.currentBatteryLevel === 0) {
                console.log('BatteryMeter: Battery depleted!');
                this.scene.events.emit('batteryDepleted');
                this.isFlashlightActive = false;
            }
        } 
        // Handle battery recharge when flashlight is off
        else if (!this.isFlashlightActive && this.currentBatteryLevel < this.maxBatteryLevel) {
            // Increase battery level
            this.currentBatteryLevel = Math.min(this.maxBatteryLevel, this.currentBatteryLevel + this.rechargeRate);
        }
        
        // Calculate percentage and update visuals
        const percentage = this.currentBatteryLevel / this.maxBatteryLevel;
        
        // Update bar height
        this.levelBar.scaleY = percentage;
        
        // Update color based on threshold
        let color;
        if (percentage <= this.colorThresholds.low) {
            color = this.colors.low;
        } else if (percentage <= this.colorThresholds.medium) {
            color = this.colors.medium;
        } else {
            color = this.colors.high;
        }
        this.levelBar.setFillStyle(color);
    }
    
    /**
     * Periodically check and fix position if needed
     */
    checkPosition() {
        if (this.container) {
            if (this.container.x !== this.targetX || this.container.y !== this.targetY) {
                this.container.setPosition(this.targetX, this.targetY);
            }
            
            if (this.container.scrollFactorX !== 0 || this.container.scrollFactorY !== 0) {
                this.container.setScrollFactor(0);
            }
        }
    }
    
    /**
     * Handle resize events
     */
    handleResize() {
        if (this.container) {
            this.container.setPosition(this.targetX, this.targetY);
            this.container.setScrollFactor(0);
        }
    }
    
    /**
     * Get current battery level
     * @returns {number} Current battery level (0-100)
     */
    getBatteryLevel() {
        return this.currentBatteryLevel;
    }
    
    /**
     * Set battery level
     * @param {number} level - New battery level (0-100)
     */
    setBatteryLevel(level) {
        this.currentBatteryLevel = Phaser.Math.Clamp(level, 0, this.maxBatteryLevel);
        this.updateBatteryLevel();
    }
    
    /**
     * Destroy the battery meter and clean up
     */
    destroy() {
        // Stop drain timer
        if (this.drainTimer) {
            this.drainTimer.remove();
        }
        
        // Remove keyboard input
        if (this.keyF) {
            this.keyF.removeAllListeners();
        }
        
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