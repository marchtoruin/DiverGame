import Phaser from 'phaser';

export default class DefaultArmSystem {
    constructor(scene) {
        this.scene = scene;
        this.arm = null;
        this.active = true;
        this.isFacingLeft = false;
        
        // Store pivot points
        this.pivotPoints = {
            'arms': { x: 7, y: 5 },        // Regular right arm
            'arms_left': { x: 81, y: 5 }   // Regular left arm
        };

        // Shoulder offset matches original values
        this.shoulderOffset = {
            x: { left: 3, right: -3 },
            y: -47
        };
    }

    create(player) {
        if (!player || !player.sprite) {
            console.warn('DefaultArmSystem: Cannot create arm without valid player');
            return;
        }

        // Only create if we have the required texture
        if (!this.scene.textures.exists('arms')) {
            console.error('DefaultArmSystem: Required texture "arms" not found');
            return;
        }

        // Create the arm sprite
        this.arm = this.scene.add.sprite(
            player.sprite.x,
            player.sprite.y,
            'arms'
        );

        // Calculate normalized pivot points
        const texture = this.scene.textures.get('arms');
        const width = texture.source[0].width;
        const height = texture.source[0].height;

        // Set initial pivot point for right-facing arm
        const rightPivot = this.pivotPoints['arms'];
        this.arm.setOrigin(rightPivot.x / width, rightPivot.y / height);
        
        // Set depth to be just above player but below obstacles
        this.arm.setDepth(4.5);
        this.arm.setVisible(true);

        console.log('DefaultArmSystem: Arm created successfully');
    }

    update(player, pointer) {
        if (!this.active || !this.arm || !player?.sprite) return;

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
        this.arm.x = playerX + shoulderOffsetX;
        this.arm.y = playerY + this.shoulderOffset.y;

        // Update arm texture if direction changed
        if (this.isFacingLeft !== isFacingLeft) {
            this.isFacingLeft = isFacingLeft;
            const desiredKey = isFacingLeft ? 'arms_left' : 'arms';
            this.arm.setTexture(desiredKey);

            // Reset any flip state
            this.arm.setFlipX(false);
            this.arm.setFlipY(false);

            // Apply the correct pivot origin
            const pivot = this.pivotPoints[desiredKey];
            const texture = this.scene.textures.get(desiredKey);
            const width = texture.source[0].width;
            const height = texture.source[0].height;
            this.arm.setOrigin(pivot.x / width, pivot.y / height);
        }

        // Calculate true aim direction
        const rawAngle = Phaser.Math.Angle.Between(
            this.arm.x, this.arm.y,
            worldMouseX, worldMouseY
        );

        // Store the raw angle for systems that need true direction
        this.arm.trueDirection = rawAngle;

        // Get visual angle with clamping
        let visualAngle = rawAngle;
        const isAbove = worldMouseY < this.arm.y;

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

        // Apply the rotation
        this.arm.setRotation(visualAngle);
        this.arm.finalRotation = visualAngle;

        // Calculate arm tip position for bullet spawning
        const armLength = 70;
        this.arm.tipX = this.arm.x + Math.cos(this.arm.trueDirection) * armLength;
        this.arm.tipY = this.arm.y + Math.sin(this.arm.trueDirection) * armLength;
    }

    setActive(active) {
        this.active = active;
        if (this.arm) {
            this.arm.setVisible(active);
        }
    }

    destroy() {
        if (this.arm) {
            this.arm.destroy();
            this.arm = null;
        }
    }
} 