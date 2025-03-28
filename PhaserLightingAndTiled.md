# Phaser 3.88.2 Lighting with Tiled Tilemaps Integration Guide

## Key Points

- Research suggests integrating Phaser 3.88.2's lighting system with Tiled tilemaps requires setting the tilemap layer to the 'Light2D' pipeline.
- Tiles blocking light (like walls) rely on their normal maps for lighting effects.
- No special Tiled metadata is required beyond normal maps.
- Performance can be optimized by limiting light sources in large maps.
- Potential rendering issues exist in older versions; thorough testing is recommended.

## Direct Answer

Phaser 3.88.2's lighting system can work well with Tiled tilemaps, especially for walls or environmental geometry, but requires some setup for stability, visual quality, and ease of use.

### Setting Up Tiled Tile Layers

To make tiles cast shadows or block light:
- Ensure your Tiled tileset includes both color and normal maps.
- Normal maps help the lighting system understand how light interacts with each tile.
- No special properties in Tiled are necessary, but custom properties can be added for game logic.

### Assigning Lighting Properties in Phaser

Load your tilemap and set up the lighting pipeline:

```javascript
const map = this.make.tilemap({ key: 'map' });
const tileset = map.addTilesetImage('tilesetName', 'tilesetKey');
const layer = map.createLayer(0, tileset, 0, 0).setPipeline('Light2D');

// Place light sources
this.lights.addLight(x, y, radius);
```

### Tileset and Layer Requirements

- No special metadata in Tiled is required beyond normal maps.
- Each tile's normal map determines its appearance under light.
- Ensure walls have normal maps that make them appear solid.

### Performance for Large Maps

- Keep the number of light sources low to avoid performance hits.
- Test and optimize by:
  - Culling invisible areas
  - Applying lighting only to visible layers

### Known Issues and Limitations

- Potential rendering issues with lighting and tilemaps in older Phaser versions.
- Always test your game to identify and resolve problems.

### Example and Tools

- Check Phaser's "Light Map" example for basic setup.
- Community tutorials like Digitherium's blog offer advanced insights.
- Post-processing tools like blur can smooth lighting effects.

**Note:** Advanced light blocking (e.g., shadows cast by walls onto other tiles) might require custom coding, as Phaser's system focuses on individual tile lighting.

## Detailed Technical Integration

### Configuring Tiled Tile Layers for Lighting

- Tileset must include color and normal maps.
- Normal maps are crucial for the Light2D pipeline.
- Create normal maps using tools like SpriteIlluminator.
- Custom properties in Tiled are more useful for game logic than lighting.

### Lighting Pipeline Setup

```javascript
const map = this.make.tilemap({ key: 'map' });
const tileset = map.addTilesetImage('tilesetName', 'tilesetKey', 
  null, null, null, null, null, 
  ['path/to/color.png', 'path/to/normal.png']
);
const layer = map.createLayer(0, tileset, 0, 0).setPipeline('Light2D');

// Enable and configure lights
this.lights.enable().setAmbientColor(0x555555);
this.lights.addLight(400, 300, 200)
  .setColor(0xffffff)
  .setIntensity(3.0);
```

### Performance Optimization Strategies

- Limit active light sources
- Use culling techniques for visible areas
- Selectively apply Light2D pipeline
- Test on different devices, especially mobile platforms

## Community Resources and Tools

- Phaser's official "Light Map" example
- Digitherium's Phaser Platformer Series
- Community plugins:
  - phaser-tilemap-plus
  - Rex Rainbow's Plugins
  - Kawase Blur plugin for smoothing effects

## Conclusion

Integrating Phaser 3.88.2's lighting with Tiled tilemaps requires careful setup of normal maps, pipeline configuration, and performance optimization. Always test thoroughly and be prepared to implement custom solutions for advanced lighting effects.

*Survey Note: This guide is based on documentation and community insights as of March 27, 2025.*