/**
 * HealthBar - UI component to display player's health
 */
import { PLAYER } from '../utils/Constants';

export default class HealthBar {
    /**
     * Create a new health bar
     * @param {Phaser.Scene} scene - The game scene
     * @param {Object} config - Configuration options
     */
    constructor(scene, config = {}) {
        this.scene = scene;
        console.log('Initializing HealthBar with config:', config);
        
        // Store initial position
        this.x = config.x || 10;
        this.y = config.y || 55; // Position below oxygen meter
        
        // Default configuration
        this.config = {
            width: 200,
            height: 40,
            backgroundColor: 0x000000,
            healthColor: 0xff0000,
            warningThreshold: 0.5,
            criticalThreshold: 0.25,
            ...config
        };
        
        // Create container
        this.container = scene.add.container(this.x, this.y);
        this.container.setDepth(999);
        this.container.setScrollFactor(0);
        
        // Create a separate container for smooth text rendering
        this.textContainer = scene.add.container(0, 0);
        this.textContainer.setDepth(1000);
        this.container.add(this.textContainer);
        
        // Add heart sprite as an independent element
        this.label = scene.add.sprite(
            this.x + (this.config.width / 2) - 70,
            this.y + 21,
            'heart'
        );
        this.label.setOrigin(0.5, 1);
        this.label.setScale(0.128);
        this.label.setDepth(5000);
        this.label.setScrollFactor(0);
        
        // Create white border
        this.whiteBorder = scene.add.rectangle(
            -2,
            -2,
            this.config.width + 8,
            this.config.height + 8,
            0xffffff
        );
        this.whiteBorder.setOrigin(0, 0);
        
        // Create black border
        this.border = scene.add.rectangle(
            0,
            0,
            this.config.width + 4,
            this.config.height + 4,
            this.config.backgroundColor
        );
        this.border.setOrigin(0, 0);
        
        // Create black background
        this.background = scene.add.rectangle(
            2,
            2,
            this.config.width,
            this.config.height,
            this.config.backgroundColor
        );
        this.background.setOrigin(0, 0);
        
        // Create red health bar
        this.healthBar = scene.add.rectangle(
            2,
            2,
            this.config.width,
            this.config.height,
            this.config.healthColor
        );
        this.healthBar.setOrigin(0, 0);
        
        // Add percentage text (matching oxygen meter exactly)
        this.percentText = scene.add.text(
            this.config.width + 10,
            this.config.height / 2 + 2,
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
            this.healthBar
        ]);
        this.textContainer.add([this.percentText]);
        
        console.log('HealthBar elements created:', {
            container: this.container,
            whiteBorder: this.whiteBorder,
            border: this.border,
            background: this.background,
            healthBar: this.healthBar,
            label: this.label,
            percentText: this.percentText
        });
        
        // Initialize with max health
        this.maxHealth = PLAYER.HEALTH.MAX;
        this.currentHealth = this.maxHealth;
        this.updateDisplay(this.currentHealth);
        
        // Add event listeners
        this.scene.events.on('resize', this.handleResize, this);
        this.scene.events.on('postupdate', this.checkPosition, this);
        
        // Force to top of display list
        if (this.scene.children) {
            this.scene.children.bringToTop(this.container);
        }
        
        console.log('HealthBar initialization complete');
    }
    
    /**
     * Periodically check and fix position if needed
     */
    checkPosition() {
        if (this.container) {
            // Ensure the container is still at the correct position
            if (this.container.x !== this.x || this.container.y !== this.y) {
                console.log('Fixing HealthBar position:', { from: { x: this.container.x, y: this.container.y }, to: { x: this.x, y: this.y } });
                this.container.setPosition(this.x, this.y);
            }
            
            // Double check the scroll factor is still 0
            if (this.container.scrollFactorX !== 0 || this.container.scrollFactorY !== 0) {
                console.log('Fixing HealthBar scroll factor');
                this.container.setScrollFactor(0);
            }
            
            // Ensure depth is correct
            if (this.container.depth !== 999) {
                console.log('Fixing HealthBar depth');
                this.container.setDepth(999);
            }
        }
    }
    
    /**
     * Handle resize events to keep the bar in the correct position
     */
    handleResize() {
        if (this.container) {
            console.log('Handling HealthBar resize');
            // Position in screen space coordinates
            this.container.setPosition(this.x, this.y);
            
            // Ensure it stays fixed to camera
            this.container.setScrollFactor(0);
            
            // Ensure it stays on top
            this.container.setDepth(999);
        }
    }
    
    /**
     * Update the health bar value
     * @param {number} currentHealth - Current health value
     * @param {number} maxHealth - Maximum health value
     */
    updateHealth(value, maxHealth = this.maxHealth) {
        this.maxHealth = maxHealth;
        this.currentHealth = Phaser.Math.Clamp(value, 0, maxHealth);
        console.log('Updating HealthBar:', { current: this.currentHealth, max: this.maxHealth });
        this.updateDisplay(this.currentHealth);
    }
    
    /**
     * Update the bar color based on current health level
     */
    updateDisplay(value) {
        // Calculate health percentage
        const percentage = value / this.maxHealth;
        console.log('Updating HealthBar display:', { value, percentage });
        
        // Update bar width
        this.healthBar.width = this.config.width * percentage;
        
        // Update percentage text
        this.percentText.setText(`${Math.round(percentage * 100)}%`);
        
        // Update color based on health level
        let color;
        if (percentage <= this.config.criticalThreshold) {
            color = this.config.healthColor;
            this.startPulsingAnimation();
        } else if (percentage <= this.config.warningThreshold) {
            color = this.config.healthColor;
            this.stopPulsingAnimation();
        } else {
            color = this.config.healthColor;
            this.stopPulsingAnimation();
        }
        
        // Apply color
        this.healthBar.setFillStyle(color);
        
        // Add visual feedback for damage
        if (this._lastHealth && this._lastHealth > value) {
            this.scene.cameras.main.shake(100, Math.min(0.005, (this._lastHealth - value) / 100));
            
            // Flash the bar red briefly
            this.scene.tweens.add({
                targets: this.healthBar,
                alpha: 0.2,
                duration: 100,
                yoyo: true,
                repeat: 1,
                onComplete: () => {
                    this.healthBar.setAlpha(1);
                }
            });
        }
        
        this._lastHealth = value;
    }
    
    /**
     * Start a pulsing animation for critical health warning
     */
    startPulsingAnimation() {
        if (this.pulseAnimation) return;
        
        this.pulseAnimation = this.scene.tweens.add({
            targets: this.healthBar,
            alpha: 0.4,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
    
    /**
     * Stop the pulsing animation
     */
    stopPulsingAnimation() {
        if (this.pulseAnimation) {
            this.pulseAnimation.stop();
            this.pulseAnimation = null;
            this.healthBar.setAlpha(1);
        }
    }
    
    /**
     * Show/hide the health bar
     * @param {boolean} visible - Whether the bar should be visible
     */
    setVisible(visible) {
        this.container.setVisible(visible);
    }
    
    /**
     * Update the position of the health bar
     * @param {number} x - New X position 
     * @param {number} y - New Y position
     */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.container.setPosition(x, y);
    }
    
    /**
     * Destroy the health bar and clean up resources
     */
    destroy() {
        // Stop animations
        this.stopPulsingAnimation();
        
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