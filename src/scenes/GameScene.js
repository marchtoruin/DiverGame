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
import airPocket1Img from '../assets/air_pocket1.png';
import airPocket2Img from '../assets/air_pocket2.png';
import airPocket3Img from '../assets/air_pocket3.png';
import bgMusic from '../assets/music/bg_music.mp3';
import ambienceMusic from '../assets/music/ambience_underwater.wav';
import heartImg from '../assets/heart.png';
import badFishImg from '../assets/enemies/badFish01.png';
import seaweedImg from '../assets/seaweed.png'; // Add seaweed tileset
import flashlightCone1Img from '../assets/flashlight_cone1.png'; // Import custom flashlight mask
import new_idle_swimImg from '../assets/new_idle_swim.png'; // Import new player spritesheet
import batteryImg from '../assets/battery.png';
import jellyFishImg from '../assets/jelly_fish.png'; // Import jellyfish sprite with underscore
import jellyChargeImg from '../assets/jelly_charge.png'; // Import jellyfish battery charge pickup sprite with underscore
import armsImg from '../assets/arms.png';
import armsLeftImg from '../assets/arms_left.png'; // Import left-facing arm sprite

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
import GameStateManager from '../systems/GameStateManager';
import BatterySystem from '../systems/BatterySystem';
import JellyfishSystem from '../systems/JellyfishSystem';

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
        this.jellyfishSystem = null;
        
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
            
            // CRITICAL: Also add the raw level data to the json cache for AirPocketSystem
            if (!this.cache.json.has('level1')) {
                this.cache.json.add('level1', level1Data);
                console.log('Added level1 data to json cache for AirPocketSystem');
            }
            
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
            this.load.image('battery', batteryImg);

            // CRITICAL: Make sure the spritesheet loads BEFORE it's needed
            // Load with all possible options to avoid frame/dimensions issues
            console.log('Loading player spritesheet upfront with forced options');
            
            // Add texture-specific loading event listener to create animations only after textures are loaded
            this.load.on('filecomplete-spritesheet-diver_swim_new', function() {
                console.log('✅ diver_swim_new spritesheet loaded successfully!');
                const texture = this.textures.get('diver_swim_new');
                console.log('Texture details on load:', 
                    'frameTotal:', texture.frameTotal,
                    'dimensions:', texture.source[0].width, 'x', texture.source[0].height);
                
                // Store a flag to indicate the spritesheet is ready
                this.diverSpritesheetLoaded = true;
            }, this);
            
            this.load.on('filecomplete', function(key) {
                console.log('File loaded:', key);
            });
            
            // Load the player sprite sheet with exact dimensions (1048px total width, 8 frames at 131x150)
            console.log('Loading player sprite sheet with 131x150 frames');
            this.load.spritesheet('diver_swim_new', new_idle_swimImg, { 
                frameWidth: 131,     // Each frame is exactly 131px wide
                frameHeight: 150,    // Each frame is exactly 150px tall
                startFrame: 0,       // Start at the first frame
                endFrame: 7,         // 8 frames total (0-7)
                spacing: 0,          // No spacing between frames
                margin: 0            // No margin around frames
            });
            
            this.load.image('bubble', bubbleImg);
            this.load.image('heart', heartImg);
            
            // Load enemy assets
            this.load.image('badFish', badFishImg);
            
            // Load jellyfish and charge pickup
            this.load.image('jelly_fish', jellyFishImg);
            this.load.image('jelly_charge', jellyChargeImg);
            
            // Load all background bubble variations
            this.load.image('bg_bubble1', bgBubble1Img);
            this.load.image('bg_bubble2', bgBubble2Img);
            this.load.image('bg_bubble3', bgBubble3Img);
            
            // Load bullet sprite
            this.load.image('bullet', bulletImg);
            
            // Load custom flashlight mask image
            this.load.image('flashlight_cone1', flashlightCone1Img);
            
            // Load arms sprite for the diver
            this.load.image('arms', armsImg);
            this.load.image('arms_left', armsLeftImg);
            this.load.on('filecomplete-image-arms', () => {
                console.log('[DEBUG] arms.png loaded');
                this.findArmPivotPoint();
            });
            this.load.on('filecomplete-image-arms_left', () => {
                console.log('[DEBUG] arms_left.png loaded successfully!');
                if (this.armPivot && !this.armPivotLeft) {
                    // If the right arm pivot is already found but not the left one
                    this.findPivotInTexture('arms_left', 'armPivotLeft');
                }
            });
            
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

    /**
     * Finds the magenta pivot point marker (#fb00ff) in the arms sprite
     * and stores the normalized origin coordinates
     */
    findArmPivotPoint() {
        try {
            if (!this.textures.exists('arms')) {
                console.error('[ARM PIVOT] Arms texture not available yet');
                return;
            }

            console.log('[ARM PIVOT] Scanning arms texture for magenta pivot marker...');
            this.findPivotInTexture('arms');
            
            // Also scan the left-facing arm if it exists
            if (this.textures.exists('arms_left')) {
                console.log('[ARM PIVOT] Scanning arms_left texture for magenta pivot marker...');
                this.findPivotInTexture('arms_left', 'armPivotLeft');
            }
        } catch (error) {
            console.error('[ARM PIVOT] Error analyzing arms texture:', error);
            // Default fallback values
            this.armPivot = { x: 0.0, y: 0.5, pixelX: 0, pixelY: 0 };
            this.armPivotLeft = { x: 1.0, y: 0.5, pixelX: 0, pixelY: 0 };
        }
    }
    
    /**
     * Scans a texture for the magenta pivot marker and stores the normalized coordinates
     * @param {string} textureKey - The key of the texture to scan
     * @param {string} storageProperty - The property name to store the result (defaults to 'armPivot')
     */
    findPivotInTexture(textureKey, storageProperty = 'armPivot') {
        try {
            // Get the texture
            const texture = this.textures.get(textureKey);
            const frame = texture.getFrameNames()[0] || '__BASE';
            
            // Create a temporary canvas to get pixel data
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Get image dimensions
            const source = texture.getSourceImage();
            const width = source.width;
            const height = source.height;
            
            // Set canvas size
            canvas.width = width;
            canvas.height = height;
            
            // Draw the image onto canvas
            ctx.drawImage(source, 0, 0);
            
            // Get image data - all pixels
            const imageData = ctx.getImageData(0, 0, width, height).data;
            
            // Target color - magenta #fb00ff (251, 0, 255)
            const targetR = 251;
            const targetG = 0;
            const targetB = 255;
            
            // Look for the magenta pixel
            let pivotX = -1;
            let pivotY = -1;
            
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const index = (y * width + x) * 4;
                    const r = imageData[index];
                    const g = imageData[index + 1];
                    const b = imageData[index + 2];
                    
                    // Check if this pixel matches the magenta color
                    if (r === targetR && g === targetG && b === targetB) {
                        pivotX = x;
                        pivotY = y;
                        console.log(`[ARM PIVOT] Found magenta marker in ${textureKey} at pixel (${x}, ${y})`);
                        // Break out of both loops once found
                        y = height;
                        break;
                    }
                }
            }
            
            if (pivotX >= 0 && pivotY >= 0) {
                // Calculate normalized origin values
                const originX = pivotX / width;
                const originY = pivotY / height;
                
                // Store these values for use when creating the diverArm sprite
                this[storageProperty] = { x: originX, y: originY, pixelX: pivotX, pixelY: pivotY };
                
                console.log(`[ARM PIVOT] Calculated normalized origin for ${textureKey}: (${originX.toFixed(3)}, ${originY.toFixed(3)})`);
            } else {
                console.warn(`[ARM PIVOT] No magenta pivot marker found in ${textureKey} texture`);
                // Default fallback values
                if (textureKey === 'arms') {
                    this[storageProperty] = { x: 0.0, y: 0.5, pixelX: 0, pixelY: height / 2 };
                } else {
                    // For arms_left, default to right edge center
                    this[storageProperty] = { x: 1.0, y: 0.5, pixelX: width, pixelY: height / 2 };
                }
            }
        } catch (error) {
            console.error(`[ARM PIVOT] Error analyzing ${textureKey} texture:`, error);
            // Default fallback values
            if (textureKey === 'arms') {
                this[storageProperty] = { x: 0.0, y: 0.5, pixelX: 0, pixelY: 0 };
            } else {
                // For arms_left, default to right edge center
                this[storageProperty] = { x: 1.0, y: 0.5, pixelX: 0, pixelY: 0 };
            }
        }
    }

    create() {
        this.gameRunning = true;
        
        try {
            console.log('🎮 GameScene instance:', this.constructor.name);
            
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
            
            // Handle game over conditions
            this.events.on('playerOxygenDepleted', () => {
                console.log("💀 GameScene received playerOxygenDepleted event - game over");
                if (this.gameStateManager) {
                    this.gameStateManager.changeState(this.gameStateManager.gameStates.GAME_OVER, {
                        cause: 'oxygen'
                    });
                } else {
                    console.error("Failed to trigger game over - gameStateManager not initialized");
                    // Emergency fallback - restart the scene if game state manager is not available
                    this.scene.restart();
                }
            });
            
            this.events.on('playerDeath', () => {
                console.log("💀 GameScene received playerDeath event - game over");
                if (this.gameStateManager) {
                    this.gameStateManager.changeState(this.gameStateManager.gameStates.GAME_OVER, {
                        cause: 'health'
                    });
                } else {
                    console.error("Failed to trigger game over - gameStateManager not initialized");
                    // Emergency fallback - restart the scene if game state manager is not available
                    this.scene.restart();
                }
            });
            
            this.events.on('gameOver', () => {
                console.log("💀 GameScene received gameOver event");
                if (this.gameStateManager) {
                    this.gameStateManager.changeState(this.gameStateManager.gameStates.GAME_OVER);
                }
            });
            
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
            
            // Add custom flashlight mask generator (press G key)
            this.input.keyboard.on('keydown-G', () => {
                if (this.lightingSystem) {
                    console.log('Creating custom flashlight mask template...');
                    const maskKey = this.lightingSystem.createCustomFlashlightMaskTemplate();
                    
                    if (maskKey) {
                        // Apply the new custom mask
                        this.lightingSystem.setCustomFlashlightMask(maskKey);
                        console.log('Custom flashlight mask applied! Toggle with F key to see it.');
                        
                        // If flashlight is off, turn it on to show the new mask
                        if (!this.lightingSystem.flashlightEnabled) {
                            this.lightingSystem.toggleFlashlight();
                        }
                    }
                }
            });
            
            console.log('GameScene initialization complete');
        } catch (error) {
            console.error('Error in create:', error);
        }
    }
    
    setupSystems() {
        try {
            console.log('Setting up game systems...');
            
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
            
            // Initialize game state manager
            this.gameStateManager = new GameStateManager(this);
            
            // Initialize audio system
            if (this.audioSystem) {
                this.audioSystem.setupMusic('music', 'ambience');
            }
            
            // Initialize player system
            this.playerSystem = new PlayerSystem(this);
            
            // Initialize battery system and hook up event listener
            this.batterySystem = new BatterySystem(this);
            this.batterySystem.scene.events.on('battery-depleted', () => {
                console.log("💡 GameScene caught battery-depleted");
                if (this.lightingSystem) {
                    console.log("💡 GameScene turning flashlight OFF");
                    
                    // Directly set flashlight to disabled state instead of toggling
                    this.lightingSystem.flashlightEnabled = false;
                    
                    // Force hide flashlight visual elements
                    if (this.lightingSystem.flashlightPointLight) {
                        this.lightingSystem.flashlightPointLight.setVisible(false);
                    }
                    
                    if (this.lightingSystem.flashlightGlow) {
                        this.lightingSystem.flashlightGlow.setVisible(false);
                    }
                    
                    // Clear any mask on the overlay
                    if (this.lightingSystem.overlay) {
                        this.lightingSystem.overlay.clearMask();
                    }
                    
                    console.log("💡 GameScene: Flashlight elements forcibly hidden");
                }
                
                // Also update the battery system state
                if (this.batterySystem) {
                    this.batterySystem.isFlashlightOn = false;
                }
            });
            
            // Initialize air pocket system after player
            this.airPocketSystem = new AirPocketSystem(this, this.player);
            this.airPocketSystem.setDebugVisualsEnabled(true);
            
            // Initialize enemy system
            console.log('Creating enemy system...');
            this.enemySystem = new EnemySystem(this);
            console.log('Enemy system created successfully');
            
            // Initialize jellyfish system
            console.log('Creating jellyfish system...');
            this.jellyfishSystem = new JellyfishSystem(this);
            console.log('Jellyfish system created successfully');
            
            // Initialize lighting system
            this.lightingSystem = new LightingSystem(this);
            
            // Set the custom flashlight mask
            this.lightingSystem.setCustomFlashlightMask('flashlight_cone1');
            
            // Initialize animation system
            this.animationSystem = new AnimationSystem(this);
            
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
            
            // Create animations using the new method first, then fall back to old method if needed
            try {
                // Try the new animation first
                console.log('Attempting to create animation with new spritesheet...');
                const animOptions = {
                    frameRate: 8, // Smoother animation with lower frame rate
                    yoyo: false, 
                    frameDelay: 0, 
                    // Enhanced interpolation options
                    useInterpolation: true, // Enable frame interpolation
                    sample: 2, // Higher sample rate for smoother transitions
                    ease: 'Sine.easeInOut', // Add easing for smoother transitions
                    blendMode: Phaser.BlendModes.NORMAL
                };
                const newSuccess = this.animationSystem.createNewPlayerSwimAnimation(animOptions);
                
                if (newSuccess) {
                    console.log('Successfully created animation with new spritesheet');
                    requiredAnimations[0].status = true;
                } else {
                    // Fall back to original methods if new animation fails
                    console.warn('Failed to create animation with new spritesheet, falling back to original methods');
                    
                    // Try specific animation creation first
                    const success = this.animationSystem.createPlayerSwimAnimation('idle_swim_full');
                    requiredAnimations[0].status = this.anims.exists(requiredAnimations[0].key);
                    
                    // If specific creation failed, try master method
                    if (!requiredAnimations[0].status) {
                        console.log(`Specific animation creation failed for ${requiredAnimations[0].key}, trying master method...`);
                        this.animationSystem.createAnimations();
                        requiredAnimations[0].status = this.anims.exists(requiredAnimations[0].key);
                    }
                }
            } catch (err) {
                console.error(`Error creating animation:`, err);
                // Create placeholder animation as last resort
                this.animationSystem.createPlaceholderAnimation();
                requiredAnimations[0].status = this.anims.exists(requiredAnimations[0].key);
            }
            
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
            
            // Use player spawn point from map if available, otherwise use default
            const spawnX = this.playerSpawnPoint ? this.playerSpawnPoint.x : 400;
            const spawnY = this.playerSpawnPoint ? this.playerSpawnPoint.y : 300;
            
            // Create player system if it doesn't exist
            if (!this.playerSystem) {
                this.playerSystem = new PlayerSystem(this);
            }
            
            // Initialize the player at the spawn point
            this.player = this.playerSystem.createPlayer(spawnX, spawnY);
            
            // Configure the player sprite
            if (this.player && this.player.sprite) {
                console.log('Player sprite created successfully');
                
                this.player.sprite.setCollideWorldBounds(true);
                this.player.sprite.setVisible(true);
                this.player.sprite.setDepth(25); // Ensure player is above ALL other elements including overlays
                
                // DIRECT ANIMATION APPROACH: create and play animation directly in setupPlayer
                try {
                    console.log('Setting up animation with direct approach');
                    
                    // First check if the spritesheet exists
                    if (!this.textures.exists('diver_swim_new')) {
                        console.error('diver_swim_new texture is missing!');
                        // Set fallback texture
                        this.player.sprite.setTexture('player');
                    } else {
                        // Step 1: Set the texture
                        this.player.sprite.setTexture('diver_swim_new');
                        console.log('Player texture set to diver_swim_new');
                        
                        // Step 2: Set the origin to center (0.5, 0.5)
                        this.player.sprite.setOrigin(0.5, 0.5);
                        console.log('Set sprite origin to center (0.5, 0.5)');
                        
                        // Step 3: Create the swim animation
                        if (!this.anims.exists('swim')) {
                            this.anims.create({
                                key: 'swim',
                                frames: this.anims.generateFrameNumbers('diver_swim_new', { 
                                    start: 0, 
                                    end: 7  // 8 frames total (0-7)
                                }),
                                frameRate: 10,
                                repeat: -1  // Loop infinitely
                            });
                            console.log('Created swim animation (8 frames, 10 FPS, looping)');
                        }
                        
                        // Step 4: Play the animation
                        this.player.sprite.anims.play('swim', true);
                        console.log('Started swim animation');
                    }
                } catch (error) {
                    console.error('Error setting up player animation:', error);
                    // Fallback to static image
                    this.player.sprite.setTexture('player');
                }
                
                // Add the diver arm sprite if the texture exists
                if (this.textures.exists('arms')) {
                    this.diverArm = this.add.sprite(this.player.sprite.x, this.player.sprite.y, 'arms');
                    
                    // Check if we've found the pivot point, otherwise use defaults
                    if (this.armPivot) {
                        console.log(`[ARM PIVOT] Applying pivot origin ${this.armPivot.x.toFixed(3)}, ${this.armPivot.y.toFixed(3)}`);
                        this.diverArm.setOrigin(this.armPivot.x, this.armPivot.y);
                    } else {
                        console.warn('[ARM PIVOT] No pivot data found, using default origin');
                        this.diverArm.setOrigin(0.0, 0.5);
                    }
                    
                    this.diverArm.setDepth(this.player.sprite.depth + 1);
                    this.diverArm.setVisible(true);
                    console.log('Added diver arm sprite');
                } else {
                    console.error('[ARMS DEBUG] ❌ CRITICAL: arms texture not available');
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
                
                // Listen for boost start/end events to maintain arm position
                this.player.on('boostStart', () => {
                    // Ensure arm stays attached when boost starts
                    if (this.diverArm && this.player?.sprite) {
                        const offsetX = this.player.sprite.flipX ? 3 : -3;
                        this.diverArm.setPosition(
                            this.player.sprite.x + offsetX,
                            this.player.sprite.y - 47
                        );
                    }
                });
                
                this.player.on('boostEnd', () => {
                    // Ensure arm stays attached when boost ends
                    if (this.diverArm && this.player?.sprite) {
                        const offsetX = this.player.sprite.flipX ? 3 : -3;
                        this.diverArm.setPosition(
                            this.player.sprite.x + offsetX,
                            this.player.sprite.y - 47
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

        // Add escape key for pause
        this.input.keyboard.on('keydown-ESC', () => {
            if (this.gameRunning) {
                this.pause();
            } else {
                this.resume();
            }
        });
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
                // Get the obstacles layer directly from the tilemap
                const obstaclesLayer = this.tilemapSystem.map.getLayer('Obstacles').tilemapLayer;
                
                if (obstaclesLayer && this.player?.sprite) {
                    // Enable collisions on the obstacles layer
                    obstaclesLayer.setCollisionByExclusion([-1]);
                    
                    // Add collider between player and obstacles
                    this.physics.add.collider(this.player.sprite, obstaclesLayer);
                    console.log('Player-obstacle collisions set up');
                    
                    // Add bullet-wall collisions
                    if (this.bulletSystem) {
                        this.physics.add.collider(
                            this.bulletSystem.bullets,
                            obstaclesLayer,
                            (bullet) => {
                                if (bullet.active) {
                                    bullet.deactivate();
                                }
                            }
                        );
                        console.log('Bullet-obstacle collisions set up');
                    }
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
        
        // ABSOLUTE MOUSE TRACKING PRIORITY
        if (this.diverArm && this.player?.sprite) {
            // Get mouse pointer position and player position
            const pointer = this.input.activePointer;
            const worldMouseX = this.cameras.main.scrollX + pointer.x;
            const worldMouseY = this.cameras.main.scrollY + pointer.y;
            const playerX = this.player.sprite.x;
            const playerY = this.player.sprite.y;
            
            // Check if left mouse button is down (shooting)
            const isShooting = pointer.isDown && pointer.button === 0;
            
            // CRITICAL: While shooting, mouse direction ALWAYS takes priority over movement
            const isMouseOnLeft = worldMouseX < playerX;
            
            // Update player facing direction based ONLY on mouse position
            // This ensures proper facing direction during shooting regardless of movement
            this.player.sprite.flipX = isMouseOnLeft;
            const isFacingLeft = this.player.sprite.flipX;
            
            // Position the arm directly at the shoulder with fixed offsets
            const shoulderOffsetX = isFacingLeft ? 3 : -3;
            const shoulderOffsetY = -47;
            this.diverArm.x = playerX + shoulderOffsetX;
            this.diverArm.y = playerY + shoulderOffsetY;
            
            // Update arm texture if direction changed
            if (this.diverArm.isFacingLeft !== isFacingLeft) {
                // Set the correct arm texture based on facing direction
                const desiredKey = isFacingLeft ? 'arms_left' : 'arms';
                this.diverArm.setTexture(desiredKey);
                
                // Reset any flip state
                this.diverArm.setFlipX(false);
                this.diverArm.setFlipY(false);
                
                // Apply the correct pivot origin
                if (this.armPivot) {
                    if (isFacingLeft && this.armPivotLeft) {
                        this.diverArm.setOrigin(this.armPivotLeft.x, this.armPivotLeft.y);
                    } else {
                        this.diverArm.setOrigin(this.armPivot.x, this.armPivot.y);
                    }
                }
                
                // Store the new facing direction
                this.diverArm.isFacingLeft = isFacingLeft;
            }
            
            // Calculate true aim direction (used for bullet firing, etc.)
            const rawAngle = Phaser.Math.Angle.Between(
                this.diverArm.x, this.diverArm.y,
                worldMouseX, worldMouseY
            );
            
            // Store the raw angle for systems that need true direction
            this.diverArm.trueDirection = rawAngle;
            
            // Get visual angle with clamping
            let visualAngle = rawAngle;
            const isAbove = worldMouseY < this.diverArm.y;
            
            if (isFacingLeft) {
                // Left facing arm logic
                let degrees = Phaser.Math.RadToDeg(rawAngle);
                if (degrees < 0) degrees += 360;
                
                if (degrees < 90 || degrees > 270) {
                    // Clamp to vertical when out of range
                    visualAngle = Phaser.Math.DegToRad(isAbove ? 90 : 270);
                }
                
                // Add PI for left-facing arm texture
                visualAngle += Math.PI;
            } else {
                // Right facing arm logic
                let degrees = Phaser.Math.RadToDeg(rawAngle);
                
                if (degrees < -90 || degrees > 90) {
                    // Clamp to vertical when out of range
                    visualAngle = Phaser.Math.DegToRad(isAbove ? -90 : 90);
                }
            }
            
            // Apply the rotation immediately
            this.diverArm.setRotation(visualAngle);
            this.diverArm.finalRotation = visualAngle;
            
            // Calculate arm tip position
            const armLength = 70;
            this.diverArm.tipX = this.diverArm.x + Math.cos(this.diverArm.trueDirection) * armLength;
            this.diverArm.tipY = this.diverArm.y + Math.sin(this.diverArm.trueDirection) * armLength;
        }
        
        // Simple animation check - ensure animation is playing
        if (this.player && this.player.sprite && this.anims.exists('swim')) {
            // If not playing, restart the animation
            if (!this.player.sprite.anims.isPlaying) {
                this.player.sprite.play('swim', true);
            }
        }
        
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
        
        // Update the lighting system
        if (this.lightingSystem) {
            this.lightingSystem.update(delta);
        }

        // Update jellyfish system
        if (this.jellyfishSystem) {
            this.jellyfishSystem.update(time, delta);
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
            
            // Clean up diver arm
            if (this.diverArm) {
                this.diverArm.destroy();
                console.log('Cleaned up diver arm');
            }
            
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
                { system: this.jellyfishSystem, name: 'JellyfishSystem' },
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
            
            // Set game state
            this.gameRunning = false;
            
            // Pause physics
            this.physics.pause();
            
            // Pause all tweens
            this.tweens.pauseAll();
            
            // Stop any active timers
            this.time.paused = true;
            
            // Pause animations if any are playing
            this.anims.pauseAll();
            
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
            
            // Set game state first
            this.gameRunning = true;
            
            // Resume physics
            this.physics.resume();
            
            // Resume tweens
            this.tweens.resumeAll();
            
            // Resume timers
            this.time.paused = false;
            
            // Resume animations
            this.anims.resumeAll();
            
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