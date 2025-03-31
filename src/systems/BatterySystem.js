/**
 * BatterySystem - Manages the flashlight's battery level and indicator
 */
export default class BatterySystem {
    constructor(scene) {
        this.scene = scene;
        console.log('🔋 BatterySystem initialized with scene:', this.scene.constructor.name);
        this.maxBattery = 100;
        this.currentBattery = this.maxBattery;
        this.drainRate = 2; // Battery percentage drained per second
        this.rechargeRate = 5; // Battery percentage recharged per second
        this.isFlashlightOn = false;
        this.lastUpdateTime = 0;
        this.batteryDepleted = false; // Flag to prevent multiple depleted events
        
        // Battery level thresholds and their corresponding colors
        this.batteryStates = [
            { threshold: 75, color: 0x00ff00 }, // Green (100-75%)
            { threshold: 50, color: 0xffff00 }, // Yellow (74-50%)
            { threshold: 25, color: 0xff8800 }, // Orange (49-25%)
            { threshold: 0, color: 0xff0000 }   // Red (24-0%)
        ];

        // Listen for battery-depleted event
        this.scene.events.on('battery-depleted', () => {
            console.log('Battery depleted event received - turning off flashlight');
            // First update our internal state
            this.isFlashlightOn = false;
            
            // Then ensure the flashlight is disabled in the lighting system
            if (this.scene.lightingSystem) {
                // Set flashlightEnabled to false before toggling
                this.scene.lightingSystem.flashlightEnabled = false;
                
                // Force flashlight visual elements to be hidden
                if (this.scene.lightingSystem.flashlightPointLight) {
                    this.scene.lightingSystem.flashlightPointLight.setVisible(false);
                }
                
                if (this.scene.lightingSystem.flashlightGlow) {
                    this.scene.lightingSystem.flashlightGlow.setVisible(false);
                }
                
                // Clear any mask on the overlay
                if (this.scene.lightingSystem.overlay) {
                    this.scene.lightingSystem.overlay.clearMask();
                }
                
                console.log('[DEBUG] Forcibly disabled flashlight visuals');
            }
            
            // Ensure the flashlight is off in the BatteryMeter
            if (this.scene.gameSceneUI?.batteryMeter) {
                this.scene.gameSceneUI.batteryMeter.isFlashlightActive = false;
            }
        });
        
        // Also listen for batteryDepleted (no hyphen) from BatteryMeter
        this.scene.events.on('batteryDepleted', () => {
            console.log('BatteryMeter batteryDepleted event received');
            // Trigger our standard battery-depleted event to ensure consistency
            this.scene.events.emit('battery-depleted');
        });
    }

    /**
     * Update the battery level based on flashlight usage
     * @param {number} time - Current game time
     */
    update(time) {
        if (this.lastUpdateTime === 0) {
            this.lastUpdateTime = time;
            return;
        }

        const deltaSeconds = (time - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = time;

        if (this.isFlashlightOn) {
            this.currentBattery = Math.max(0, this.currentBattery - (this.drainRate * deltaSeconds));
            
            // Check for battery depletion
            if (this.currentBattery <= 0 && !this.batteryDepleted) {
                this.batteryDepleted = true;
                console.log("🔋 Battery depleted — emitting event from scene:", this.scene.constructor.name);
                this.scene.events.emit('battery-depleted');
            }
        } else if (this.currentBattery < this.maxBattery) {
            this.currentBattery = Math.min(this.maxBattery, this.currentBattery + (this.rechargeRate * deltaSeconds));
            // Reset the depleted flag when battery recharges
            if (this.currentBattery > 0 && this.batteryDepleted) {
                this.batteryDepleted = false;
            }
        }
    }

    /**
     * Force the flashlight to turn off (used when battery depletes)
     */
    forceFlashlightOff() {
        this.isFlashlightOn = false;
        if (this.scene.lightingSystem) {
            // Ensure the flashlight is turned off in the lighting system
            this.scene.lightingSystem.flashlightEnabled = false;
            
            // Directly hide the flashlight visual elements
            if (this.scene.lightingSystem.flashlightPointLight) {
                this.scene.lightingSystem.flashlightPointLight.setVisible(false);
            }
            
            if (this.scene.lightingSystem.flashlightGlow) {
                this.scene.lightingSystem.flashlightGlow.setVisible(false);
            }
            
            // Clear any mask on the overlay
            if (this.scene.lightingSystem.overlay) {
                this.scene.lightingSystem.overlay.clearMask();
            }
            
            console.log('[DEBUG] Forcibly turned off flashlight');
        }
    }

    /**
     * Update the indicator light color based on current battery level
     */
    updateIndicatorColor() {
        if (!this.scene.lightingSystem) return;

        // Find the appropriate color for current battery level
        const state = this.batteryStates.find(state => this.currentBattery > state.threshold);
        const color = state ? state.color : this.batteryStates[this.batteryStates.length - 1].color;

        // Update both the point light and glow colors
        if (this.scene.lightingSystem.flashlightPointLight) {
            this.scene.lightingSystem.flashlightPointLight.setTint(color);
        }
        if (this.scene.lightingSystem.flashlightGlow) {
            // Make glow slightly lighter
            const glowColor = this.getLighterColor(color);
            this.scene.lightingSystem.flashlightGlow.setTint(glowColor);
        }
    }

    /**
     * Get a lighter version of a color for the glow effect
     * @param {number} color - The base color in hex
     * @returns {number} - Lighter version of the color
     */
    getLighterColor(color) {
        const r = ((color >> 16) & 255) + 40;
        const g = ((color >> 8) & 255) + 40;
        const b = (color & 255) + 40;
        return ((Math.min(r, 255) << 16) | (Math.min(g, 255) << 8) | Math.min(b, 255));
    }

    /**
     * Try to turn on the flashlight
     * @returns {boolean} Whether the flashlight was successfully turned on
     */
    turnOnFlashlight() {
        if (this.currentBattery > 0) {
            this.isFlashlightOn = true;
            return true;
        }
        return false;
    }

    /**
     * Turn off the flashlight
     */
    turnOffFlashlight() {
        this.isFlashlightOn = false;
        if (this.scene.lightingSystem) {
            this.scene.lightingSystem.toggleFlashlight();
        }
    }

    /**
     * Get the current battery percentage
     * @returns {number} Battery percentage (0-100)
     */
    getBatteryPercentage() {
        return this.currentBattery;
    }

    /**
     * Recharge the battery to full
     */
    rechargeBattery() {
        this.currentBattery = this.maxBattery;
    }
} 