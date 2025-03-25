import Enemy from '../entities/Enemy';

export default class EnemySystem {
    constructor(scene) {
        this.scene = scene;
        this.enemies = scene.add.group({
            classType: Enemy,
            runChildUpdate: true
        });
        
        // Spawn settings
        this.maxEnemies = 10;
        this.spawnInterval = 2000; // Spawn every 2 seconds
        this.spawnTimer = 0;
        
        // Get map bounds for spawning
        this.updateMapBounds();
    }
    
    isPositionValid(x, y) {
        // Get the obstacles layer
        const obstaclesLayer = this.scene.tilemapSystem?.layers?.Obstacles;
        if (!obstaclesLayer) return true; // If no obstacles layer, any position is valid
        
        // Convert pixel coordinates to tile coordinates
        const tileX = Math.floor(x / this.scene.tilemapSystem.map.tileWidth);
        const tileY = Math.floor(y / this.scene.tilemapSystem.map.tileHeight);
        
        // Get the tile at this position
        const tile = obstaclesLayer.getTileAt(tileX, tileY);
        
        // Position is valid if there's no tile (tile.index === -1)
        return !tile || tile.index === -1;
    }
    
    updateMapBounds() {
        // Get map bounds from tilemap system or use default values
        const map = this.scene.tilemapSystem?.map;
        if (map) {
            this.mapBounds = {
                width: map.widthInPixels,
                height: map.heightInPixels
            };
            console.log('EnemySystem using map dimensions:', this.mapBounds);
        } else {
            // Use physics world bounds as fallback
            this.mapBounds = {
                width: this.scene.physics.world.bounds.width,
                height: this.scene.physics.world.bounds.height
            };
            console.log('EnemySystem using physics world bounds:', this.mapBounds);
        }
    }
    
    spawnEnemy() {
        if (this.enemies.getLength() >= this.maxEnemies) return;
        
        // Update map bounds before spawning
        this.updateMapBounds();
        
        // Try to find a valid spawn position
        let validPosition = false;
        let x, y;
        let attempts = 0;
        const maxAttempts = 10; // Prevent infinite loop
        
        while (!validPosition && attempts < maxAttempts) {
            // Random position along the edges of the map
            const side = Phaser.Math.Between(0, 3); // 0: top, 1: right, 2: bottom, 3: left
            
            switch (side) {
                case 0: // Top
                    x = Phaser.Math.Between(0, this.mapBounds.width);
                    y = -50;
                    break;
                case 1: // Right
                    x = this.mapBounds.width + 50;
                    y = Phaser.Math.Between(0, this.mapBounds.height);
                    break;
                case 2: // Bottom
                    x = Phaser.Math.Between(0, this.mapBounds.width);
                    y = this.mapBounds.height + 50;
                    break;
                case 3: // Left
                    x = -50;
                    y = Phaser.Math.Between(0, this.mapBounds.height);
                    break;
            }
            
            // Check if position is valid (not inside an obstacle)
            validPosition = this.isPositionValid(x, y);
            attempts++;
        }
        
        // If we found a valid position, spawn the enemy
        if (validPosition) {
            const enemy = new Enemy(this.scene, x, y);
            this.enemies.add(enemy);
            console.log('Spawned enemy at:', { x, y });
        } else {
            console.warn('Could not find valid spawn position for enemy after', maxAttempts, 'attempts');
        }
    }
    
    update(time, delta) {
        // Update spawn timer
        this.spawnTimer += delta;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnEnemy();
        }
        
        // Clean up dead enemies
        this.enemies.getChildren().forEach(enemy => {
            if (!enemy.isAlive) {
                this.enemies.remove(enemy);
            }
        });
    }
    
    destroy() {
        this.enemies.getChildren().forEach(enemy => enemy.destroy());
        this.enemies.clear(true, true);
    }
} 