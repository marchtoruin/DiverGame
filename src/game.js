import Phaser from 'phaser';
import diverImg from './assets/diver2.png';
import airPocket1Img from './assets/air_pocket1.png';
import airPocket2Img from './assets/air_pocket2.png';
import airPocket3Img from './assets/air_pocket3.png';
import rockImg from './assets/rock2.png';
import rock3Img from './assets/rock3.png';
import bubbleImg from './assets/bubble.png';
import bgMusic from './assets/music/bg_music.mp3';
import ambienceMusic from './assets/music/ambience_underwater.wav';
import underwaterBg from './assets/underwater_bg.png';  // This is correct - in the assets folder
import blackAndBlueImg from './assets/BlackNblues.png';  // Add this import
import level1Data from './assets/maps/level1.json';  // Re-enable the import

class GameScene extends Phaser.Scene {
    constructor() {
        super({ 
            key: 'GameScene'
        });
        
        // Configure physics separately in the init method
        this.isMuted = false;
        this.musicVolume = 0.5; // Default volume
        this.boostActive = false; // Track if boost is active
        this.boostCooldown = false; // Track if boost is on cooldown
        this.boostCooldownTime = 0; // Time when cooldown ends
        this.bubbleEffectsEnabled = false; // Start with bubble effects disabled
        this.touchData = {
            startX: 0,
            startY: 0,
            isMoving: false
        };
    }
    
    init() {
        // Configure physics system with proper settings
        this.physics.world.setBounds(0, 0, 1600, 1200); // Default until map loads
        
        // Create collision groups to better manage collisions
        // Only enable debug body if debug graphics are available
        if (this.physics.config.debug && this.physics.world.debugGraphic) {
            this.physics.world.enableBody(this.physics.world.debugGraphic);
        }
        
        console.log('Physics system initialized');
    }
    
    preload() {
        // Add loading error handlers
        this.load.on('loaderror', (fileObj) => {
            console.error('Error loading asset:', fileObj.src);
        });

        this.load.on('complete', () => {
            console.log('All assets loaded successfully');
        });

        // Load all images first with their explicit keys that match the Tiled tileset names
        this.load.image('Blue_background', underwaterBg);
        this.load.image('blackAndBlue', blackAndBlueImg);
        
        // Other images
        this.load.image('player', diverImg);
        this.load.image('air_pocket1', airPocket1Img);
        this.load.image('air_pocket2', airPocket2Img);
        this.load.image('air_pocket3', airPocket3Img);
        this.load.image('rock', rockImg);
        this.load.image('obstacle', rock3Img);
        this.load.image('bubble', bubbleImg);
        
        // Load audio
        this.load.audio('music', bgMusic);
        this.load.audio('ambience', ambienceMusic);
        
        // Load the tilemap JSON file
        this.load.tilemapTiledJSON('level1', level1Data);
    }

    create() {
        console.log("Creating map from tilemap JSON data");
        
        try {
            // Create the map from the loaded JSON file
            this.map = this.make.tilemap({ key: 'level1' });
            
            // Debug: Log layer information
            if (this.map && this.map.layers) {
                console.log('Map loaded. Layers:', this.map.layers.map(layer => layer.name));
                console.log('Tilemap layer count:', this.map.layers.length);
                console.log('Map object layers:', this.map.objects ? this.map.objects.map(layer => layer.name) : 'None');
                console.log('Map object layer count:', this.map.objects ? this.map.objects.length : 0);
                
                if (this.map.objects && this.map.objects.length > 0) {
                    this.map.objects.forEach((layer, index) => {
                        console.log(`Object layer ${index}: name=${layer.name}, objects=${layer.objects ? layer.objects.length : 0}`);
                    });
                }
                
                // Log tileset info for debugging
                console.log('Tileset info:', this.map.tilesets.map(tileset => ({
                    name: tileset.name,
                    firstgid: tileset.firstgid,
                    tileCount: tileset.total,
                    image: tileset.image
                })));
                
                // Detailed inspection of tileset data
            } else {
                console.error('Map not loaded properly or has no layers');
            }
        } catch (error) {
            console.error('Error creating map:', error);
            // Create a fallback map
            this.createFallbackMap();
        }
        
        // Add music system
        this.setupMusicSystem();

        // Create the tilemap (this is our new background)
        this.createTiledMap();

        console.log("World bounds set to:", this.physics.world.bounds.width, this.physics.world.bounds.height);

        // Find player spawn point from the map
        this.playerSpawnPoint = this.findPlayerSpawn();
        console.log("Player spawn point set to:", this.playerSpawnPoint.x, this.playerSpawnPoint.y);
        
        // IMPORTANT: We will NOT validate or adjust the spawn point - player must spawn EXACTLY where placed in Tiled
        
        // Create player at the spawn point from the map
        console.log('Creating player at spawn position:', this.playerSpawnPoint.x, this.playerSpawnPoint.y);
        
        this.player = this.physics.add.sprite(
            this.playerSpawnPoint.x, 
            this.playerSpawnPoint.y,
            'player'
        );
        
        console.log("Player created at:", this.player.x, this.player.y);
        
        // CRITICAL FIX: Ensure player has proper physics body for collisions
        this.player.setCollideWorldBounds(false);
        
        // IMPORTANT: Set a proper sized hitbox - adjusted to match sprite visible area better
        // We need a larger hitbox as the image shows the player needs a bigger collision area
        this.player.body.setSize(80, 120, true); // Increased from 70x100 to better match the sprite
        this.player.body.setOffset(5, 5); // Adjusted to better center the hitbox on the sprite
        
        // Configure other physics properties for the player
        this.player.setDrag(100);
        this.player.setMaxVelocity(300);  // Will be adjusted in update based on boost state
        this.player.setDepth(3); // Player should be above obstacle layer

        // Make the player's physics body more reliable for collisions
        this.player.body.setBounce(0.1); // Add slight bounce like air pockets
        this.player.body.setFriction(0.1, 0.1);
        
        // CRITICAL FIX FOR COLLISION DETECTION: Make player immovable = true like air pockets
        // This is likely why air pockets collide but player doesn't
        this.player.body.setImmovable(true);  // Set to true like air pockets
        this.player.body.pushable = false;   // Match air pocket settings

        // Initialize boost state - ensure boost is OFF initially
        this.boostActive = false;
        this.boostCooldown = false;
        this.boostCooldownTime = 0;

        // IMPORTANT: Set overflow check to prevent tunneling through objects
        // This ensures multiple checks per step for fast-moving objects
        this.physics.world.TILE_BIAS = 64; // Increase the tile bias (default is 16)

        // Make the player's physics body more visible in debug mode
        if (this.physics.config.debug) {
            this.player.body.debugBodyColor = 0x0088ff; // Bright blue for player body
            this.player.body.debugShowBody = true;
            this.player.body.debugShowVelocity = true;
            console.log('Enhanced player physics debug enabled');
        }
        
        // Add debug info for player body
        console.log('Player physics body:', {
            width: this.player.body.width,
            height: this.player.body.height,
            offsetX: this.player.body.offset.x,
            offsetY: this.player.body.offset.y,
            enabled: this.player.body.enable
        });

        // Initialize the air pockets group
        console.log('Creating air pockets...');
        this.airPockets = this.physics.add.group();

        // IMPORTANT: Explicitly clear any existing physics group colliders
        // This ensures no leftover collision data persists
        if (this.physics.world.colliders) {
            console.log('Cleaning up any existing physics colliders for air pockets');
            this.physics.world.colliders.getActive().forEach(collider => {
                if (collider.object1 === this.airPockets || 
                    (Array.isArray(collider.object1) && collider.object1.includes(this.airPockets)) ||
                    collider.object2 === this.airPockets || 
                    (Array.isArray(collider.object2) && collider.object2.includes(this.airPockets))) {
                    this.physics.world.removeCollider(collider);
                    console.log('Removed old air pocket collider');
                }
            });
        }
        
        // Track spawned locations and respawn timers
        this.airPocketSpawnPoints = [];
        
        // Spawn air pockets from Tiled map only
        this.spawnTiledAirPockets();
        
        // Create player bubble trail (disabled by default - will enable on first movement)
        this.bubbleEmitter = this.add.particles(0, 0, 'bubble', {
            follow: this.player,
            followOffset: { x: 10, y: -32 },
            lifespan: 3000,
            gravityY: -50,
            speed: { min: 40, max: 80 },
            scale: { start: 0.1, end: 0.02 },
            alpha: { start: 0.6, end: 0 },
            angle: { min: 250, max: 290 },
            rotate: { min: -180, max: 180 },
            frequency: 300,
            quantity: 1,
            emitZone: { 
                type: 'random',
                source: new Phaser.Geom.Circle(10, -32, 5)
            }
        }).setDepth(3.5);
        
        // Disable emitter initially
        this.bubbleEmitter.stop();

        // Create a separate emitter for movement bursts (disabled by default)
        this.movementBurstEmitter = this.add.particles(0, 0, 'bubble', {
            follow: this.player,
            followOffset: { x: 0, y: 0 },
            lifespan: 1000, // Shorter lifespan for jet effect
            gravityY: -20, // Less gravity for straighter path
            speed: { min: 250, max: 400 }, // Much faster for jet blast effect
            scale: { start: 0.2, end: 0.05 },
            alpha: { start: 0.9, end: 0 },
            angle: { min: 170, max: 190 }, // Will be adjusted based on player direction
            rotate: { min: -15, max: 15 }, // Less rotation for more directional appearance
            frequency: 20, // More frequent emission for denser jet effect
            quantity: 3, // Emit more bubbles for density
            tint: [ 0xffffff, 0xccccff ], // Add slight blue tint to some bubbles
            emitZone: { 
                type: 'random',
                source: new Phaser.Geom.Circle(0, 0, 3) // Smaller emission zone for focused jet
            }
        }).setDepth(3.5);
        
        // Disable emitter initially
        this.movementBurstEmitter.stop();
        
        // Player movement tracking
        this.playerMovement = {
            prevDirection: { x: 0, y: 0 },
            isMoving: false,
            lastBurstTime: 0
        };

        // Set up camera to follow player
        this.cameras.main.setBounds(0, 0, this.physics.world.bounds.width, this.physics.world.bounds.height);
        this.cameras.main.startFollow(this.player);
        this.cameras.main.setDeadzone(200, 200);

        // Add debug visualization for world boundaries
        if (this.physics.config.debug) {
            const worldBounds = this.physics.world.bounds;
            const worldBoundaryGraphics = this.add.graphics();
            worldBoundaryGraphics.lineStyle(4, 0x00ff00, 1); // Green line, 4px width
            worldBoundaryGraphics.strokeRect(
                worldBounds.x, 
                worldBounds.y, 
                worldBounds.width, 
                worldBounds.height
            );
            console.log('World boundary visualization enabled');
        }

        // Add overlap for oxygen refill
        this.physics.add.overlap(
            this.player, 
            this.airPockets, 
            this.refillOxygen, 
            (player, airPocket) => {
                // Only allow overlap if both objects exist and are active
                return player && player.active && airPocket && airPocket.active;
            }, 
            this
        );

        // Create UI elements that stay fixed to the camera
        this.maxOxygen = 100;
        this.currentOxygen = this.maxOxygen;

        this.oxygenBarBG = this.add.rectangle(20, 20, 400, 40, 0x000000); // 2x original size
        this.oxygenBarBG.setScrollFactor(0);
        this.oxygenBarBG.setOrigin(0, 0);
        this.oxygenBarBG.setDepth(10); // Set high depth value
        
        this.oxygenBar = this.add.rectangle(20, 20, 400, 40, 0x00ff00); // 2x original size
        this.oxygenBar.setScrollFactor(0);
        this.oxygenBar.setOrigin(0, 0);
        this.oxygenBar.setDepth(10); // Set high depth value
        
        const oxygenText = this.add.text(20, 70, 'Oxygen', { font: '32px Arial', color: '#ffffff' }); // 2x original font size
        oxygenText.setScrollFactor(0);
        oxygenText.setDepth(10); // Set high depth value

        // Add hint text for R key to respawn air pockets
        const respawnHint = this.add.text(20, 120, 'Press R to respawn air pockets', { 
            font: '24px Arial', 
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 5, y: 5 }
        });
        respawnHint.setScrollFactor(0);
        respawnHint.setDepth(10);

        // Add hint text for boost key
        const boostHint = this.add.text(20, 170, 'SPACE: Boost (uses oxygen)', { 
            font: '24px Arial', 
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 5, y: 5 }
        });
        boostHint.setScrollFactor(0);
        boostHint.setDepth(10);

        // Set up controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = {
            up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            boost: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
        };

        // Add key listener for X to fix collision
        this.input.keyboard.on('keydown-X', () => {
            console.log('X key pressed - Fixing collision data');
            this.fixTiledCollisions();
            if (this.playerObstacleCollider) {
                this.physics.world.removeCollider(this.playerObstacleCollider);
            }
            this.playerObstacleCollider = this.physics.add.collider(
                this.player,
                this.obstaclesLayer
            );
            console.log('Collision system completely rebuilt');
        });

        // Add key listener for R to respawn all air pockets
        this.input.keyboard.on('keydown-R', () => {
            console.log('R key pressed - Respawning all air pockets');
            this.respawnAllAirPockets();
        });

        // Add touch controls
        this.setupTouchControls();
    }

    setupTouchControls() {
        // Create a semi-transparent touch joystick background with purple color (0x800080)
        // Increased size to 90 (from 70) and moved position up and right
        this.touchArea = this.add.circle(150, this.cameras.main.height - 200, 90, 0x800080, 0.3);
        this.touchArea.setScrollFactor(0);
        this.touchArea.setDepth(100);
        this.touchArea.setInteractive();

        // Create boost button (also moved up to match joystick height)
        this.boostButton = this.add.circle(this.cameras.main.width - 100, this.cameras.main.height - 150, 40, 0x00ff00, 0.5);
        this.boostButton.setScrollFactor(0);
        this.boostButton.setDepth(100);
        this.boostButton.setAlpha(0.5);
        this.boostButton.setInteractive();

        // Add text to boost button (adjusted to match new button position)
        this.boostText = this.add.text(this.boostButton.x, this.boostButton.y, 'BOOST', {
            font: '16px Arial',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.boostText.setScrollFactor(0);
        this.boostText.setDepth(100);

        // Track touch states
        this.touchData = {
            isMoving: false,
            startX: 0,
            startY: 0,
            isBoosting: false
        };

        // Handle touch start
        this.input.on('pointerdown', (pointer) => {
            if (this.touchArea.getBounds().contains(pointer.x, pointer.y)) {
                this.touchData.isMoving = true;
                this.touchData.startX = pointer.x;
                this.touchData.startY = pointer.y;
            }
            // Check boost button separately to allow simultaneous movement and boost
            if (this.boostButton.getBounds().contains(pointer.x, pointer.y)) {
                this.touchData.isBoosting = true;
                this.keys.boost.isDown = true;
            }
        });

        // Handle touch move
        this.input.on('pointermove', (pointer) => {
            if (this.touchData.isMoving) {
                const deltaX = pointer.x - this.touchData.startX;
                const deltaY = pointer.y - this.touchData.startY;
                
                // Simulate WASD key presses based on touch movement
                // Clear previous simulated keys
                this.keys.left.isDown = false;
                this.keys.right.isDown = false;
                this.keys.up.isDown = false;
                this.keys.down.isDown = false;

                // Set appropriate keys based on movement direction
                if (Math.abs(deltaX) > 10) { // Small threshold to prevent jitter
                    if (deltaX < 0) {
                        this.keys.left.isDown = true;
                    } else {
                        this.keys.right.isDown = true;
                    }
                }
                
                if (Math.abs(deltaY) > 10) {
                    if (deltaY < 0) {
                        this.keys.up.isDown = true;
                    } else {
                        this.keys.down.isDown = true;
                    }
                }

                // Update player facing direction
                if (deltaX < 0) {
                    this.player.setFlipX(true);
                } else if (deltaX > 0) {
                    this.player.setFlipX(false);
                }
            }
        });

        // Handle touch end
        this.input.on('pointerup', (pointer) => {
            // Check if this pointer was the one that started moving
            if (this.touchData.isMoving) {
                // Clear all simulated movement key states
                this.keys.left.isDown = false;
                this.keys.right.isDown = false;
                this.keys.up.isDown = false;
                this.keys.down.isDown = false;
                this.touchData.isMoving = false;
            }
            
            // Check if this pointer was the one boosting
            if (this.touchData.isBoosting && this.boostButton.getBounds().contains(pointer.x, pointer.y)) {
                this.keys.boost.isDown = false;
                this.touchData.isBoosting = false;
            }
        });

        // Make controls responsive to screen size
        this.scale.on('resize', this.resizeControls, this);
        this.resizeControls();
    }

    resizeControls() {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        // Update joystick position with new coordinates
        this.touchArea.setPosition(150, height - 200);

        // Update boost button position
        this.boostButton.setPosition(width - 100, height - 150);
        this.boostText.setPosition(width - 100, height - 150);
    }

    update(time, delta) {
        // First, check if player is still active
        if (!this.player.active || !this.player.body) {
            console.log('Player inactive or missing body!');
            return;
        }

        // IMPROVED DEBUG VISUALIZATION: Track collisions in real-time
        if (this.physics.config.debug && this.player && this.player.body && this.obstaclesLayer) {
            // Find the tile at the player's current position
            const tileX = Math.floor(this.player.x / this.map.tileWidth);
            const tileY = Math.floor(this.player.y / this.map.tileHeight);
            
            // Check surrounding tiles (3x3 grid centered on player)
            let collidingTiles = 0;
            let collisionText = "";
            
            // Add debugging for world bounds
            const inWorldBounds = this.player.x >= 0 && 
                                this.player.x <= this.physics.world.bounds.width &&
                                this.player.y >= 0 && 
                                this.player.y <= this.physics.world.bounds.height;
            
            // Create or update debug text for player body
            if (!this.playerBodyDebugText) {
                this.playerBodyDebugText = this.add.text(10, 250, '', { 
                    font: '14px Arial', 
                    fill: '#ffff00',
                    backgroundColor: '#000000',
                    padding: { x: 5, y: 5 }
                }).setScrollFactor(0).setDepth(100);
            }
            
            // Update player physics body debug info
            this.playerBodyDebugText.setText(
                `Player body: ${this.player.body.width}x${this.player.body.height} @ (${this.player.body.offset.x},${this.player.body.offset.y})\n` +
                `Immovable: ${this.player.body.immovable}, Pushable: ${!this.player.body.pushable}\n` +
                `Velocity: (${Math.floor(this.player.body.velocity.x)},${Math.floor(this.player.body.velocity.y)})`
            );
            
            // Check if player is overlapping with any obstacle tiles
            let playerOverlappingObstacle = false;
            const playerBounds = this.player.getBounds();
            
            for (let y = tileY - 1; y <= tileY + 1; y++) {
                for (let x = tileX - 1; x <= tileX + 1; x++) {
                    const tile = this.obstaclesLayer.getTileAt(x, y);
                    if (tile && tile.index !== -1) {
                        // Calculate tile bounds
                        const tileBounds = {
                            x: tile.x * this.map.tileWidth,
                            y: tile.y * this.map.tileHeight,
                            width: this.map.tileWidth,
                            height: this.map.tileHeight
                        };
                        
                        // Check for overlap between player and this tile
                        if (Phaser.Geom.Rectangle.Overlaps(playerBounds, tileBounds)) {
                            playerOverlappingObstacle = true;
                            collidingTiles++;
                            
                            // Highlight this tile with a bright flash
                            this.time.delayedCall(0, () => {
                                const highlightGraphics = this.add.graphics();
                                highlightGraphics.fillStyle(0xff0000, 0.5);
                                highlightGraphics.fillRect(
                                    x * this.map.tileWidth, 
                                    y * this.map.tileHeight,
                                    this.map.tileWidth,
                                    this.map.tileHeight
                                );
                                
                                this.time.delayedCall(300, () => {
                                    highlightGraphics.destroy();
                                });
                            });
                            
                            collisionText += `Tile at (${x},${y}) index=${tile.index}\n`;
                        }
                    }
                }
            }
            
            // If player is stuck in a wall, try to push them out
            if (playerOverlappingObstacle && !this.noClipMode) {
                console.log("EMERGENCY: Player detected inside obstacle - attempting to fix position");
                
                // Find nearest non-colliding position
                const directions = [
                    { x: 0, y: -1 }, // Up
                    { x: 0, y: 1 },  // Down
                    { x: -1, y: 0 }, // Left
                    { x: 1, y: 0 },  // Right
                    { x: -1, y: -1 }, // Up-Left
                    { x: 1, y: -1 },  // Up-Right
                    { x: -1, y: 1 },  // Down-Left
                    { x: 1, y: 1 }    // Down-Right
                ];
                
                // Try each direction with increasing distance
                let foundSafePosition = false;
                for (let distance = 1; distance <= 5 && !foundSafePosition; distance++) {
                    for (const dir of directions) {
                        const testX = this.player.x + (dir.x * this.map.tileWidth * distance);
                        const testY = this.player.y + (dir.y * this.map.tileHeight * distance);
                        
                        // Check if this position is valid (not inside an obstacle)
                        if (this.isPositionValid(testX, testY)) {
                            // Move player to safe position
                            this.player.x = testX;
                            this.player.y = testY;
                            this.player.body.reset(testX, testY);
                            foundSafePosition = true;
                            console.log(`Moved player to safe position: (${testX}, ${testY})`);
                            break;
                        }
                    }
                }
                
                if (!foundSafePosition) {
                    // If we couldn't find a safe position, just respawn the player
                    console.log("Could not find safe position - respawning player");
                    this.respawnPlayer();
                }
            }
            
            // Check for key press to toggle noclip mode (allow player to pass through obstacles)
            const zKey = this.input.keyboard.addKey('Z');
            if (Phaser.Input.Keyboard.JustDown(zKey)) {
                // Toggle no-clip mode
                this.noClipMode = !this.noClipMode;
                
                if (this.noClipMode) {
                    // Disable all collision for the player
                    if (this.playerObstacleCollider) {
                        this.playerObstacleCollider.active = false;
                    }
                    console.log("NO CLIP MODE ENABLED - Player can pass through obstacles");
                } else {
                    // Re-enable collision
                    if (this.playerObstacleCollider) {
                        this.playerObstacleCollider.active = true;
                    }
                    console.log("NO CLIP MODE DISABLED - Normal collision restored");
                }
            }
            
            // Update the collision debug text
            if (this.playerDebugText) {
                this.playerDebugText.setText(
                    `Player pos: (${Math.floor(this.player.x)},${Math.floor(this.player.y)})\n` +
                    `Tile pos: (${tileX},${tileY})\n` +
                    `Colliding tiles: ${collidingTiles}\n` +
                    `In world bounds: ${inWorldBounds}\n` +
                    `NoClip mode: ${this.noClipMode ? 'ON (Z)' : 'OFF (Z)'}\n` +
                    collisionText
                );
            }
        }

        // Update oxygen
        // Only deplete oxygen if not boosting, otherwise boost will handle oxygen depletion
        if (!this.boostActive) {
            this.currentOxygen -= (delta / 1000) * 1;
        }
        this.currentOxygen = Phaser.Math.Clamp(this.currentOxygen, 0, this.maxOxygen);
        
        // Only proceed with game over if oxygen is actually 0
        if (this.currentOxygen <= 0) {
            this.gameOver();
            return;
        }

        this.oxygenBar.width = (this.currentOxygen / this.maxOxygen) * 400;

        // Check spawn points from Tiled map to see if any need respawning
        this.airPocketSpawnPoints.forEach((spawnPoint, index) => {
            if (!spawnPoint.active && (time - spawnPoint.lastSpawnTime) >= spawnPoint.spawnRate) {
                // Check if this position is still valid (not inside an obstacle)
                if (this.isPositionValid(spawnPoint.x, spawnPoint.y)) {
                    // Time to respawn this air pocket
                    const airPocket = this.createSingleAirPocket(spawnPoint.x, spawnPoint.y, spawnPoint.variation);
                    
                    // Store the spawn point index on the air pocket for reference
                    airPocket.spawnPointIndex = index;
                    
                    // Mark as active
                    spawnPoint.active = true;
                    spawnPoint.lastSpawnTime = time;
                    
                    console.log(`Respawned air pocket at (${spawnPoint.x}, ${spawnPoint.y}) with variation ${spawnPoint.variation}`);
                }
            }
        });

        // Ensure player position stays within world bounds
        this.player.x = Phaser.Math.Clamp(this.player.x, 0, this.physics.world.bounds.width);
        this.player.y = Phaser.Math.Clamp(this.player.y, 0, this.physics.world.bounds.height);

        // Track current movement direction
        let currentDirection = { x: 0, y: 0 };

        // Movement controls
        if (this.cursors.left.isDown || this.keys.left.isDown) {
            this.player.setAccelerationX(-200); // Reduced from 300 for slower base movement
            this.player.setFlipX(true);
            currentDirection.x = -1;
            
            // Enable particle effects on first movement
            if (!this.bubbleEffectsEnabled) {
                this.bubbleEffectsEnabled = true;
                this.bubbleEmitter.start();
            }
        } else if (this.cursors.right.isDown || this.keys.right.isDown) {
            this.player.setAccelerationX(200); // Reduced from 300 for slower base movement
            this.player.setFlipX(false);
            currentDirection.x = 1;
            
            // Enable particle effects on first movement
            if (!this.bubbleEffectsEnabled) {
                this.bubbleEffectsEnabled = true;
                this.bubbleEmitter.start();
            }
        } else {
            this.player.setAccelerationX(0);
        }

        if (this.cursors.up.isDown || this.keys.up.isDown) {
            this.player.setAccelerationY(-200); // Reduced from 300 for slower base movement
            currentDirection.y = -1;
            
            // Enable particle effects on first movement
            if (!this.bubbleEffectsEnabled) {
                this.bubbleEffectsEnabled = true;
                this.bubbleEmitter.start();
            }
        } else if (this.cursors.down.isDown || this.keys.down.isDown) {
            this.player.setAccelerationY(200); // Reduced from 300 for slower base movement
            currentDirection.y = 1;
            
            // Enable particle effects on first movement
            if (!this.bubbleEffectsEnabled) {
                this.bubbleEffectsEnabled = true;
                this.bubbleEmitter.start();
            }
        } else {
            this.player.setAccelerationY(0);
        }
        
        // Check if boost is on cooldown
        if (this.boostCooldown && time > this.boostCooldownTime) {
            this.boostCooldown = false;
        }
        
        // Handle boost key (press and hold spacebar)
        if (this.keys.boost.isDown && this.currentOxygen > 0 && !this.boostCooldown) {
            // Only show boost just-activated log if it wasn't already active
            if (!this.boostActive) {
                console.log('Boost activated');
                this.boostActive = true;
                
                // Change oxygen bar color during boost
                if (this.oxygenBar) {
                    this.oxygenBar.fillColor = 0x00ffff; // Cyan color during boost
                }
            }
            
            // Consume oxygen while boosting (faster than normal depletion)
            this.currentOxygen -= (delta / 1000) * 5; // 5x normal depletion rate
            
            // Calculate boost direction based on current movement or facing direction
            let boostDirection = { x: 0, y: 0 };
            
            // If actively moving, boost in that direction
            if (currentDirection.x !== 0 || currentDirection.y !== 0) {
                boostDirection = currentDirection;
            } else {
                // If not moving, boost based on facing direction
                boostDirection.x = this.player.flipX ? -1 : 1;
            }
            
            // Calculate the vector magnitude of current velocity
            const currentVelocityMagnitude = Math.sqrt(
                Math.pow(this.player.body.velocity.x, 2) + 
                Math.pow(this.player.body.velocity.y, 2)
            );
            
            // Apply direct velocity increase for immediate speed boost effect
            let boostSpeed = 600; // Default boost speed
            
            // If player is already moving at high speed, use super boost
            if (currentVelocityMagnitude > 200) {
                boostSpeed = 1000; // Much higher boost when already at high speed
                
                // Add a very gentle camera shake effect
                this.cameras.main.shake(80, 0.002);
            }
            
            // Apply the appropriate boost speed based on direction
            if (boostDirection.x !== 0) {
                this.player.body.velocity.x = boostDirection.x * boostSpeed;
            }
            if (boostDirection.y !== 0) {
                this.player.body.velocity.y = boostDirection.y * boostSpeed;
            }
            
            // If not moving in any direction, apply boost based on facing direction
            if (boostDirection.x === 0 && boostDirection.y === 0) {
                const facingDirection = this.player.flipX ? -1 : 1;
                this.player.body.velocity.x = facingDirection * boostSpeed;
            }
            
            // Create constant jet blast effect while boosting
            if (time - this.playerMovement.lastBurstTime > 50) {
                this.emitBoostBurst(boostDirection);
                this.playerMovement.lastBurstTime = time;
            }
        } else {
            // If boost was active but is now off (released space or ran out of oxygen)
            if (this.boostActive) {
                console.log('Boost deactivated');
                this.boostActive = false;
                
                // Set cooldown after boost ends
                this.boostCooldown = true;
                this.boostCooldownTime = time + 500; // 0.5 second cooldown
                
                // Reset oxygen bar color
                if (this.oxygenBar) {
                    this.oxygenBar.fillColor = 0x00ff00; // Change back to green
                }
            }
        }
        
        // Handle boost cooldown expiration
        if (this.boostCooldown && time > this.boostCooldownTime) {
            this.boostCooldown = false;
        }
        
        // IMPORTANT: Apply velocity clamping to prevent fast tunneling through obstacles
        // Higher max speed when boosting, with possibility of extra momentum boost
        const maxSpeed = this.boostActive ? 
            (this.player.body.speed > 200 ? 1000 : 600) : // Allow much higher max speed when boosting from high speed
            250; // Normal non-boost speed
        const vx = Phaser.Math.Clamp(this.player.body.velocity.x, -maxSpeed, maxSpeed);
        const vy = Phaser.Math.Clamp(this.player.body.velocity.y, -maxSpeed, maxSpeed);
        this.player.setVelocity(vx, vy);
        
        // Check for movement state changes (starting to move or changing direction)
        const isMovingNow = currentDirection.x !== 0 || currentDirection.y !== 0;
        const directionChanged = 
            currentDirection.x !== this.playerMovement.prevDirection.x || 
            currentDirection.y !== this.playerMovement.prevDirection.y;
        
        // Start moving or change direction burst effect
        // Only emit movement bursts when player is actually moving and not boosting
        if ((isMovingNow && (!this.playerMovement.isMoving || directionChanged)) && 
            (time - this.playerMovement.lastBurstTime > 500) && 
            !this.boostActive) { // Only emit normal movement burst when not boosting
            
            // Enable particle system if this is first movement
            if (!this.bubbleEffectsEnabled) {
                this.bubbleEffectsEnabled = true;
                this.bubbleEmitter.start();
                this.movementBurstEmitter.start();
            }
            
            // Emit a burst of bubbles
            this.emitMovementBurst(currentDirection);
            this.playerMovement.lastBurstTime = time;
        }
        
        // Update player movement state
        this.playerMovement.isMoving = isMovingNow;
        this.playerMovement.prevDirection.x = currentDirection.x;
        this.playerMovement.prevDirection.y = currentDirection.y;

        // REMOVED: The periodic air pocket boost is no longer needed with the new continuous physics model

        // Check for and remove out-of-bounds air pockets with safety checks
        if (this.airPockets) {
            this.airPockets.getChildren().forEach(airPocket => {
                // Skip processing if the air pocket is no longer valid
                if (!airPocket || !airPocket.active || !airPocket.body) return;
                
                // Only remove the air pocket if it's very far outside the map
                if (airPocket.y < -500 || 
                    airPocket.y > this.physics.world.bounds.height + 500 ||
                    airPocket.x < -500 || 
                    airPocket.x > this.physics.world.bounds.width + 500) {
                    
                // If this was from a spawn point, mark it as inactive so it can respawn
                if (airPocket.spawnPointIndex !== undefined) {
                    const spawnPoint = this.airPocketSpawnPoints[airPocket.spawnPointIndex];
                    if (spawnPoint) {
                        spawnPoint.active = false;
                        spawnPoint.lastSpawnTime = time;
                    }
                }
                
                if (airPocket.particles) {
                    airPocket.particles.destroy();
                    }
                    
                    // Safely remove air pocket
                    if (airPocket.obstacleLayerCollider) {
                        this.physics.world.removeCollider(airPocket.obstacleLayerCollider);
                    }
                    airPocket.destroy();
                }
            });
        }

        // Handle boost for touch controls
        if (this.boostActive && this.currentOxygen > 0 && !this.boostCooldown) {
            // Consume oxygen while boosting
            this.currentOxygen -= (delta / 1000) * 5;

            // Calculate boost direction based on current movement
            const currentVelocity = new Phaser.Math.Vector2(this.player.body.velocity);
            if (currentVelocity.length() > 0) {
                currentVelocity.normalize();
                this.player.body.velocity.x = currentVelocity.x * 600;
                this.player.body.velocity.y = currentVelocity.y * 600;
            } else {
                // If not moving, boost in facing direction
                const facingDirection = this.player.flipX ? -1 : 1;
                this.player.body.velocity.x = facingDirection * 600;
            }
        }
    }

    refillOxygen(player, airPocket) {
        // Safety check - ensure both objects still exist
        if (!player || !player.active || !airPocket || !airPocket.active) {
            return;
        }
        
        this.currentOxygen = this.maxOxygen;
        
        // Create burst effect using the same particle system style
        const burstEffect = this.add.particles(0, 0, 'bubble', {
            x: airPocket.x,
            y: airPocket.y,
            lifespan: 1000,
            speed: { min: 50, max: 100 },
            scale: { start: 0.1, end: 0 },
            alpha: { start: 0.5, end: 0 },
            angle: { min: 0, max: 360 },
            gravityY: -20,
            frequency: 1000/10, // Emit 10 particles over 1 second
            emitZone: { 
                type: 'random',
                source: new Phaser.Geom.Circle(0, 0, 20)
            }
        });

        // Destroy the burst effect after animation
        this.time.delayedCall(1000, () => {
            burstEffect.destroy();
        });
        
        // If this is a fixed spawn point from our Tiled map, mark it as inactive so it can respawn
        if (airPocket.spawnPointIndex !== undefined) {
            // Find the spawn point and mark as inactive
            const spawnPoint = this.airPocketSpawnPoints[airPocket.spawnPointIndex];
            if (spawnPoint) {
                spawnPoint.active = false;
                spawnPoint.lastSpawnTime = this.time.now;
            }
        }

        // Clean up the air pocket and its particles
        if (airPocket.particles) {
            airPocket.particles.destroy();
        }
        airPocket.destroy();
    }

    gameOver() {
        if (this.player.active) { // Only run game over once
            // Display game over text
            const gameOverText = this.add.text(800, 600, 'Game Over', { 
                font: '48px Arial', 
                color: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 20, y: 10 }
            }).setOrigin(0.5).setDepth(10);
            
            // Deactivate the player temporarily
            this.player.setActive(false);
            this.player.setVisible(false);
            
            // Make sure to remove the physics body to prevent interactions
            if (this.player.body) {
                this.physics.world.remove(this.player);
            }
            
            // After a delay, respawn the player (3 seconds)
            this.time.delayedCall(3000, () => {
                this.respawnPlayer();
                gameOverText.destroy();
            });
        }
    }

    setupMusicSystem() {
        try {
            // Create audio instances if loaded successfully
            if (this.cache.audio.exists('music') && this.cache.audio.exists('ambience')) {
                // Create the background music instance
                this.backgroundMusic = this.sound.add('music', {
                    volume: this.musicVolume * 0.7, // Slightly lower volume for background music
                    loop: true
                });

                // Create the ambient underwater sounds instance
                this.ambienceSound = this.sound.add('ambience', {
                    volume: 1, // Lower volume for ambient sounds
                    loop: true
                });

                // Start playing both audio tracks
                if (!this.sound.locked) {
                    this.backgroundMusic.play();
                    this.ambienceSound.play();
                } else {
                    // If audio is locked (common on mobile), wait for user interaction
                    this.sound.once('unlocked', () => {
                        this.backgroundMusic.play();
                        this.ambienceSound.play();
                    });
                }

                // Add volume control UI
                const volumeStyle = {
                    font: '24px Arial',
                    color: '#ffffff',
                    backgroundColor: '#000000',
                    padding: { x: 10, y: 5 }
                };

                // Add mute button (top right corner)
                const muteButton = this.add.text(1500, 20, '🔊', volumeStyle)
                    .setScrollFactor(0)
                    .setDepth(10)
                    .setInteractive();

                // Add volume controls
                const volumeDown = this.add.text(1400, 20, '−', volumeStyle)
                    .setScrollFactor(0)
                    .setDepth(10)
                    .setInteractive();

                const volumeUp = this.add.text(1450, 20, '+', volumeStyle)
                    .setScrollFactor(0)
                    .setDepth(10)
                    .setInteractive();

                // Add debug button for respawning all air pockets
                const respawnButton = this.add.text(1300, 20, '🔄 Air', volumeStyle)
                    .setScrollFactor(0)
                    .setDepth(10)
                    .setInteractive();
                
                respawnButton.on('pointerdown', () => {
                    this.respawnAllAirPockets();
                    console.log('Debug: Respawning all air pockets');
                });

                // Handle mute toggle
                muteButton.on('pointerdown', () => {
                    this.isMuted = !this.isMuted;
                    if (this.isMuted) {
                        this.backgroundMusic.setVolume(0);
                        this.ambienceSound.setVolume(0);
                        muteButton.setText('🔈');
                    } else {
                        this.backgroundMusic.setVolume(this.musicVolume * 0.7);
                        this.ambienceSound.setVolume(0.3);
                        muteButton.setText('🔊');
                    }
                });

                // Handle volume controls
                volumeDown.on('pointerdown', () => {
                    this.musicVolume = Math.max(0, this.musicVolume - 0.1);
                    if (!this.isMuted) {
                        this.backgroundMusic.setVolume(this.musicVolume * 0.7);
                        // Also adjust ambience volume proportionally
                        this.ambienceSound.setVolume(this.musicVolume * 0.6);
                    }
                });

                volumeUp.on('pointerdown', () => {
                    this.musicVolume = Math.min(1, this.musicVolume + 0.1);
                    if (!this.isMuted) {
                        this.backgroundMusic.setVolume(this.musicVolume * 0.7);
                        // Also adjust ambience volume proportionally
                        this.ambienceSound.setVolume(this.musicVolume * 0.6);
                    }
                });
            } else {
                console.warn('Audio tracks not loaded successfully');
            }
        } catch (error) {
            console.error('Error setting up music system:', error);
        }
    }

    createTiledMap() {
        // First check if we have a valid map
        if (!this.map) {
            console.warn('No map data available. Using fallback.');
            this.createFallbackMap();
            return;
        }
        
        try {
            console.log('Creating tilemap with available data');
            
            // Load the tilesets, specifying exactly what image keys to use
            console.log('Adding tileset images with correct keys...');
            const bgTileset = this.map.addTilesetImage('Blue_background', 'Blue_background');
            const blackBlueTileset = this.map.addTilesetImage('blackAndBlue', 'blackAndBlue');
            
            // Log the results
            console.log('Background tileset loaded:', !!bgTileset);
            console.log('BlackAndBlue tileset loaded:', !!blackBlueTileset);
            
            if (!bgTileset && !blackBlueTileset) {
                console.error('Failed to load any tilesets. Using fallback map.');
                this.createFallbackMap();
                return;
            }
            
            // Create an array of available tilesets
            const tilesets = [];
            if (bgTileset) tilesets.push(bgTileset);
            if (blackBlueTileset) tilesets.push(blackBlueTileset);
            
            // Get and log the layer names
            const mapLayers = this.map.layers || [];
            if (mapLayers.length === 0) {
                console.error('No layers found in map data');
                this.createFallbackMap();
                return;
            }
            
            // Debug log all layer names
            const layerNames = mapLayers.map(layer => layer.name);
            console.log('Available map layers:', layerNames);
            
            // Try to create each layer by name
            try {
                if (layerNames.includes('Background')) {
                    const backgroundLayer = this.map.createLayer('Background', tilesets);
                    if (backgroundLayer) {
                        backgroundLayer.setScrollFactor(0.7);
                        backgroundLayer.setDepth(1);
                        console.log('Background layer created successfully');
                        
                        // Set world bounds based on the map size
                        const worldWidth = this.map.widthInPixels;
                        const worldHeight = this.map.heightInPixels;
                        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
                        console.log('World bounds set to:', worldWidth, worldHeight);
                        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
                        
                        // ADD ROCKS TO BACKGROUND LAYER
                        this.addRocksToLayer(worldWidth, worldHeight, 0.7, 'rock', 1.2, 10); // rock2.png on background
                    }
                } else if (layerNames.length > 0) {
                    // Use the first layer as background if no "Background" layer exists
                    const backgroundLayer = this.map.createLayer(layerNames[0], tilesets);
                    if (backgroundLayer) {
                        backgroundLayer.setScrollFactor(0.7);
                        backgroundLayer.setDepth(1);
                        console.log(`Using layer "${layerNames[0]}" as background`);
                        
                        // Set world bounds
                        const worldWidth = this.map.widthInPixels;
                        const worldHeight = this.map.heightInPixels;
                        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
                        console.log('World bounds set to:', worldWidth, worldHeight);
                        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
                        
                        // ADD ROCKS TO BACKGROUND LAYER
                        this.addRocksToLayer(worldWidth, worldHeight, 0.7, 'rock', 1.2, 10); // rock2.png on background
                    }
                } else {
                    throw new Error('No usable layers in map data');
                }
            } catch (error) {
                console.error('Error creating background layer:', error);
                this.createFallbackMap();
                return;
            }
            
            // Try to create midground layer if it exists
            if (layerNames.includes('Midground')) {
                try {
                    const midgroundLayer = this.map.createLayer('Midground', tilesets);
                    if (midgroundLayer) {
                        midgroundLayer.setScrollFactor(0.85);
                        midgroundLayer.setAlpha(0.8);
                        midgroundLayer.setDepth(1.5);
                        console.log('Midground layer created successfully');
                        
                        // ADD ROCKS TO MIDGROUND LAYER
                        const worldWidth = this.map.widthInPixels;
                        const worldHeight = this.map.heightInPixels;
                        this.addRocksToLayer(worldWidth, worldHeight, 0.85, 'obstacle', 1.0, 8); // rock3.png on midground
                    }
                } catch (error) {
                    console.error('Error creating midground layer:', error);
                }
            }
            
            // SIMPLIFIED APPROACH FOR OBSTACLES LAYER
            if (layerNames.includes('Obstacles')) {
                try {
                    console.log('============= SETTING UP OBSTACLES LAYER =============');
                    
                    // Remove existing layer if it exists
                    if (this.obstaclesLayer) {
                        console.log('Destroying old obstacle layer');
                        this.obstaclesLayer.destroy();
                        this.obstaclesLayer = null;
                    }
                    
                    // Clean up any existing colliders
                    if (this.playerObstacleCollider) {
                        this.physics.world.removeCollider(this.playerObstacleCollider);
                        this.playerObstacleCollider = null;
                    }
                    
                    // Create the obstacles layer
                    console.log('Creating obstacles layer from Tiled map');
                    this.obstaclesLayer = this.map.createLayer('Obstacles', tilesets);
                    
                    if (this.obstaclesLayer) {
                        // Set basic display properties
                        this.obstaclesLayer.setScrollFactor(1);
                        this.obstaclesLayer.setDepth(2);
                        
                        // Make obstacles visible to debug
                        this.obstaclesLayer.setAlpha(1);
                        
                        // SIMPLIFIED COLLISION: Set collision for all non-empty tiles
                        console.log('Setting collision for non-empty tiles on Obstacles layer');
                        this.obstaclesLayer.setCollisionByExclusion([-1]);
                        
                        // Enable debug visualization if debugging is enabled
                        if (this.physics.config.debug) {
                            console.log('Enabling debug visualization for obstacle tiles');
                            
                            // Create or replace debug graphics
                            if (this.tileDebugGraphics) {
                                this.tileDebugGraphics.destroy();
                            }
                            this.tileDebugGraphics = this.add.graphics();
                            
                            // Show collision tiles with bright colors
                            this.obstaclesLayer.renderDebug(this.tileDebugGraphics, {
                                tileColor: null, // No color for non-colliding tiles
                                collidingTileColor: new Phaser.Display.Color(255, 0, 255, 1), // Bright magenta for collision tiles
                                faceColor: new Phaser.Display.Color(255, 255, 0, 1) // Yellow for collision faces
                            });
                        }
                        
                        // Create player-obstacle collider after a delay to ensure everything is initialized
                        if (this.player && this.player.body) {
                            console.log('Creating player-obstacle collider');
                            
                            // First clean up any existing collider
                            if (this.playerObstacleCollider) {
                                this.physics.world.removeCollider(this.playerObstacleCollider);
                            }
                            
                            // CRITICAL: Ensure player has correct physics properties
                            // These must match what we set in create() and fixTiledCollisions()
                            this.player.body.setImmovable(false);
                            this.player.body.pushable = true;
                            this.player.body.setBounce(0.1);
                            
                            console.log('Player-obstacle collider created with visual feedback');
                        } else {
                            console.log('Player not ready yet, collider will be created later');
                        }
                    }
                    
                    console.log('============= OBSTACLES LAYER SETUP COMPLETE =============');
                    
                    // ADD EXACT SAME COLLIDER APPROACH AS AIR POCKETS
                    // Wait just a moment to ensure everything is initialized
                    this.time.delayedCall(100, () => {
                        // First, remove any existing collider for the player
                        if (this.playerObstacleCollider) {
                            this.physics.world.removeCollider(this.playerObstacleCollider);
                        }
                        
                        console.log('Creating player obstacle collider using EXACT SAME approach as air pockets');
                        // Create the collider using the same exact method that works for air pockets
                        this.playerObstacleCollider = this.physics.add.collider(
                            this.player,
                            this.obstaclesLayer
                        );
                        
                        console.log('Player-obstacle collider created with SAME approach as air pockets');
                    });
                    
                } catch (error) {
                    console.error('Error setting up obstacles layer:', error);
                }
            } else {
                console.error('No Obstacles layer found in the map!');
            }
        } catch (error) {
            console.error('Error in createTiledMap:', error);
            this.createFallbackMap();
        }
    }

    // Add new method to place rock sprites on a specific layer with parallax
    addRocksToLayer(worldWidth, worldHeight, scrollFactor, rockType, scale, count) {
        console.log(`Adding ${count} ${rockType} rocks with scroll factor ${scrollFactor}`);
        
        // Create rocks group (non-physics)
        const rocksGroup = this.add.group();
        
        // Add rocks randomly distributed across the world
        for (let i = 0; i < count; i++) {
            // Calculate random position within world bounds
            // Add padding to avoid rocks right at the edge
            const padding = 100;
            const x = Phaser.Math.Between(padding, worldWidth - padding);
            const y = Phaser.Math.Between(padding, worldHeight - padding);
            
            // Create rock sprite
            const rock = this.add.sprite(x, y, rockType);
            
            // Set appropriate scale - make background rocks larger
            rock.setScale(scale);
            
            // Set scroll factor to match the layer (for parallax effect)
            rock.setScrollFactor(scrollFactor);
            
            // Set depth to match the layer it's on (slightly above to be visible)
            rock.setDepth(scrollFactor < 0.8 ? 1.1 : 1.6);
            
            // REMOVED: All rotation and flips - keep rocks in original default orientation
            
            // Add to group for management
            rocksGroup.add(rock);
        }
        
        return rocksGroup;
    }

    createFallbackMap() {
        console.log("Creating fallback map due to tilemap loading failure");
        
        // Set world bounds based on our config
        const worldWidth = 1600;
        const worldHeight = 1200;
        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
        
        // Create simple background
        const background = this.add.image(worldWidth/2, worldHeight/2, 'Blue_background')
            .setDepth(1)
            .setScrollFactor(0.7);
        
        // Scale image to fit the world
        background.setDisplaySize(worldWidth, worldHeight);
        
        // Set the camera bounds to match
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
        
        // Add rocks to fallback map too
        this.addRocksToLayer(worldWidth, worldHeight, 0.7, 'rock', 1.2, 10); // Background rocks
        this.addRocksToLayer(worldWidth, worldHeight, 0.85, 'obstacle', 1.0, 8); // Midground rocks
    }

    spawnTiledAirPockets() {
        // Check if the AirPockets object layer exists
        const airPocketsLayer = this.map.getObjectLayer('AirPockets');
        
        if (!airPocketsLayer) {
            console.log('No AirPockets layer found in the Tiled map');
            console.log('Available layers:', this.map.objects ? this.map.objects.map(layer => layer.name) : 'None');
            return;
        }
        
        console.log('Found AirPockets layer with objects:', airPocketsLayer.objects.length);
        
        // Check if the objects array has properties on the LAYER rather than individual objects
        // This is a common Tiled export pattern where properties are set at the layer level
        const layerHasProperties = airPocketsLayer.properties && airPocketsLayer.properties.length > 0;
        let layerType = '';
        let layerVariation = 1;
        let layerSpawnRate = 8000; // Default respawn rate in ms (8 seconds)
        
        if (layerHasProperties) {
            // Find properties on the layer itself
            const typeProperty = airPocketsLayer.properties.find(prop => prop.name === 'type');
            if (typeProperty) {
                layerType = typeProperty.value;
            }
            
            const variationProperty = airPocketsLayer.properties.find(prop => prop.name === 'variation');
            if (variationProperty) {
                layerVariation = parseInt(variationProperty.value) || 1;
            }
            
            // Look for spawn rate property
            const spawnRateProperty = airPocketsLayer.properties.find(prop => prop.name === 'spawnRate');
            if (spawnRateProperty) {
                layerSpawnRate = parseInt(spawnRateProperty.value) || 8000; 
            }
            
            console.log(`Found layer-level properties: type=${layerType}, variation=${layerVariation}, spawnRate=${layerSpawnRate}ms`);
        }
        
        // Debug: List all object types in this layer
        let objectTypes = {};
        airPocketsLayer.objects.forEach(obj => {
            if (obj.type) {
                objectTypes[obj.type] = (objectTypes[obj.type] || 0) + 1;
            } else {
                objectTypes['no-type'] = (objectTypes['no-type'] || 0) + 1;
            }
        });
        console.log('Object types in AirPockets layer:', objectTypes);
        
        // Iterate through all objects in the AirPockets layer
        airPocketsLayer.objects.forEach(object => {
            console.log('Processing object:', object);
            
            // Check if this is an air pocket type - either by explicit type, checking properties, or layer properties
            const isAirPocket = object.type === 'air_pocket' || 
                object.name === 'air_pocket' ||
                (object.properties && object.properties.some(prop => prop.name === 'type' && prop.value === 'air_pocket')) ||
                layerType === 'air_pocket';
            
            if (isAirPocket) {
                // Get the variation property (defaulting to 1 if not specified)
                let variation = layerVariation; // Default to layer variation if available
                let spawnRate = layerSpawnRate; // Default to layer spawn rate
                
                if (object.properties) {
                    // Find the variation property on the object (overrides layer property)
                    const variationProp = object.properties.find(prop => prop.name === 'variation');
                    if (variationProp) {
                        variation = parseInt(variationProp.value) || 1;
                        // Ensure variation is within valid range (1-3)
                        variation = Math.max(1, Math.min(3, variation));
                    }
                    
                    // Check for spawn rate property
                    const spawnRateProp = object.properties.find(prop => prop.name === 'spawnRate');
                    if (spawnRateProp) {
                        spawnRate = parseInt(spawnRateProp.value) || 8000;
                    }
                }
                
                // Get position (Tiled origin is top-left)
                const x = object.x;
                const y = object.y;
                
                // IMPORTANT: Check if this position overlaps with an obstacle tile before spawning
                if (this.obstaclesLayer) {
                    // Convert pixel coordinates to tile coordinates
                    const tileX = Math.floor(x / this.map.tileWidth);
                    const tileY = Math.floor(y / this.map.tileHeight);
                    
                    // Get the tile at this position
                    const tile = this.obstaclesLayer.getTileAt(tileX, tileY);
                    
                    // If there's a tile (not empty) at this position, skip spawning the air pocket
                    if (tile && tile.index !== -1) {
                        console.log(`Skipping air pocket at (${x}, ${y}) because it overlaps with an obstacle tile`);
                        return; // Skip to next object
                    }
                }
                
                console.log(`Spawning air pocket from Tiled: variation ${variation} at (${x}, ${y}) with respawn rate ${spawnRate}ms`);
                
                // Create the air pocket at the specified position with the correct variation
                this.createSingleAirPocket(x, y, variation);
                
                // Add this location to our spawn points list for respawning
                this.airPocketSpawnPoints.push({
                    x: x,
                    y: y,
                    variation: variation,
                    spawnRate: spawnRate,
                    active: true,
                    lastSpawnTime: this.time.now
                });
            } else {
                // Only create fallback air pockets if they are within valid areas (not inside obstacles)
                // First check if position overlaps with obstacles
                const x = object.x;
                const y = object.y;
                
                // Check if this position overlaps with an obstacle tile
                if (this.obstaclesLayer) {
                    // Convert pixel coordinates to tile coordinates
                    const tileX = Math.floor(x / this.map.tileWidth);
                    const tileY = Math.floor(y / this.map.tileHeight);
                    
                    // Get the tile at this position
                    const tile = this.obstaclesLayer.getTileAt(tileX, tileY);
                    
                    // If there's a tile at this position, skip spawning the air pocket
                    if (tile && tile.index !== -1) {
                        console.log(`Skipping fallback air pocket at (${x}, ${y}) because it overlaps with an obstacle tile`);
                        return; // Skip to next object
                    }
                }
                
                // For non-air-pocket objects, assume they are still air pockets based on being in the AirPockets layer
                let variation = layerVariation; // Use layer variation as default
                let spawnRate = layerSpawnRate;
                
                // Try to find variation from properties
                if (object.properties) {
                    const variationProp = object.properties.find(prop => prop.name === 'variation');
                    if (variationProp) {
                        variation = parseInt(variationProp.value) || 1;
                        variation = Math.max(1, Math.min(3, variation));
                    }
                    
                    // Check for spawn rate property
                    const spawnRateProp = object.properties.find(prop => prop.name === 'spawnRate');
                    if (spawnRateProp) {
                        spawnRate = parseInt(spawnRateProp.value) || 8000;
                    }
                }
                
                console.log(`Spawning fallback air pocket at (${object.x}, ${object.y}) with variation ${variation} and respawn rate ${spawnRate}ms`);
                this.createSingleAirPocket(object.x, object.y, variation);
                
                // Add to spawn points
                this.airPocketSpawnPoints.push({
                    x: object.x,
                    y: object.y,
                    variation: variation,
                    spawnRate: spawnRate,
                    active: true,
                    lastSpawnTime: this.time.now
                });
            }
        });
    }

    createSingleAirPocket(x, y, variation = null) {
        // Safety check - make sure airPockets group exists
        if (!this.airPockets) {
            console.error('Air pockets group not initialized');
            return null;
        }
        
        // Check for required texture keys
        const airPocketType = variation || Phaser.Math.Between(1, 3);
        const textureKey = `air_pocket${airPocketType}`;
        if (!this.textures.exists(textureKey)) {
            console.error(`Missing texture: ${textureKey}`);
            return null;
        }
        
        // If variation is not specified, choose randomly between 1-3
        const airPocket = this.airPockets.create(x, y, textureKey);
        airPocket.setScale(0.165);
        airPocket.setScrollFactor(1);
        airPocket.setDepth(2.5); // Between obstacles and player
        
        // Set up collision box - make it smaller for better collision detection
        const originalWidth = airPocket.width;
        const originalHeight = airPocket.height;
        airPocket.body.setSize(originalWidth * 0.5, originalHeight * 0.5);
        airPocket.body.setOffset(125, 125); // Adjust offset to center the collision box
        
        // IMPORTANT: Enable pushing to prevent passing through obstacles
        airPocket.body.pushable = false;
        
        // Ensure air pocket doesn't collide with world boundaries
        airPocket.body.setCollideWorldBounds(false);
        
        // Make air pocket physics body more visible in debug mode
        if (this.physics.config.debug) {
            airPocket.body.debugBodyColor = 0xff00ff; // Bright magenta for air pocket body
            airPocket.body.debugShowBody = true;
            airPocket.body.debugShowVelocity = true;
        }
        
        // =============== AIR POCKET PHYSICS PARAMETERS ===============
        // These settings control how air pockets move through the water
        
        // BOUNCE: How much the air pocket bounces off obstacles
        // Range: 0-1 (0 = no bounce, 1 = full bounce)
        // Higher values make bubbles bounce more aggressively off walls
        // Lower values create softer, more gentle collisions
        airPocket.setBounce(0.25);    // Increased bounce for more noticeable reflection (was 0.1)
        
        // DRAG: Resistance to movement (simulates water density)
        // Range: 0-100+ (0 = no resistance, higher = more resistance)
        // Higher values slow bubbles down faster, lower values allow longer sustained movement
        // Too high will make bubbles stop quickly, too low will make them slide forever
        airPocket.setDrag(2);       // ADJUST: Increase to slow bubbles down faster
        
        // FRICTION: Resistance to movement along surfaces
        // Range: 0-1 (0 = frictionless, 1 = high friction)
        // Controls how easily bubbles slide along obstacles
        // Lower values allow bubbles to slide more easily along walls
        airPocket.setFriction(0.01); // ADJUST: Increase to make bubbles stick more to walls
        
        // DAMPING: Gradual reduction in velocity over time
        // This creates a more realistic water-like environment
        // True = enable damping, False = disable damping
        airPocket.body.setDamping(true);  // ADJUST: Set to false to disable all damping
        
        // DRAG COEFFICIENT: How quickly velocity decreases over time
        // Range: 0-1 (0 = no damping, 1 = instant stop)
        // Controls the rate at which bubbles naturally slow down
        // Smaller values make bubbles maintain speed longer
        airPocket.body.setDrag(0.005);    // ADJUST: Increase for more water resistance
        
        // GRAVITY: Whether bubbles are affected by gravity
        // Air pockets should float up, so we disable gravity and control their movement manually
        airPocket.body.setAllowGravity(false);  // Almost always keep this false for bubbles
        
        // IMMOVABLE: Whether other objects can move this object during collisions
        // False allows bubbles to be pushed around by other physics objects
        // True would make them completely unmovable by collisions
        airPocket.body.setImmovable(false);  // ADJUST: Set to true to prevent pushing
        
        // INITIAL VELOCITY: Starting speed and direction
        // X velocity: horizontal movement (-left, +right)
        // Y velocity: vertical movement (-up, +down)
        // These values control how fast the bubble initially moves
        const baseSpeed = Phaser.Math.Between(700, 800);  // ADJUST: Reduced to half from 1400-1600
        const jitter = Phaser.Math.Between(-15, 15);      // Slightly reduced horizontal movement
        
        // Set the initial velocity - negative Y means upward in Phaser
        airPocket.setVelocity(jitter, -baseSpeed);
        
        // Store base speed for the continuous buoyancy model
        // This is used to maintain consistent rising behavior
        airPocket.baseSpeed = baseSpeed;  // Don't change this line - it stores the value above
        
        // =============== NATURAL WOBBLE PARAMETERS ===============
        // These create the side-to-side wobbling motion for realism
        
        // Starting phase of the wobble (in radians)
        airPocket.wobblePhase = 0;
        
        // How fast the wobble cycles
        // Higher values create faster oscillation, lower values make slower wobbling
        airPocket.wobbleSpeed = Phaser.Math.FloatBetween(0.02, 0.04);  // Reduced to match slower speed
        
        // How far the bubble wobbles side to side
        // Higher values create wider side-to-side movement
        airPocket.wobbleAmplitude = Phaser.Math.Between(10, 20);  // Slightly reduced wobble amplitude
        
        // =============== CONTINUOUS BUOYANCY SYSTEM ===============
        // This timer constantly updates the bubble physics for smooth movement
        
        this.time.addEvent({
            // How often to update bubble physics (milliseconds)
            // Lower values = smoother movement but more CPU usage
            delay: 50,  // Slightly increased delay for slower movement (was 40)
            loop: true, // Keep this true to continuously update
            callback: () => {
                // Skip if the bubble has been destroyed
                if (!airPocket || !airPocket.active || !airPocket.body) {
                    return;
                }
                
                // ---- PHYSICS UPDATE SYSTEM ----
                
                // Calculate current upward speed (converted to positive number)
                const currentSpeed = Math.abs(airPocket.body.velocity.y);
                
                // Target speed - bubbles accelerate slightly as they rise (realistic physics)
                // The 1.05 multiplier means bubbles aim for 5% faster than base speed
                const targetSpeed = airPocket.baseSpeed * 1.05;  // ADJUST: Increase multiplier for more acceleration
                
                // Smooth acceleration toward target speed
                // Only apply if we're significantly below target speed
                if (currentSpeed < targetSpeed - 30) {  // Reduced threshold for slower speeds (was 50)
                    // Calculate proportional acceleration based on how far from target
                    const speedDiff = targetSpeed - currentSpeed;
                    // Limit max acceleration to prevent jerky movement
                    const acceleration = Math.min(speedDiff * 0.1, 15);  // Reduced for gentler acceleration (was 0.15, 25)
                    
                    // Apply upward force (negative Y in Phaser means up)
                    airPocket.body.velocity.y -= acceleration;
                }
                
                // ---- WOBBLE SYSTEM ----
                
                // Update wobble phase (creates the oscillation)
                airPocket.wobblePhase += airPocket.wobbleSpeed;
                
                // Calculate horizontal wobble using sine wave
                const wobbleX = Math.sin(airPocket.wobblePhase) * airPocket.wobbleAmplitude;
                
                // Apply horizontal wobble without affecting vertical speed
                // This preserves upward momentum while adding side-to-side motion
                const currentVelocityY = airPocket.body.velocity.y;
                airPocket.body.velocity.x = wobbleX;  // Set horizontal velocity to wobble value
                airPocket.body.velocity.y = currentVelocityY;  // Preserve vertical velocity
            }
        });
        
        // Create bubble trail
        airPocket.particles = this.add.particles(0, 0, 'bubble', {
            follow: airPocket,
            followOffset: { x: 0, y: 0 },
            lifespan: 2500,
            gravityY: -100,           // Reduced upward gravity (was -200)
            speed: { min: 80, max: 120 }, // Reduced speed (was 150-200)
            scale: { start: 0.2, end: 0.1 },
            alpha: { start: 0.6, end: 0 },
            angle: { min: 265, max: 275 },
            frequency: 120,           // Reduced emission frequency (was 80)
            emitZone: { 
                type: 'random',
                source: new Phaser.Geom.Circle(0, -20, 25)
            },
            quantity: 1               // Reduced quantity (was 2)
        }).setDepth(2);

        // Add gentle rotation with more variation
        this.tweens.add({
            targets: airPocket,
            angle: Phaser.Math.Between(-5, 5),  // ADJUST: Increase for more rotation
            duration: Phaser.Math.Between(2000, 3000),  // ADJUST: Decrease for faster rotation
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // =============== COLLISION HANDLING ===============
        // Controls how bubbles react when hitting obstacles
        
        if (this.obstaclesLayer && airPocket.active && airPocket.body) {
            // Remove any existing collider to prevent duplicates
            if (airPocket.obstacleLayerCollider) {
                this.physics.world.removeCollider(airPocket.obstacleLayerCollider);
                delete airPocket.obstacleLayerCollider;
            }
            
            // Create the obstacle collider with custom collision handling
            airPocket.obstacleLayerCollider = this.physics.add.collider(
                airPocket, 
                this.obstaclesLayer,
                (airPocket, obstacle) => {
                    // This function runs when a bubble collides with an obstacle
                    if (airPocket && airPocket.body) {
                        // Generate a slightly stronger random deflection angle
                        const deflectAngle = Phaser.Math.FloatBetween(-0.4, 0.4);  // Increased for more noticeable deflection
                        
                        // Calculate current speed
                        const speed = Math.sqrt(
                            Math.pow(airPocket.body.velocity.x, 2) + 
                            Math.pow(airPocket.body.velocity.y, 2)
                        );
                        
                        // Apply horizontal deflection force based on angle
                        // Increased multiplier for more noticeable bounce effect
                        airPocket.body.velocity.x += Math.cos(deflectAngle) * speed * 0.2;  // Increased from 0.1 for more bounce
                        
                        // Maintain upward velocity after collision (don't accelerate upward)
                        // FIXED: Don't increase the upward velocity when colliding with obstacles
                        const currentUpwardSpeed = Math.abs(airPocket.body.velocity.y);
                        
                        // Always maintain the same speed or slightly reduce it, never increase
                        airPocket.body.velocity.y = -Math.min(currentUpwardSpeed, airPocket.baseSpeed);
                    }
                }
            );
        }

        return airPocket;
    }

    // Add a helper method to check if a location is valid for spawning
    isPositionValid(x, y) {
        // If the obstacles layer doesn't exist, consider the position valid
        if (!this.obstaclesLayer) return true;
        
        // Convert pixel coordinates to tile coordinates
        const tileX = Math.floor(x / this.map.tileWidth);
        const tileY = Math.floor(y / this.map.tileHeight);
        
        // Get the tile at this position
        const tile = this.obstaclesLayer.getTileAt(tileX, tileY);
        
        // If there's no tile or the tile index is -1 (empty), the position is valid
        if (!tile || tile.index === -1) return true;
        
        // If we have a tile with an index not equal to -1, it means there's a collision tile there
        // so the position is not valid
        return false;
    }

    // Add new method for movement burst
    emitMovementBurst(direction) {
        // Determine the emission position based on player's facing direction
        
        // Fixed position offset from the player's back (where a tank/jet pack would be)
        const offsetX = this.player.flipX ? -40 : 40; // Position from the back of the diver
        const offsetY = 5; // Slightly below center for backpack position
        
        // Set emitter follow offset
        this.movementBurstEmitter.followOffset.x = offsetX;
        this.movementBurstEmitter.followOffset.y = offsetY;
        
        // Set the emission angle based on player's facing direction
        // This creates the "jet blast" effect - always emit in the opposite direction of facing
        const angleMin = this.player.flipX ? 340 : 160; // Right-facing: emit left, Left-facing: emit right
        const angleMax = this.player.flipX ? 380 : 200; // Small angle range for focused stream
        
        // For Phaser 3 particle emitters, we can't directly set these properties
        // Instead, we need to create new particle effects with the updated config
        
        // Create powerful jet blast effect with more bubbles for a dense stream
        this.movementBurstEmitter.explode(15, // More bubbles for dense jet blast
            this.player.x + offsetX, 
            this.player.y + offsetY);
    }

    // Add a method to find the player spawn point from the map
    findPlayerSpawn() {
        console.log('Searching for player spawn in map objects...');
        
        // Check if map and object layers exist
        if (!this.map || !this.map.objects) {
            console.error('No map or object layers found. Cannot find player spawn point.');
            return { x: 292, y: 340 }; // Hardcoded coordinate from level1.json as absolute fallback
        }
        
        // Find the specific object with template="Player Spawn.tx"
        let playerSpawnPoint = null;
        
        this.map.objects.forEach(layer => {
            const objects = layer.objects || [];
            objects.forEach(obj => {
                // Log all objects to verify what we're looking at
                console.log(`Object ID: ${obj.id}, Template: ${obj.template || 'None'}, x: ${obj.x}, y: ${obj.y}`);
                
                // Check specifically for the Player Spawn template
                if (obj.template && (
                    obj.template.includes('Player Spawn') || 
                    obj.template.includes('player_spawn')
                )) {
                    console.log(`Found player spawn point at (${obj.x}, ${obj.y}) with template: ${obj.template}`);
                    playerSpawnPoint = { x: obj.x, y: obj.y };
                }
            });
        });
        
        if (playerSpawnPoint) {
            console.log(`Using player spawn point from map: (${playerSpawnPoint.x}, ${playerSpawnPoint.y})`);
            return playerSpawnPoint;
        }
        
        // If we reach here, we couldn't find the spawn point in the map
        console.error('Could not find Player Spawn object in map. Using hardcoded position from level1.json');
        return { x: 292, y: 340 }; // Hardcoded fallback from level1.json
    }

    // Add a dedicated method for respawning the player
    respawnPlayer() {
        // Make sure we have a valid spawn point
        if (!this.playerSpawnPoint) {
            console.error('No player spawn point defined');
            return;
        }
        
        // Reset player position to spawn point location from map
        this.player.x = this.playerSpawnPoint.x;
        this.player.y = this.playerSpawnPoint.y;
        
        // Reactivate the player
        this.player.setActive(true);
        this.player.setVisible(true);
        
        // Re-enable physics if they were removed
        if (!this.player.body) {
            this.physics.add.existing(this.player);
        }
        
        // IMPORTANT: Set correct physics properties to match what works for air pockets
        this.player.body.setImmovable(true);
        this.player.body.pushable = false;
        this.player.body.setBounce(0.1);
        
        // Reset collision with obstacle layer if needed
        if (this.obstaclesLayer) {
            // Remove any existing colliders to prevent duplicate collision handling
            this.physics.world.colliders.getActive().forEach(collider => {
                if ((collider.object1 === this.player && collider.object2 === this.obstaclesLayer) || 
                    (collider.object1 === this.obstaclesLayer && collider.object2 === this.player)) {
                    this.physics.world.removeCollider(collider);
                    console.log('Removed old player-obstacle collider during respawn');
                }
            });
            
            // CRITICAL: Use EXACTLY the same collider approach as air pockets
            this.physics.add.collider(
                this.player, 
                this.obstaclesLayer
            );
            console.log('Added fresh player-obstacle collision during respawn using air pocket approach');
        }
        
        // Reset oxygen level
        this.currentOxygen = this.maxOxygen;
        
        // Reset velocity and acceleration
        this.player.setVelocity(0, 0);
        this.player.setAcceleration(0, 0);
        
        console.log(`Player respawned at exact spawn point from map: ${this.playerSpawnPoint.x}, ${this.playerSpawnPoint.y}`);
    }

    // This method updates the air pockets based on the respawn timer
    updateAirPocketSpawns(time, delta) {
        if (!this.respawningAirPockets || !this.obstaclesLayer) return;
        
        // Check each respawning air pocket
        for (let i = this.respawningAirPockets.length - 1; i >= 0; i--) {
            const airPocketData = this.respawningAirPockets[i];
            
            // Decrease time left
            airPocketData.timeLeft -= delta;
            
            // Time to check if we can respawn
            if (airPocketData.timeLeft <= 0) {
                // Get the spawn point
                const spawnPoint = airPocketData.spawnPoint;
                
                // Check if the position is valid (not inside an obstacle)
                if (this.isPositionValid(spawnPoint.x, spawnPoint.y)) {
                    // Time to respawn this air pocket
                    const airPocket = this.createSingleAirPocket(spawnPoint.x, spawnPoint.y);
                    
                    // Remove from respawning list
                    this.respawningAirPockets.splice(i, 1);
                } else {
                    // Location still blocked, try again later
                    airPocketData.timeLeft = 1000; // Try again in 1 second
                }
            }
        }
    }

    // SIMPLIFIED COLLISION FIX METHOD
    fixTiledCollisions() {
        if (!this.obstaclesLayer) {
            console.error('No obstacles layer exists to fix collisions!');
            return;
        }
        
        console.log('==== FIXING COLLISION DATA FROM TILED ====');
        
        // Reset all collision data on the layer
        this.obstaclesLayer.setCollision(false);
        
        // Set collision only for non-empty tiles
        this.obstaclesLayer.setCollisionByExclusion([-1]);
        
        console.log('Reset collision data: all non-empty tiles (-1) are now collidable');
        
        // Recreate the player-obstacle collider using EXACT same pattern as air pockets
        if (this.player && this.player.body) {
            // Remove existing collider if any
            if (this.playerObstacleCollider) {
                this.physics.world.removeCollider(this.playerObstacleCollider);
            }
            
            // CRITICAL FIX: Check player physics body
            console.log('Player body before collider creation:', {
                width: this.player.body.width,
                height: this.player.body.height,
                offsetX: this.player.body.offset.x,
                offsetY: this.player.body.offset.y,
                enabled: this.player.body.enable
            });
            
            // Ensure physics body is enabled and properly sized
            if (!this.player.body.enable) {
                console.log('Re-enabling player physics body');
                this.player.body.enable = true;
            }
            
            // CRITICAL FIX: Reinitialize the physics body to ensure it's correctly sized
            // Use the same size/offset we set originally
            this.player.body.setSize(80, 120, true);
            this.player.body.setOffset(5, 5);
            
            // Fix contradicting physics properties - match what works for air pockets
            this.player.body.setImmovable(true);
            this.player.body.pushable = false;
            this.player.body.setBounce(0.1);
            
            // CRITICAL: Use EXACT same collider approach as air pockets - no callbacks or filters
            this.playerObstacleCollider = this.physics.add.collider(
                this.player,
                this.obstaclesLayer
            );
            
            console.log('Created player-obstacle collider using EXACT same approach as air pockets');
        }
        
        // Update debug visualization if enabled
        if (this.physics.config.debug && this.tileDebugGraphics) {
            this.tileDebugGraphics.clear();
            
            this.obstaclesLayer.renderDebug(this.tileDebugGraphics, {
                tileColor: null,
                collidingTileColor: new Phaser.Display.Color(255, 0, 255, 1),
                faceColor: new Phaser.Display.Color(255, 255, 0, 1)
            });
            
            console.log('Updated collision debug visualization');
        }
    }

    // Add a method to respawn all air pockets for debugging
    respawnAllAirPockets() {
        console.log('Removing all existing air pockets...');
        // First, ensure we completely remove all existing air pockets
        if (this.airPockets) {
            // Get a count before removal for logging
            const airPocketCount = this.airPockets.getChildren().length;
            
            // Clear the entire group to ensure all air pockets are removed
            this.airPockets.clear(true, true);
            console.log(`Removed ${airPocketCount} air pockets from the map`);
        }
        
        // Mark all spawn points as inactive
        this.airPocketSpawnPoints.forEach(spawnPoint => {
            spawnPoint.active = false;
        });
        
        // Now create new air pockets at all spawn points
        this.airPocketSpawnPoints.forEach((spawnPoint, index) => {
            // Check if this position is valid (not inside an obstacle)
            if (this.isPositionValid(spawnPoint.x, spawnPoint.y)) {
                // Spawn a new air pocket
                const airPocket = this.createSingleAirPocket(spawnPoint.x, spawnPoint.y, spawnPoint.variation);
                
                // Store the spawn point index for reference
                airPocket.spawnPointIndex = index;
                
                // Mark as active
                spawnPoint.active = true;
                spawnPoint.lastSpawnTime = this.time.now;
            }
        });
        
        // No blue flash effect
    }

    // Add a new method specifically for boost bursts, with more power
    emitBoostBurst(direction) {
        // Determine the emission position based on player's direction
        let offsetX, offsetY, emitAngle;
        
        if (direction.x !== 0) {
            // Horizontal movement - emit from behind
            offsetX = direction.x > 0 ? -40 : 40; // Emit from opposite side of movement
            offsetY = 0;
            emitAngle = direction.x > 0 ? { min: 160, max: 200 } : { min: 340, max: 380 };
        } else if (direction.y !== 0) {
            // Vertical movement
            offsetX = 0;
            offsetY = direction.y > 0 ? -40 : 40; // Emit from opposite side of movement
            emitAngle = direction.y > 0 ? { min: 250, max: 290 } : { min: 70, max: 110 };
        } else {
            // Default (no movement) - use player's facing direction
            offsetX = this.player.flipX ? 40 : -40;
            offsetY = 0;
            emitAngle = this.player.flipX ? { min: 340, max: 380 } : { min: 160, max: 200 };
        }
        
        // Create a temporary stronger emitter specifically for the boost
        const boostEmitter = this.add.particles(0, 0, 'bubble', {
            x: this.player.x + offsetX,
            y: this.player.y + offsetY,
            lifespan: 1000,
            gravityY: -20,
            speed: { min: 400, max: 600 }, // Increased from 300-500 for more dramatic jet effect
            scale: { start: 0.4, end: 0.1 }, // Larger particles for more dramatic effect
            alpha: { start: 1.0, end: 0 }, // Fully opaque start
            angle: emitAngle,
            rotate: { min: -15, max: 15 },
            frequency: -1, // Emit all at once (explode mode)
            emitZone: { 
                type: 'random',
                source: new Phaser.Geom.Circle(0, 0, 4) // Slightly larger radius for boost
            },
            tint: [ 0xffffff, 0xd8f0ff, 0xccccff ] // Add more blue tints for dramatic effect
        }).setDepth(3.5);
        
        // Emit a dense burst of particles
        boostEmitter.explode(35); // Increased from 25 for more particles
        
        // Destroy the temporary emitter after a short time
        this.time.delayedCall(1000, () => {
            boostEmitter.destroy();
        });
    }
}

const config = {
    type: Phaser.AUTO,
    width: 1600,    // 2x original width
    height: 1200,   // 2x original height
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false,     // Disabled debug mode for production
            debugShowBody: true,
            debugShowStaticBody: true,
            debugShowVelocity: true,
            debugVelocityColor: 0xffff00,
            debugBodyColor: 0x0000ff,
            debugStaticBodyColor: 0xff00ff,
            processTileCollisions: true,  // Make sure tile collisions are processed
            tileBias: 64,     // Increase tile bias to prevent tunneling
            fps: 60,          // Lock physics to 60fps for consistency
            checkCollision: {
                up: true,
                down: true,
                left: true,
                right: true
            },
            overlapBias: 8,   // Add overlap bias for better overlap detection
            maxEntries: 256   // Increase max entries in the dynamic tree
        }
    },
    scene: GameScene,
    callbacks: {
        postBoot: function(game) {
            // Safeguard for physics system
            console.log('Game booted successfully, physics system initialized');
        }
    }
};

const game = new Phaser.Game(config); 