import Phaser from 'phaser';
import backgroundImg from './assets/underwater_bg.png';
import midLayerImg from './assets/mid_layer_bg.png';
import diverImg from './assets/diver2.png';
import airPocket1Img from './assets/air_pocket1.png';
import airPocket2Img from './assets/air_pocket2.png';
import airPocket3Img from './assets/air_pocket3.png';
import rockImg from './assets/rock2.png';
import rock3Img from './assets/rock3.png';
import bubbleImg from './assets/bubble.png';
import bgMusic from './assets/music/bg_music.mp3';

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        this.isMuted = false;
        this.musicVolume = 0.5; // Default volume
    }

    preload() {
        // Add loading error handlers
        this.load.on('loaderror', (fileObj) => {
            console.error('Error loading asset:', fileObj.src);
        });

        this.load.on('complete', () => {
            console.log('All assets loaded successfully');
        });

        // Load all assets
        this.load.image('background', backgroundImg);
        this.load.image('middle_layer', midLayerImg);
        this.load.image('player', diverImg);
        this.load.image('air_pocket1', airPocket1Img);
        this.load.image('air_pocket2', airPocket2Img);
        this.load.image('air_pocket3', airPocket3Img);
        this.load.image('obstacle', rockImg);
        this.load.image('rock3', rock3Img);
        this.load.image('bubble', bubbleImg);
        
        // Load background music using imported asset
        this.load.audio('bgMusic', bgMusic);
        
        // TODO: Load the new layer images once you have them
        // this.load.image('middle_layer', middleLayerImg);
        // this.load.image('foreground', foregroundImg);
    }

    create() {
        // Add music system
        this.setupMusicSystem();

        // Make the world 2 screens wide and 8 screens tall
        const worldWidth = 1600 * 2;  // 2 screens wide (3200 pixels)
        const worldHeight = 1200 * 8; // 8 screens tall (9600 pixels)
        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

        // Create background layers
        this.createParallaxBackground(worldWidth, worldHeight);

        // Create obstacles first so they appear behind the player
        console.log('Creating obstacles...');
        this.obstacles = this.physics.add.staticGroup();
        
        // Create background rocks (rock2) in the middle layer
        const smallRocks = [];
        for (let i = 0; i < 60; i++) { // Increased for vertical world
            smallRocks.push({
                x: Phaser.Math.Between(200, worldWidth - 200),
                y: Phaser.Math.Between(200, worldHeight - 200)
            });
        }

        // Add small rocks to middle layer
        smallRocks.forEach(pos => {
            const rock = this.add.image(pos.x, pos.y, 'obstacle')
                .setScrollFactor(0.6) // Match middle layer scroll factor
                .setDepth(0.2) // Lower depth so they appear behind large rocks
                .setAlpha(0.85); // Slightly reduce opacity to enhance depth effect
        });
        
        // Create large rocks (rock3) as physical obstacles
        const largeRockPositions = [];
        const numRocks = 15; // Reduced from 25 to 15
        const numSections = 5; // Divide world into 5 vertical sections
        const rocksPerSection = Math.ceil(numRocks / numSections);
        const sectionHeight = (worldHeight - 1200) / numSections; // Height per section (excluding top screen)

        for (let section = 0; section < numSections; section++) {
            for (let i = 0; i < rocksPerSection; i++) {
                const sectionY = 1200 + (section * sectionHeight);
                largeRockPositions.push({
                    x: Phaser.Math.Between(400, worldWidth - 400),
                    y: sectionY + Phaser.Math.Between(200, sectionHeight - 200)
                });
            }
        }

        // Shuffle the positions array to randomize rock placement within sections
        Phaser.Utils.Array.Shuffle(largeRockPositions);
        
        // Only use the first 15 positions
        largeRockPositions.slice(0, 15).forEach(pos => {
            const rock = this.obstacles.create(pos.x, pos.y, 'rock3');
            rock.body.setSize(250, 200);
            rock.body.setOffset(73, 150);
            rock.setScrollFactor(1);
            rock.setDepth(1);
        });

        // Create player with proper depth - start near top
        console.log('Creating player...');
        this.player = this.physics.add.sprite(worldWidth / 2, 600, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(84, 112);
        this.player.setOffset(0, 0);
        this.player.setDrag(100);  // Reduced drag from 150 to 100 for more momentum
        this.player.setMaxVelocity(300);  // Increased max velocity from 250 to 300
        this.player.setDepth(2);

        // Create player bubble trail
        this.add.particles(0, 0, 'bubble', {
            follow: this.player,
            followOffset: { x: 0, y: -40 },
            lifespan: 3000,
            gravityY: -50,
            speed: { min: 40, max: 80 },
            scale: { start: 0.15, end: 0.05 },
            alpha: { start: 0.6, end: 0 },
            angle: { min: 250, max: 290 },
            rotate: { min: -180, max: 180 },
            frequency: 500,
            emitZone: { 
                type: 'random',
                source: new Phaser.Geom.Circle(0, 0, 10)
            }
        });

        // Set up camera to follow player
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
        this.cameras.main.startFollow(this.player);
        this.cameras.main.setDeadzone(200, 200);

        // Add air pockets spread across the world
        console.log('Creating air pockets...');
        this.airPockets = this.physics.add.group();
        this.createAirPockets(worldWidth, worldHeight);

        // Add collisions and overlaps
        this.physics.add.collider(this.player, this.obstacles);
        this.physics.add.overlap(this.player, this.airPockets, this.refillOxygen, null, this);

        // Add collisions between air pockets and obstacles
        this.physics.add.collider(this.airPockets, this.obstacles, (airPocket, obstacle) => {
            // Calculate collision normal (direction of bounce)
            const dx = airPocket.x - obstacle.x;
            const dy = airPocket.y - obstacle.y;
            const angle = Math.atan2(dy, dx);
            
            // Get current velocity components
            const velocity = new Phaser.Math.Vector2(airPocket.body.velocity.x, airPocket.body.velocity.y);
            const speed = velocity.length();
            
            // Calculate new velocity after bounce
            const bounceSpeed = speed * 0.8;  // Maintain 80% of speed after bounce
            const minUpwardSpeed = 80;  // Minimum upward speed to maintain
            
            // Apply new velocity with bounce direction
            let newVelX = Math.cos(angle) * bounceSpeed;
            let newVelY = Math.sin(angle) * bounceSpeed;
            
            // Ensure minimum upward velocity
            newVelY = Math.min(newVelY, -minUpwardSpeed);
            
            airPocket.setVelocity(newVelX, newVelY);
        });

        // Create UI elements that stay fixed to the camera
        this.maxOxygen = 100;
        this.currentOxygen = this.maxOxygen;

        this.oxygenBarBG = this.add.rectangle(20, 20, 400, 40, 0x000000); // 2x original size
        this.oxygenBarBG.setScrollFactor(0);
        this.oxygenBarBG.setOrigin(0, 0);
        this.oxygenBarBG.setDepth(10); // Set high depth value
        
        this.oxygenBar = this.add.rectangle(20, 20, 400, 40, 0x00ff00); // 2x original size
        this.oxygenBar.setScrollFactor(0);
        this.oxygenBar.setOrigin(0, 0);
        this.oxygenBar.setDepth(10); // Set high depth value
        
        const oxygenText = this.add.text(20, 70, 'Oxygen', { font: '32px Arial', color: '#ffffff' }); // 2x original font size
        oxygenText.setScrollFactor(0);
        oxygenText.setDepth(10); // Set high depth value

        // Set up controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = {
            up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
        };
    }

    createParallaxBackground(worldWidth, worldHeight) {
        // Calculate how many tiles we need for each layer
        const bgWidth = 1600;  // 2x original size
        const bgHeight = 1200; // 2x original size
        const tilesX = Math.ceil(worldWidth / bgWidth) + 1; // +1 for seamless scrolling
        const tilesY = Math.ceil(worldHeight / bgHeight) + 1;

        // Create container for background layers
        this.backgroundLayers = {
            far: [],
            middle: [],
            front: []
        };

        // Create far background layer (slowest moving)
        for (let x = 0; x < tilesX; x++) {
            for (let y = 0; y < tilesY; y++) {
                const bg = this.add.image(x * bgWidth, y * bgHeight, 'background')
                    .setOrigin(0, 0)
                    .setScrollFactor(0.3); // Moves at 0.3x speed
                this.backgroundLayers.far.push(bg);
            }
        }

        // Create middle layer (medium speed)
        for (let x = 0; x < tilesX; x++) {
            for (let y = 0; y < tilesY; y++) {
                const middle = this.add.image(x * bgWidth, y * bgHeight, 'middle_layer')
                    .setOrigin(0, 0)
                    .setScrollFactor(0.6)
                    .setAlpha(0.25); // 25% opacity
                this.backgroundLayers.middle.push(middle);
            }
        }

        // TODO: Once you have the foreground image
        // Create foreground layer (fastest moving)
        /*for (let x = 0; x < tilesX; x++) {
            for (let y = 0; y < tilesY; y++) {
                const front = this.add.image(x * bgWidth, y * bgHeight, 'foreground')
                    .setOrigin(0, 0)
                    .setScrollFactor(0.9); // Moves at 0.9x speed
                this.backgroundLayers.front.push(front);
            }
        }*/
    }

    createAirPockets(worldWidth, worldHeight) {
        this.airPockets.clear(true, true);
        
        // Create zones with moderate spacing, but avoid the starting area
        const zoneSize = 1600;
        const zones = [];
        const startAreaX = 800;
        const startAreaY = 600;
        const safeRadius = 800;
        
        // Generate spawn points across the world, avoiding the start area
        for (let x = zoneSize; x < worldWidth - zoneSize; x += zoneSize) {
            // Only create zones in the bottom third of the world
            const y = worldHeight - zoneSize;
            
            // Calculate distance from start position
            const distanceFromStart = Phaser.Math.Distance.Between(x, y, startAreaX, startAreaY);
            
            // Only add zones that are outside the safe radius
            if (distanceFromStart > safeRadius) {
                zones.push({
                    minX: x - 400,
                    maxX: x + 400,
                    minY: y - 200,
                    maxY: y
                });
            }
        }

        // Create initial air pockets in valid zones
        zones.forEach(zone => {
            if (Phaser.Math.Between(1, 3) === 1) { // 33% spawn chance
                const x = Phaser.Math.Between(zone.minX, zone.maxX);
                const y = Phaser.Math.Between(zone.minY, zone.maxY);
                this.createSingleAirPocket(x, y);
            }
        });

        // Set up periodic spawning of new air pockets
        this.time.addEvent({
            delay: 6000, // Spawn every 6 seconds
            callback: () => {
                // Get camera view bounds
                const cam = this.cameras.main;
                const camBounds = {
                    left: cam.scrollX,
                    right: cam.scrollX + cam.width,
                    top: cam.scrollY,
                    bottom: cam.scrollY + cam.height
                };
                
                // Always spawn from bottom, but outside camera view
                const x = Phaser.Math.Between(200, worldWidth - 200);
                const y = camBounds.bottom + 300; // Spawn well below the camera view
                
                // Only spawn if the position is within world bounds
                if (y < worldHeight - 100) {
                    this.createSingleAirPocket(x, y);
                }
            },
            loop: true
        });
    }

    createSingleAirPocket(x, y) {
        const airPocketType = Phaser.Math.Between(1, 3);
        const airPocket = this.airPockets.create(x, y, `air_pocket${airPocketType}`);
        airPocket.setScale(0.165);
        airPocket.setScrollFactor(1);
        airPocket.setDepth(1);
        
        // Set up collision box
        const originalWidth = airPocket.width;
        const originalHeight = airPocket.height;
        airPocket.body.setSize(originalWidth * 0.65, originalHeight * 0.65);
        airPocket.body.setOffset(75, 75);
        
        // Set physics properties for better bouncing
        airPocket.setBounce(0.8);  // Higher bounce for more reactive collisions
        airPocket.setDrag(0);      // No drag to maintain momentum
        airPocket.setFriction(0);  // No friction
        airPocket.body.setAllowGravity(false);  // Disable gravity
        
        // Set initial velocity with slight randomness
        airPocket.setVelocity(
            Phaser.Math.Between(-20, 20),  // Small random horizontal velocity
            -100  // Consistent upward movement
        );
        
        // Create bubble trail
        airPocket.particles = this.add.particles(0, 0, 'bubble', {
            follow: airPocket,
            followOffset: { x: 0, y: 0 },
            lifespan: 2500,
            gravityY: -200,
            speed: { min: 150, max: 200 },
            scale: { start: 0.2, end: 0.1 },
            alpha: { start: 0.6, end: 0 },
            angle: { min: 265, max: 275 },
            frequency: 80,
            emitZone: { 
                type: 'random',
                source: new Phaser.Geom.Circle(0, -20, 25)
            },
            quantity: 2
        }).setDepth(0);

        // Add gentle rotation
        this.tweens.add({
            targets: airPocket,
            angle: Phaser.Math.Between(-10, 10),
            duration: 2500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        return airPocket;
    }

    update(time, delta) {
        // First, check if player is still active
        if (!this.player.active || !this.player.body) {
            console.log('Player inactive or missing body!');
            return;
        }

        // Update oxygen
        this.currentOxygen -= (delta / 1000) * 1;
        this.currentOxygen = Phaser.Math.Clamp(this.currentOxygen, 0, this.maxOxygen);
        
        // Only proceed with game over if oxygen is actually 0
        if (this.currentOxygen <= 0) {
            this.gameOver();
            return;
        }

        this.oxygenBar.width = (this.currentOxygen / this.maxOxygen) * 400;

        // Ensure player position stays within world bounds
        this.player.x = Phaser.Math.Clamp(this.player.x, 0, this.physics.world.bounds.width);
        this.player.y = Phaser.Math.Clamp(this.player.y, 0, this.physics.world.bounds.height);

        // Movement controls
        if (this.cursors.left.isDown || this.keys.left.isDown) {
            this.player.setAccelerationX(-300);  // Increased from -200 to -300
            this.player.setFlipX(true);
        } else if (this.cursors.right.isDown || this.keys.right.isDown) {
            this.player.setAccelerationX(300);   // Increased from 200 to 300
            this.player.setFlipX(false);
        } else {
            this.player.setAccelerationX(0);
        }

        if (this.cursors.up.isDown || this.keys.up.isDown) {
            this.player.setAccelerationY(-300);  // Increased from -200 to -300
        } else if (this.cursors.down.isDown || this.keys.down.isDown) {
            this.player.setAccelerationY(300);   // Increased from 200 to 300
        } else {
            this.player.setAccelerationY(0);
        }

        // Check for and remove out-of-bounds air pockets
        this.airPockets.getChildren().forEach(airPocket => {
            if (airPocket.y < 0) {
                if (airPocket.particles) {
                    airPocket.particles.destroy();
                }
                airPocket.destroy();
            }
        });
    }

    refillOxygen(player, airPocket) {
        this.currentOxygen = this.maxOxygen;
        
        // Create burst effect using the same particle system style
        const burstEffect = this.add.particles(0, 0, 'bubble', {
            x: airPocket.x,
            y: airPocket.y,
            lifespan: 1000,
            speed: { min: 50, max: 100 },
            scale: { start: 0.1, end: 0 },
            alpha: { start: 0.5, end: 0 },
            angle: { min: 0, max: 360 },
            gravityY: -20,
            frequency: 1000/10, // Emit 10 particles over 1 second
            emitZone: { 
                type: 'random',
                source: new Phaser.Geom.Circle(0, 0, 20)
            }
        });

        // Destroy the burst effect after animation
        this.time.delayedCall(1000, () => {
            burstEffect.destroy();
        });

        // Clean up the air pocket and its particles
        if (airPocket.particles) {
            airPocket.particles.destroy();
        }
        airPocket.destroy();
    }

    gameOver() {
        if (this.player.active) { // Only run game over once
            this.add.text(800, 600, 'Game Over', { font: '48px Arial', color: '#ffffff' }).setOrigin(0.5);
            this.player.setActive(false);
            this.player.setVisible(false);
            if (this.player.body) {
                this.physics.world.remove(this.player);
            }
        }
    }

    setupMusicSystem() {
        try {
            // Create background music if audio loaded successfully
            if (this.cache.audio.exists('bgMusic')) {
                // Create the audio instance
                this.backgroundMusic = this.sound.add('bgMusic', {
                    volume: this.musicVolume,
                    loop: true
                });

                // Start playing the music
                if (!this.sound.locked) {
                    this.backgroundMusic.play();
                } else {
                    // If audio is locked (common on mobile), wait for user interaction
                    this.sound.once('unlocked', () => {
                        this.backgroundMusic.play();
                    });
                }

                // Add volume control UI
                const volumeStyle = {
                    font: '24px Arial',
                    color: '#ffffff',
                    backgroundColor: '#000000',
                    padding: { x: 10, y: 5 }
                };

                // Add mute button (top right corner)
                const muteButton = this.add.text(1500, 20, '🔊', volumeStyle)
                    .setScrollFactor(0)
                    .setDepth(10)
                    .setInteractive();

                // Add volume controls
                const volumeDown = this.add.text(1400, 20, '−', volumeStyle)
                    .setScrollFactor(0)
                    .setDepth(10)
                    .setInteractive();

                const volumeUp = this.add.text(1450, 20, '+', volumeStyle)
                    .setScrollFactor(0)
                    .setDepth(10)
                    .setInteractive();

                // Handle mute toggle
                muteButton.on('pointerdown', () => {
                    this.isMuted = !this.isMuted;
                    if (this.isMuted) {
                        this.backgroundMusic.setVolume(0);
                        muteButton.setText('🔈');
                    } else {
                        this.backgroundMusic.setVolume(this.musicVolume);
                        muteButton.setText('🔊');
                    }
                });

                // Handle volume controls
                volumeDown.on('pointerdown', () => {
                    this.musicVolume = Math.max(0, this.musicVolume - 0.1);
                    if (!this.isMuted) {
                        this.backgroundMusic.setVolume(this.musicVolume);
                    }
                });

                volumeUp.on('pointerdown', () => {
                    this.musicVolume = Math.min(1, this.musicVolume + 0.1);
                    if (!this.isMuted) {
                        this.backgroundMusic.setVolume(this.musicVolume);
                    }
                });
            } else {
                console.warn('Background music not loaded successfully');
            }
        } catch (error) {
            console.error('Error setting up music system:', error);
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: 1600,    // 2x original width
    height: 1200,   // 2x original height
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: true
        }
    },
    scene: GameScene
};

const game = new Phaser.Game(config); 