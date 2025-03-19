Key Points
It seems likely that Phaser.js can be used to create a 2D underwater exploration game with basic features like player movement, oxygen management, and UI elements.
Research suggests that setting up Phaser 3 involves configuring game settings, loading assets, and defining scene functions for preload, create, and update.
The evidence leans toward using Phaser's arcade physics for player movement with acceleration and drag to simulate an underwater feel, and for collision detection with obstacles.
It appears that oxygen depletion can be managed over time, with refills triggered by overlapping with air pockets, and displayed via a UI oxygen bar.
Game Setup and Player Movement
Phaser.js, a popular framework for HTML5 games, is well-suited for your 2D underwater exploration game. To start, you'll need to set up a basic Phaser 3 configuration with a width of 800 pixels and height of 600 pixels, using arcade physics for movement and collision detection. Player movement can be controlled using WASD or arrow keys, with acceleration set to 100 and drag to 100 to simulate the underwater feel, ensuring smooth, momentum-based movement. This setup also includes collision detection to prevent the player from passing through obstacles like rocks or cave walls.
Oxygen System and UI
The oxygen system will deplete at a rate of 1 unit per second, starting with a maximum of 100 units. When the player overlaps with air pockets, oxygen refills to maximum instantly, with a mechanism to prevent continuous refilling while overlapping. A simple UI oxygen bar, displayed as a green rectangle scaling with oxygen levels, will update in real-time, positioned at the top-left corner of the screen with a black background for contrast.
Starter Code
Below is the starter code you can copy and paste into Cursor for further iteration. Ensure you have the necessary asset images (underwater_bg.png, diver.png, air_pocket.png, rock.png) in an "assets" folder, or replace the file names with your own.
javascript
import Phaser from 'phaser';

class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    preload() {
        this.load.image('background', 'assets/underwater_bg.png');
        this.load.image('player', 'assets/diver.png');
        this.load.image('air_pocket', 'assets/air_pocket.png');
        this.load.image('obstacle', 'assets/rock.png');
    }

    create() {
        this.add.image(0, 0, 'background').setOrigin(0, 0);

        this.player = this.physics.add.sprite(400, 300, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.setAcceleration(100);
        this.player.setDrag(100);
        this.player.setMaxVelocity(200);

        this.airPockets = this.physics.add.group();
        for (let i = 0; i < 5; i++) {
            const x = Phaser.Math.Between(100, 700);
            const y = Phaser.Math.Between(100, 500);
            this.airPockets.create(x, y, 'air_pocket');
        }

        this.obstacles = this.physics.add.staticGroup();
        this.obstacles.create(200, 200, 'obstacle');
        this.obstacles.create(400, 400, 'obstacle');

        this.physics.add.collider(this.player, this.obstacles);
        this.physics.add.overlap(this.player, this.airPockets, this.refillOxygen, null, this);

        this.maxOxygen = 100;
        this.currentOxygen = this.maxOxygen;
        this.refilling = false;

        this.oxygenBarBG = this.add.rectangle(10, 10, 200, 20, 0x000000);
        this.oxygenBarBG.setOrigin(0, 0);
        this.oxygenBar = this.add.rectangle(10, 10, 200, 20, 0x00ff00);
        this.oxygenBar.setOrigin(0, 0);
        this.add.text(10, 35, 'Oxygen', { font: '16px Arial', color: '#ffffff' });

        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = {
            up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
        };
    }

    update(time, delta) {
        this.currentOxygen -= (delta / 1000) * 1;
        this.currentOxygen = Phaser.Math.Clamp(this.currentOxygen, 0, this.maxOxygen);
        if (this.currentOxygen == 0) {
            this.gameOver();
        }

        this.oxygenBar.width = (this.currentOxygen / this.maxOxygen) * 200;

        if (this.cursors.left.isDown || this.keys.left.isDown) {
            this.player.setAccelerationX(-100);
        } else if (this.cursors.right.isDown || this.keys.right.isDown) {
            this.player.setAccelerationX(100);
        } else {
            this.player.setAccelerationX(0);
        }

        if (this.cursors.up.isDown || this.keys.up.isDown) {
            this.player.setAccelerationY(-100);
        } else if (this.cursors.down.isDown || this.keys.down.isDown) {
            this.player.setAccelerationY(100);
        } else {
            this.player.setAccelerationY(0);
        }

        if (!this.physics.world.overlap(this.player, this.airPockets)) {
            this.refilling = false;
        }
    }

    refillOxygen(player, airPocket) {
        if (!this.refilling) {
            this.currentOxygen = this.maxOxygen;
            this.refilling = true;
        }
    }

    gameOver() {
        this.add.text(400, 300, 'Game Over', { font: '48px Arial', color: '#ffffff' }).setOrigin(0.5);
        this.player.setActive(false);
        this.player.setVisible(false);
        this.physics.world.remove(this.player);
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }
        }
    },
    scene: GameScene
};

const game = new Phaser.Game(config);
Detailed Analysis and Implementation Notes
This section provides a comprehensive breakdown of the implementation, expanding on the direct answer with detailed considerations and technical insights derived from the analysis process. The goal is to offer a thorough understanding for further development and iteration, particularly for a 2D underwater exploration game using Phaser.js and Node.js, focusing on the requested starter code elements.
Game Framework and Setup
Phaser.js, an open-source framework for HTML5 games, is particularly suitable for 2D game development, offering features like physics, input handling, and scene management. For this project, Phaser 3 was chosen due to its modern class-based scene system and robust arcade physics, which align with the game's requirements. The setup involves initializing a game instance with a configuration object specifying a canvas size of 800x600 pixels, using Phaser.AUTO for rendering (automatically choosing between Canvas and WebGL), and enabling arcade physics with no gravity for a 2D underwater environment.
The game is structured using a GameScene class extending Phaser.Scene, which includes methods for preload, create, and update. This class-based approach, recommended in Phaser 3 documentation, provides flexibility for managing game states and logic. Given the project's Node.js context, it's assumed that Phaser is installed via npm (npm install phaser) and the game runs client-side, with Node.js potentially used for project management and bundling (e.g., with Parcel or Webpack).
Asset Loading and Initial Scene Setup
In the preload function, assets are loaded to ensure they are available before the game starts. For this starter code, the following images are assumed: underwater_bg.png for the background, diver.png for the player, air_pocket.png for air pockets, and rock.png for obstacles. These are loaded using this.load.image, with file paths pointing to an "assets" folder. Note that the user must ensure these assets exist or replace the file names with their own, as no specific assets were provided.
The create function initializes the game world by adding the background image at the top-left corner (using setOrigin(0, 0) for precise positioning). This provides a static backdrop, with plans for a parallax effect deferred for later iterations as per the user's focus on essentials.
Player Movement and Physics
The player, represented by a sprite loaded as "player," is created with physics enabled via this.physics.add.sprite. Positioned at (400, 300) for the center of the screen, the player is set to collide with world bounds using setCollideWorldBounds(true) to prevent escaping the game area. To simulate an underwater feel with slight momentum, the player's physics body is configured with:
Acceleration set to 100 using setAcceleration(100), allowing gradual speed increase.
Drag set to 100 using setDrag(100), simulating water resistance to slow down when no input is given.
Maximum velocity capped at 200 using setMaxVelocity(200) to prevent excessive speed, enhancing the underwater movement feel.
Movement is handled in the update function, responding to both WASD keys and arrow keys. Keyboard inputs are set up using createCursorKeys for arrows and manually adding WASD keys via addKey for each direction (W, A, S, D). The movement logic uses acceleration rather than direct velocity changes, with the following implementation:
If left (A or left arrow) is pressed, set setAccelerationX(-100).
If right (D or right arrow) is pressed, set setAccelerationX(100).
If no horizontal input, set setAccelerationX(0).
Similarly for vertical movement with up (W or up arrow) and down (S or down arrow).
This approach ensures diagonal movement is possible by combining accelerations, and the drag effect provides a natural deceleration, mimicking water resistance. This setup aligns with the underwater exploration theme, offering a slower, more buoyant movement compared to air-based games.
Oxygen System Implementation
The oxygen system is critical, with a maximum capacity of 100 units initialized in create. The current oxygen level starts at maximum and depletes over time in the update function, calculated as this.currentOxygen -= (delta / 1000) * 1, where delta is the time elapsed since the last frame in milliseconds, ensuring frame-rate independent depletion at 1 unit per second. The Phaser.Math.Clamp function ensures the oxygen level stays between 0 and the maximum, preventing negative values.
When oxygen reaches zero, the gameOver function is called, displaying "Game Over" text centered on the screen (at 400, 300) with a font size of 48px Arial in white, and the player is deactivated (setActive(false)), hidden (setVisible(false)), and removed from physics (this.physics.world.remove(this.player)), effectively ending the game.
Air pockets, created as a group of 5 sprites at random positions within the screen (using Phaser.Math.Between(100, 700) for x and Phaser.Math.Between(100, 500) for y), allow oxygen refilling. An overlap detection is set up using this.physics.add.overlap(this.player, this.airPockets, this.refillOxygen, null, this), triggering the refillOxygen function when the player touches an air pocket. To prevent continuous refilling while overlapping, a refilling flag is used:
Initially false, set to true when refilling occurs, ensuring only one refill per overlap event.
In update, if no overlap is detected (!this.physics.world.overlap(this.player, this.airPockets)), refilling is set back to false, allowing future refills.
This mechanism ensures players can't exploit air pockets by staying in place, with refills setting currentOxygen to maxOxygen instantly.
User Interface for Oxygen Display
The UI oxygen bar is implemented using Phaser's graphics, with a black background rectangle (oxygenBarBG) at (10, 10) with dimensions 200x20 pixels, and a green fill rectangle (oxygenBar) initially at full width (200 pixels) to match full oxygen. The bar's width updates in update as this.oxygenBar.width = (this.currentOxygen / this.maxOxygen) * 200, scaling proportionally to the oxygen level. For clarity, "Oxygen" text is added below the bar at (10, 35) in 16px Arial, white color, enhancing user feedback.
This simple bar provides a visual indicator of oxygen status, with the green color contrasting against the black background for readability. Future iterations could enhance this with animations or additional styling, but for now, it meets the basic UI requirement.
Collision Detection with Obstacles
Basic collision detection is implemented for obstacles, represented by static physics objects. A group obstacles is created using this.physics.add.staticGroup(), with two example obstacles at (200, 200) and (400, 400) using the "obstacle" image. Collision is set up with this.physics.add.collider(this.player, this.obstacles), ensuring the player cannot pass through these objects. The player's physics body, by default, will collide and stop or bounce off immovable static bodies, with bounce set to zero (setBounce(0)) for natural stopping behavior, simulating underwater rocks or cave walls.
Considerations and Unexpected Details
An unexpected detail is the use of delta time for oxygen depletion, ensuring consistent gameplay across different frame rates, which is crucial for a smooth player experience but may require tuning for balance (e.g., adjusting depletion rate from 1 per second to faster for shorter gameplay sessions). Another consideration is the reusable nature of air pockets, assumed for simplicity, which might need to be consumable in later iterations for added challenge.
The implementation also assumes asset availability, with placeholders like "underwater_bg.png," which the user must replace, highlighting the need for asset preparation in game development. The choice of acceleration and drag for movement, while effective, might feel different from traditional platformers, offering a unique underwater exploration feel that could be further refined with buoyancy simulations in future iterations.
Tables for Reference
Below is a table summarizing key game parameters for quick reference:
Parameter
Value
Description
Game Width
800 pixels
Canvas width for the game
Game Height
600 pixels
Canvas height for the game
Player Acceleration
100
Rate of speed increase for movement
Player Drag
100
Resistance to slow down movement
Max Player Velocity
200
Maximum speed limit for player
Max Oxygen
100 units
Starting and maximum oxygen capacity
Oxygen Depletion Rate
1 unit/second
Rate at which oxygen decreases
Another table for asset loading details:
Asset Name
File
Purpose
Background
underwater_bg.png
Sets the underwater scene
Player
diver.png
Represents the diver character
Air Pocket
air_pocket.png
Oxygen refill points
Obstacle
rock.png
Represents underwater obstacles
These tables aid in understanding the initial setup and can be adjusted as needed for further development.
Conclusion
This starter code provides a foundation for your underwater exploration game, focusing on player movement with an underwater feel, oxygen management with UI display, and basic collision detection. It is designed for copy-pasting into Cursor for iteration, with placeholders for assets that you can replace. Future enhancements could include parallax backgrounds, oxygen tank upgrades, and more complex physics, but this meets the essential requirements for now.
Key Citations
Phaser 3 Documentation Overview
Phaser 3 Physics Arcade Guide