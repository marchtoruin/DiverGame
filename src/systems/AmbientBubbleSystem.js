import { PARTICLES } from '../utils/Constants';

/**
 * Manages ambient background bubbles in the game environment
 * Creates a persistent effect of bubbles drifting upward from below the viewport
 */
export default class AmbientBubbleSystem {
    /**
     * Create and initialize the ambient bubble system
     * @param {Phaser.Scene} scene - The scene this system belongs to
     */
    constructor(scene) {
        this.scene = scene;
        this.enabled = true;
        this.depth = 1 ;  // Between Background (10) and Background_sprites (20), behind Midground_sprites (30) and Obstacles (40)
        this.bubbles = new Set();
        this.mapWidth = 0;
        this.mapHeight = 0;
        
        // Spawn timing
        this.nextSpawnTime = 0;
        this.spawnInterval = 1000; // Increased from 800ms to 1000ms for fewer bubbles
    }

    createAmbientBubbles(width, height) {
        this.mapWidth = width;
        this.mapHeight = height;
        
        // Don't create any initial bubbles - let them spawn naturally from below
        this.enabled = true;
    }

    /**
     * Updates the ambient bubble system, generating new bubbles at random locations
     * @param {number} time - Current time
     */
    update(time) {
        if (!this.enabled || !this.mapWidth) return;

        // Clean up destroyed bubbles
        for (const bubble of this.bubbles) {
            if (!bubble.active) {
                this.bubbles.delete(bubble);
            }
        }

        // Check if we should spawn new bubbles
        if (time > this.nextSpawnTime) {
            this.spawnBubbles();
            this.nextSpawnTime = time + this.spawnInterval;
        }

        // Update existing bubbles
        this.updateBubbles(time);
    }

    spawnBubbles() {
        const camera = this.scene.cameras.main;
        const spawnY = camera.scrollY + camera.height + 300; // 300px below viewport
        
        // Spawn 1-2 bubbles with reduced chance of 2 bubbles
        const count = Math.random() < 0.2 ? 2 : 1; // Reduced from 0.3 to 0.2 for fewer double spawns
        
        for (let i = 0; i < count; i++) {
            // Spawn across the entire visible width plus some padding
            const spawnX = camera.scrollX - 50 + Math.random() * (camera.width + 100);
            this.createBubble(spawnX, spawnY);
        }
    }

    createBubble(x, y) {
        // Randomly select one of the three bubble images
        const bubbleImages = ['bg_bubble1', 'bg_bubble2', 'bg_bubble3'];
        const randomBubbleKey = bubbleImages[Math.floor(Math.random() * bubbleImages.length)];

        const rand = Math.random();
        let config;

        if (rand < 0.5) { // 50% tiny
            config = {
                scale: 0.03,
                scaleVariation: 0.004,
                speed: 0.4,
                drift: 0.15,
                wobbleSpeed: 0.002,
                wobbleAmount: 0.3,
                deformSpeed: 0.4 + Math.random() * 0.2
            };
        } else if (rand < 0.8) { // 30% small
            config = {
                scale: 0.06,
                scaleVariation: 0.006,
                speed: 0.35,
                drift: 0.12,
                wobbleSpeed: 0.0015,
                wobbleAmount: 0.4,
                deformSpeed: 0.35 + Math.random() * 0.2
            };
        } else if (rand < 0.95) { // 15% medium
            config = {
                scale: 0.15,
                scaleVariation: 0.01,
                speed: 0.3,
                drift: 0.1,
                wobbleSpeed: 0.001,
                wobbleAmount: 0.5,
                deformSpeed: 0.3 + Math.random() * 0.5
            };
        } else { // 5% large
            config = {
                scale: 0.2,
                scaleVariation: 0.015,
                speed: 0.25,
                drift: 0.08,
                wobbleSpeed: 0.0008,
                wobbleAmount: 0.6,
                deformSpeed: 0.25 + Math.random() * 0.5
            };
        }

        const bubble = this.scene.add.sprite(x, y, randomBubbleKey)
            .setScale(config.scale)
            .setAlpha(0.5)
            .setDepth(this.depth)
            .setRotation(Math.random() * Math.PI * 2);

        // Add movement properties
        bubble.moveData = {
            baseScale: config.scale,
            scaleVariation: config.scaleVariation,
            speed: config.speed,
            drift: config.drift,
            wobbleSpeed: config.wobbleSpeed,
            wobbleAmount: config.wobbleAmount,
            wobbleOffset: Math.random() * Math.PI * 2,
            deformSpeed: config.deformSpeed,
            deformOffsetX: Math.random() * Math.PI * 2,
            deformOffsetY: Math.random() * Math.PI * 2,
            time: 0
        };

        this.bubbles.add(bubble);
    }

    updateBubbles(time) {
        const camera = this.scene.cameras.main;
        const removeY = camera.scrollY - 100; // Remove when 100px above viewport

        for (const bubble of this.bubbles) {
            if (!bubble.active) continue;

            const moveData = bubble.moveData;
            moveData.time += 0.016; // Approximate for 60fps

            // Move upward with slight drift
            bubble.y -= moveData.speed;
            bubble.x -= moveData.drift;

            // Add subtle wobble
            bubble.x += Math.sin(moveData.time * moveData.wobbleSpeed + moveData.wobbleOffset) * moveData.wobbleAmount;

            // Create organic deformation using independent X/Y scaling with different phases
            const baseScale = moveData.baseScale;
            const variation = moveData.scaleVariation;
            
            // Calculate X and Y scales independently with different phases and slightly different frequencies
            const xScale = baseScale + Math.sin(moveData.time * moveData.deformSpeed + moveData.deformOffsetX) * variation;
            const yScale = baseScale + Math.cos(moveData.time * (moveData.deformSpeed * 1.1) + moveData.deformOffsetY) * variation;
            
            // Apply the deformations
            bubble.setScale(xScale, yScale);

            // Remove if too high or too far left
            if (bubble.y < removeY || bubble.x < camera.scrollX - 200) {
                bubble.destroy();
                this.bubbles.delete(bubble);
            }
        }
    }

    /**
     * Cleans up and destroys all particle emitters
     */
    destroy() {
        this.enabled = false;
        for (const bubble of this.bubbles) {
            bubble.destroy();
        }
        this.bubbles.clear();
    }

    spawnBubble() {
        if (!this.enabled) return;
        
        // Randomly select one of the three bubble images
        const bubbleImages = ['bg_bubble1', 'bg_bubble2', 'bg_bubble3'];
        const randomBubbleKey = bubbleImages[Math.floor(Math.random() * bubbleImages.length)];
        
        // Random position along the bottom of the screen
        const x = Math.random() * this.mapWidth;
        const y = this.mapHeight + 20; // Start slightly below the screen
        
        // Create bubble sprite
        const bubble = this.scene.add.sprite(x, y, randomBubbleKey);
        
        // Randomize initial rotation
        bubble.setRotation(Math.random() * Math.PI * 2);
        
        // Determine bubble size and properties
        const sizeRoll = Math.random();
        let baseScale, scaleVariation, deformSpeed, speed, drift;
        
        if (sizeRoll < 0.5) { // 50% chance for tiny bubbles
            baseScale = 0.08;
            scaleVariation = 0.004;
            deformSpeed = 0.4 + Math.random() * 0.2;
            speed = 30 + Math.random() * 20;
            drift = 0.5 + Math.random() * 0.5;
        } else if (sizeRoll < 0.8) { // 30% chance for small bubbles
            baseScale = 0.12;
            scaleVariation = 0.006;
            deformSpeed = 0.35 + Math.random() * 0.2;
            speed = 25 + Math.random() * 15;
            drift = 0.8 + Math.random() * 0.8;
        } else if (sizeRoll < 0.95) { // 15% chance for medium bubbles
            baseScale = 0.16;
            scaleVariation = 0.01;
            deformSpeed = 0.3 + Math.random() * 0.2;
            speed = 20 + Math.random() * 10;
            drift = 1.2 + Math.random() * 1.2;
        } else { // 5% chance for large bubbles
            baseScale = 0.2;
            scaleVariation = 0.015;
            deformSpeed = 0.25 + Math.random() * 0.2;
            speed = 15 + Math.random() * 5;
            drift = 1.5 + Math.random() * 1.5;
        }
        
        // Set initial scale
        bubble.setScale(baseScale);
        
        // Store movement data
        bubble.moveData = {
            speed: speed,
            drift: drift,
            time: 0,
            deformSpeed: deformSpeed,
            deformOffsetX: Math.random() * Math.PI * 2,
            deformOffsetY: Math.random() * Math.PI * 2
        };
        
        // Add to active bubbles
        this.bubbles.add(bubble);
        
        // Set depth
        bubble.setDepth(this.depth);
    }
} 