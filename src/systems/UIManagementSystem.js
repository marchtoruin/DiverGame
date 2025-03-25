/**
 * Manages all UI elements in the game
 */
export default class UIManagementSystem {
    constructor(scene) {
        this.scene = scene;
        this.uiElements = new Map();
        this.uiContainers = new Map();
        this.uiConfig = {
            depths: {
                base: 1000,
                meters: 1001,
                controls: 1002,
                debug: 1003
            },
            padding: 10,
            meterWidth: 200,
            meterHeight: 20
        };
    }

    /**
     * Initialize UI elements
     */
    initialize() {
        // Create main UI container
        this.createUIContainer('main', 0, 0);
        
        // Create meters container (for health, oxygen, etc)
        this.createUIContainer('meters', this.uiConfig.padding, this.uiConfig.padding);
        
        console.log('UI Management System initialized');
    }

    /**
     * Create a UI container at specified position
     * @param {string} key - Container identifier
     * @param {number} x - X position
     * @param {number} y - Y position
     */
    createUIContainer(key, x, y) {
        const container = this.scene.add.container(x, y);
        container.setDepth(this.uiConfig.depths.base);
        container.setScrollFactor(0);
        this.uiContainers.set(key, container);
    }

    /**
     * Create oxygen meter UI
     * @param {Object} config - Oxygen meter configuration
     */
    createOxygenMeter(config = {}) {
        const meterConfig = {
            x: this.uiConfig.padding,
            y: this.uiConfig.padding,
            width: this.uiConfig.meterWidth,
            height: this.uiConfig.meterHeight,
            ...config
        };

        const meter = this.scene.oxygenMeter;
        if (meter) {
            this.uiElements.set('oxygenMeter', meter);
            if (meter.container) {
                meter.container.setDepth(this.uiConfig.depths.meters);
            }
        }
    }

    /**
     * Create health bar UI
     * @param {Object} config - Health bar configuration
     */
    createHealthBar(config = {}) {
        const barConfig = {
            x: this.uiConfig.padding,
            y: this.uiConfig.padding + this.uiConfig.meterHeight + this.uiConfig.padding,
            width: this.uiConfig.meterWidth,
            height: this.uiConfig.meterHeight,
            ...config
        };

        const healthBar = this.scene.healthSystem?.healthBar;
        if (healthBar) {
            this.uiElements.set('healthBar', healthBar);
            if (healthBar.container) {
                healthBar.container.setDepth(this.uiConfig.depths.meters);
            }
        }
    }

    /**
     * Create touch controls UI
     * @param {boolean} enabled - Whether touch controls should be enabled
     */
    createTouchControls(enabled = true) {
        // Remove this method as touch controls are now handled by TouchControlSystem
        return;
    }

    /**
     * Create debug UI elements
     * @param {boolean} enabled - Whether debug UI should be shown
     */
    createDebugUI(enabled = false) {
        if (!enabled) return;

        const debugButton = this.scene.add.rectangle(
            this.scene.cameras.main.width - 80,
            40,
            100,
            30,
            0x333333,
            0.8
        );
        debugButton.setScrollFactor(0);
        debugButton.setDepth(this.uiConfig.depths.debug);
        debugButton.setInteractive();
        this.uiElements.set('debugButton', debugButton);

        const debugText = this.scene.add.text(
            debugButton.x,
            debugButton.y,
            'Touch: ON',
            {
                font: '16px Arial',
                color: '#ffffff',
                align: 'center'
            }
        ).setOrigin(0.5);
        debugText.setScrollFactor(0);
        debugText.setDepth(this.uiConfig.depths.debug);
        this.uiElements.set('debugText', debugText);
    }

    /**
     * Update UI element positions on resize
     */
    handleResize() {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;

        // Update touch controls position
        const moveButton = this.uiElements.get('moveButton');
        if (moveButton) {
            moveButton.setPosition(100, height - 100);
        }

        const boostButton = this.uiElements.get('boostButton');
        if (boostButton) {
            boostButton.setPosition(width - 100, height - 100);
        }

        // Update debug button position
        const debugButton = this.uiElements.get('debugButton');
        if (debugButton) {
            debugButton.setPosition(width - 80, 40);
        }

        const debugText = this.uiElements.get('debugText');
        if (debugText) {
            debugText.setPosition(width - 80, 40);
        }
    }

    /**
     * Update UI elements
     */
    update() {
        // Update oxygen meter
        const oxygenMeter = this.uiElements.get('oxygenMeter');
        if (oxygenMeter?.update) {
            oxygenMeter.update();
        }

        // Update health bar
        const healthBar = this.uiElements.get('healthBar');
        if (healthBar?.update) {
            healthBar.update();
        }
    }

    /**
     * Clean up UI elements
     */
    destroy() {
        // Destroy all UI elements
        for (const [key, element] of this.uiElements) {
            if (element && element.destroy) {
                element.destroy();
            }
        }
        this.uiElements.clear();

        // Destroy all containers
        for (const [key, container] of this.uiContainers) {
            if (container && container.destroy) {
                container.destroy();
            }
        }
        this.uiContainers.clear();
    }
} 