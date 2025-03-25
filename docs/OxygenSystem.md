# Oxygen System Documentation

This document explains how to use the new Oxygen System in the Underwater Game.

## Overview

The Oxygen System adds a survival mechanic to the game where the player must manage their oxygen level while exploring underwater. The player's oxygen depletes over time, and they must collect air pockets to replenish it. If oxygen is fully depleted, the player will start drowning and taking damage.

## Components

The Oxygen System consists of several components:

1. **Player Oxygen Management** - Handles the player's oxygen depletion, warnings, and drowning state
2. **Air Pockets** - Collectible entities that replenish oxygen
3. **Air Pocket System** - Manages all air pockets in the game
4. **UI Components** - Display oxygen and health levels
5. **Visual Effects** - Indicate low oxygen and drowning states

## Adding Air Pockets to Your Map

You can add air pockets to your Tiled map in two ways:

### Method 1: Using Tiled Objects

1. In Tiled, create an Objects layer
2. Add an object and set its name or type to contain "air" (e.g., "Air Pocket", "air_bubble", etc.)
3. Optionally add a property called "variation" with a value of 1, 2, or 3 to specify the size

The Air Pocket System will automatically detect these objects and create air pockets at their positions.

### Method 2: Adding Programmatically

You can also add air pockets through code:

```javascript
// In your GameScene code
this.airPocketSystem.addAirPocket(x, y, variation);
```

Where:
- `x` and `y` are the coordinates
- `variation` is 1, 2, or 3 (small, medium, large)

## Configuration

The oxygen system uses constants defined in `src/utils/Constants.js`:

```javascript
// Oxygen system constants
export const OXYGEN = {
    MAX: 100,                   // Maximum oxygen level
    DEPLETION_RATE: 0.1,        // Oxygen depleted per frame
    LOW_WARNING: 20,            // Threshold for low oxygen warning
    SAFE_LEVEL: 30,             // Threshold to clear warning
    DAMAGE_RATE: 0.5,           // Damage when out of oxygen
    AIR_POCKET: {
        SMALL: 20,              // Amount for small air pocket
        MEDIUM: 30,             // Amount for medium air pocket
        LARGE: 40,              // Amount for large air pocket
        RESPAWN_TIME: 10000     // Respawn time in ms
    }
};
```

You can adjust these values to change how the oxygen system behaves.

## Health System Integration

When oxygen is depleted, the player starts taking damage according to the `OXYGEN.DAMAGE_RATE` value. The player's health will recover slowly when they have sufficient oxygen.

## UI Components

### Oxygen Meter

The `OxygenMeter` class displays the player's current oxygen level with color-coding:
- Green: High oxygen
- Yellow: Medium oxygen
- Red: Low oxygen (flashing when critically low)

### Health Bar

The `HealthBar` class displays the player's health with similar color-coding.

## Visual Effects

The system includes several visual effects:

1. **Low Oxygen Warning** - A red vignette effect that pulses when oxygen is low
2. **Drowning Effect** - A blue vignette effect when the player is out of oxygen
3. **Air Pocket Collection** - Particle effects when collecting an air pocket
4. **Air Pocket Respawn** - Effect when an air pocket reappears after collection

## Sound Effects

The system includes three sound effects:

1. `air_collect.mp3` - Played when collecting an air pocket
2. `low_oxygen_alarm.mp3` - Played when oxygen is critically low
3. `air_respawn.mp3` - Played when an air pocket respawns

## Events

The system uses several events for communication:

- `playerOxygenChanged` - Emitted when oxygen level changes
- `playerHealthChanged` - Emitted when health changes
- `playerLowOxygen` - Emitted when oxygen becomes critically low
- `playerDrowning` - Emitted when the player starts/stops drowning
- `playerDied` - Emitted when the player dies

## Example: Adding a Deep Area That Depletes Oxygen Faster

You can create areas where oxygen depletes faster for added challenge:

```javascript
// In your update method
update(time, delta) {
    // ... existing code ...
    
    // Check if player is in a deep area
    if (this.player && this.isInDeepArea(this.player.sprite.x, this.player.sprite.y)) {
        // Double the oxygen depletion rate temporarily
        this.player.oxygenDepletionRate = OXYGEN.DEPLETION_RATE * 2;
    } else if (this.player) {
        // Reset to normal depletion rate
        this.player.oxygenDepletionRate = OXYGEN.DEPLETION_RATE;
    }
    
    // ... existing code ...
}

isInDeepArea(x, y) {
    // Define your logic to determine if the position is in a deep area
    // This could be a specific region of the map or a property of the tiles
    return y > 1000; // Example: anything below y=1000 is considered deep
}
```

## Troubleshooting

### Air Pockets Not Appearing

If air pockets aren't appearing from your Tiled map:

1. Check that your object layer is being loaded correctly
2. Verify that objects have "air" in their name or type
3. Look at the console for any error messages
4. Manually add air pockets with `airPocketSystem.addAirPocket()`

### Oxygen Not Depleting/Replenishing

If oxygen mechanics aren't working:

1. Check that the player entity has the oxygen properties initialized
2. Verify that the update method is being called
3. Ensure collision detection between player and air pockets is working

### UI Not Updating

If UI elements aren't updating:

1. Verify the UI components were created and added to the scene
2. Check that events are being emitted correctly
3. Ensure the UI event listeners are connected 