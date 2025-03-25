/**
 * Manages touch controls and their UI elements
 */
export default class TouchControlSystem {
    constructor(scene) {
        this.scene = scene;
        this.enabled = true;
        this.elements = new Map();
        this.touchData = {
            isMoving: false,
            startX: 0,
            startY: 0,
            left: false,
            right: false,
            up: false,
            down: false,
            boost: false
        };

        this.config = {
            joystick: {
                x: 150,
                y: this.scene.cameras.main.height - 150,
                baseRadius: 80,
                stickRadius: 40,
                maxDistance: 40,
                zoneRadius: 120,
                color: 0x6666ff
            },
            boost: {
                x: this.scene.cameras.main.width - 120,
                y: this.scene.cameras.main.height - 150,
                radius: 60,
                zoneRadius: 90,
                color: 0x00ff00
            },
            depths: {
                base: 1000,
                controls: 1001,
                text: 1002
            }
        };
    }

    /**
     * Initialize the touch control system
     */
    initialize() {
        this.createJoystick();
        this.createBoostButton();
        this.setupEventListeners();
        this.setVisible(this.enabled);
        console.log('Touch control system initialized');
    }

    /**
     * Create the joystick UI elements
     */
    createJoystick() {
        const cfg = this.config.joystick;

        // Create joystick zone (larger interactive area)
        const zone = this.scene.add.circle(cfg.x, cfg.y, cfg.zoneRadius, cfg.color, 0.1);
        zone.setStrokeStyle(2, cfg.color, 0.1);
        zone.setScrollFactor(0);
        zone.setDepth(this.config.depths.base);
        zone.setInteractive({ useHandCursor: true });
        this.elements.set('joystickZone', zone);

        // Create glow effect
        const glow = this.scene.add.circle(cfg.x, cfg.y, cfg.baseRadius + 20, cfg.color, 0.1);
        glow.setStrokeStyle(6, cfg.color, 0.3);
        glow.setScrollFactor(0);
        glow.setDepth(this.config.depths.base);
        this.elements.set('joystickGlow', glow);

        // Create base (outline only)
        const base = this.scene.add.circle(cfg.x, cfg.y, cfg.baseRadius);
        base.setStrokeStyle(4, cfg.color, 0.8);
        base.setScrollFactor(0);
        base.setDepth(this.config.depths.controls);
        this.elements.set('joystickBase', base);

        // Create stick (outline only)
        const stick = this.scene.add.circle(cfg.x, cfg.y, cfg.stickRadius);
        stick.setStrokeStyle(3, cfg.color, 1);
        stick.setScrollFactor(0);
        stick.setDepth(this.config.depths.controls);
        this.elements.set('joystickStick', stick);

        // Create "MOVE" text
        const moveText = this.scene.add.text(cfg.x, cfg.y - 120, 'MOVE', {
            font: 'bold 24px Arial',
            color: '#ffffff',
            stroke: '#6666ff',
            strokeThickness: 2
        }).setOrigin(0.5);
        moveText.setScrollFactor(0);
        moveText.setDepth(this.config.depths.text);
        this.elements.set('moveText', moveText);

        // Create directional arrows
        const arrowConfig = {
            fontSize: '32px',
            color: '#ffffff',
            stroke: '#6666ff',
            strokeThickness: 2
        };

        const arrows = {
            up: { text: '⬆', offset: { x: 0, y: -60 } },
            down: { text: '⬇', offset: { x: 0, y: 60 } },
            left: { text: '⬅', offset: { x: -60, y: 0 } },
            right: { text: '➡', offset: { x: 60, y: 0 } }
        };

        Object.entries(arrows).forEach(([direction, data]) => {
            const arrow = this.scene.add.text(
                cfg.x + data.offset.x,
                cfg.y + data.offset.y,
                data.text,
                arrowConfig
            ).setOrigin(0.5);
            arrow.setScrollFactor(0);
            arrow.setDepth(this.config.depths.text);
            this.elements.set(`${direction}Arrow`, arrow);
        });
    }

    /**
     * Create the boost button UI elements
     */
    createBoostButton() {
        const cfg = this.config.boost;

        // Create boost zone
        const zone = this.scene.add.circle(cfg.x, cfg.y, cfg.zoneRadius, cfg.color, 0.1);
        zone.setStrokeStyle(2, cfg.color, 0.1);
        zone.setScrollFactor(0);
        zone.setDepth(this.config.depths.base);
        zone.setInteractive({ useHandCursor: true });
        this.elements.set('boostZone', zone);

        // Create glow effect
        const glow = this.scene.add.circle(cfg.x, cfg.y, cfg.radius + 20, cfg.color, 0.1);
        glow.setStrokeStyle(6, cfg.color, 0.3);
        glow.setScrollFactor(0);
        glow.setDepth(this.config.depths.base);
        this.elements.set('boostGlow', glow);

        // Create button (outline only)
        const button = this.scene.add.circle(cfg.x, cfg.y, cfg.radius);
        button.setStrokeStyle(4, cfg.color, 0.8);
        button.setScrollFactor(0);
        button.setDepth(this.config.depths.controls);
        this.elements.set('boostButton', button);

        // Create text
        const text = this.scene.add.text(cfg.x, cfg.y, 'BOOST', {
            font: 'bold 28px Arial',
            color: '#ffffff',
            stroke: '#00ff00',
            strokeThickness: 3
        }).setOrigin(0.5);
        text.setScrollFactor(0);
        text.setDepth(this.config.depths.text);
        this.elements.set('boostText', text);
    }

    /**
     * Set up event listeners for touch controls
     */
    setupEventListeners() {
        const joystickZone = this.elements.get('joystickZone');
        const boostZone = this.elements.get('boostZone');

        // Joystick events
        joystickZone.on('pointerdown', this.handleJoystickDown.bind(this));
        joystickZone.on('pointermove', this.handleJoystickMove.bind(this));
        joystickZone.on('pointerup', this.handleJoystickUp.bind(this));
        joystickZone.on('pointerout', this.handleJoystickUp.bind(this));

        // Boost events
        boostZone.on('pointerdown', this.handleBoostDown.bind(this));
        boostZone.on('pointerup', this.handleBoostUp.bind(this));
        boostZone.on('pointerout', this.handleBoostUp.bind(this));

        // Handle resize
        this.scene.scale.on('resize', this.handleResize, this);
    }

    /**
     * Handle joystick pointer down
     */
    handleJoystickDown(pointer) {
        this.touchData.isMoving = true;
        this.touchData.startX = pointer.x;
        this.touchData.startY = pointer.y;
        this.elements.get('joystickStick').setAlpha(0.8);
        this.elements.get('joystickGlow').setAlpha(0.3);
        this.updateJoystickPosition(pointer);
    }

    /**
     * Handle joystick pointer move
     */
    handleJoystickMove(pointer) {
        if (this.touchData.isMoving) {
            this.updateJoystickPosition(pointer);
        }
    }

    /**
     * Handle joystick pointer up/out
     */
    handleJoystickUp() {
        this.resetJoystick();
    }

    /**
     * Update joystick position and movement flags
     */
    updateJoystickPosition(pointer) {
        if (!this.touchData.isMoving) return;

        const cfg = this.config.joystick;
        const dx = pointer.x - this.touchData.startX;
        const dy = pointer.y - this.touchData.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        let moveX = dx;
        let moveY = dy;

        if (distance > cfg.maxDistance) {
            const angle = Math.atan2(dy, dx);
            moveX = Math.cos(angle) * cfg.maxDistance;
            moveY = Math.sin(angle) * cfg.maxDistance;
        }

        const stick = this.elements.get('joystickStick');
        const base = this.elements.get('joystickBase');
        stick.x = base.x + moveX;
        stick.y = base.y + moveY;

        // Update movement flags
        this.touchData.left = dx < -5;
        this.touchData.right = dx > 5;
        this.touchData.up = dy < -5;
        this.touchData.down = dy > 5;

        // Update key states in the scene
        if (this.scene.keys) {
            this.scene.keys.left.isDown = this.touchData.left;
            this.scene.keys.right.isDown = this.touchData.right;
            this.scene.keys.up.isDown = this.touchData.up;
            this.scene.keys.down.isDown = this.touchData.down;
        }

        // Update arrow visuals
        this.updateArrowVisuals();
    }

    /**
     * Update arrow visuals based on movement
     */
    updateArrowVisuals() {
        ['up', 'down', 'left', 'right'].forEach(direction => {
            const arrow = this.elements.get(`${direction}Arrow`);
            if (arrow) {
                arrow.setAlpha(this.touchData[direction] ? 1 : 0.5);
            }
        });
    }

    /**
     * Reset joystick state
     */
    resetJoystick() {
        const stick = this.elements.get('joystickStick');
        const base = this.elements.get('joystickBase');
        if (stick && base) {
            stick.x = base.x;
            stick.y = base.y;
            stick.setAlpha(0.5);
        }

        this.elements.get('joystickGlow')?.setAlpha(0.1);

        // Reset movement flags
        this.touchData.isMoving = false;
        this.touchData.left = false;
        this.touchData.right = false;
        this.touchData.up = false;
        this.touchData.down = false;

        // Reset key states
        if (this.scene.keys) {
            this.scene.keys.left.isDown = false;
            this.scene.keys.right.isDown = false;
            this.scene.keys.up.isDown = false;
            this.scene.keys.down.isDown = false;
        }

        this.updateArrowVisuals();
    }

    /**
     * Handle boost button down
     */
    handleBoostDown() {
        this.touchData.boost = true;
        if (this.scene.keys) {
            this.scene.keys.boost.isDown = true;
        }
        this.elements.get('boostButton').setFillStyle(this.config.boost.color, 0.6);
        this.elements.get('boostGlow').setAlpha(0.3);
        this.elements.get('boostText').setScale(0.9);
    }

    /**
     * Handle boost button up/out
     */
    handleBoostUp() {
        this.touchData.boost = false;
        if (this.scene.keys) {
            this.scene.keys.boost.isDown = false;
        }
        this.elements.get('boostButton').setFillStyle(this.config.boost.color, 0.3);
        this.elements.get('boostGlow').setAlpha(0.1);
        this.elements.get('boostText').setScale(1);
    }

    /**
     * Handle window resize
     */
    handleResize() {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;

        // Update config positions
        this.config.joystick.y = height - 150;
        this.config.boost.x = width - 120;
        this.config.boost.y = height - 150;

        // Update joystick elements
        const joystickElements = ['joystickZone', 'joystickGlow', 'joystickBase', 'joystickStick'];
        joystickElements.forEach(key => {
            const element = this.elements.get(key);
            if (element) {
                element.setPosition(this.config.joystick.x, this.config.joystick.y);
            }
        });

        // Update boost elements
        const boostElements = ['boostZone', 'boostGlow', 'boostButton', 'boostText'];
        boostElements.forEach(key => {
            const element = this.elements.get(key);
            if (element) {
                element.setPosition(this.config.boost.x, this.config.boost.y);
            }
        });

        // Update text positions
        this.elements.get('moveText')?.setPosition(
            this.config.joystick.x,
            this.config.joystick.y - 120
        );

        // Update arrow positions
        const arrowOffsets = {
            up: { x: 0, y: -60 },
            down: { x: 0, y: 60 },
            left: { x: -60, y: 0 },
            right: { x: 60, y: 0 }
        };

        Object.entries(arrowOffsets).forEach(([direction, offset]) => {
            const arrow = this.elements.get(`${direction}Arrow`);
            if (arrow) {
                arrow.setPosition(
                    this.config.joystick.x + offset.x,
                    this.config.joystick.y + offset.y
                );
            }
        });
    }

    /**
     * Set visibility of all touch control elements
     */
    setVisible(visible) {
        this.enabled = visible;
        
        // Store current alpha values before changing visibility
        const defaultAlphas = {
            joystickZone: 0.1,
            boostZone: 0.1,
            joystickGlow: 0.1,
            boostGlow: 0.1,
            joystickBase: 1,
            joystickStick: 1,
            boostButton: 1,
            moveText: 1,
            boostText: 1
        };

        for (const [key, element] of this.elements.entries()) {
            if (element) {
                // Set visibility
                element.setVisible(visible);
                
                // Set alpha based on visibility
                if (!visible) {
                    element.setAlpha(0);
                } else {
                    // Set default alpha based on element type
                    if (key.includes('Zone')) {
                        element.setAlpha(defaultAlphas.joystickZone);
                    } else if (key.includes('Glow')) {
                        element.setAlpha(defaultAlphas.joystickGlow);
                    } else if (key === 'joystickBase' || key === 'joystickStick' || key === 'boostButton') {
                        element.setAlpha(1);
                        element.setStrokeStyle(4, key.includes('boost') ? this.config.boost.color : this.config.joystick.color, 0.8);
                    } else if (key.includes('Arrow')) {
                        element.setAlpha(0.5);
                    } else {
                        element.setAlpha(1);
                    }
                }
            }
        }

        // Reset state when hiding controls
        if (!visible) {
            this.resetJoystick();
            this.touchData = {
                isMoving: false,
                startX: 0,
                startY: 0,
                left: false,
                right: false,
                up: false,
                down: false,
                boost: false
            };
        }
    }

    /**
     * Get current touch input state
     */
    getInputState() {
        return this.enabled ? this.touchData : { startX: 0, startY: 0, isMoving: false };
    }

    /**
     * Clean up resources
     */
    destroy() {
        // Remove event listeners
        this.scene.scale.off('resize', this.handleResize, this);

        // Destroy all elements
        for (const element of this.elements.values()) {
            if (element?.destroy) {
                element.destroy();
            }
        }
        this.elements.clear();
    }
} 