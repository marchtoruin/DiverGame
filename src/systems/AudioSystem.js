import { AUDIO } from '../utils/Constants';

/**
 * Manages all audio-related functionality in the game
 */
export default class AudioSystem {
    /**
     * Create and initialize the audio system
     * @param {Phaser.Scene} scene - The scene this system belongs to
     */
    constructor(scene) {
        this.scene = scene;
        this.musicVolume = AUDIO.MUSIC_VOLUME;
        this.isMuted = false;
        this.ambience = null;
        this.music = null;
        this.effectsVolume = AUDIO.EFFECTS_VOLUME;
        this.masterVolume = AUDIO.MASTER_VOLUME;
    }

    /**
     * Setup and initialize all music and ambient sounds
     * @param {string} musicKey - Key for the background music asset
     * @param {string} ambienceKey - Key for the ambient sound asset
     */
    setupMusic(musicKey, ambienceKey) {
        try {
            console.log(`Setting up music system with music: ${musicKey}, ambience: ${ambienceKey}`);
            
            // Check if the audio files exist in cache first
            if (!this.scene.cache.audio.exists(musicKey)) {
                console.warn(`Music audio key "${musicKey}" not found in cache`);
                return false;
            }
            
            if (!this.scene.cache.audio.exists(ambienceKey)) {
                console.warn(`Ambience audio key "${ambienceKey}" not found in cache`);
                return false;
            }
            
            // Main music track
            this.music = this.scene.sound.add(musicKey, {
                volume: this.musicVolume,
                loop: true
            });
            
            // Ambient underwater sound
            this.ambience = this.scene.sound.add(ambienceKey, {
                volume: AUDIO.AMBIENCE_VOLUME,
                loop: true
            });
            
            // Start both audio tracks
            console.log('Starting music and ambience tracks');
            this.music.play();
            this.ambience.play();
            
            // Add mute button
            this.setupMuteButton();
            
            console.log('Music system setup complete');
            return true;
        } catch (error) {
            console.error('Error setting up music system:', error);
            return false;
        }
    }
    
    /**
     * Setup mute button and handle muting/unmuting
     */
    setupMuteButton() {
        // Create mute button in top-right corner
        const muteButton = this.scene.add.text(
            this.scene.cameras.main.width - 100, 
            50, 
            '🔊', 
            { 
                fontSize: '32px',
                backgroundColor: 'rgba(0,0,0,0.5)',
                padding: { x: 10, y: 5 },
                borderRadius: 5
            }
        ).setInteractive().setScrollFactor(0).setDepth(100);
        
        // Handle click events
        muteButton.on('pointerdown', () => {
            this.toggleMute(muteButton);
        });
        
        // Make sure it stays in position when camera moves
        this.scene.events.on('resize', () => {
            muteButton.setPosition(this.scene.cameras.main.width - 100, 50);
        });
    }
    
    /**
     * Toggle mute state for all audio
     * @param {Phaser.GameObjects.Text} muteButton - Reference to the mute button for updating its text
     */
    toggleMute(muteButton) {
        this.isMuted = !this.isMuted;
        muteButton.setText(this.isMuted ? '🔇' : '🔊');
        
        // Mute/unmute all audio
        if (this.isMuted) {
            this.scene.sound.setMute(true);
        } else {
            this.scene.sound.setMute(false);
        }
    }
    
    /**
     * Adjust volume of the background music
     * @param {number} amount - Amount to adjust the volume by (-1 to 1)
     */
    adjustVolume(amount) {
        this.musicVolume = Phaser.Math.Clamp(this.musicVolume + amount, 0, 1);
        if (this.music) {
            this.music.setVolume(this.musicVolume);
        }
    }
    
    /**
     * Clean up audio resources when scene is destroyed
     */
    destroy() {
        if (this.music) {
            this.music.stop();
        }
        if (this.ambience) {
            this.ambience.stop();
        }
    }

    /**
     * Play a sound effect or music track
     * @param {string} key - The key of the sound to play
     * @param {object} config - Configuration options for sound
     * @returns {Phaser.Sound.BaseSound|null} - The sound object or null if it couldn't be played
     */
    playSound(key, config = {}) {
        try {
            // Only allow music or ambience - we don't have any other sounds
            if (key !== 'music' && key !== 'ambience') {
                return null;
            }
            
            // Check if sound exists in the scene
            if (!this.scene.sound.get(key) && !this.scene.cache.audio.exists(key)) {
                console.warn(`Audio: "${key}" not found. Skipping playback.`);
                return null;
            }
            
            // Set default config
            const mergedConfig = {
                volume: (this.effectsVolume || 0.5) * (this.masterVolume || 1),
                loop: false,
                ...config
            };
            
            // Play the sound
            return this.scene.sound.play(key, mergedConfig);
        } catch (error) {
            console.error(`Error playing audio ${key}:`, error.message);
            return null;
        }
    }
} 