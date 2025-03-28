import Enemy from '../entities/Enemy';

export default class EnemySystem {
    constructor(scene) {
        console.log('Initializing EnemySystem...');
        
        this.scene = scene;
        this.enemies = scene.add.group({
            classType: Enemy,
            runChildUpdate: true
        });
        
        // Spawn settings
        this.maxEnemies = 10;
        this.spawnInterval = 2000; // Spawn every 2 seconds
        this.spawnTimer = 0;
        
        // Debug markers array
        this.debugMarkers = [];
        this.spawnData = {};
        
        // Get map bounds for spawning
        this.updateMapBounds();
        
        // Define hardcoded enemy spawn points
        // These are used instead of map data
        this.hardcodedSpawnPoints = [
            { x: 500, y: 300, type: 1 },
            { x: 800, y: 500, type: 2 },
            { x: 1200, y: 700, type: 3 },
            { x: 400, y: 900, type: 1 },
            { x: 1500, y: 400, type: 2 }
        ];
        
        // Initialize with hardcoded spawn points
        this.initSpawnPoints(this.hardcodedSpawnPoints);
        
        console.log('EnemySystem initialization complete');
        
        // Start spawning immediately
        this.spawnEnemy();
    }
    
    isPositionValid(x, y) {
        // First check if the map and tilemapSystem are available
        if (!this.scene.tilemapSystem) {
            console.log("No tilemapSystem found - allowing spawn position");
            return true;
        }
        
        // Check if tilemap is initialized
        if (!this.scene.tilemapSystem.map) {
            console.log("Map not initialized - allowing spawn position");
            return true;
        }
        
        // Get map dimensions
        const mapWidth = this.scene.tilemapSystem.map.widthInPixels;
        const mapHeight = this.scene.tilemapSystem.map.heightInPixels;
        
        // For spawn positions, we want to allow slightly outside the map bounds
        // since we're spawning from edges
        const buffer = 100; // Allow spawning within 100 pixels outside the map
        
        if (x < -buffer || x > mapWidth + buffer || y < -buffer || y > mapHeight + buffer) {
            console.log(`Position (${x}, ${y}) too far outside map bounds`);
            return false;
        }
        
        // Skip obstacle check for spawn positions that are outside the map
        // This allows enemies to spawn from the edges
        if (x < 0 || x > mapWidth || y < 0 || y > mapHeight) {
            console.log(`Position (${x}, ${y}) is at map edge - valid spawn point`);
            return true;
        }
        
        // Only check for obstacles if the position is inside the map
        if (this.scene.tilemapSystem.isPositionBlocked) {
            const isBlocked = this.scene.tilemapSystem.isPositionBlocked(x, y);
            if (isBlocked) {
                console.log(`Position (${x}, ${y}) blocked by obstacle`);
            }
            return !isBlocked;
        }
        
        // If we can't check for obstacles, allow the position
        console.log(`Position (${x}, ${y}) valid (no obstacle check available)`);
        return true;
    }
    
    updateMapBounds() {
        console.log('Updating map bounds...');
        
        // Try to get bounds from tilemap first
        if (this.scene.tilemapSystem && this.scene.tilemapSystem.map) {
            const map = this.scene.tilemapSystem.map;
            console.log('TilemapSystem found with map:', {
                widthInPixels: map.widthInPixels,
                heightInPixels: map.heightInPixels,
                width: map.width,
                height: map.height,
                tileWidth: map.tileWidth,
                tileHeight: map.tileHeight
            });
            
            this.mapBounds = {
                width: map.widthInPixels,
                height: map.heightInPixels
            };
            console.log('Set map bounds from tilemap:', this.mapBounds);
        }
        // Fallback to camera bounds
        else if (this.scene.cameras && this.scene.cameras.main) {
            console.log('No tilemap found, using camera bounds');
            this.mapBounds = {
                width: this.scene.cameras.main.width,
                height: this.scene.cameras.main.height
            };
            console.log('Set map bounds from camera:', this.mapBounds);
        }
        // Last resort - use default values
        else {
            console.warn('No map or camera bounds available, using defaults');
            this.mapBounds = {
                width: 800,
                height: 600
            };
            console.log('Set default map bounds:', this.mapBounds);
        }
    }
    
    spawnEnemy() {
        console.log('SpawnEnemy called. Current enemy count:', this.enemies.getLength(), 'Max:', this.maxEnemies);
        
        if (this.enemies.getLength() >= this.maxEnemies) {
            console.log('Max enemies reached, skipping spawn');
            return;
        }
        
        // Update map bounds before spawning
        this.updateMapBounds();
        console.log('Map bounds:', this.mapBounds);
        
        // Try to find a valid spawn position
        let validPosition = false;
        let x, y;
        let attempts = 0;
        const maxAttempts = 10; // Prevent infinite loop
        const spawnOffset = 100; // Distance outside the map to spawn enemies
        
        while (!validPosition && attempts < maxAttempts) {
            // Random position along the edges of the map
            const side = Phaser.Math.Between(0, 3); // 0: top, 1: right, 2: bottom, 3: left
            
            switch (side) {
                case 0: // Top
                    x = Phaser.Math.Between(0, this.mapBounds.width);
                    y = -spawnOffset;
                    break;
                case 1: // Right
                    x = this.mapBounds.width + spawnOffset;
                    y = Phaser.Math.Between(0, this.mapBounds.height);
                    break;
                case 2: // Bottom
                    x = Phaser.Math.Between(0, this.mapBounds.width);
                    y = this.mapBounds.height + spawnOffset;
                    break;
                case 3: // Left
                    x = -spawnOffset;
                    y = Phaser.Math.Between(0, this.mapBounds.height);
                    break;
            }
            
            console.log(`Attempt ${attempts + 1}: Trying position (${x}, ${y})`);
            
            // Check if position is valid (not inside an obstacle)
            validPosition = this.isPositionValid(x, y);
            attempts++;
        }
        
        // If we found a valid position, spawn the enemy
        if (validPosition) {
            const enemy = new Enemy(this.scene, x, y);
            this.enemies.add(enemy);
            console.log('Successfully spawned enemy at:', { x, y });
        } else {
            console.warn('Could not find valid spawn position for enemy after', maxAttempts, 'attempts');
        }
    }
    
    update(time, delta) {
        if (!this.scene || !this.scene.game) {
            console.warn('EnemySystem update called without valid scene');
            return;
        }

        if (!this.scene.game.isRunning) {
            return;
        }

        // Update spawn timer
        this.spawnTimer += delta;
        
        // Only log every second to reduce spam
        if (Math.floor(this.spawnTimer / 1000) !== Math.floor((this.spawnTimer - delta) / 1000)) {
            console.log(`Enemy system active - Timer: ${Math.floor(this.spawnTimer)}/${this.spawnInterval}ms`);
        }
        
        if (this.spawnTimer >= this.spawnInterval) {
            console.log('Spawn interval reached, attempting to spawn enemy...');
            this.spawnTimer = 0;
            this.spawnEnemy();
        }
        
        // Update existing enemies
        const enemies = this.enemies.getChildren();
        if (enemies.length === 0) {
            console.log('No active enemies, waiting for spawn...');
        } else {
            console.log(`Managing ${enemies.length} active enemies`);
        }
        
        // Clean up dead enemies
        enemies.forEach(enemy => {
            if (!enemy.isAlive) {
                console.log('Removing dead enemy');
                this.enemies.remove(enemy);
            }
        });
    }
    
    destroy() {
        this.enemies.getChildren().forEach(enemy => enemy.destroy());
        this.enemies.clear(true, true);
    }

    /**
     * Create a visual marker for a spawn point (debug only)
     * @param {number} x - X position
     * @param {number} y - Y position 
     * @param {number} type - Enemy type
     * @private
     */
    createSpawnPointMarker(x, y, type) {
        // This method is intentionally empty to ensure NO markers are created
        // Debug markers for enemy spawn points must NEVER be visible
        // No debug visualization is created regardless of debug settings
        return;
    }

    /**
     * Clean up any existing spawn point markers
     */
    clearDebugMarkers() {
        if (this.debugMarkers && this.debugMarkers.length > 0) {
            this.debugMarkers.forEach(marker => {
                if (marker && marker.destroy) {
                    marker.destroy();
                }
            });
            this.debugMarkers = [];
        }
    }

    /**
     * Initialize spawn points for enemies
     * @param {Array} spawnPoints - Array of spawn point objects from the map
     */
    initSpawnPoints(spawnPoints = []) {
        try {
            // Clear existing debug markers first
            this.clearDebugMarkers();
            
            // Store the spawn points
            this.spawnPoints = [];
            
            // CRITICAL: Set enemySpawnLocations immediately to prevent other systems from using these positions
            this.scene.enemySpawnPointsInitialized = true;
            this.scene.enemySpawnLocations = this.hardcodedSpawnPoints.map(p => ({ x: p.x, y: p.y, isEnemySpawn: true }));
            
            console.log(`Initializing ${spawnPoints.length} enemy spawn points`);
            
            // Process each spawn point
            spawnPoints.forEach(point => {
                // Only process valid spawn points with coordinates
                if (point && point.x !== undefined && point.y !== undefined) {
                    // Store the spawn point
                    this.spawnPoints.push({
                        x: point.x,
                        y: point.y,
                        type: point.type || 1,
                        active: true,
                        lastSpawnTime: 0,
                        isEnemySpawn: true // Mark explicitly as enemy spawn
                    });
                    
                    // Create debug marker (hidden by default)
                    this.createSpawnPointMarker(point.x, point.y, point.type || 1);
                }
            });
            
            // Create spawn data for each type of enemy
            this.spawnData = {};
            
            // Type 1: Basic enemy
            this.spawnData[1] = {
                respawn: 5000,  // Respawn every 5 seconds
                health: 30,
                damage: 10,
                oxygen: 20, // Oxygen drop amount
                speed: 100
            };
            
            // Type 2: Medium enemy
            this.spawnData[2] = {
                respawn: 8000,  // Respawn every 8 seconds
                health: 50,
                damage: 15,
                oxygen: 35,
                speed: 80
            };
            
            // Type 3: Large enemy
            this.spawnData[3] = {
                respawn: 12000,  // Respawn every 12 seconds
                health: 100,
                damage: 25,
                oxygen: 50,
                speed: 60
            };
            
            console.log(`Enemy spawn system initialized with ${this.spawnPoints.length} spawn points`);
            
            // Clear any existing air pocket markers at enemy spawn positions
            this.clearAirPocketMarkersAtEnemyPositions();
        } catch (error) {
            console.error('Error initializing enemy spawn points:', error);
        }
    }

    /**
     * Clear any existing air pocket markers at enemy spawn positions
     */
    clearAirPocketMarkersAtEnemyPositions() {
        // Skip if no air pocket system
        if (!this.scene.airPocketSystem) {
            return;
        }
        
        console.log('Checking for air pocket markers at enemy spawn positions');
        
        // Get the spawn locations
        const enemyPositions = this.spawnPoints.map(p => ({ x: p.x, y: p.y }));
        
        // If there's any debug text from air pocket system near these positions, destroy them
        if (this.scene.airPocketSystem.debugTexts && this.scene.airPocketSystem.debugTexts.length > 0) {
            let removed = 0;
            
            // Filter out debug texts at enemy positions
            this.scene.airPocketSystem.debugTexts = this.scene.airPocketSystem.debugTexts.filter(text => {
                // Check if this text is at an enemy position
                const isAtEnemyPosition = enemyPositions.some(pos => 
                    Math.abs(text.x - pos.x) < 20 && 
                    Math.abs(text.y - pos.y) < 60
                );
                
                // Destroy if at enemy position
                if (isAtEnemyPosition) {
                    text.destroy();
                    removed++;
                    return false;
                }
                
                return true;
            });
            
            if (removed > 0) {
                console.log(`Removed ${removed} air pocket markers at enemy spawn positions`);
            }
        }
    }
} 