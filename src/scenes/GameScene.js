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
import mapConfig from '../config/mapConfig.json';
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
import flashlightCone1Img from '../assets/flashlight_cone1.png'; // Import custom flashlight mask

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
import BackgroundSystem from '../systems/BackgroundSystem';
import LightingSystem from '../systems/LightingSystem';

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
        this.backgroundSystem = null;
        this.lightingSystem = null;
        
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
            
            // Add map configuration to cache
            this.cache.json.add('mapConfig', mapConfig);
            
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
            
            // Load custom flashlight mask image
            this.load.image('flashlight_cone1', flashlightCone1Img);
            
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
            // Initialize background system first
            this.backgroundSystem = new BackgroundSystem(this);
            this.backgroundSystem.createFullScreenBackground();
            
            // Initialize all systems
            this.setupSystems();
            
            // Create the map
            this.createTiledMap();
            
            // Setup player after map creation
            this.setupPlayer();
            
            // Setup controls
            this.setupControls();
            
            // Initialize camera and UI after everything is set up
            this.gameSceneCamera.initialize();
            this.gameSceneUI.initialize();
            
            // Setup collisions last
            this.setupCollisions();
            
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
                this.backgroundSystem?.handleResize();
                this.uiSystem?.handleResize();
                this.lightingSystem?.handleResize();
            });
            
            // Add flashlight key binding
            this.input.keyboard.on('keydown-F', () => {
                if (this.lightingSystem) {
                    // Toggle flashlight with the custom mask
                    this.lightingSystem.toggleFlashlight('flashlight_cone1');
                }
            });
            
            console.log('GameScene initialization complete');
        } catch (error) {
            console.error('Error in create:', error);
        }
    }
    
    setupSystems() {
        try {
            // Initialize camera system first
            this.gameSceneCamera = new GameSceneCamera(this);
            
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
            
            // Initialize player system
            this.playerSystem = new PlayerSystem(this);
            
            // Initialize air pocket system after player
            this.airPocketSystem = new AirPocketSystem(this, this.player);
            this.airPocketSystem.setDebugVisualsEnabled(true);
            
            // Initialize enemy system
            this.enemySystem = new EnemySystem(this);
            
            // Initialize lighting system
            this.lightingSystem = new LightingSystem(this);
            
            // Set the custom flashlight mask
            this.lightingSystem.setCustomFlashlightMask('flashlight_cone1');
            
            // Initialize UI
            this.gameSceneUI = new GameSceneUI(this);
            
            // Make sure the bullet system has proper references
            this.bulletSystem.init();
            
            console.log('All systems initialized successfully');
        } catch (error) {
            console.error('Error in setupSystems:', error);
        }
    }

    setupAnimations() {
        try {
            console.log('Setting up animations...');
            
            if (!this.animationSystem) {
                console.warn('Animation system not initialized, skipping animation setup');
                return;
            }

            // Track which animations we need to create
            const requiredAnimations = [
                { key: ANIMATIONS.IDLE_SWIM.KEY, status: false }
            ];
            
            // First remove any existing animations to prevent conflicts
            requiredAnimations.forEach(({ key }) => {
                if (this.anims.exists(key)) {
                    console.log(`Removing existing animation: ${key}`);
                    this.anims.remove(key);
                }
            });
            
            // Create animations using both methods for redundancy
            requiredAnimations.forEach(animation => {
                try {
                    // Try specific animation creation first
                    const success = this.animationSystem.createPlayerSwimAnimation('idle_swim_full');
                    animation.status = this.anims.exists(animation.key);
                    
                    // If specific creation failed, try master method
                    if (!animation.status) {
                        console.log(`Specific animation creation failed for ${animation.key}, trying master method...`);
                        this.animationSystem.createAnimations();
                        animation.status = this.anims.exists(animation.key);
                    }
                    
                    console.log(`Animation ${animation.key} creation ${animation.status ? 'succeeded' : 'failed'}`);
                } catch (err) {
                    console.error(`Error creating animation ${animation.key}:`, err);
                }
            });
            
            // Final verification
            const missingAnimations = requiredAnimations.filter(a => !a.status).map(a => a.key);
            if (missingAnimations.length > 0) {
                console.error('Failed to create animations:', missingAnimations);
            } else {
                console.log('All animations created successfully');
            }
            
        } catch (error) {
            console.error('Error in setupAnimations:', error);
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

            // After map is created and all the setup has been done:
            if (this.lightingSystem) {
                console.log('Initializing lighting system with map');
                
                // Create a lighting overlay sized to the camera
                this.lightingSystem.createOverlay();
                
                // Process Lighting layer from the Tiled map
                this.lightingSystem.processLightingZones(map);
                
                // Process Light objects from the Tiled map (for point lights)
                this.lightingSystem.processLightObjects(map);
                
                // Give the lighting system access to the map
                this.map = map;
                
                // Enable lighting system debug
                if (this.physics.config.debug) {
                    console.log('Lighting zones created:', this.lightingSystem.lightingZones.length);
                    
                    // Display any active lighting zones
                    if (this.lightingSystem.lightingZones.length > 0) {
                        this.lightingSystem.lightingZones.forEach((zone, index) => {
                            console.log(`Zone ${index}: ${zone.type} at (${zone.x}, ${zone.y}), size: ${zone.width}x${zone.height}`);
                        });
                    }
                }
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
                        // Use particle system directly
                        if (this.particleSystem) {
                            this.particleSystem.emitBoostBurst(sprite, 'bubble', direction);
                        }
                        
                        // Keep camera shake in GameScene
                        if (this.gameSceneCamera) {
                            this.gameSceneCamera.shake(
                                CAMERA.SHAKE.DURATION,
                                CAMERA.SHAKE.INTENSITY
                            );
                        }
                    });
                    
                    // Listen for camera shake events
                    this.player.on('cameraShake', (duration, intensity) => {
                        if (this.gameSceneCamera) {
                            this.gameSceneCamera.shake(duration, intensity);
                        }
                    });
                    
                    // Connect to lighting system
                    if (this.lightingSystem) {
                        console.log('Connecting player to lighting system');
                        this.lightingSystem.setPlayer(this.player);
                    }
                    
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

    setupControls() {
        this.setupKeyboardControls();
        
        // Initialize touch control system
        this.touchControlSystem = new TouchControlSystem(this);
        this.touchControlSystem.initialize();
        this.touchControlSystem.setVisible(this.touchControlsEnabled);
    }

    setupKeyboardControls() {
        this.cursors = this.input.keyboard.createCursorKeys();
        
        // Initialize both arrow and WASD controls in a single object
        this.keys = {
            up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            boost: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
            // Add arrow keys as alternative controls
            upArrow: this.cursors.up,
            downArrow: this.cursors.down,
            leftArrow: this.cursors.left,
            rightArrow: this.cursors.right
        };
        
        // For backward compatibility
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
        
        // Update player and oxygen first since they're critical
        if (this.player) {
            this.player.update(time, delta);
            // Only update oxygen if meter exists and has update method
            this.oxygenMeter?.updateOxygen?.(this.player.oxygen, this.player.maxOxygen);
        }
        
        // Update core gameplay systems
        this.gameSceneCamera?.update?.(time, delta);
        this.airPocketSystem?.update?.(time, delta);
        this.collisionSystem?.update?.(time, delta);
        
        // Update visual and effect systems
        this.ambientBubbleSystem?.update?.(time, delta);
        this.bulletSystem?.update?.(time, delta);
        
        // Update UI and input systems
        this.healthSystem?.update?.(time, delta);
        this.uiSystem?.update?.(time, delta);
        this.touchControlSystem?.update?.(time, delta);
        this.gameSceneUI?.update?.(time, delta);

        // Update enemy system last to ensure all other systems are updated first
        this.enemySystem?.update?.(time, delta);

        // Update touch input state
        this.touchData = this.touchControlSystem?.getInputState() || this.touchData;

        // Get the player's current direction based on keyboard input
        let playerRotation = null;
        
        if (this.cursors) {
            if (this.cursors.left.isDown) {
                playerRotation = Math.PI; // Left = 180 degrees
            } else if (this.cursors.right.isDown) {
                playerRotation = 0; // Right = 0 degrees
            } else if (this.cursors.up.isDown) {
                playerRotation = -Math.PI/2; // Up = -90 degrees
            } else if (this.cursors.down.isDown) {
                playerRotation = Math.PI/2; // Down = 90 degrees
            }
            
            // Handle diagonals
            if (this.cursors.up.isDown && this.cursors.right.isDown) {
                playerRotation = -Math.PI/4; // Up-Right = -45 degrees
            } else if (this.cursors.up.isDown && this.cursors.left.isDown) {
                playerRotation = -3*Math.PI/4; // Up-Left = -135 degrees
            } else if (this.cursors.down.isDown && this.cursors.right.isDown) {
                playerRotation = Math.PI/4; // Down-Right = 45 degrees
            } else if (this.cursors.down.isDown && this.cursors.left.isDown) {
                playerRotation = 3*Math.PI/4; // Down-Left = 135 degrees
            }
        }
        
        // Only update the player's rotation if we have a valid direction
        if (playerRotation !== null) {
            // Store the rotation on the player object
            this.player.rotation = playerRotation;
        }
        
        // Check if player's sprite flipX needs to be updated based on movement
        if (this.player && this.player.sprite) {
            // If player is moving left
            if (this.cursors.left.isDown || this.keys.left.isDown) {
                // If player wasn't already facing left
                if (!this.player.sprite.flipX) {
                    // Update the player sprite and flashlight immediately
                    this.player.sprite.flipX = true;
                    
                    // Update flashlight rotation if enabled
                    if (this.lightingSystem && this.lightingSystem.flashlightEnabled) {
                        this.lightingSystem.flashlightRotation = Math.PI; // left
                        this.lightingSystem.updateFlashlightCone();
                    }
                }
            }
            // If player is moving right
            else if (this.cursors.right.isDown || this.keys.right.isDown) {
                // If player wasn't already facing right
                if (this.player.sprite.flipX) {
                    // Update the player sprite and flashlight immediately
                    this.player.sprite.flipX = false;
                    
                    // Update flashlight rotation if enabled
                    if (this.lightingSystem && this.lightingSystem.flashlightEnabled) {
                        this.lightingSystem.flashlightRotation = 0; // right
                        this.lightingSystem.updateFlashlightCone();
                    }
                }
            }
        }
        
        // Update the lighting system
        if (this.lightingSystem) {
            this.lightingSystem.update(delta);
        }
    }

    cleanup() {
        try {
            console.log('Starting GameScene cleanup...');
            
            // Remove event listeners first
            this.events.off('resize');
            this.events.off('playerOxygenChanged');
            
            // Define all systems that need cleanup
            const systemsToCleanup = [
                { system: this.backgroundSystem, name: 'BackgroundSystem' },
                { system: this.tilemapSystem, name: 'TilemapSystem' },
                { system: this.airPocketSystem, name: 'AirPocketSystem' },
                { system: this.playerSystem, name: 'PlayerSystem' },
                { system: this.player, name: 'Player' },
                { system: this.oxygenMeter, name: 'OxygenMeter' },
                { system: this.healthSystem, name: 'HealthSystem' },
                { system: this.gameSceneCamera, name: 'GameSceneCamera' }
            ];
            
            // Clean up each system
            systemsToCleanup.forEach(({ system, name }) => {
                try {
                    if (system?.destroy) {
                        system.destroy();
                        console.log(`Cleaned up ${name}`);
                    }
                } catch (err) {
                    console.warn(`Error cleaning up ${name}:`, err);
                }
            });
            
            // Null out references
            this.tilemapSystem = null;
            this.airPocketSystem = null;
            this.playerSystem = null;
            this.player = null;
            this.oxygenMeter = null;
            this.healthSystem = null;
            this.gameSceneCamera = null;
            
            console.log('GameScene cleanup completed');
        } catch (error) {
            console.error('Error in cleanup:', error);
        }
    }

    shutdown() {
        try {
            console.log('GameScene shutting down...');
            
            // Clean up physics first
            if (this.physics.world.colliders) {
                this.physics.world.colliders.destroy();
                console.log('Physics colliders cleaned up');
            }
            
            // Define remaining systems to clean up
            const remainingSystems = [
                { system: this.ambientBubbleSystem, name: 'AmbientBubbleSystem' },
                { system: this.uiSystem, name: 'UISystem' },
                { system: this.touchControlSystem, name: 'TouchControlSystem' },
                { system: this.gameSceneUI, name: 'GameSceneUI' },
                { system: this.particleSystem, name: 'ParticleSystem' },
                { system: this.enemySystem, name: 'EnemySystem' },
                { system: this.bulletSystem, name: 'BulletSystem' },
                { system: this.audioSystem, name: 'AudioSystem' }
            ];
            
            // Clean up remaining systems
            remainingSystems.forEach(({ system, name }) => {
                try {
                    if (system?.destroy) {
                        system.destroy();
                        console.log(`Cleaned up ${name}`);
                    }
                } catch (err) {
                    console.warn(`Error cleaning up ${name}:`, err);
                }
            });
            
            // Stop all game loops and timers
            this.gameRunning = false;
            
            // Clear any remaining tweens
            this.tweens.killAll();
            
            // Clear any remaining timers
            this.time.removeAllEvents();
            
            // Call parent class shutdown
            super.shutdown();
            
            console.log('GameScene shutdown completed');
        } catch (error) {
            console.error('Error in shutdown:', error);
            // Still try to call parent shutdown even if we had errors
            super.shutdown();
        }
    }
    
    pause() {
        try {
            console.log('GameScene pausing...');
            
            // Set game state first
            this.gameRunning = false;
            
            // Pause all active systems
            const systemsToPause = [
                { system: this.ambientBubbleSystem, name: 'AmbientBubbleSystem' },
                { system: this.particleSystem, name: 'ParticleSystem' },
                { system: this.enemySystem, name: 'EnemySystem' },
                { system: this.bulletSystem, name: 'BulletSystem' },
                { system: this.audioSystem, name: 'AudioSystem' }
            ];
            
            systemsToPause.forEach(({ system, name }) => {
                try {
                    if (system?.pause) {
                        system.pause();
                        console.log(`Paused ${name}`);
                    }
                } catch (err) {
                    console.warn(`Error pausing ${name}:`, err);
                }
            });
            
            // Pause any active tweens
            this.tweens.pauseAll();
            
            // Call parent pause last
            super.pause();
            
            console.log('GameScene paused successfully');
        } catch (error) {
            console.error('Error in pause:', error);
            // Ensure game state is set even if error occurs
            this.gameRunning = false;
        }
    }
    
    resume() {
        try {
            console.log('GameScene resuming...');
            
            // Resume all active systems
            const systemsToResume = [
                { system: this.ambientBubbleSystem, name: 'AmbientBubbleSystem' },
                { system: this.particleSystem, name: 'ParticleSystem' },
                { system: this.enemySystem, name: 'EnemySystem' },
                { system: this.bulletSystem, name: 'BulletSystem' },
                { system: this.audioSystem, name: 'AudioSystem' }
            ];
            
            systemsToResume.forEach(({ system, name }) => {
                try {
                    if (system?.resume) {
                        system.resume();
                        console.log(`Resumed ${name}`);
                    }
                } catch (err) {
                    console.warn(`Error resuming ${name}:`, err);
                }
            });
            
            // Resume any paused tweens
            this.tweens.resumeAll();
            
            // Set game state
            this.gameRunning = true;
            
            // Call parent resume last
            super.resume();
            
            console.log('GameScene resumed successfully');
        } catch (error) {
            console.error('Error in resume:', error);
            // Ensure game state is set even if error occurs
            this.gameRunning = true;
        }
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
            // Let the background system handle all layer adjustments
            this.backgroundSystem?.adjustLayers(this.tilemapSystem);
            
            // Ensure player is visible and on top
            if (this.player?.sprite) {
                this.player.sprite.setVisible(true)
                    .setDepth(25)
                    .setScale(1.0);
            }
        } catch (error) {
            console.error('Error adjusting background layers:', error);
        }
    }
} 