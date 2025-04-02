import Phaser from 'phaser';

export default class HarpoonSystem {
    constructor(scene) {
        this.scene = scene;
        this.active = false;
        this.harpoonArm = null;
        this.markerPosition = null;
        this.isFacingLeft = false;
        this.trueDirection = 0;
        this.lastShotTime = 0;
        this.shotDelay = 500; // Milliseconds between shots
        
        // Bind to weapon system changes
        this.scene.events.on('weaponChanged', this.onWeaponChanged, this);
        this.scene.events.on('weaponShootAttempt', this.onShootAttempt, this);
    }

    onWeaponChanged(weaponState) {
        const isHarpoonActive = weaponState.current === 'harpoon';
        
        // Only process if state actually changed
        if (this.active !== isHarpoonActive) {
            this.active = isHarpoonActive;
            
            // Show/hide harpoon arm
            if (this.harpoonArm) {
                this.harpoonArm.setVisible(this.active);
            }
            
            // If becoming active, ensure regular arm is hidden and disabled
            if (this.scene.diverArm) {
                this.scene.diverArm.setVisible(!this.active);
                // Completely disable the regular arm system
                this.scene.diverArm.active = !this.active;
                // Also disable bullet system if it exists
                if (this.scene.bulletSystem) {
                    this.scene.bulletSystem.enabled = !this.active;
                    this.scene.bulletSystem.isFiring = false; // Stop any active firing
                    this.scene.bulletSystem.lastFireTime = 0; // Reset fire timer
                }
            }
        }
    }

    onShootAttempt(data) {
        if (data.weapon === 'harpoon' && this.active && this.canShoot()) {
            this.shoot();
        }
    }

    findPivotPoint(texture) {
        // Get image dimensions for normalized coordinates
        const source = this.scene.textures.get(texture).getSourceImage();
        const width = source.width;
        const height = source.height;
        
        // Hardcoded pivot points for both regular and harpoon arms
        const pivotPoints = {
            'harpoon_arms_right': { x: 5, y: 7 },
            'harpoon_arms_left': { x: 76, y: 7 },
            'arms': { x: 7, y: 5 },          // Regular right arm
            'arms_left': { x: 81, y: 5 }     // Regular left arm
        };
        
        const point = pivotPoints[texture];
        
        if (point) {
            console.log(`[DEBUG] Using hardcoded pivot point for ${texture} at (${point.x}, ${point.y})`);
            return {
                x: point.x,
                y: point.y,
                normalizedX: point.x / width,
                normalizedY: point.y / height
            };
        }
        
        console.warn(`[ERROR] No pivot point defined for texture: ${texture}`);
        return null;
    }

    create(player) {
        if (!player || !player.sprite) return;

        // Find pivot points first
        const rightPivot = this.findPivotPoint('harpoon_arms_right');
        const leftPivot = this.findPivotPoint('harpoon_arms_left');

        if (!rightPivot || !leftPivot) {
            console.error('Failed to find pivot points for harpoon arms');
            return;
        }

        // Store pivot points
        this.markerPosition = {
            right: rightPivot,
            left: leftPivot
        };

        // Create the harpoon arm sprite
        this.harpoonArm = this.scene.add.sprite(
            player.sprite.x,
            player.sprite.y,
            'harpoon_arms_right'
        );

        // Set initial state
        this.harpoonArm.setDepth(7); // Above player
        this.harpoonArm.setOrigin(rightPivot.normalizedX, rightPivot.normalizedY);
        this.harpoonArm.setVisible(false); // Hidden by default
        this.active = false;

        // Match the regular arm's shoulder offset
        this.shoulderOffset = {
            x: { left: 3, right: -3 },
            y: -47
        };
    }

    update(player, pointer) {
        if (!this.active || !this.harpoonArm || !player || !player.sprite) return;

        // Get world mouse coordinates
        const worldMouseX = this.scene.cameras.main.scrollX + pointer.x;
        const worldMouseY = this.scene.cameras.main.scrollY + pointer.y;
        const playerX = player.sprite.x;
        const playerY = player.sprite.y;

        // Check if mouse is on left side of player
        const isMouseOnLeft = worldMouseX < playerX;

        // Update player facing direction based on mouse position
        player.sprite.flipX = isMouseOnLeft;
        const isFacingLeft = player.sprite.flipX;

        // Position the arm at the shoulder with fixed offsets
        const shoulderOffsetX = isFacingLeft ? this.shoulderOffset.x.left : this.shoulderOffset.x.right;
        this.harpoonArm.x = playerX + shoulderOffsetX;
        this.harpoonArm.y = playerY + this.shoulderOffset.y;

        // Update arm texture if direction changed
        if (this.isFacingLeft !== isFacingLeft) {
            this.isFacingLeft = isFacingLeft;
            const desiredKey = isFacingLeft ? 'harpoon_arms_left' : 'harpoon_arms_right';
            this.harpoonArm.setTexture(desiredKey);

            // Reset any flip state
            this.harpoonArm.setFlipX(false);
            this.harpoonArm.setFlipY(false);

            // Apply the correct pivot origin
            const pivot = isFacingLeft ? this.markerPosition.left : this.markerPosition.right;
            this.harpoonArm.setOrigin(pivot.normalizedX, pivot.normalizedY);
        }

        // Calculate true aim direction (used for bullet firing)
        const rawAngle = Phaser.Math.Angle.Between(
            this.harpoonArm.x, this.harpoonArm.y,
            worldMouseX, worldMouseY
        );

        // Store the raw angle for systems that need true direction
        this.harpoonArm.trueDirection = rawAngle;
        this.trueDirection = rawAngle;

        // Get visual angle with clamping
        let visualAngle = rawAngle;
        const isAbove = worldMouseY < this.harpoonArm.y;

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
        this.harpoonArm.setRotation(visualAngle);
        this.harpoonArm.finalRotation = visualAngle;

        // Calculate arm tip position for projectile spawning
        const armLength = 70;
        this.harpoonArm.tipX = this.harpoonArm.x + Math.cos(this.trueDirection) * armLength;
        this.harpoonArm.tipY = this.harpoonArm.y + Math.sin(this.trueDirection) * armLength;
    }

    canShoot() {
        return this.scene.time.now > this.lastShotTime + this.shotDelay;
    }

    shoot() {
        if (!this.active || !this.harpoonArm) return;

        // Update last shot time
        this.lastShotTime = this.scene.time.now;

        // Use the pre-calculated tip position for projectile spawn
        const spawnX = this.harpoonArm.tipX;
        const spawnY = this.harpoonArm.tipY;

        // Create harpoon projectile (using a placeholder sprite for now)
        const projectile = this.scene.add.sprite(spawnX, spawnY, 'bullet');
        projectile.setDepth(6);
        projectile.setScale(1.5);
        projectile.setTint(0xff00cc); // Magenta tint to distinguish from regular bullets
        projectile.setRotation(this.trueDirection);

        // Add physics
        this.scene.physics.add.existing(projectile);
        const speed = 600;
        projectile.body.setVelocity(
            Math.cos(this.trueDirection) * speed,
            Math.sin(this.trueDirection) * speed
        );

        // Destroy after 2 seconds
        this.scene.time.delayedCall(2000, () => {
            projectile.destroy();
        });
    }

    destroy() {
        if (this.harpoonArm) {
            this.harpoonArm.destroy();
        }
        this.scene.events.off('weaponChanged', this.onWeaponChanged, this);
        this.scene.events.off('weaponShootAttempt', this.onShootAttempt, this);
    }
} 