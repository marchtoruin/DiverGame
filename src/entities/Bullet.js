// src/entities/Bullet.js
import { LIGHTING } from '../utils/Constants';

export default class Bullet extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'bullet');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Initialize properties
        this.speed = 800;
        this.lifespan = 1000; // in milliseconds
        this.damage = 5;
        this.setActive(false);
        this.setVisible(false);
        this.setScale(0.5);
        
        // IMPORTANT: Set depth higher than the darkness overlay (which is at 900)
        // This makes bullets appear on top of the darkness
        this.setDepth(950);
        
        // Ensure independent physics
        this.body.setAllowGravity(false);
        this.body.setBounce(0);
        this.body.setDrag(0);
        this.body.setFriction(0);
        
        // Set a proper hitbox size
        this.body.setSize(this.width * 0.7, this.height * 0.7);
        
        // Add a glow effect
        this.createGlowEffect();
    }
  
    createGlowEffect() {
        // Create glow sprite that follows the bullet
        this.glow = this.scene.add.sprite(this.x, this.y, 'bullet')
            .setBlendMode(Phaser.BlendModes.ADD)
            .setAlpha(0.6)
            .setScale(1.2)
            .setTint(0xffff99) // Yellowish tint for better visibility
            .setVisible(false)
            // IMPORTANT: Set glow depth just below bullet but above darkness
            .setDepth(949);
            
        // Slight pulse animation for the glow
        this.scene.tweens.add({
            targets: this.glow,
            alpha: { from: 0.4, to: 0.8 },
            scale: { from: 1.0, to: 1.5 },
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
  
    fire(x, y, direction) {
        // Reset bullet position
        this.body.reset(x, y);
        
        // Activate bullet and set velocity
        this.setActive(true);
        this.setVisible(true);
        
        // Show glow effect
        if (this.glow) {
            this.glow.setVisible(true);
            this.glow.setPosition(this.x, this.y);
        }
        
        // Apply velocity based on direction
        const speed = direction > 0 ? this.speed : -this.speed;
        this.setVelocityX(speed);
        this.setVelocityY(0);
        
        // Reset lifespan timer
        this.lifespan = 1000; // reset to full lifespan
        
        // Add particle trail if it exists
        if (this.scene.particleSystem) {
            this.scene.particleSystem.addBulletTrail?.(this);
        }
    }
  
    update(time, delta) {
        // Decrease lifespan
        this.lifespan -= delta;
        
        // Check if bullet has expired
        if (this.lifespan <= 0) {
            this.deactivate();
            return;
        }
        
        // Update glow position
        if (this.glow && this.glow.visible) {
            this.glow.setPosition(this.x, this.y);
        }
    }
    
    deactivate() {
        // Deactivate the bullet
        this.setActive(false);
        this.setVisible(false);
        this.body.stop();
        
        // Hide glow effect
        if (this.glow) {
            this.glow.setVisible(false);
        }
    }
    
    destroy() {
        if (this.glow) {
            this.glow.destroy();
        }
        super.destroy();
    }
}