/**
 * InputManager - Manages all input handling (keyboard, touch) for the game
 */
import Phaser from 'phaser';

export default class InputManager {
    /**
     * Create a new input manager
     * @param {Phaser.Scene} scene - The scene this system belongs to
     * @param {Object} config - Configuration options
     */
    constructor(scene, config = {}) {
        this.scene = scene;
        this.config = {
            touchEnabled: true,
            ...config
        };
        
        // Input states
        this.keys = null;
        this.cursors = null;
        this.touchData = { startX: 0, startY: 0, isMoving: false };
        
        // Initialize input systems
        this.setupKeyboardControls();
        
        // Store player reference (to be set later)
        this.player = null;
        
        // Key bindings for specific actions
        this.actionBindings = {};
    }
    
    /**
     * Initialize keyboard controls
     */
    setupKeyboardControls() {
        // Create cursors for arrow keys
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        
        // Initialize both arrow and WASD controls in a single object
        this.keys = {
            up: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            boost: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
            space: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
            // Add arrow keys as alternative controls
            upArrow: this.cursors.up,
            downArrow: this.cursors.down,
            leftArrow: this.cursors.left,
            rightArrow: this.cursors.right
        };
        
        // For backward compatibility with existing code
        this.wasdKeys = this.keys;
    }
    
    /**
     * Bind a specific action to a callback
     * @param {string} action - Action name (e.g., 'flashlight', 'pause')
     * @param {Function} callback - Callback to execute when key is pressed
     * @param {string} key - Keyboard key code (defaults to predefined keys)
     */
    bindAction(action, callback, key = null) {
        // If a key is specified, use it; otherwise use default mappings
        const keyCode = key || this.getDefaultKeyForAction(action);
        
        if (!keyCode) {
            console.warn(`No key binding found for action: ${action}`);
            return;
        }
        
        const keyObj = this.scene.input.keyboard.addKey(keyCode);
        
        // Store the binding
        this.actionBindings[action] = {
            key: keyObj,
            callback
        };
        
        // Add the key event listener
        this.scene.input.keyboard.on(`keydown-${keyCode}`, callback);
        
        console.log(`Bound action '${action}' to key ${keyCode}`);
    }
    
    /**
     * Get the default key for a named action
     * @param {string} action - Action name
     * @returns {string} Key code for the action
     */
    getDefaultKeyForAction(action) {
        const actionMap = {
            'flashlight': 'F',
            'pause': 'P',
            'menu': 'ESC',
            'shoot': 'SPACE',
            'boost': 'SHIFT'
        };
        
        return actionMap[action];
    }
    
    /**
     * Unbind a specific action
     * @param {string} action - Action name to unbind
     */
    unbindAction(action) {
        if (this.actionBindings[action]) {
            const binding = this.actionBindings[action];
            this.scene.input.keyboard.off(`keydown-${binding.key.keyCode}`);
            delete this.actionBindings[action];
            console.log(`Unbound action: ${action}`);
        }
    }
    
    /**
     * Set the player reference for input processing
     * @param {Object} player - The player object
     */
    setPlayer(player) {
        this.player = player;
    }
    
    /**
     * Get the current input state
     * @returns {Object} Current input state
     */
    getInputState() {
        const inputState = {
            // Direction input
            up: this.keys.up.isDown || this.keys.upArrow.isDown,
            down: this.keys.down.isDown || this.keys.downArrow.isDown,
            left: this.keys.left.isDown || this.keys.leftArrow.isDown,
            right: this.keys.right.isDown || this.keys.rightArrow.isDown,
            
            // Action input
            boost: this.keys.boost.isDown || this.cursors.shift.isDown || this.keys.space.isDown || this.cursors.space.isDown,
            shoot: this.keys.space.isDown || this.cursors.space.isDown,
            
            // Touch data
            touch: {...this.touchData}
        };
        
        // Calculate the primary direction for convenience
        if (inputState.left) inputState.primaryDirection = 'left';
        else if (inputState.right) inputState.primaryDirection = 'right';
        else if (inputState.up) inputState.primaryDirection = 'up';
        else if (inputState.down) inputState.primaryDirection = 'down';
        
        return inputState;
    }
    
    /**
     * Update method called each frame
     * @param {number} time - Current time
     * @param {number} delta - Time since last update
     */
    update(time, delta) {
        // Get player's current direction based on keyboard input
        if (this.player && this.player.sprite) {
            // Track player rotation
            let playerRotation = null;
            
            // Handle rotation based on input
            if (this.cursors.left.isDown || this.keys.left.isDown) {
                playerRotation = Math.PI; // Left = 180 degrees
                
                // If player wasn't already facing left
                if (!this.player.sprite.flipX) {
                    this.player.sprite.flipX = true;
                    
                    // Notify any systems that need to know about direction change
                    this.scene.events.emit('playerDirectionChanged', 'left');
                }
            } 
            else if (this.cursors.right.isDown || this.keys.right.isDown) {
                playerRotation = 0; // Right = 0 degrees
                
                // If player wasn't already facing right
                if (this.player.sprite.flipX) {
                    this.player.sprite.flipX = false;
                    
                    // Notify any systems that need to know about direction change
                    this.scene.events.emit('playerDirectionChanged', 'right');
                }
            } 
            else if (this.cursors.up.isDown || this.keys.up.isDown) {
                playerRotation = -Math.PI/2; // Up = -90 degrees
            } 
            else if (this.cursors.down.isDown || this.keys.down.isDown) {
                playerRotation = Math.PI/2; // Down = 90 degrees
            }
            
            // Handle diagonals
            if ((this.cursors.up.isDown || this.keys.up.isDown) && 
                (this.cursors.right.isDown || this.keys.right.isDown)) {
                playerRotation = -Math.PI/4; // Up-Right = -45 degrees
            } 
            else if ((this.cursors.up.isDown || this.keys.up.isDown) && 
                     (this.cursors.left.isDown || this.keys.left.isDown)) {
                playerRotation = -3*Math.PI/4; // Up-Left = -135 degrees
            } 
            else if ((this.cursors.down.isDown || this.keys.down.isDown) && 
                     (this.cursors.right.isDown || this.keys.right.isDown)) {
                playerRotation = Math.PI/4; // Down-Right = 45 degrees
            } 
            else if ((this.cursors.down.isDown || this.keys.down.isDown) && 
                     (this.cursors.left.isDown || this.keys.left.isDown)) {
                playerRotation = 3*Math.PI/4; // Down-Left = 135 degrees
            }
            
            // Only update the player's rotation if we have a valid direction
            if (playerRotation !== null) {
                // Store the rotation on the player object
                this.player.rotation = playerRotation;
                
                // Emit rotation change event
                this.scene.events.emit('playerRotationChanged', playerRotation);
            }
        }
    }
    
    /**
     * Update touch input state
     * @param {Object} touchData - The touch state data from TouchControlSystem
     */
    updateTouchData(touchData) {
        this.touchData = touchData || { startX: 0, startY: 0, isMoving: false };
    }
    
    /**
     * Clean up event listeners
     */
    destroy() {
        // Unbind all action bindings
        Object.keys(this.actionBindings).forEach(action => {
            this.unbindAction(action);
        });
        
        this.actionBindings = {};
        this.scene = null;
        this.player = null;
    }
} 