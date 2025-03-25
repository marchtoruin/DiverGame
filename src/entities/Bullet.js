// src/entities/Bullet.js
export default class Bullet extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'bullet');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Initialize properties
        this.speed = 1440; // Increased speed for faster projectiles
        this.setActive(false);
        this.setVisible(false);
        this.setScale(0.6);
        this.setDepth(12);
        
        // Ensure independent physics
        this.body.setAllowGravity(false);
        this.body.setBounce(0);
        this.body.setDrag(0);
        this.body.setFriction(0);
        
        // Set a proper hitbox size
        this.body.setSize(this.width * 0.7, this.height * 0.7);
        
        // Add a simple glow effect
        this.glow = scene.add.sprite(x, y, 'bullet')
            .setScale(0.8)
            .setAlpha(0.3)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(11)
            .setVisible(false);
    }
  
    fire(x, y, direction) {
        // Reset bullet state and position
        this.setActive(true);
        this.setVisible(true);
        
        // Important: Reset the body AND position
        this.body.reset(x, y);
        this.body.setVelocity(this.speed * direction, 0);
        
        // Ensure no interference from physics
        this.body.setAllowGravity(false);
        this.body.setDrag(0);
        this.body.setFriction(0);
        
        // Show and position glow effect
        this.glow.setVisible(true);
        this.glow.setPosition(x, y);
        
        // Rotate bullet based on direction
        this.rotation = direction > 0 ? 0 : Math.PI;
        this.glow.rotation = this.rotation;
        
        // Add a quick flash effect
        const flash = this.scene.add.sprite(x, y, 'bullet')
            .setScale(1)
            .setAlpha(0.8)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(13);
        flash.rotation = this.rotation;
        
        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 1.5,
            duration: 100,
            onComplete: () => flash.destroy()
        });
        
        // Emit a small burst using the particle system if available
        if (this.scene.particleSystem) {
            const particleDirection = { x: direction, y: 0 };
            this.scene.particleSystem.emitMovementBurst(this, 'bubble', particleDirection);
        }
    }
  
    update() {
        if (this.active) {
            // Update glow position
            if (this.glow && this.glow.visible) {
                this.glow.setPosition(this.x, this.y);
            }
            
            // Check if bullet is out of bounds relative to the camera
            const camera = this.scene.cameras.main;
            const margin = 100; // Larger margin to ensure bullets don't disappear too early
            
            // Convert world position to screen position
            const screenX = this.x - camera.scrollX;
            
            // Check if bullet is far outside the camera view
            if (screenX < -margin || screenX > camera.width + margin) {
                this.deactivate();
            }
        }
    }
    
    deactivate() {
        this.setActive(false);
        this.setVisible(false);
        this.glow.setVisible(false);
        // Ensure velocity is zeroed when deactivated
        this.body.setVelocity(0, 0);
    }
    
    destroy() {
        if (this.glow) {
            this.glow.destroy();
        }
        super.destroy();
    }
}
  