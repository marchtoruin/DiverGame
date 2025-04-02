import Phaser from 'phaser';

export default class WeaponSystem {
    constructor(scene) {
        this.scene = scene;
        
        // Available weapons
        this.weapons = ['default', 'harpoon'];
        this.currentWeaponIndex = 0;
        
        // Set up mouse wheel listener
        this.scene.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
            // Scroll up (deltaY < 0) = next weapon
            // Scroll down (deltaY > 0) = previous weapon
            if (deltaY < 0) {
                this.nextWeapon();
            } else if (deltaY > 0) {
                this.previousWeapon();
            }
        });

        // Handle shooting input centrally
        this.scene.input.on('pointerdown', (pointer) => {
            if (pointer.leftButtonDown()) {
                const currentWeapon = this.getCurrentWeapon();
                this.scene.events.emit('weaponShootAttempt', {
                    weapon: currentWeapon,
                    pointer: pointer
                });
            }
        });

        // Disable direct bullet system input handling
        if (this.scene.bulletSystem) {
            this.scene.bulletSystem.isFiring = false;
            this.scene.bulletSystem.enabled = false;
        }

        // Emit initial weapon state
        this.emitWeaponChanged(null, true);
    }

    getCurrentWeapon() {
        return this.weapons[this.currentWeaponIndex];
    }

    nextWeapon() {
        const previousWeapon = this.getCurrentWeapon();
        this.currentWeaponIndex = (this.currentWeaponIndex + 1) % this.weapons.length;
        this.emitWeaponChanged(previousWeapon);
    }

    previousWeapon() {
        const previousWeapon = this.getCurrentWeapon();
        this.currentWeaponIndex = (this.currentWeaponIndex - 1 + this.weapons.length) % this.weapons.length;
        this.emitWeaponChanged(previousWeapon);
    }

    emitWeaponChanged(previousWeapon, isInitial = false) {
        const current = this.getCurrentWeapon();
        
        // Update bullet system state based on weapon
        if (this.scene.bulletSystem) {
            this.scene.bulletSystem.enabled = (current === 'default');
            this.scene.bulletSystem.isFiring = false;
        }

        // Emit detailed state change
        this.scene.events.emit('weaponChanged', {
            current: current,
            previous: previousWeapon,
            isInitial: isInitial,
            state: {
                defaultGunEnabled: current === 'default',
                harpoonEnabled: current === 'harpoon'
            }
        });
    }

    destroy() {
        // Clean up event listeners
        this.scene.input.off('wheel');
        this.scene.input.off('pointerdown');
    }
} 