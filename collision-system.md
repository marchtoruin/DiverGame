# Underwater Game Collision System

## Core Principles

The collision system in this game relies on Phaser's standard Arcade Physics without any custom filters or callbacks. The key discovery was that **simpler is better** - unnecessary filtering or custom collision processing breaks the collision detection.

## Working Collision Setup

### For Obstacles Layer
```javascript
// Set collision for all non-empty tiles
obstaclesLayer.setCollisionByExclusion([-1]);
```

### For Player-Obstacle Collision
```javascript
// CORRECT: Simple direct collider - no callbacks or filters
this.physics.add.collider(
    this.player,
    this.obstaclesLayer
);
```

### For Air Pockets-Obstacle Collision
```javascript
// CORRECT: Simple direct collider - no callbacks or filters
airPocket.obstacleLayerCollider = this.physics.add.collider(
    airPocket, 
    this.obstaclesLayer
);
```

## Player Physics Settings

The physics body settings that work for proper collision:

```javascript
// Proper player physics body settings for collision
this.player.body.setSize(80, 120, true);    // Hitbox size
this.player.body.setOffset(5, 5);           // Hitbox position
this.player.body.setImmovable(true);        // Important!
this.player.body.pushable = false;          // Important!
this.player.body.setBounce(0.1);            // Slight bounce
```

## Air Pocket Physics Settings

Fine-tuned settings for realistic buoyant air pockets that float upward while maintaining proper collision:

```javascript
// Air pocket physics settings for realistic buoyancy
airPocket.setBounce(0.4);                // Moderate bounce (not too bouncy)
airPocket.setDrag(15);                   // Moderate drag - enough to provide resistance but not stop movement
airPocket.setFriction(0.1);              // Light friction to allow sideways movement
airPocket.body.setDamping(true);         // Enable velocity damping
airPocket.body.setDrag(0.03);            // Very subtle damping effect
airPocket.body.setAllowGravity(false);   // No gravity
airPocket.body.setImmovable(false);      // Can be moved by collisions
airPocket.body.pushable = false;         // But won't be pushed by player

// Strong initial upward velocity
airPocket.setVelocity(
    Phaser.Math.Between(-10, 10),        // Mild horizontal drift
    Phaser.Math.Between(-120, -100)      // Strong upward movement
);

// Continuous buoyancy force using a timer
this.time.addEvent({
    delay: 500,                          // Check every 500ms
    loop: true,                          // Repeat indefinitely
    callback: () => {
        // Apply additional upward force if slowing down
        if (airPocket.body.velocity.y > -50) {
            airPocket.body.velocity.y -= 20;
        }
    }
});

// Global periodic boost in update method
if (time % 1000 < 20) { // Once per second
    this.airPockets.getChildren().forEach(airPocket => {
        if (airPocket.body.velocity.y > -40) {
            airPocket.body.velocity.y -= Phaser.Math.Between(15, 25);
        }
    });
}
```

## Things That Break Collision

1. **Custom Collision Callbacks**: Adding process callbacks or collision callbacks to the collider prevents proper collision detection.

2. **Incorrect Physics Properties**: If `immovable` and `pushable` are set incorrectly, collisions may not work properly.

3. **Mismatched Methods**: Using `player.setOffset()` instead of `player.body.setOffset()` causes problems.

4. **Missing Delay**: Not waiting for physics to initialize before creating colliders.

## Adding New Collidable Objects

When adding a new object that should collide with the obstacles:

1. Create the sprite with `physics.add.sprite()` or add it to a physics group
2. Set the proper physics body size with `body.setSize()` and `body.setOffset()`
3. Set `body.setImmovable(true)` and `body.pushable = false`
4. Create a simple collider: `physics.add.collider(newObject, obstaclesLayer)`

## Fixing Collisions When They Break

If collision detection stops working:

1. Check that the object has a proper physics body
2. Remove any custom collision callbacks or filters
3. Reset the obstacle layer collision: `obstaclesLayer.setCollisionByExclusion([-1])`
4. Recreate the collider using the simple approach above
5. If updating the map, first destroy the old obstacles layer before creating a new one

## Debugging Collisions

Use the debug mode to visualize collision bodies:

```javascript
// In config
physics: {
    arcade: {
        debug: true,
        debugShowBody: true,
        debugShowStaticBody: true
    }
}
```

## Notes

- Always test collision with both player and air pockets - if air pockets collide but player doesn't, there's an issue with the player's collision setup.
- Phaser's Arcade Physics works best with simple shapes - complex collision is better handled through multiple simple shapes.
- The `TILE_BIAS` setting (64) helps prevent tunneling through obstacles at higher speeds.
- For floating objects like air pockets, combining moderate bounce, low drag, and continuous upward force creates the most realistic buoyancy effect.
- If objects get "stuck" due to collisions, adding periodic velocity boosts helps ensure they continue their intended movement. 