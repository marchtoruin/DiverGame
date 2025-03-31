import Phaser from 'phaser';
import AssetManagementSystem from '../systems/AssetManagementSystem';

// Import asset paths directly
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
import laserSprite09 from '../assets/laser_sprites/09.png';
import airPocket1Img from '../assets/air_pocket1.png';
import airPocket2Img from '../assets/air_pocket2.png';
import airPocket3Img from '../assets/air_pocket3.png';
import bgMusic from '../assets/music/bg_music.mp3';
import ambienceMusic from '../assets/music/ambience_underwater.wav';
import heartImg from '../assets/heart.png';
import badFishImg from '../assets/enemies/badFish01.png';
import seaweedImg from '../assets/seaweed.png';
import flashlightCone1Img from '../assets/flashlight_cone1.png';
import new_idle_swimImg from '../assets/new_idle_swim.png';
import batteryImg from '../assets/battery.png';
import jellyFishImg from '../assets/jelly_fish.png';
import jellyChargeImg from '../assets/jelly_charge.png';

// Import normal maps 
import black_and_blue_nImg from '../assets/tilesets/normal_maps/black_and_blue_n.png';
import rock2_nImg from '../assets/tilesets/normal_maps/rock2_n.png';
import rock3_nImg from '../assets/tilesets/normal_maps/rock3_n.png';

export default class LoadingScene extends Phaser.Scene {
    constructor() {
        super({ key: 'LoadingScene' });
        this.assetSystem = null;
        this.assetsLoaded = false;
    }

    init() {
        console.log('LoadingScene initialized');
    }

    preload() {
        this.createLoadingUI();
        
        // Initialize asset management system
        this.assetSystem = new AssetManagementSystem(this);
        
        // Register the progress event
        this.load.on('progress', (value) => {
            this.updateProgressBar(value);
        });
        
        this.load.on('complete', () => {
            this.assetsLoaded = true;
            console.log('All assets preloaded successfully');
        });
        
        // Load all assets
        this.loadAssets();
    }

    loadAssets() {
        try {
            // Add map configuration to cache
            this.cache.json.add('mapConfig', mapConfig);
            
            // Load map and tilesets
            this.load.tilemapTiledJSON('level1', level1Data);
            this.load.tilemapTiledJSON('level2', level2Data);
            this.load.image('underwater_bg', underwaterBg);
            this.load.image('black_and_blue', blackAndBlueImg);
            this.load.image('black_and_blue_n', black_and_blue_nImg);
            this.load.image('rock2', rock2Img);
            this.load.image('rock2_n', rock2_nImg);
            this.load.image('rock3', rock3Img);
            this.load.image('rock3_n', rock3_nImg);
            this.load.image('seaweed', seaweedImg);
            this.load.image('air_pocket1', airPocket1Img);
            this.load.image('air_pocket2', airPocket2Img);
            this.load.image('air_pocket3', airPocket3Img);
            
            // Load player assets
            this.load.image('player', diverImg);
            this.load.spritesheet('diver_swim_new', new_idle_swimImg, { 
                frameWidth: 139, 
                frameHeight: 150 
            });
            this.load.image('bubble', bubbleImg);
            this.load.image('heart', heartImg);
            this.load.image('battery', batteryImg);
            
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
            
            // Load laser sprite for battery indicator
            this.load.image('09', laserSprite09);
            
            // Load custom flashlight mask image
            this.load.image('flashlight_cone1', flashlightCone1Img);
            
            // Load audio
            this.load.audio('music', bgMusic);
            this.load.audio('ambience', ambienceMusic);
            
            // Use AssetManagementSystem to track loaded assets
            this.assetSystem.loadAssets();
            
        } catch (error) {
            console.error('Error loading assets:', error);
        }
    }

    createLoadingUI() {
        // Create a simple loading bar
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        
        // Background
        this.add.rectangle(width/2, height/2, width, height, 0x000066);
        
        // Loading text
        this.add.text(width/2, height/2 - 50, 'Loading...', {
            fontFamily: 'Arial',
            fontSize: '32px',
            color: '#ffffff'
        }).setOrigin(0.5);
        
        // Progress bar background
        this.add.rectangle(width/2, height/2, 400, 30, 0x000000);
        
        // Progress bar
        this.progressBar = this.add.rectangle(width/2 - 195, height/2, 10, 20, 0xff00ff);
        this.progressBar.setOrigin(0, 0.5);
    }

    updateProgressBar(value) {
        // Update progress bar width based on load progress (0-1)
        this.progressBar.width = 390 * value;
        
        // Add a subtle pulse effect to the bar
        if (!this.progressTween) {
            this.progressTween = this.tweens.add({
                targets: this.progressBar,
                alpha: 0.7,
                yoyo: true,
                duration: 500,
                repeat: -1
            });
        }
    }

    create() {
        // Add some delay to ensure everything is loaded properly
        this.time.delayedCall(1000, () => {
            // Small animation before transitioning
            this.cameras.main.fadeOut(500);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                // Start the level selection scene (DebugMapScene) 
                // This preserves the original flow where users select a level first
                this.scene.start('DebugMapScene');
            });
        });
    }
} 