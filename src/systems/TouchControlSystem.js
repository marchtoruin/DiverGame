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
            flashlight: {
                x: this.scene.cameras.main.width - 120,
                y: this.scene.cameras.main.height - 300, // Position above boost button
                radius: 50,
                zoneRadius: 80,
                color: 0xffcc00 // Yellow color for flashlight
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
        this.createFlashlightButton();
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
     * Create the flashlight button UI elements
     */
    createFlashlightButton() {
        const cfg = this.config.flashlight;

        // Create flashlight zone
        const zone = this.scene.add.circle(cfg.x, cfg.y, cfg.zoneRadius, cfg.color, 0.1);
        zone.setStrokeStyle(2, cfg.color, 0.1);
        zone.setScrollFactor(0);
        zone.setDepth(this.config.depths.base);
        zone.setInteractive({ useHandCursor: true });
        this.elements.set('flashlightZone', zone);

        // Create glow effect
        const glow = this.scene.add.circle(cfg.x, cfg.y, cfg.radius + 20, cfg.color, 0.1);
        glow.setStrokeStyle(6, cfg.color, 0.3);
        glow.setScrollFactor(0);
        glow.setDepth(this.config.depths.base);
        this.elements.set('flashlightGlow', glow);

        // Create button (outline only)
        const button = this.scene.add.circle(cfg.x, cfg.y, cfg.radius);
        button.setStrokeStyle(4, cfg.color, 0.8);
        button.setScrollFactor(0);
        button.setDepth(this.config.depths.controls);
        this.elements.set('flashlightButton', button);

        // Create flashlight icon
        const icon = this.scene.add.text(cfg.x, cfg.y - 5, '🔦', {
            font: 'bold 36px Arial',
            color: '#ffffff'
        }).setOrigin(0.5);
        icon.setScrollFactor(0);
        icon.setDepth(this.config.depths.text);
        this.elements.set('flashlightIcon', icon);

        // Create text
        const text = this.scene.add.text(cfg.x, cfg.y + 30, 'LIGHT', {
            font: 'bold 20px Arial',
            color: '#ffffff',
            stroke: '#ffcc00',
            strokeThickness: 2
        }).setOrigin(0.5);
        text.setScrollFactor(0);
        text.setDepth(this.config.depths.text);
        this.elements.set('flashlightText', text);
    }

    /**
     * Set up event listeners for touch controls
     */
    setupEventListeners() {
        const joystickZone = this.elements.get('joystickZone');
        const boostZone = this.elements.get('boostZone');
        const flashlightZone = this.elements.get('flashlightZone');

        // Joystick events
        joystickZone.on('pointerdown', this.handleJoystickDown.bind(this));
        joystickZone.on('pointermove', this.handleJoystickMove.bind(this));
        joystickZone.on('pointerup', this.handleJoystickUp.bind(this));
        joystickZone.on('pointerout', this.handleJoystickUp.bind(this));

        // Boost events
        boostZone.on('pointerdown', this.handleBoostDown.bind(this));
        boostZone.on('pointerup', this.handleBoostUp.bind(this));
        boostZone.on('pointerout', this.handleBoostUp.bind(this));

        // Flashlight events
        flashlightZone.on('pointerdown', this.handleFlashlightDown.bind(this));
        flashlightZone.on('pointerup', this.handleFlashlightUp.bind(this));

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
     * Handle flashlight button down
     */
    handleFlashlightDown() {
        // Visual feedback
        this.elements.get('flashlightButton').setFillStyle(this.config.flashlight.color, 0.6);
        this.elements.get('flashlightGlow').setAlpha(0.5);
        this.elements.get('flashlightText').setScale(0.9);
        this.elements.get('flashlightIcon').setScale(0.9);
    }

    /**
     * Handle flashlight button up/out
     */
    handleFlashlightUp() {
        // Reset visual state
        this.elements.get('flashlightButton').setFillStyle(this.config.flashlight.color, 0.3);
        this.elements.get('flashlightGlow').setAlpha(0.1);
        this.elements.get('flashlightText').setScale(1);
        this.elements.get('flashlightIcon').setScale(1);
        
        // Toggle the flashlight
        if (this.scene.lightingSystem) {
            this.scene.lightingSystem.toggleFlashlight('flashlight_cone1');
            console.log('TouchControlSystem: Flashlight toggled via touch');
        }
    }

    /**
     * Handle window resize event
     */
    handleResize() {
        const width = this.scene.cameras.main.width;
        const height = this.scene.cameras.main.height;
        
        // Update joystick position
        const joystickCfg = this.config.joystick;
        joystickCfg.y = height - 150;
        
        const joystickElements = [
            'joystickZone',
            'joystickGlow',
            'joystickBase',
            'joystickStick',
            'moveText'
        ];
        
        joystickElements.forEach(key => {
            const element = this.elements.get(key);
            if (element) {
                element.setPosition(joystickCfg.x, joystickCfg.y);
            }
        });
        
        // Update arrow positions
        const arrows = {
            upArrow: { x: 0, y: -60 },
            downArrow: { x: 0, y: 60 },
            leftArrow: { x: -60, y: 0 },
            rightArrow: { x: 60, y: 0 }
        };
        
        Object.entries(arrows).forEach(([key, offset]) => {
            const arrow = this.elements.get(key);
            if (arrow) {
                arrow.setPosition(joystickCfg.x + offset.x, joystickCfg.y + offset.y);
            }
        });
        
        // Update boost button position
        const boostCfg = this.config.boost;
        boostCfg.x = width - 120;
        boostCfg.y = height - 150;
        
        const boostElements = [
            'boostZone',
            'boostGlow',
            'boostButton',
            'boostText'
        ];
        
        boostElements.forEach(key => {
            const element = this.elements.get(key);
            if (element) {
                element.setPosition(boostCfg.x, boostCfg.y);
            }
        });
        
        // Update flashlight button position
        const flashlightCfg = this.config.flashlight;
        flashlightCfg.x = width - 120;
        flashlightCfg.y = height - 300; // Position above boost button
        
        const flashlightElements = [
            'flashlightZone',
            'flashlightGlow',
            'flashlightButton',
            'flashlightIcon'
        ];
        
        flashlightElements.forEach(key => {
            const element = this.elements.get(key);
            if (element) {
                element.setPosition(flashlightCfg.x, flashlightCfg.y);
            }
        });
        
        // Position flashlight text slightly below the button
        const flashlightText = this.elements.get('flashlightText');
        if (flashlightText) {
            flashlightText.setPosition(flashlightCfg.x, flashlightCfg.y + 30);
        }
    }

    /**
     * Set visibility of all touch control elements
     * @param {boolean} visible - Whether elements should be visible
     */
    setVisible(visible) {
        this.enabled = visible;

        // Set visibility for all elements
        const alphaMap = {
            joystickZone: 0.1,
            joystickGlow: 0.1,
            joystickBase: 1,
            joystickStick: 1,
            boostZone: 0.1,
            boostGlow: 0.1,
            boostButton: 1,
            moveText: 1,
            boostText: 1,
            flashlightZone: 0.1,
            flashlightGlow: 0.1,
            flashlightButton: 1,
            flashlightIcon: 1,
            flashlightText: 1
        };

        // Basic visibility (arrows)
        const arrowKeys = ['upArrow', 'downArrow', 'leftArrow', 'rightArrow'];
        arrowKeys.forEach(key => {
            const element = this.elements.get(key);
            if (element) {
                element.setVisible(visible);
                if (visible) {
                    element.setAlpha(0.5);
                }
            }
        });

        // Alpha-based visibility (all other elements)
        Object.entries(alphaMap).forEach(([key, alpha]) => {
            const element = this.elements.get(key);
            if (element) {
                element.setVisible(visible);
                if (visible) {
                    // Set appropriate alpha values
                    if (key === 'joystickGlow' || key === 'boostGlow' || key === 'flashlightGlow') {
                        element.setAlpha(0.1);
                    } else if (key === 'joystickZone' || key === 'boostZone' || key === 'flashlightZone') {
                        element.setAlpha(0.1);
                    } else if (key === 'joystickBase' || key === 'joystickStick' || key === 'boostButton' || key === 'flashlightButton') {
                        element.setAlpha(1);
                        // Set appropriate stroke style based on button type
                        const color = key.includes('boost') ? this.config.boost.color : 
                                     key.includes('flashlight') ? this.config.flashlight.color : 
                                     this.config.joystick.color;
                        element.setStrokeStyle(4, color, 0.8);
                    } else {
                        element.setAlpha(alpha);
                    }
                }
            }
        });

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
     * Clean up all touch control elements
     */
    destroy() {
        // Remove resize listener
        this.scene.scale.off('resize', this.handleResize, this);
        
        // Remove event listeners and destroy elements
        const elements = Array.from(this.elements.entries());
        
        for (const [key, element] of elements) {
            if (key === 'joystickZone') {
                element.off('pointerdown');
                element.off('pointermove');
                element.off('pointerup');
                element.off('pointerout');
            } else if (key === 'boostZone') {
                element.off('pointerdown');
                element.off('pointerup');
                element.off('pointerout');
            } else if (key === 'flashlightZone') {
                element.off('pointerdown');
                element.off('pointerup');
            }
            
            if (element.destroy) {
                element.destroy();
            }
        }
        
        // Clear all references
        this.elements.clear();
    }
} 