import { PLAYER } from '../utils/Constants';
import HealthBar from '../ui/HealthBar';

export default class HealthSystem {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;
        this.maxHealth = PLAYER.HEALTH.MAX;
        this.currentHealth = this.maxHealth;
        this.isInvulnerable = false;
        this.invulnerabilityDuration = 1000; // 1 second of invulnerability after taking damage
        this.lastDamageTime = 0;
        
        // Create health bar UI
        this.healthBar = new HealthBar(scene, {
            x: 10,
            y: 40, // Position below oxygen meter
            width: 200,
            height: 20
        });
        
        // Initialize health display
        this.updateHealthDisplay();
    }
    
    takeDamage(amount) {
        const now = Date.now();
        
        // Check invulnerability
        if (this.isInvulnerable && now - this.lastDamageTime < this.invulnerabilityDuration) {
            return;
        }
        
        // Apply damage
        this.currentHealth = Math.max(0, this.currentHealth - amount);
        this.lastDamageTime = now;
        this.isInvulnerable = true;
        
        // Update display
        this.updateHealthDisplay();
        
        // Visual feedback
        if (this.player?.sprite) {
            // Flash the player red
            this.scene.tweens.add({
                targets: this.player.sprite,
                alpha: 0.5,
                duration: 100,
                yoyo: true,
                repeat: 2,
                onComplete: () => {
                    if (this.player?.sprite) {
                        this.player.sprite.alpha = 1;
                    }
                }
            });
        }
        
        // Check for death
        if (this.currentHealth <= 0) {
            this.onDeath();
        }
        
        // Reset invulnerability and alpha after duration
        this.scene.time.delayedCall(this.invulnerabilityDuration, () => {
            this.isInvulnerable = false;
            if (this.player?.sprite) {
                this.player.sprite.alpha = 1;
                this.player.sprite.clearTint();
            }
        });
    }
    
    heal(amount) {
        this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
        this.updateHealthDisplay();
    }
    
    updateHealthDisplay() {
        if (this.healthBar) {
            this.healthBar.updateHealth(this.currentHealth, this.maxHealth);
        }
    }
    
    onDeath() {
        if (this.player) {
            // Emit death event for other systems to handle
            this.scene.events.emit('playerDeath');
            
            // Visual feedback
            if (this.player.sprite) {
                this.player.sprite.setTint(0xff0000);
                
                // Add death animation
                this.scene.tweens.add({
                    targets: this.player.sprite,
                    alpha: 0,
                    y: this.player.sprite.y + 50,
                    duration: 1000,
                    ease: 'Power2',
                    onComplete: () => {
                        // Handle game over or respawn logic
                        this.scene.events.emit('gameOver');
                    }
                });
            }
        }
    }
    
    reset() {
        this.currentHealth = this.maxHealth;
        this.isInvulnerable = false;
        this.lastDamageTime = 0;
        this.updateHealthDisplay();
        
        if (this.player?.sprite) {
            this.player.sprite.clearTint();
            this.player.sprite.alpha = 1;
        }
    }
    
    update() {
        // Update invulnerability visual effect
        if (this.isInvulnerable && this.player?.sprite) {
            const flickerSpeed = 100; // ms
            const alpha = Math.sin(Date.now() / flickerSpeed) * 0.3 + 0.7;
            this.player.sprite.setAlpha(alpha);
        } else if (this.player?.sprite && !this.isInvulnerable) {
            // Ensure alpha is reset when not invulnerable
            this.player.sprite.setAlpha(1);
        }
    }
    
    destroy() {
        if (this.healthBar) {
            this.healthBar.destroy();
        }
    }
} 