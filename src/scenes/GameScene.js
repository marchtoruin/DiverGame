import Phaser from 'phaser';
import { 
    GAME_WIDTH, 
    GAME_HEIGHT, 
    GAME_GRAVITY, 
    PLAYER, 
    OXYGEN, 
    PHYSICS, 
    CAMERA,
    PARTICLES,
    AIR_POCKET,
    ANIMATIONS,
    AUDIO 
} from '../utils/Constants';

// Import asset paths
import level1Data from '../assets/maps/level1.json';
import level2Data from '../assets/maps/level2.json';
import underwaterBg from '../assets/underwater_bg.png';
import blackAndBlueImg from '../assets/black_and_blue.png';  
import rock2Img from '../assets/rock2.png';
import rock3Img from '../assets/rock3.png';
import diverImg from '../assets/diver2.png';
import bubbleImg from '../assets/bubble.png';
import bgBubble1Img from '../assets/bg_bubble1.png';
import bgBubble2Img from '../assets/bg_bubble2.png';
import bgBubble3Img from '../assets/bg_bubble3.png';
import bulletImg from '../assets/laser_sprites/03.png';
import idleSwimStrip from '../assets/idle_swim_strip.png';
import airPocket1Img from '../assets/air_pocket1.png';
import airPocket2Img from '../assets/air_pocket2.png';
import airPocket3Img from '../assets/air_pocket3.png';
import bgMusic from '../assets/music/bg_music.mp3';
import ambienceMusic from '../assets/music/ambience_underwater.wav';
import heartImg from '../assets/heart.png';
import badFishImg from '../assets/enemies/badFish01.png';
import seaweedImg from '../assets/seaweed.png'; // Add seaweed tileset

// Import systems
import AnimationSystem from '../systems/AnimationSystem';
import AudioSystem from '../systems/AudioSystem';
import ParticleSystem from '../systems/ParticleSystem';
import TilemapSystem from '../systems/TilemapSystem';
import AirPocketSystem from '../systems/AirPocketSystem.js';
import CollisionSystem from '../systems/CollisionSystem.js';
import OxygenMeterSystem from '../systems/OxygenMeterSystem';
import HealthSystem from '../systems/HealthSystem';
import Player from '../entities/Player';
import OxygenMeter from '../ui/OxygenMeter.js';
import PlayerSystem from '../systems/PlayerSystem.js';
import AmbientBubbleSystem from '../systems/AmbientBubbleSystem.js';
import Bullet from '../entities/Bullet.js';
import BulletSystem from '../systems/BulletSystem.js';
import EnemySystem from '../systems/EnemySystem';
import MapConfigurationSystem from '../systems/MapConfigurationSystem';
import EntityLayerSystem from '../systems/EntityLayerSystem';
import AssetManagementSystem from '../systems/AssetManagementSystem';
import UIManagementSystem from '../systems/UIManagementSystem';
import TouchControlSystem from '../systems/TouchControlSystem';
import { GameSceneUI } from './components/GameSceneUI';
import { GameSceneCamera } from './components/GameSceneCamera';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.initializeProperties();
        this.currentLevel = 'level1'; // Default level
        
        // Expose systems for UI
        this.OxygenMeterSystem = OxygenMeterSystem;
        this.HealthSystem = HealthSystem;
    }
    
    initializeProperties() {
        // Systems
        this.player = null;
        this.animationSystem = null;
        this.audioSystem = null;
        this.particleSystem = null;
        this.tilemapSystem = null;
        this.airPocketSystem = null;
        this.oxygenMeter = null;
        this.playerSystem = null;
        this.collisionSystem = null;
        this.ambientBubbleSystem = null;
        this.bulletSystem = null;
        this.healthSystem = null;
        this.enemySystem = null;
        this.mapConfigSystem = null;
        this.entityLayerSystem = null;
        this.uiSystem = null;
        this.touchControlSystem = null;
        this.gameSceneUI = null;
        this.gameSceneCamera = null;
        
        // Game state
        this.oxygenLevel = 100;
        this.oxygenDecreaseRate = 0.1;
        this.gameOver = false;
        this.gameRunning = true;
        
        // Air pocket spawn points
        this.airPocketSpawnPoints = [];
        
        // Input state
        this.cursors = null;
        this.touchData = { startX: 0, startY: 0, isMoving: false };
        this.touchControlsEnabled = true;
    }
    
    init(data) {
        if (data && data.level) {
            this.currentLevel = data.level;
            console.log('Loading level:', this.currentLevel);
        }
        // Don't set world bounds here - we'll set them properly when the map loads
        // This was overriding the correct map dimensions
        if (this.physics.config.debug && this.physics.world.debugGraphic) {
            this.physics.world.enableBody(this.physics.world.debugGraphic);
        }
    }

    preload() {
        try {
            // Initialize asset management system
            this.assetSystem = new AssetManagementSystem(this);
            
            // Load map configuration
            this.load.json('mapConfig', 'src/config/mapConfig.json');
            
            // Load map and tilesets
            this.load.tilemapTiledJSON('level1', level1Data);
            this.load.tilemapTiledJSON('level2', level2Data);
            this.load.image('underwater_bg', underwaterBg);
            this.load.image('black_and_blue', blackAndBlueImg);
            this.load.image('rock2', rock2Img);
            this.load.image('rock3', rock3Img);
            this.load.image('seaweed', seaweedImg);
            this.load.image('air_pocket1', airPocket1Img);
            this.load.image('air_pocket2', airPocket2Img);
            this.load.image('air_pocket3', airPocket3Img);
            
            // Load player assets
            this.load.image('player', diverImg);
            this.load.image('bubble', bubbleImg);
            this.load.image('heart', heartImg);
            
            // Load enemy assets
            this.load.image('badFish', badFishImg);
            
            // Load all background bubble variations
            this.load.image('bg_bubble1', bgBubble1Img);
            this.load.image('bg_bubble2', bgBubble2Img);
            this.load.image('bg_bubble3', bgBubble3Img);
            
            // Load bullet sprite
            this.load.image('bullet', bulletImg);
            
            // Load audio
            this.load.audio('music', bgMusic);
            this.load.audio('ambience', ambienceMusic);

            // Initialize the asset system after loading
            this.assetSystem.loadAssets()
                .catch(error => {
                    console.error('Error initializing asset system:', error);
                });
        } catch (error) {
            console.error('Error in preload:', error);
        }
    }

    create() {
        this.gameRunning = true;
        
        try {
            // Initialize camera system first
            this.gameSceneCamera = new GameSceneCamera(this);
            
            // Create full-screen background
            this.createFullScreenBackground();
            
            // Setup core systems
            this.audioSystem = new AudioSystem(this);
            this.particleSystem = new ParticleSystem(this);
            this.mapConfigSystem = new MapConfigurationSystem(this);
            this.entityLayerSystem = new EntityLayerSystem(this);
            this.tilemapSystem = new TilemapSystem(this);
            this.ambientBubbleSystem = new AmbientBubbleSystem(this);
            this.bulletSystem = new BulletSystem(this);
            
            // Initialize audio system
            if (this.audioSystem) {
                this.audioSystem.setupMusic('music', 'ambience');
            }
            
            // Create the map
            this.createTiledMap();
            
            // Now create player
            this.playerSystem = new PlayerSystem(this);
            this.setupPlayer();
            
            // Complete remaining setup
            this.airPocketSystem = new AirPocketSystem(this, this.player);
            this.airPocketSystem.setDebugVisualsEnabled(true);
            this.setupControls();
            
            // Initialize camera after player and map are set up
            this.gameSceneCamera.initialize();
            
            // Initialize UI systems
            this.gameSceneUI = new GameSceneUI(this);
            this.gameSceneUI.initialize();
            
            // Setup collisions
            this.setupCollisions();
            
            // Initialize enemy system
            this.enemySystem = new EnemySystem(this);
            
            // Set up collision between player and enemies
            this.physics.add.overlap(
                this.player.sprite,
                this.enemySystem.enemies,
                this.handlePlayerEnemyCollision,
                null,
                this
            );

            // Set up collision between bullets and enemies
            if (this.bulletSystem) {
                this.bulletSystem.setupCollision(
                    this.enemySystem.enemies,
                    (bullet, enemy) => {
                        if (enemy.isAlive) {
                            enemy.takeDamage(20);
                        }
                    }
                );
            }
            
            // Handle window resize
            this.scale.on('resize', () => {
                this.uiSystem?.handleResize();
            });
            
            console.log('GameScene initialization complete');
        } catch (error) {
            console.error('Error in create method:', error);
        }
    }
    
    createFullScreenBackground() {
        try {
            // Create a background that covers the entire screen regardless of camera position
            // Using the camera's viewport dimensions ensures it fills the entire screen
            const width = this.cameras.main.width;
            const height = this.cameras.main.height;
            
            // Create a very large rectangle that will stay fixed to the camera
            // This ensures no black areas are visible at the edges
            this.fullScreenBg = this.add.rectangle(
                -width, -height, 
                width * 4, height * 4, 
                0x000033 // Darker blue background
            );
            this.fullScreenBg.setScrollFactor(0); // Fixed to camera
            this.fullScreenBg.setDepth(-50);
            this.fullScreenBg.setOrigin(0, 0);
            
            // Add a gradient overlay for depth effect - using darker colors
            const gradientTexture = this.createGradientTexture(width, height, ['#000022', '#000033', '#000044']);
            if (gradientTexture) {
                this.gradientOverlay = this.add.image(0, 0, 'gradient-texture');
                this.gradientOverlay.setScrollFactor(0);
                this.gradientOverlay.setDepth(-45);
                this.gradientOverlay.setOrigin(0, 0);
                this.gradientOverlay.setDisplaySize(width * 2, height * 2);
            }
            
            // Create a more densely-packed water pattern overlay for visual interest
            // But with darker, more subtle colors
            for (let i = 0; i < 30; i++) { // Reduced from 50
                const x = Phaser.Math.Between(-width/2, width * 1.5);
                const y = Phaser.Math.Between(-height/2, height * 1.5);
                const size = Phaser.Math.Between(50, 300);
                const alpha = Phaser.Math.FloatBetween(0.03, 0.1); // Lower alpha
                
                const waterEffect = this.add.circle(x, y, size, 0x000066, alpha); // Darker blue
                waterEffect.setScrollFactor(Phaser.Math.FloatBetween(0.05, 0.3)); // Varied parallax
                waterEffect.setDepth(-40);
                
                // Add subtle animation to water effects
                this.tweens.add({
                    targets: waterEffect,
                    alpha: '-=0.02', // Smaller alpha change
                    scale: '+=0.2',  // Smaller scale change
                    duration: Phaser.Math.Between(5000, 10000), // Slower
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1
                });
            }
            
            // Add some larger circular shapes for additional underwater effect
            for (let i = 0; i < 7; i++) { // Reduced from 10
                const x = Phaser.Math.Between(-width/2, width * 1.5);
                const y = Phaser.Math.Between(-height/2, height * 1.5);
                const size = Phaser.Math.Between(200, 500);
                const alpha = Phaser.Math.FloatBetween(0.02, 0.05); // Lower alpha
                
                const deepWaterEffect = this.add.circle(x, y, size, 0x000055, alpha); // Darker blue
                deepWaterEffect.setScrollFactor(Phaser.Math.FloatBetween(0.1, 0.2));
                deepWaterEffect.setDepth(-42);
                
                // Add subtle pulsing animation
                this.tweens.add({
                    targets: deepWaterEffect,
                    alpha: '-=0.01', // Smaller alpha change
                    scale: '+=0.15', // Smaller scale change
                    duration: Phaser.Math.Between(8000, 15000), // Slower
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1
                });
            }
            
            // Create animated water overlay for underwater movement effect without tile movement
            this.createWaterMovementOverlay();
            
            console.log('Created dark full-screen background that stays fixed to camera');
        } catch (error) {
            console.error('Error creating full-screen background:', error);
        }
    }
    
    createWaterMovementOverlay() {
        try {
            const width = this.cameras.main.width;
            const height = this.cameras.main.height;
            
            // Create container for water overlay effects
            this.waterOverlayContainer = this.add.container(0, 0);
            this.waterOverlayContainer.setDepth(20); // Above most things but below player
            this.waterOverlayContainer.setScrollFactor(0); // Fixed to camera
            
            // Add subtle caustic light effects (light shimmering through water)
            // But make them much more subtle and darker
            for (let i = 0; i < 5; i++) { // Reduced from 8 to 5
                const x = Phaser.Math.Between(0, width);
                const y = Phaser.Math.Between(0, height);
                const size = Phaser.Math.Between(100, 350);
                
                // Create a light patch with much lower opacity
                const causticLight = this.add.graphics();
                causticLight.fillStyle(0x001133, 0.01); // Darker blue, very transparent
                causticLight.fillCircle(0, 0, size);
                
                const causticSprite = this.add.renderTexture(x, y, size*2, size*2);
                causticSprite.draw(causticLight, size, size);
                causticLight.destroy();
                
                this.waterOverlayContainer.add(causticSprite);
                
                // Animate the caustic light effect with less visibility
                this.tweens.add({
                    targets: causticSprite,
                    alpha: { from: 0.01, to: 0.05 }, // Much lower opacity
                    scale: { from: 0.8, to: 1.2 },
                    duration: Phaser.Math.Between(4000, 8000),
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: Phaser.Math.Between(0, 2000)
                });
                
                // Also move them slightly
                this.tweens.add({
                    targets: causticSprite,
                    x: '+=30',
                    y: '+=20',
                    duration: Phaser.Math.Between(6000, 10000),
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: Phaser.Math.Between(0, 3000)
                });
            }
            
            // Remove the blue haze overlay completely
            // This was causing the lightening of the background
            
            console.log('Created subtle water movement overlay without blue tint');
        } catch (error) {
            console.error('Error creating water movement overlay:', error);
        }
    }
    
    // Helper method to create a gradient texture
    createGradientTexture(width, height, colorStops) {
        try {
            // Create a canvas for the gradient
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            // Create gradient
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            
            // Add color stops
            colorStops.forEach((color, index) => {
                gradient.addColorStop(index / (colorStops.length - 1), color);
            });
            
            // Fill with gradient
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);
            
            // Create texture from canvas
            this.textures.addCanvas('gradient-texture', canvas);
            
            console.log('Created gradient texture for background');
            return true;
        } catch (error) {
            console.error('Error creating gradient texture:', error);
            return false;
        }
    }
    
    setupSystems() {
        try {
            // This method is now called from within create
            // to allow proper sequencing of initialization
        } catch (error) {
            console.error('Error initializing systems:', error);
        }
    }

    setupAnimations() {
        try {
            console.log('Setting up animations...');
            if (this.animationSystem) {
                // First remove any existing animations to prevent conflicts
                if (this.anims.exists(ANIMATIONS.IDLE_SWIM.KEY)) {
                    this.anims.remove(ANIMATIONS.IDLE_SWIM.KEY);
                    console.log('Removed existing idle_swim animation');
                }
                
                // Create a new animation
                const success = this.animationSystem.createPlayerSwimAnimation('idle_swim_full');
                
                // Verify the animation was created
                if (this.anims.exists(ANIMATIONS.IDLE_SWIM.KEY)) {
                    console.log('Animation created successfully, verified it exists!');
                } else {
                    console.error('Animation creation failed - not found after creation attempt');
                    // Try one more time with the animation system's master method
                    this.animationSystem.createAnimations();
                }
                
                // Do final check after all attempts
                const animExists = this.anims.exists(ANIMATIONS.IDLE_SWIM.KEY);
                console.log('Final animation status:', animExists ? 'SUCCESS' : 'FAILED');
            } else {
                console.warn('Animation system not initialized');
            }
        } catch (error) {
            console.error('Error setting up animations:', error);
        }
    }

    createTiledMap() {
        try {
            console.log('Creating tilemap...');
            const map = this.make.tilemap({ key: this.currentLevel });
            
            // Debug: log all tilesets in the map
            console.log('Tilesets in map:', map.tilesets.map(t => ({
                name: t.name,
                firstgid: t.firstgid,
                tileCount: t.total
            })));
            
            // Show detailed map info for debugging
            console.log('Map dimensions:', {
                width: map.width,
                height: map.height,
                tileWidth: map.tileWidth,
                tileHeight: map.tileHeight,
                widthInPixels: map.widthInPixels,
                heightInPixels: map.heightInPixels
            });

            // Add debug visualization for obstacles layer
            const debugObstacles = true; // Set to true to enable debug visualization
            if (debugObstacles) {
                const obstaclesLayer = map.layers.find(l => l.name === 'Obstacles');
                if (obstaclesLayer) {
                    console.log('Obstacles layer data:', {
                        encoding: obstaclesLayer.compression || 'none',
                        format: typeof obstaclesLayer.data === 'string' ? 'base64' : 'array',
                        sampleTiles: Array.isArray(obstaclesLayer.data) 
                            ? obstaclesLayer.data.slice(0, 10) 
                            : 'Base64 encoded'
                    });
                }
            }
            
            // Create TWO solid background colors spanning the entire viewport
            // One fixed to the camera and one that scrolls slightly
            const fixedBgRect = this.add.rectangle(
                0, 0,
                this.cameras.main.width * 2,
                this.cameras.main.height * 2,
                0x000066
            );
            fixedBgRect.setDepth(-30);
            fixedBgRect.setOrigin(0, 0);
            fixedBgRect.setScrollFactor(0); // Fixed to camera
            console.log('Created fixed background color rectangle');
            
            // Create a second background that scrolls with the camera but more slowly
            const scrollingBgRect = this.add.rectangle(
                -1000, -1000,
                map.widthInPixels + 2000,
                map.heightInPixels + 2000,
                0x000088
            );
            scrollingBgRect.setDepth(-20);
            scrollingBgRect.setOrigin(0, 0);
            scrollingBgRect.setScrollFactor(0.2); // Parallax effect
            console.log('Created scrolling background color rectangle');
            
            // Add each tileset to the map
            const addedTilesets = [];
            map.tilesets.forEach(tileset => {
                try {
                    // Extract the base name without path or extension
                    const cleanName = tileset.name.replace(/^\.\.\//, '').replace(/\.png$/, '');
                    
                    console.log(`Attempting to add tileset: ${tileset.name} (cleaned: ${cleanName})`);
                    const addedTileset = map.addTilesetImage(tileset.name, cleanName);
                    
                    if (addedTileset) {
                        console.log(`Added embedded tileset: ${tileset.name} → ${cleanName}`);
                        addedTilesets.push(addedTileset);
                    } else {
                        console.warn(`Failed to add tileset: ${tileset.name} with key: ${cleanName}`);
                    }
                } catch (e) {
                    console.error(`Error adding tileset ${tileset.name}:`, e);
                }
            });
            
            // Detailed error logging if no tilesets are added
            if (addedTilesets.length === 0) {
                console.error('No tilesets were added to the map. Available texture keys:', Object.keys(this.textures.list));
            } else {
                console.log(`Successfully added ${addedTilesets.length} tilesets to the map`);
            }
            
            // Create layers if tilesets were added
            if (addedTilesets.length > 0) {
                // Set map in tilemap system first so it can access it
                if (this.tilemapSystem) {
                    this.tilemapSystem.setMap(map);
                    
                    // Use the enhanced layer processing system to create all layers
                    console.log('Using enhanced layer processing system');
                    const processedLayers = this.tilemapSystem.processMapLayers(map, addedTilesets);
                    
                    // Process entities using the new EntityLayerSystem
                    if (this.entityLayerSystem) {
                        console.log('Processing map entities with EntityLayerSystem');
                        this.entityLayerSystem.processMapLayers(map);
                        
                        // Get player spawn point
                        const playerSpawn = this.entityLayerSystem.getPlayerSpawn();
                        if (playerSpawn) {
                            this.playerSpawnPoint = playerSpawn;
                            console.log('Found player spawn point:', this.playerSpawnPoint);
                        }
                        
                        // Get air pocket spawn points
                        const airPocketSpawns = this.entityLayerSystem.getAirPocketSpawns();
                        if (airPocketSpawns.length > 0) {
                            this.airPocketSpawnPoints = airPocketSpawns;
                            console.log(`Loaded ${airPocketSpawns.length} air pocket spawn points`);
                            
                            // Register air pockets with the air pocket system
                            if (this.airPocketSystem) {
                                airPocketSpawns.forEach(spawn => {
                                    this.airPocketSystem.registerAirPocket(
                                        spawn.x,
                                        spawn.y,
                                        spawn.width || 100,
                                        spawn.height || 100
                                    );
                                });
                            }
                        }
                    } else {
                        // Fallback to old object processing if EntityLayerSystem is not available
                        console.warn('EntityLayerSystem not available, using legacy object processing');
                        const objectData = this.tilemapSystem.processObjectLayers(map);
                        
                        if (objectData.playerSpawns.length > 0) {
                            this.playerSpawnPoint = {
                                x: objectData.playerSpawns[0].x,
                                y: objectData.playerSpawns[0].y
                            };
                        }
                        
                        if (objectData.airPockets.length > 0) {
                            // Process air pockets using old method
                            // ... existing air pocket processing code ...
                        }
                    }
                    
                    // Set world bounds
                    const bounds = {
                        width: map.widthInPixels,
                        height: map.heightInPixels
                    };
                    
                    // Debug log the world bounds being set
                    console.log('Setting world bounds to map dimensions:', bounds);
                    
                    // Store the map reference for access in other methods
                    this.map = map;
                    
                    this.physics.world.setBounds(0, 0, bounds.width, bounds.height);
                    
                    // Only set initial camera bounds here, detailed setup happens in setupCamera()
                    this.cameras.main.setBounds(0, 0, bounds.width, bounds.height);
                    console.log('Initial camera bounds set:', this.cameras.main.getBounds());
                    
                    // Initialize ambient bubbles with map dimensions
                    if (this.ambientBubbleSystem) {
                        console.log('Initializing ambient bubble system with dimensions:', bounds);
                        this.ambientBubbleSystem.createAmbientBubbles('bg_bubble1', bounds.width, bounds.height);
                        
                        // Verify the system is working
                        this.time.delayedCall(1000, () => {
                            console.log('Active bubbles count:', this.ambientBubbleSystem.bubbles.size);
                        });
                    } else {
                        console.error('Ambient bubble system not initialized!');
                    }
                    
                    // Set overall background color for the camera
                    this.cameras.main.setBackgroundColor('rgba(0, 0, 80, 1)');
                    
                    console.log('Tilemap creation complete');
                } else {
                    // Fallback to legacy layer creation if tilemapSystem is not available
                    console.warn('TilemapSystem not available, using legacy layer creation');
                    this.createLayersLegacy(map, addedTilesets);
                }
            } else {
                console.error('No tilesets were added to the map');
            }
        } catch (error) {
            console.error('Error in createTiledMap:', error);
            this.createFallbackMap();
        }
    }
    
    // Legacy layer creation method for backward compatibility
    createLayersLegacy(map, addedTilesets) {
        console.log('Available map layers:', map.layers.map(l => l.name));
        
        // Try force-creating all layers regardless of their type
        const tileLayerNames = ['Background', 'Background_sprites', 'Midground_sprites', 'Obstacles'];
        
        // Create each named layer directly
        tileLayerNames.forEach(layerName => {
            try {
                console.log(`Directly creating layer: ${layerName}`);
                
                // Force create the layer
                const layer = map.createLayer(layerName, addedTilesets);
                
                if (layer) {
                    // Configure based on layer name
                    const lowerName = layerName.toLowerCase();
                    
                    // Scale differently based on the exact layer name
                    if (layerName === 'Background') {
                        console.log(`Setting ${layerName} as main background layer`);
                        // Only scale the main Background layer
                        layer.setDepth(0)
                            .setScrollFactor(0.3) // Slower scrolling for background
                            .setScale(3.0) // Much larger scale to ensure full coverage
                            .setPosition(-map.tileWidth * 25, -map.tileHeight * 25); // Position far off-screen
                    } else if (layerName === 'Background_sprites') {
                        console.log(`Setting ${layerName} as background sprites layer`);
                        // Background sprites should remain at normal size
                        layer.setDepth(1)
                            .setScrollFactor(0.4) // Slight parallax effect
                            .setScale(1.0); // Normal scale
                    } else if (layerName === 'Midground_sprites') {
                        console.log(`Setting ${layerName} as midground layer`);
                        layer.setDepth(2)
                            .setScrollFactor(0.8) // Medium scrolling for midground
                            .setScale(1.0); // Normal scale
                    } else if (layerName === 'Obstacles') {
                        console.log(`Setting ${layerName} as obstacle layer`);
                        layer.setDepth(5)
                            .setScrollFactor(1.0) // Normal scrolling for gameplay elements
                            .setScale(1.0); // Normal scale - important for collisions
                        layer.setCollisionByExclusion([-1]);
                    } else {
                        console.log(`Setting ${layerName} as default layer`);
                        layer.setDepth(1)
                            .setScrollFactor(1.0)
                            .setScale(1.0);
                    }
                    
                    // Make layer visible
                    layer.setVisible(true).setAlpha(1);
                    
                    // Register with tilemap system
                    if (this.tilemapSystem) {
                        this.tilemapSystem.registerLayer(layerName, layer);
                        console.log(`Registered layer ${layerName} with tilemap system`);
                    }
                } else {
                    console.error(`Failed to create layer: ${layerName}`);
                }
            } catch (err) {
                console.error(`Error creating layer ${layerName}:`, err);
            }
        });
        
        // Process object layers
        if (map.objects) {
            map.objects.forEach(objectLayer => {
                if (objectLayer.name.toLowerCase().includes('airpocket')) {
                    objectLayer.objects.forEach(obj => {
                        if (this.airPocketSystem) {
                            this.airPocketSystem.registerAirPocket(obj.x, obj.y, obj.width || 100, obj.height || 100);
                        }
                    });
                } else if (objectLayer.name.toLowerCase().includes('spawn')) {
                    objectLayer.objects.forEach(obj => {
                        if (obj.name && obj.name.toLowerCase().includes('player')) {
                            this.playerSpawnPoint = { x: obj.x, y: obj.y };
                        }
                    });
                }
            });
        }
    }

    setupPlayer() {
        try {
            console.log('Setting up player...');
            
            // Get spawn position
            let spawnX = 100, spawnY = 100;
            if (this.playerSpawnPoint) {
                spawnX = this.playerSpawnPoint.x;
                spawnY = this.playerSpawnPoint.y;
            }
            
            // Create player through the player system
            if (this.playerSystem) {
                this.player = this.playerSystem.createPlayer(spawnX, spawnY);
                
                if (this.player && this.player.sprite) {
                    // Set up player physics
                    this.player.sprite.setCollideWorldBounds(true);
                    
                    // Make sure player has correct scale and is visible
                    this.player.sprite.setScale(1.0);
                    this.player.sprite.setVisible(true);
                    this.player.sprite.setDepth(25); // Ensure player is above ALL other elements including overlays
                    
                    // Log animation status - this should now show the animation exists
                    if (this.anims.exists(ANIMATIONS.IDLE_SWIM.KEY)) {
                        console.log('Player animation exists, playing...');
                        this.player.sprite.play(ANIMATIONS.IDLE_SWIM.KEY);
                    } else {
                        console.error('Animation still missing after setup!');
                    }
                    
                    // Explicitly create helmet bubbles
                    this.player.createMaskBubbles();
                    
                    // Listen for player boost events to create particles
                    this.player.on('boostBurst', (sprite, direction) => {
                        this.createBoostParticles(sprite, direction);
                    });
                    
                    // Listen for camera shake events
                    this.player.on('cameraShake', (duration, intensity) => {
                        if (this.gameSceneCamera) {
                            this.gameSceneCamera.shake(duration, intensity);
                        }
                    });
                    
                    console.log('Player setup complete');
                } else {
                    console.error('Failed to create player sprite');
                }
            } else {
                console.error('PlayerSystem not initialized');
            }
        } catch (error) {
            console.error('Error in setupPlayer:', error);
        }
    }

    createBoostParticles(player, direction, isHighSpeedBoost = false) {
        try {
            if (!player || !this.particleSystem) {
                console.warn('Cannot create boost particles: player or particleSystem not available');
                return;
            }
            
            console.log('Creating boost particles:', { direction, isHighSpeedBoost });
            
            // Use particle system to create boost effects
            this.particleSystem.emitBoostBurst(player, 'bubble', direction, isHighSpeedBoost);
            
            // Add camera shake when boosting
            if (this.gameSceneCamera) {
                const intensity = isHighSpeedBoost ? 
                    CAMERA.SHAKE.INTENSITY * 1.5 : 
                    CAMERA.SHAKE.INTENSITY;
                
                const duration = isHighSpeedBoost ? 
                    CAMERA.SHAKE.DURATION * 1.2 : 
                    CAMERA.SHAKE.DURATION;
                    
                this.gameSceneCamera.shake(duration, intensity);
            }
        } catch (error) {
            console.error('Error creating boost particles:', error);
        }
    }

    setupControls() {
        this.setupKeyboardControls();
        
        // Initialize touch control system
        this.touchControlSystem = new TouchControlSystem(this);
        this.touchControlSystem.initialize();
        this.touchControlSystem.setVisible(this.touchControlsEnabled);
    }

    setupKeyboardControls() {
        this.cursors = this.input.keyboard.createCursorKeys();
        
        this.keys = {
            up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            boost: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        };
        
        this.wasdKeys = this.keys;
    }

    setupCollisions() {
        try {
            console.log('Setting up collisions...');

            // Setup obstacle collisions if tilemap system exists
            if (this.tilemapSystem) {
                // Find the obstacles layer
                const obstaclesLayer = Object.values(this.tilemapSystem.layers || {}).find(layer => 
                    layer.layer?.name?.toLowerCase().includes('obstacle')
                );
                
                if (obstaclesLayer && this.player?.sprite) {
                    // Enable collisions on the obstacles layer
                    obstaclesLayer.setCollisionByExclusion([-1]);
                    
                    // Add collider between player and obstacles
                    this.physics.add.collider(this.player.sprite, obstaclesLayer);
                    console.log('Player-obstacle collisions set up');
                }
            }
            
            // Setup air pocket collisions if system exists
            if (this.airPocketSystem && this.player) {
                this.airPocketSystem.setupPlayerOverlap(this.player);
                console.log('Air pocket collisions set up');
            }
            
            // Initialize collision system if not already done
            if (!this.collisionSystem) {
                this.collisionSystem = new CollisionSystem(this);
            }

            console.log('Collision setup complete');
        } catch (error) {
            console.error('Error setting up collisions:', error);
        }
    }

    handlePlayerEnemyCollision(playerSprite, enemy) {
        if (!enemy.isAlive) return;
        
        // Update player health
        const damage = 20;
        if (this.healthSystem) {
            this.healthSystem.takeDamage(damage);
        }
        
        // Add screen shake effect
        this.cameras.main.shake(100, 0.01);
        
        // Knockback effect on player
        const knockbackForce = 200;
        const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, playerSprite.x, playerSprite.y);
        playerSprite.body.velocity.x += Math.cos(angle) * knockbackForce;
        playerSprite.body.velocity.y += Math.sin(angle) * knockbackForce;

        // Add invulnerability frames to prevent multiple hits
        playerSprite.setTint(0xff0000);
        this.time.delayedCall(500, () => {
            if (playerSprite && playerSprite.active) {
                playerSprite.clearTint();
            }
        });
    }

    update(time, delta) {
        if (!this.gameRunning) return;
        
        if (this.player) {
            this.player.update(time, delta);
            if (this.oxygenMeter?.updateOxygen) {
                this.oxygenMeter.updateOxygen(this.player.oxygen, this.player.maxOxygen);
            }
        }
        
        // Update systems
        [
            this.oxygenMeter,
            this.gameSceneCamera,
            this.airPocketSystem,
            this.collisionSystem,
            this.ambientBubbleSystem,
            this.bulletSystem,
            this.healthSystem,
            this.uiSystem,
            this.touchControlSystem,
            this.gameSceneUI
        ].forEach(system => {
            if (system?.update) system.update(time, delta);
        });

        // Update enemy system
        if (this.enemySystem) {
            this.enemySystem.update(time, delta);
        }

        // Get touch input state
        this.touchData = this.touchControlSystem?.getInputState() || this.touchData;
    }

    cleanup() {
        this.events.off('resize');
        this.events.off('playerOxygenChanged');
        
        [
            this.tilemapSystem,
            this.airPocketSystem,
            this.playerSystem,
            this.player,
            this.oxygenMeter,
            this.healthSystem,
            this.gameSceneCamera
        ].forEach(system => {
            if (system?.destroy) system.destroy();
        });
        
        this.tilemapSystem = null;
        this.airPocketSystem = null;
        this.playerSystem = null;
        this.player = null;
        this.oxygenMeter = null;
        this.healthSystem = null;
        this.gameSceneCamera = null;
    }

    shutdown() {
        console.log('GameScene shutting down');
        
        // Clean up physics
        if (this.physics.world.colliders) {
            this.physics.world.colliders.destroy();
        }
        
        // Clean up systems
        [
            this.ambientBubbleSystem,
            this.uiSystem,
            this.touchControlSystem,
            this.gameSceneUI
        ].forEach(system => {
            if (system?.destroy) {
                system.destroy();
                system = null;
            }
        });
        
        // Clean up other resources
        this.gameRunning = false;
        
        // Call super.shutdown after cleanup
        super.shutdown();
    }
    
    pause() {
        console.log('GameScene paused');
        
        // Pause ambient bubbles
        if (this.ambientBubbleSystem) {
            this.ambientBubbleSystem.pause();
        }
        
        this.gameRunning = false;
        super.pause();
    }
    
    resume() {
        console.log('GameScene resumed');
        
        // Resume ambient bubbles
        if (this.ambientBubbleSystem) {
            this.ambientBubbleSystem.resume();
        }
        
        this.gameRunning = true;
        super.resume();
    }

    getInputState() {
        // Only process touch input if enabled
        if (!this.touchControlsEnabled) {
            this.touchData = { startX: 0, startY: 0, isMoving: false };
        }
        return this.touchData;
    }

    /**
     * Check if a position is valid for spawning an air pocket
     * @param {number} x - X position to check
     * @param {number} y - Y position to check
     * @returns {boolean} True if the position is valid
     */
    isPositionValid(x, y) {
        // If no tilemap system or no obstacles layer, assume position is valid
        if (!this.tilemapSystem || !this.tilemapSystem.layers) {
            return true;
        }
        
        // Try to find obstacles layer with case-insensitive check
        const obstaclesLayerKey = 
            // First check if we already have a direct 'obstacles' key
            this.tilemapSystem.layers.obstacles ? 'obstacles' :
            // Then check capitalized version
            this.tilemapSystem.layers.Obstacles ? 'Obstacles' :
            // Then try to find any key that includes 'obstacle'
            Object.keys(this.tilemapSystem.layers)
                .find(key => key.toLowerCase().includes('obstacle'));
                
        if (!obstaclesLayerKey) {
            return true;
        }
        
        const obstaclesLayer = this.tilemapSystem.layers[obstaclesLayerKey];
        if (!obstaclesLayer) {
            return true;
        }
        
        // Convert pixel coordinates to tile coordinates
        const tileX = Math.floor(x / this.tilemapSystem.map.tileWidth);
        const tileY = Math.floor(y / this.tilemapSystem.map.tileHeight);
        
        // Get the tile at this position
        const tile = obstaclesLayer.getTileAt(tileX, tileY);
        
        // Position is valid if there's no tile (empty space)
        return !tile || tile.index === -1;
    }

    /**
     * Create a single air pocket at the specified position
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} variation - Air pocket variation (1-3)
     * @returns {Object} The created air pocket
     */
    createSingleAirPocket(x, y, variation = 1) {
        if (!this.airPocketSystem) {
            console.warn('Cannot create air pocket - system not initialized');
            return null;
        }
        
        // Create the air pocket through the air pocket system
        return this.airPocketSystem.createAirPocket(x, y, {
            type: variation,
            variation: variation
        });
    }

    adjustBackgroundLayers() {
        try {
            console.log('Adjusting background layers...');
            
            // Get the world dimensions
            const worldBounds = this.tilemapSystem?.map ? {
                width: this.tilemapSystem.map.widthInPixels,
                height: this.tilemapSystem.map.heightInPixels
            } : {
                width: this.physics.world.bounds.width,
                height: this.physics.world.bounds.height
            };
            
            // Get camera dimensions 
            const cameraWidth = this.cameras.main.width;
            const cameraHeight = this.cameras.main.height;
            
            // Create a solid background color first to ensure no black areas
            if (!this.backgroundRect) {
                // Create a massive background rectangle that completely fills the view
                this.backgroundRect = this.add.rectangle(
                    -cameraWidth, -cameraHeight, 
                    worldBounds.width + (cameraWidth * 3), 
                    worldBounds.height + (cameraHeight * 3),
                    0x000044 // Darker blue for the base background
                );
                this.backgroundRect.setOrigin(0, 0);
                this.backgroundRect.setDepth(-10);
                this.backgroundRect.setScrollFactor(0.05); // Very slow parallax effect
                console.log('Added massive background rectangle with darker color');
            }
            
            // Configure tilemap layers if available
            if (this.tilemapSystem?.layers) {
                console.log('Found tilemap layers to adjust:', Object.keys(this.tilemapSystem.layers));
                
                Object.entries(this.tilemapSystem.layers).forEach(([name, layer]) => {
                    if (!layer) {
                        console.warn(`Layer ${name} is null or undefined`);
                        return;
                    }
                    
                    // Make sure all layers are visible
                    layer.setVisible(true);
                    
                    // Configure layers based on their exact name, not just substring matching
                    if (name === 'Background') {
                        console.log(`Adjusting main background layer: ${name}`);
                        // Fix grid-line shimmering by:
                        // 1. Using a fixed scroll factor (0.0)
                        // 2. Removing screen blend mode to preserve dark colors
                        // 3. Making it fully opaque to show original colors
                        
                        // Clear any existing tweens on this layer
                        this.tweens.killTweensOf(layer);
                        
                        layer.setDepth(0)
                            .setScrollFactor(0.0) // Completely fixed to eliminate shimmering
                            .setScale(4.0) // Large scale but no animation
                            .setPosition(-cameraWidth, -cameraHeight) // Position far off-screen
                            .setAlpha(1.0) // Fully opaque to show original dark colors
                            .setBlendMode(Phaser.BlendModes.NORMAL); // Normal blend mode to preserve colors
                        
                    } else if (name === 'Background_sprites') {
                        console.log(`Adjusting background sprites layer: ${name}`);
                        layer.setDepth(1)
                            .setScrollFactor(0.3) // Slight parallax
                            .setScale(1.0) // Normal scale
                            .setAlpha(1.0); // Fully opaque
                    } else if (name === 'Midground_sprites') {
                        console.log(`Adjusting midground layer: ${name}`);
                        layer.setDepth(5)
                            .setScrollFactor(0.7) // Medium parallax
                            .setScale(1.0) // Normal scale
                            .setAlpha(1.0);
                    } else if (name === 'Obstacles') {
                        console.log('Adjusting Obstacles layer in GameScene');
                        layer.setDepth(40)  // Standardized to 40 to match TilemapSystem
                            .setScrollFactor(1.0)
                            .setScale(1.0)
                            .setAlpha(1.0);
                        console.log('Obstacles layer adjusted:', {
                            depth: layer.depth,
                            visible: layer.visible,
                            alpha: layer.alpha,
                            scrollFactor: layer.scrollFactorX
                        });
                    } else {
                        console.log(`Adjusting default layer: ${name}`);
                        layer.setDepth(1)
                            .setScrollFactor(1.0)
                            .setScale(1.0)
                            .setAlpha(1.0);
                    }
                });
                
                console.log('Background layers adjusted successfully');
            } else {
                console.warn('No tilemap layers available to adjust');
            }
            
            // Make sure player is visible and on top with normal scale
            if (this.player?.sprite) {
                this.player.sprite.setVisible(true)
                    .setDepth(25)
                    .setScale(1.0); // Ensure player maintains normal scale
                console.log('Player depth set to 25');
            }
        } catch (error) {
            console.error('Error adjusting background layers:', error);
        }
    }
} 