import Phaser from 'phaser';

export default class Enemy extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y, texture = 'badFish') {
        super(scene, x, y, texture);
        
        // Core properties
        this.scene = scene;
        this.health = 200;
        this.maxHealth = 200;
        this.speed = 150;
        this.isAlive = true;
        
        // Add to scene and enable physics
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Set depth to be above obstacles (10) but below player (25)
        this.setDepth(20);
        
        // Configure physics body
        this.body
            .setCollideWorldBounds(true)
            .setBounce(1, 1)
            .setSize(this.width * 0.8, this.height * 0.8)
            .setImmovable(false);  // Enemies should be movable
        
        // Add collision with obstacles layer if it exists
        if (scene.tilemapSystem?.layers?.Obstacles) {
            scene.physics.add.collider(this, scene.tilemapSystem.layers.Obstacles);
        }
        
        // Set initial velocity
        const angle = Phaser.Math.Between(0, 360);
        const velocity = scene.physics.velocityFromAngle(angle, this.speed);
        this.body.setVelocity(velocity.x, velocity.y);
        
        // Add subtle wobble animation
        scene.tweens.add({
            targets: this,
            angle: { from: -5, to: 5 },
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Create health bar
        this.createHealthBar();
    }

    createHealthBar() {
        // Create health bar background
        this.healthBarBg = this.scene.add.rectangle(
            this.x,
            this.y - this.height/2 - 10,
            this.width,
            4,
            0x000000,
            0.5
        );
        this.healthBarBg.setDepth(21); // Above enemy

        // Create health bar fill
        this.healthBarFill = this.scene.add.rectangle(
            this.x,
            this.y - this.height/2 - 10,
            this.width,
            4,
            0x00ff00,
            1
        );
        this.healthBarFill.setDepth(22); // Above background

        // Create health text
        this.healthText = this.scene.add.text(
            this.x,
            this.y - this.height/2 - 20,
            `${this.health}/${this.maxHealth}`,
            {
                font: '12px Arial',
                fill: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }
        ).setOrigin(0.5);
        this.healthText.setDepth(23); // Above health bar
    }

    updateHealthBar() {
        if (!this.healthBarFill || !this.healthBarBg || !this.healthText) return;
        
        // Update health bar fill width
        const healthPercent = this.health / this.maxHealth;
        this.healthBarFill.width = this.width * healthPercent;
        
        // Update health text
        this.healthText.setText(`${this.health}/${this.maxHealth}`);
        
        // Update colors based on health
        const color = healthPercent > 0.6 ? 0x00ff00 : healthPercent > 0.3 ? 0xffff00 : 0xff0000;
        this.healthBarFill.setFillStyle(color);
        
        // Update positions to follow enemy
        this.healthBarBg.setPosition(this.x, this.y - this.height/2 - 10);
        this.healthBarFill.setPosition(this.x - (this.width * (1 - healthPercent))/2, this.y - this.height/2 - 10);
        this.healthText.setPosition(this.x, this.y - this.height/2 - 20);
    }
    
    takeDamage(amount) {
        if (!this.isAlive) return;
        
        this.health -= amount;
        
        // Show damage number
        const damageText = this.scene.add.text(
            this.x,
            this.y - this.height/2 - 40,
            `-${amount}`,
            {
                font: '16px Arial',
                fill: '#ff0000',
                stroke: '#000000',
                strokeThickness: 2
            }
        ).setOrigin(0.5);
        damageText.setDepth(24); // Above health text

        // Animate damage number
        this.scene.tweens.add({
            targets: damageText,
            y: this.y - this.height/2 - 60,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => damageText.destroy()
        });
        
        // Flash red when hit
        this.scene.tweens.add({
            targets: this,
            alpha: { from: 0.5, to: 1 },
            duration: 100,
            ease: 'Linear',
            repeat: 1
        });
        
        // Update health bar
        this.updateHealthBar();
        
        if (this.health <= 0) {
            this.die();
        }
    }
    
    die() {
        if (!this.isAlive) return;
        this.isAlive = false;
        
        // Create death effect
        const emitter = this.scene.add.particles(this.x, this.y, 'bubble', {
            speed: { min: 50, max: 100 },
            scale: { start: 0.2, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 800,
            quantity: 1,
            frequency: 50,
            emitting: false
        });
        
        // Emit burst of particles
        emitter.explode(15, this.x, this.y);
        
        // Scale down and fade out
        this.scene.tweens.add({
            targets: this,
            scale: 0.1,
            alpha: 0,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                // Clean up health bar elements
                this.healthBarBg?.destroy();
                this.healthBarFill?.destroy();
                this.healthText?.destroy();
                emitter.destroy();
                this.destroy();
            }
        });
    }
    
    update() {
        if (!this.isAlive) return;
        
        // Flip sprite based on movement direction
        this.setFlipX(this.body.velocity.x < 0);
        
        // Bounce off screen edges with slight randomization
        if (this.body.blocked.left || this.body.blocked.right) {
            this.body.velocity.y += Phaser.Math.Between(-50, 50);
        }
        if (this.body.blocked.up || this.body.blocked.down) {
            this.body.velocity.x += Phaser.Math.Between(-50, 50);
        }
        
        // Normalize velocity to maintain constant speed
        const currentVelocity = new Phaser.Math.Vector2(this.body.velocity.x, this.body.velocity.y);
        currentVelocity.normalize().scale(this.speed);
        this.body.setVelocity(currentVelocity.x, currentVelocity.y);

        // Update health bar position
        this.updateHealthBar();
    }
} 