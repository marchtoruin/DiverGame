import Phaser from 'phaser';

export default class DebugMapScene extends Phaser.Scene {
    constructor() {
        super({ key: 'DebugMapScene' });
    }

    create() {
        // Set background color
        this.cameras.main.setBackgroundColor('#000033');

        // Add title text
        this.add.text(this.cameras.main.centerX, 100, 'Debug Map Selection', {
            font: 'bold 32px Arial',
            fill: '#ffffff'
        }).setOrigin(0.5);

        // Create level 1 button
        const level1Button = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY - 50,
            200,
            50,
            0x6666ff
        ).setInteractive({ useHandCursor: true });

        this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY - 50,
            'Level 1',
            {
                font: '24px Arial',
                fill: '#ffffff'
            }
        ).setOrigin(0.5);

        // Create level 2 button
        const level2Button = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY + 50,
            200,
            50,
            0x6666ff
        ).setInteractive({ useHandCursor: true });

        this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY + 50,
            'Level 2',
            {
                font: '24px Arial',
                fill: '#ffffff'
            }
        ).setOrigin(0.5);

        // Add hover effects
        [level1Button, level2Button].forEach(button => {
            button.on('pointerover', () => {
                button.setFillStyle(0x8888ff);
            });
            button.on('pointerout', () => {
                button.setFillStyle(0x6666ff);
            });
            button.on('pointerdown', () => {
                button.setFillStyle(0x4444ff);
            });
            button.on('pointerup', () => {
                button.setFillStyle(0x8888ff);
            });
        });

        // Add click handlers
        level1Button.on('pointerup', () => {
            this.scene.start('GameScene', { level: 'level1' });
        });

        level2Button.on('pointerup', () => {
            this.scene.start('GameScene', { level: 'level2' });
        });
    }
} 