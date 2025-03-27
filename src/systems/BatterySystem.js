/**
 * BatterySystem - Manages the flashlight's battery level and indicator
 */
export default class BatterySystem {
    constructor(scene) {
        this.scene = scene;
        this.maxBattery = 100;
        this.currentBattery = this.maxBattery;
        this.drainRate = 2; // Battery percentage drained per second
        this.rechargeRate = 5; // Battery percentage recharged per second
        this.isFlashlightOn = false;
        this.lastUpdateTime = 0;
        
        // Battery level thresholds and their corresponding colors
        this.batteryStates = [
            { threshold: 75, color: 0x00ff00 }, // Green (100-75%)
            { threshold: 50, color: 0xffff00 }, // Yellow (74-50%)
            { threshold: 25, color: 0xff8800 }, // Orange (49-25%)
            { threshold: 0, color: 0xff0000 }   // Red (24-0%)
        ];
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

        if (this.isFlashlightOn && this.currentBattery > 0) {
            // Drain battery when flashlight is on
            this.currentBattery = Math.max(0, this.currentBattery - (this.drainRate * deltaSeconds));
            
            // Turn off flashlight if battery is depleted
            if (this.currentBattery === 0) {
                this.turnOffFlashlight();
            }
        } else if (!this.isFlashlightOn && this.currentBattery < this.maxBattery) {
            // Recharge battery when flashlight is off
            this.currentBattery = Math.min(this.maxBattery, this.currentBattery + (this.rechargeRate * deltaSeconds));
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