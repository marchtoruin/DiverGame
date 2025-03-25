import Phaser from 'phaser';
import GameScene from './scenes/GameScene';
import DebugMapScene from './scenes/DebugMapScene';
import { GAME_WIDTH, GAME_HEIGHT, GAME_GRAVITY } from './utils/Constants';

// Create game container if it doesn't exist
if (typeof document !== 'undefined') {
    const container = document.getElementById('game-container') || document.createElement('div');
    if (!container.id) {
        container.id = 'game-container';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.margin = '0';
        container.style.padding = '0';
        container.style.overflow = 'hidden';
        document.body.appendChild(container);
    }
    
    // Also style the body and html elements
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.backgroundColor = '#000066';
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.backgroundColor = '#000066';
}

// Initialize game configuration
const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#000033',
    parent: 'game-container',
    pixelArt: false,
    roundPixels: false,
    antialias: true,
    scale: {
        mode: Phaser.Scale.RESIZE, // Changed to RESIZE to dynamically adjust to window size
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        parent: 'game-container',
        expandParent: true, // Ensure the parent expands to fit the game
    },
    dom: {
        createContainer: true
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: GAME_GRAVITY },
            debug: false
        }
    },
    scene: [DebugMapScene, GameScene]
};

// Create the game instance
const game = new Phaser.Game(config);

// Add resize listener to handle window resizing
window.addEventListener('resize', () => {
    if (game.scale) {
        game.scale.resize(window.innerWidth, window.innerHeight);
    }
});

// Export the game instance
export default game; 