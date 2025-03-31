/**
 * GameStateManager - Manages game state and transitions
 */
export default class GameStateManager {
    /**
     * Create a new game state manager
     * @param {Phaser.Scene} scene - The scene this system belongs to
     */
    constructor(scene) {
        this.scene = scene;
        
        // Game state
        this.gameStates = {
            LOADING: 'loading',
            READY: 'ready',
            RUNNING: 'running',
            PAUSED: 'paused',
            GAME_OVER: 'gameOver',
            LEVEL_COMPLETE: 'levelComplete'
        };
        
        // Current state - initialize to RUNNING by default
        this.currentState = this.gameStates.RUNNING;
        this.previousState = null;
        
        // Game progress tracking
        this.currentLevel = 'level1';
        this.score = 0;
        
        // State change listeners
        this.stateChangeListeners = new Map();
        
        // Pause key handling
        this.setupPauseKey();
        
        console.log('GameStateManager initialized with state:', this.currentState);
    }
    
    /**
     * Setup pause key
     */
    setupPauseKey() {
        // Add pause key binding (ESC)
        this.scene.input.keyboard.on('keydown-ESC', () => {
            this.togglePause();
        });
    }
    
    /**
     * Set the current level
     * @param {string} levelKey - The level key (e.g., 'level1')
     */
    setLevel(levelKey) {
        this.currentLevel = levelKey;
        console.log(`Current level set to: ${levelKey}`);
    }
    
    /**
     * Change the game state
     * @param {string} newState - The new state to set
     * @param {Object} data - Optional data to pass to state change listeners
     */
    changeState(newState, data = {}) {
        // Store previous state
        this.previousState = this.currentState;
        this.currentState = newState;
        
        console.log(`Game state changed from ${this.previousState} to ${this.currentState}`);
        
        // Notify listeners
        this.notifyStateChangeListeners(newState, this.previousState, data);
        
        // Handle state-specific logic
        this.handleStateChange(newState, this.previousState, data);
    }
    
    /**
     * Handle state-specific logic
     * @param {string} newState - The new state
     * @param {string} previousState - The previous state
     * @param {Object} data - Data related to the state change
     */
    handleStateChange(newState, previousState, data) {
        switch (newState) {
            case this.gameStates.READY:
                // Ready to start - e.g., "Press any key to start"
                break;
                
            case this.gameStates.RUNNING:
                if (previousState === this.gameStates.PAUSED) {
                    this.resumeGame();
                }
                break;
                
            case this.gameStates.PAUSED:
                this.pauseGame();
                break;
                
            case this.gameStates.GAME_OVER:
                this.handleGameOver(data);
                break;
                
            case this.gameStates.LEVEL_COMPLETE:
                this.handleLevelComplete(data);
                break;
        }
    }
    
    /**
     * Pause the game
     */
    pauseGame() {
        console.log('Game paused');
        
        // Explicitly set the game's paused state
        this.scene.physics.pause();
        
        // Create or show pause menu
        this.showPauseMenu();
    }
    
    /**
     * Resume the game
     */
    resumeGame() {
        console.log('Game resumed');
        
        // Resume the physics system
        this.scene.physics.resume();
        
        // Hide pause menu
        this.hidePauseMenu();
    }
    
    /**
     * Toggle between paused and running states
     */
    togglePause() {
        if (this.currentState === this.gameStates.RUNNING) {
            this.changeState(this.gameStates.PAUSED);
        } else if (this.currentState === this.gameStates.PAUSED) {
            this.changeState(this.gameStates.RUNNING);
        }
    }
    
    /**
     * Show the pause menu
     */
    showPauseMenu() {
        // Create menu if it doesn't exist
        if (!this.pauseMenu) {
            this.createPauseMenu();
        }
        
        // Show the menu
        if (this.pauseMenu) {
            this.pauseMenu.setVisible(true);
        }
    }
    
    /**
     * Hide the pause menu
     */
    hidePauseMenu() {
        if (this.pauseMenu) {
            this.pauseMenu.setVisible(false);
        }
    }
    
    /**
     * Create the pause menu
     */
    createPauseMenu() {
        // Create container for pause menu elements
        this.pauseMenu = this.scene.add.container(
            this.scene.cameras.main.width / 2,
            this.scene.cameras.main.height / 2
        );
        this.pauseMenu.setDepth(1000);
        this.pauseMenu.setVisible(false);
        
        // Background darkening
        const bg = this.scene.add.rectangle(
            0, 0,
            this.scene.cameras.main.width,
            this.scene.cameras.main.height,
            0x000000, 0.7
        );
        
        // Title text
        const titleText = this.scene.add.text(
            0, -100,
            'PAUSED',
            { fontFamily: 'Arial', fontSize: '32px', color: '#ffffff' }
        ).setOrigin(0.5);
        
        // Resume button
        const resumeButton = this.scene.add.rectangle(0, 0, 200, 50, 0x6666ff)
            .setInteractive({ useHandCursor: true });
        
        const resumeText = this.scene.add.text(
            0, 0,
            'Resume',
            { fontFamily: 'Arial', fontSize: '24px', color: '#ffffff' }
        ).setOrigin(0.5);
        
        // Add button behavior
        resumeButton.on('pointerover', () => {
            resumeButton.setFillStyle(0x8888ff);
        });
        
        resumeButton.on('pointerout', () => {
            resumeButton.setFillStyle(0x6666ff);
        });
        
        resumeButton.on('pointerdown', () => {
            resumeButton.setFillStyle(0x4444ff);
        });
        
        resumeButton.on('pointerup', () => {
            this.togglePause();
        });
        
        // Add elements to container
        this.pauseMenu.add([bg, titleText, resumeButton, resumeText]);
        
        // Make sure the menu stays fixed to the camera
        this.scene.scale.on('resize', this.handleResize, this);
    }
    
    /**
     * Handle window resize
     */
    handleResize() {
        if (this.pauseMenu) {
            this.pauseMenu.setPosition(
                this.scene.cameras.main.width / 2,
                this.scene.cameras.main.height / 2
            );
            
            // Update the background size
            const bg = this.pauseMenu.getAt(0);
            if (bg) {
                bg.setSize(
                    this.scene.cameras.main.width,
                    this.scene.cameras.main.height
                );
            }
        }
    }
    
    /**
     * Handle game over
     * @param {Object} data - Data related to the game over
     */
    handleGameOver(data) {
        console.log('Game over', data ? `Cause: ${data.cause}` : '');
        
        // Ensure game physics are stopped
        this.scene.physics.pause();
        
        // Make sure player is marked as dead to prevent any updates
        if (this.scene.player && !this.scene.player.isDead) {
            console.log('Ensuring player is marked as dead');
            this.scene.player.isDead = true;
            this.scene.player.active = false;
        }
        
        // Display game over screen with cause information
        this.showGameOverScreen(data);
    }
    
    /**
     * Show game over screen
     * @param {Object} data - Game over data
     */
    showGameOverScreen(data) {
        // Create container for game over screen elements if it doesn't exist
        if (!this.gameOverMenu) {
            // Create container at screen center
            this.gameOverMenu = this.scene.add.container(0, 0);
            this.gameOverMenu.setDepth(1000);
            
            // Background darkening - make it cover the entire camera view
            const bg = this.scene.add.rectangle(
                0, 0,
                this.scene.scale.width,
                this.scene.scale.height,
                0x000000, 0.8
            );
            bg.setOrigin(0, 0); // Set origin to top-left
            bg.setScrollFactor(0); // Fix to camera
            
            // Game Over text - centered on screen
            const gameOverText = this.scene.add.text(
                this.scene.scale.width / 2,
                this.scene.scale.height / 2 - 100,
                'GAME OVER',
                { 
                    fontFamily: 'Arial', 
                    fontSize: '64px', 
                    color: '#ffffff',
                    fontWeight: 'bold',
                    stroke: '#000000',
                    strokeThickness: 6
                }
            ).setOrigin(0.5);
            gameOverText.setScrollFactor(0); // Fix to camera
            
            // Restart button - centered below text
            const restartButton = this.scene.add.rectangle(
                this.scene.scale.width / 2,
                this.scene.scale.height / 2 + 50,
                200, 50, 
                0x6666ff
            ).setInteractive({ useHandCursor: true });
            restartButton.setScrollFactor(0); // Fix to camera
            
            const restartText = this.scene.add.text(
                this.scene.scale.width / 2,
                this.scene.scale.height / 2 + 50,
                'Restart',
                { 
                    fontFamily: 'Arial', 
                    fontSize: '32px', 
                    color: '#ffffff',
                    fontWeight: 'bold'
                }
            ).setOrigin(0.5);
            restartText.setScrollFactor(0); // Fix to camera
            
            // Add button behavior
            restartButton.on('pointerover', () => {
                restartButton.setFillStyle(0x8888ff);
            });
            
            restartButton.on('pointerout', () => {
                restartButton.setFillStyle(0x6666ff);
            });
            
            restartButton.on('pointerdown', () => {
                restartButton.setFillStyle(0x4444ff);
            });
            
            restartButton.on('pointerup', () => {
                // Hide the menu first
                this.gameOverMenu.setVisible(false);
                
                // Clean up all systems before restart
                this.cleanupForRestart();
                
                // Reset the game state
                this.scene.scene.restart();
            });
            
            // Add elements to container
            this.gameOverMenu.add([bg, gameOverText, restartButton, restartText]);
            
            // Handle window resize
            this.scene.scale.on('resize', () => {
                if (this.gameOverMenu && this.gameOverMenu.visible) {
                    // Update background size
                    bg.setSize(this.scene.scale.width, this.scene.scale.height);
                    
                    // Update positions of elements
                    gameOverText.setPosition(this.scene.scale.width / 2, this.scene.scale.height / 2 - 100);
                    restartButton.setPosition(this.scene.scale.width / 2, this.scene.scale.height / 2 + 50);
                    restartText.setPosition(this.scene.scale.width / 2, this.scene.scale.height / 2 + 50);
                }
            });
        }
        
        // Show the menu
        this.gameOverMenu.setVisible(true);
        
        // Pause the game physics
        this.scene.physics.pause();
        
        // Make sure the game over screen is on top
        this.gameOverMenu.setDepth(1000);
        
        console.log('Game over screen displayed');
    }
    
    /**
     * Handle level complete
     * @param {Object} data - Data related to the level completion
     */
    handleLevelComplete(data) {
        console.log('Level complete');
        
        // Display level complete screen
        this.showLevelCompleteScreen(data);
    }
    
    /**
     * Show level complete screen
     * @param {Object} data - Level complete data
     */
    showLevelCompleteScreen(data) {
        // Implementation of level complete screen
        console.log('Showing level complete screen');
    }
    
    /**
     * Register a listener for state changes
     * @param {string} state - The state to listen for, or 'any' for all states
     * @param {Function} callback - The callback function to call when state changes
     * @param {Object} context - The context to bind the callback to
     */
    onStateChange(state, callback, context) {
        if (!this.stateChangeListeners.has(state)) {
            this.stateChangeListeners.set(state, []);
        }
        
        this.stateChangeListeners.get(state).push({
            callback,
            context: context || this
        });
    }
    
    /**
     * Notify all listeners of a state change
     * @param {string} newState - The new state
     * @param {string} previousState - The previous state
     * @param {Object} data - Data related to the state change
     */
    notifyStateChangeListeners(newState, previousState, data) {
        // Notify specific state listeners
        if (this.stateChangeListeners.has(newState)) {
            this.stateChangeListeners.get(newState).forEach(listener => {
                listener.callback.call(listener.context, previousState, data);
            });
        }
        
        // Notify 'any' state listeners
        if (this.stateChangeListeners.has('any')) {
            this.stateChangeListeners.get('any').forEach(listener => {
                listener.callback.call(listener.context, newState, previousState, data);
            });
        }
    }
    
    /**
     * Update method called each frame
     * @param {number} time - Current time
     * @param {number} delta - Time since last update
     */
    update(time, delta) {
        // State-specific update logic
        switch (this.currentState) {
            case this.gameStates.RUNNING:
                // Game is running normally
                break;
                
            case this.gameStates.PAUSED:
                // Game is paused
                break;
                
            case this.gameStates.GAME_OVER:
                // Game over state
                break;
                
            case this.gameStates.LEVEL_COMPLETE:
                // Level complete state
                break;
        }
    }
    
    /**
     * Clean up all systems before restart
     */
    cleanupForRestart() {
        try {
            // Clean up game over menu
            if (this.gameOverMenu) {
                this.gameOverMenu.removeAll(true);
                this.gameOverMenu.destroy();
                this.gameOverMenu = null;
            }
            
            // Clean up pause menu
            if (this.pauseMenu) {
                this.pauseMenu.removeAll(true);
                this.pauseMenu.destroy();
                this.pauseMenu = null;
            }
            
            // Clean up event listeners
            this.scene.scale.off('resize');
            this.scene.input.keyboard.off('keydown-ESC');
            
            // Clear state listeners
            this.stateChangeListeners.clear();
            
            // Clean up scene systems
            if (this.scene.player) {
                if (this.scene.player.sprite) {
                    this.scene.player.sprite.destroy();
                }
                this.scene.player = null;
            }
            
            // Clean up other major systems
            const systemsToCleanup = [
                'lightingSystem',
                'audioSystem',
                'particleSystem',
                'tilemapSystem',
                'airPocketSystem',
                'oxygenMeter',
                'playerSystem',
                'collisionSystem',
                'ambientBubbleSystem',
                'bulletSystem',
                'healthSystem',
                'enemySystem',
                'uiSystem',
                'gameSceneUI',
                'gameSceneCamera'
            ];
            
            systemsToCleanup.forEach(systemKey => {
                if (this.scene[systemKey] && typeof this.scene[systemKey].destroy === 'function') {
                    try {
                        this.scene[systemKey].destroy();
                        this.scene[systemKey] = null;
                    } catch (e) {
                        console.warn(`Error cleaning up ${systemKey}:`, e);
                    }
                }
            });
            
            // Stop all running tweens
            this.scene.tweens.killAll();
            
            // Stop all running timers
            this.scene.time.removeAllEvents();
            
            // Clear any remaining physics bodies
            this.scene.physics.world.colliders.clear();
            this.scene.physics.world.bodies.clear();
            
            console.log('Cleanup completed successfully');
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
    
    /**
     * Clean up event listeners
     */
    destroy() {
        // Remove event listeners
        this.scene.scale.off('resize', this.handleResize, this);
        this.scene.input.keyboard.off('keydown-ESC');
        
        // Clear listeners
        this.stateChangeListeners.clear();
        
        // Destroy pause menu
        if (this.pauseMenu) {
            this.pauseMenu.destroy();
            this.pauseMenu = null;
        }
        
        this.scene = null;
    }
} 