const config = {
    type: Phaser.AUTO,
    width: 1600,
    height: 900,
    pixelArt: true,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: true // Enable debug mode to see player collision body
        }
    }
}; 