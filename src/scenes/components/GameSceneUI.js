import { OXYGEN } from '../../utils/Constants';
import BatteryMeter from '../../ui/BatteryMeter';

/**
 * Handles UI components and their management for GameScene
 */
export class GameSceneUI {
    constructor(scene) {
        this.scene = scene;
        this.debugButton = null;
        this.debugText = null;
        this.uiElements = new Map();
        this.batteryMeter = null;
        
        // Store references to required systems
        this.OxygenMeterSystem = scene.OxygenMeterSystem || scene.scene.systems.OxygenMeterSystem;
        this.HealthSystem = scene.HealthSystem || scene.scene.systems.HealthSystem;
    }

    /**
     * Initialize UI components
     */
    initialize() {
        this.createUI();
        this.setupResizeHandler();
    }

    /**
     * Create all UI elements
     */
    createUI() {
        try {
            // Create oxygen meter
            if (this.OxygenMeterSystem) {
                this.scene.oxygenMeter = new this.OxygenMeterSystem(this.scene, {
                    x: 10,
                    y: 10,
                    width: 200,
                    height: 20,
                    startingOxygen: OXYGEN.MAX,
                    maxOxygen: OXYGEN.MAX
                });
            } else {
                console.warn('OxygenMeterSystem not available');
            }
            
            // Create health system
            if (this.scene.player && this.HealthSystem) {
                this.scene.healthSystem = new this.HealthSystem(this.scene, this.scene.player);
            } else {
                console.warn('Player or HealthSystem not available');
            }

            // Create battery meter
            this.batteryMeter = new BatteryMeter(this.scene);
            this.uiElements.set('batteryMeter', this.batteryMeter);
            
            // Add debug button in top-right corner with better visibility
            this.debugButton = this.scene.add.rectangle(
                this.scene.cameras.main.width - 80,
                40,
                120,  // Made wider
                40,   // Made taller
                0x333333,
                0.8
            );
            this.debugButton.setScrollFactor(0);
            this.debugButton.setDepth(2000);  // Ensure it's above everything
            this.debugButton.setInteractive({ useHandCursor: true });
            
            this.debugText = this.scene.add.text(
                this.debugButton.x,
                this.debugButton.y,
                `Touch: ${this.scene.touchControlsEnabled ? 'ON' : 'OFF'}`,
                {
                    font: 'bold 16px Arial',
                    color: '#ffffff',
                    align: 'center',
                    backgroundColor: '#333333'
                }
            ).setOrigin(0.5);
            this.debugText.setScrollFactor(0);
            this.debugText.setDepth(2001);  // Above the button
            
            // Toggle touch controls when clicked
            this.debugButton.on('pointerdown', () => {
                // Toggle the state
                this.scene.touchControlsEnabled = !this.scene.touchControlsEnabled;
                
                // Update the text
                this.debugText.setText(`Touch: ${this.scene.touchControlsEnabled ? 'ON' : 'OFF'}`);
                
                // Update touch control system visibility
                if (this.scene.touchControlSystem) {
                    this.scene.touchControlSystem.setVisible(this.scene.touchControlsEnabled);
                    
                    // Reset touch input state when disabled
                    if (!this.scene.touchControlsEnabled) {
                        this.scene.touchData = {
                            isMoving: false,
                            startX: 0,
                            startY: 0,
                            left: false,
                            right: false,
                            up: false,
                            down: false,
                            boost: false
                        };
                        
                        // Reset any active key states
                        if (this.scene.keys) {
                            this.scene.keys.left.isDown = false;
                            this.scene.keys.right.isDown = false;
                            this.scene.keys.up.isDown = false;
                            this.scene.keys.down.isDown = false;
                            this.scene.keys.boost.isDown = false;
                        }
                    }
                }
                
                // Visual feedback for button press
                this.scene.tweens.add({
                    targets: this.debugButton,
                    alpha: 0.5,
                    yoyo: true,
                    duration: 100
                });
            });

            // Connect player oxygen events to UI
            this.scene.events.on('playerOxygenChanged', (value, maxValue) => {
                if (this.scene.oxygenMeter) {
                    this.scene.oxygenMeter.updateOxygen(value, maxValue);
                }
            });

            console.log('UI initialization complete');
        } catch (error) {
            console.error('Error creating UI:', error);
        }
    }

    /**
     * Set up window resize handler
     */
    setupResizeHandler() {
        this.scene.scale.on('resize', this.handleResize, this);
    }

    /**
     * Handle window resize events
     */
    handleResize() {
        const width = this.scene.cameras.main.width;
        
        // Update debug button position
        if (this.debugButton && this.debugText) {
            this.debugButton.setPosition(width - 80, 40);
            this.debugText.setPosition(this.debugButton.x, this.debugButton.y);
        }
    }

    /**
     * Update UI elements
     */
    update(time, delta) {
        // Update oxygen meter
        if (this.scene.oxygenMeter?.update) {
            this.scene.oxygenMeter.update(time, delta);
        }

        // Update health system
        if (this.scene.healthSystem?.update) {
            this.scene.healthSystem.update(time, delta);
        }
    }

    /**
     * Clean up UI elements
     */
    destroy() {
        // Remove resize listener
        this.scene.scale.off('resize', this.handleResize, this);

        // Destroy debug elements
        if (this.debugButton) {
            this.debugButton.destroy();
            this.debugButton = null;
        }
        if (this.debugText) {
            this.debugText.destroy();
            this.debugText = null;
        }

        // Clean up battery meter
        if (this.batteryMeter) {
            this.batteryMeter.destroy();
            this.batteryMeter = null;
        }

        // Clean up other UI elements
        for (const element of this.uiElements.values()) {
            if (element?.destroy) {
                element.destroy();
            }
        }
        this.uiElements.clear();
    }
} 