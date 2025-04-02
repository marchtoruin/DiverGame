/**
 * CurrentSystem - Handles underwater currents defined via polylines in Tiled
 * 
 * This system processes polylines from a "current" object layer in Tiled maps
 * and applies directional forces to the player when they enter the current.
 */
import Phaser from 'phaser';

export default class CurrentSystem {
    /**
     * Create a new current system
     * @param {Phaser.Scene} scene - The scene this system belongs to
     */
    constructor(scene) {
        this.scene = scene;
        
        // Player reference
        this.player = null;
        
        // Store current polylines/segments for force application
        this.currents = [];
        
        // Store polygon areas for area-based force application
        this.polygonAreas = [];
        
        // Default influence range (how close player needs to be to feel the current)
        this.influenceRange = 80;
        
        // Force calculation parameters
        this.maxForce = 250;       // Base maximum force (lowered from 800)
        this.forceMultiplier = 3.0;  // Higher multiplier to give more impact to Tiled strength values
        
        // Debug visualization
        this.isDebugMode = false;
        this.debugGraphics = null;
        
        // Visual representations of currents
        this.currentVisuals = [];
        this.useVisualSprites = true; // Flag to enable/disable visual sprites
        
        this.effectTimers = [];
        this.currentEffectsDepth = 35;
        
        console.log('CurrentSystem created');
    }
    
    /**
     * Enable debug visualization
     * @param {boolean} enabled - Whether debug visualization is enabled
     */
    setDebugMode(enabled) {
        this.isDebugMode = false; // Force debug visuals to always be disabled
        
        console.log('🌊 Current system debug mode forced to disabled');
        
        // Clean up graphics
        if (this.debugGraphics) {
            this.debugGraphics.clear();
            this.debugGraphics.destroy();
            this.debugGraphics = null;
        }
        
        if (this.forceGraphics) {
            this.forceGraphics.clear();
            this.forceGraphics.destroy();
            this.forceGraphics = null;
        }
        
        // Clean up text objects
        if (this.debugText) {
            this.debugText.destroy();
            this.debugText = null;
        }
        
        if (this.forceText) {
            this.forceText.destroy();
            this.forceText = null;
        }
        
        if (this.segmentTexts) {
            this.segmentTexts.forEach(text => {
                if (text) text.destroy();
            });
            this.segmentTexts = null;
        }
        
        if (this.debugTexts) {
            this.debugTexts.forEach(text => {
                if (text) text.destroy();
            });
            this.debugTexts = null;
        }
        
        /* Original debug mode code preserved for future reference:
        this.isDebugMode = enabled;
        
        if (enabled) {
            console.log('🌊 Current system debug mode enabled');
            // Create debug graphics if needed
            if (!this.debugGraphics) {
                this.debugGraphics = this.scene.add.graphics();
                this.debugGraphics.setDepth(1000);
            }
            
            // Create persistent debug visuals
            this.createPersistentDebugVisuals();
        } else {
            console.log('🌊 Current system debug mode disabled');
            // Clean up graphics
            if (this.debugGraphics) {
                this.debugGraphics.clear();
                this.debugGraphics.destroy();
                this.debugGraphics = null;
            }
            
            if (this.forceGraphics) {
                this.forceGraphics.clear();
                this.forceGraphics.destroy();
                this.forceGraphics = null;
            }
            
            // Clean up text objects
            if (this.debugText) {
                this.debugText.destroy();
                this.debugText = null;
            }
            
            if (this.forceText) {
                this.forceText.destroy();
                this.forceText = null;
            }
            
            if (this.segmentTexts) {
                this.segmentTexts.forEach(text => {
                    if (text) text.destroy();
                });
                this.segmentTexts = null;
            }
            
            if (this.debugTexts) {
                this.debugTexts.forEach(text => {
                    if (text) text.destroy();
                });
                this.debugTexts = null;
            }
        }
        */
    }
    
    /**
     * Register the player with the current system
     * @param {Object} player - The player object
     */
    setPlayer(player) {
        this.player = player;
    }
    
    /**
     * Process the currents layer from a Tiled map
     * @param {Phaser.Tilemaps.Tilemap} map - The tilemap containing the currents
     */
    processCurrentsLayer(map) {
        if (!map.objects) {
            console.error('❌ No object layers found in map');
            return;
        }
        
        console.log('🌊 All available layers:', map.objects.map(layer => layer.name));
        
        // Find the "current" layer (case insensitive)
        const currentLayer = map.objects.find(layer => 
            layer.name.toLowerCase() === 'current' || 
            layer.name.toLowerCase() === 'currents');
        
        if (!currentLayer) {
            console.error('❌ No current layer found in map. Available layers:', 
                map.objects.map(layer => layer.name));
            return;
        }
        
        console.log(`🌊 Found current layer: ${currentLayer.name} with ${currentLayer.objects?.length || 0} objects`);
        
        // Process each current object
        let processedCount = 0;
        
        if (!currentLayer.objects || currentLayer.objects.length === 0) {
            console.error('❌ No objects found in current layer');
            return;
        }
        
        currentLayer.objects.forEach(obj => {
            console.log(`🌊 Processing object:`, {
                id: obj.id,
                name: obj.name,
                type: obj.type, 
                hasPolyline: !!obj.polyline,
                hasPolygon: !!obj.polygon,
                polyPoints: obj.polyline?.length || obj.polygon?.length || 0,
                properties: obj.properties,
                x: obj.x,
                y: obj.y
            });
            
            // Check if the object is a polyline or polygon
            if (obj.polyline) {
                this.processPolyline(obj, obj.polyline);
                processedCount++;
            } else if (obj.polygon) {
                this.processPolygon(obj, obj.polygon);
                processedCount++;
            } else {
                console.warn('❌ Object in current layer is neither a polyline nor a polygon:', obj);
            }
        });
        
        console.log(`🌊 Processed ${processedCount} objects, created ${this.currents.length} current segments`);
        
        // Apply default direction to all currents without a direction
        this.setDefaultCurrentDirection("up");
        
        // Debug visualization disabled to remove cyan boundaries
        /* 
        // Create persistent debug visualization if enabled
        if (this.isDebugMode) {
            this.createPersistentDebugVisuals();
        }
        */
    }
    
    /**
     * Process a polygon object from Tiled
     * @param {Object} obj - The polygon object from Tiled
     * @param {Array} points - The polygon points
     */
    processPolygon(obj, points) {
        console.log(`🌊 Processing polygon with ${points.length} points`);
        // Extract properties (same as polyline)
        const { strength, width, direction, harpoonOnly } = this.extractProperties(obj);
        
        // Convert polygon to absolute coordinates
        const absPoints = points.map(p => ({
            x: p.x + obj.x,
            y: p.y + obj.y
        }));
        
        console.log(`🌊 Converted polygon to absolute coordinates:`, absPoints);
        
        // Get angle and direction vector from direction property
        const forceAngle = direction ? this.directionToAngle(direction) : 0;
        const directionVector = {
            x: direction ? Math.cos(forceAngle) : 0,
            y: direction ? Math.sin(forceAngle) : 0
        };
        
        // Store the complete polygon area for area-based force application
        this.polygonAreas.push({
            points: absPoints,
            strength: strength,
            direction: direction,
            forceAngle: forceAngle,
            directionVector: directionVector,
            harpoonOnly: harpoonOnly
        });
        
        // Break polygon into segments (connect each point to the next, including last to first)
        for (let i = 0; i < absPoints.length; i++) {
            const start = absPoints[i];
            const end = absPoints[(i + 1) % absPoints.length]; // Connect last point back to first
            
            // Always use the polygon's explicit direction for segments, 
            // rather than calculating segment-specific directions
            this.createSegment(
                start, end, 
                strength, width, 
                direction, harpoonOnly, 
                // Pass the directionVector directly to ensure it's consistent
                directionVector,
                forceAngle
            );
        }
    }
    
    /**
     * Process a polyline object from Tiled
     * @param {Object} obj - The polyline object from Tiled
     * @param {Array} points - The polyline points
     */
    processPolyline(obj, points) {
        console.log(`🌊 Processing polyline with ${points.length} points`);
        // Extract properties
        const { strength, width, direction, harpoonOnly } = this.extractProperties(obj);
        
        // Convert polyline to absolute coordinates
        const absPoints = points.map(p => ({
            x: p.x + obj.x,
            y: p.y + obj.y
        }));
        
        console.log(`🌊 Converted polyline to absolute coordinates:`, absPoints);
        
        // Break polyline into segments
        for (let i = 0; i < absPoints.length - 1; i++) {
            const start = absPoints[i];
            const end = absPoints[i + 1];
            
            this.createSegment(start, end, strength, width, direction, harpoonOnly);
            
            // Add visual representation if enabled
            if (this.useVisualSprites) {
                this.addCurrentVisual(start, end, direction);
            }
        }
    }
    
    /**
     * Extract properties from a Tiled object
     * @param {Object} obj - The object from Tiled
     * @returns {Object} The extracted properties
     */
    extractProperties(obj) {
        // Default values
        let strength = 1.5;
        let width = this.influenceRange;
        let direction = null;
        let harpoonOnly = false;
        
        // Current effects specific properties
        let type = 'bubble';
        let scale = 0.5;
        let frequency = 500; 
        let lifetime = 2000;
        let variance = 1; // Default variance (1-5)
        
        console.log(`🔍 Raw object:`, {
            id: obj.id,
            name: obj.name || "(unnamed)",
            type: obj.type || "(no type)",
            x: obj.x,
            y: obj.y,
            properties: obj.properties
        });
        
        // Extract properties using Tiled's export format
        // Properties can be in several different formats
        if (obj.properties) {
            // Format 1: Array of {name, value} objects
            if (Array.isArray(obj.properties)) {
                console.log(`🔍 Properties are in array format with ${obj.properties.length} items`);
                obj.properties.forEach(prop => {
                    console.log(`🔍 Processing property: ${prop.name} = ${prop.value}`);
                    const propName = prop.name.toLowerCase();
                    
                    // Current system properties
                    if (propName === 'strength') {
                        strength = parseFloat(prop.value) || strength;
                        console.log(`🔍 Found strength property: ${strength}`);
                    } else if (propName === 'width') {
                        width = parseFloat(prop.value) || width;
                    } else if (propName === 'direction') {
                        direction = String(prop.value).toLowerCase();
                        console.log(`🔍 Found direction property: "${direction}"`);
                    } else if (propName === 'harpoon_only' || propName === 'harpoononly') {
                        harpoonOnly = prop.value === 'true' || prop.value === true;
                    } 
                    // Current effects properties
                    else if (propName === 'type') {
                        type = String(prop.value).toLowerCase();
                        console.log(`🔍 Found type property: "${type}"`);
                    } else if (propName === 'scale') {
                        scale = parseFloat(prop.value) || scale;
                        console.log(`🔍 Found scale property: ${scale}`);
                    } else if (propName === 'frequency') {
                        frequency = parseInt(prop.value) || frequency;
                        console.log(`🔍 Found frequency property: ${frequency}`);
                    } else if (propName === 'lifetime') {
                        lifetime = parseInt(prop.value) || lifetime;
                        console.log(`🔍 Found lifetime property: ${lifetime}`);
                    } else if (propName === 'variance') {
                        variance = parseFloat(prop.value) || variance;
                        // Clamp variance between 1-5
                        variance = Math.max(1, Math.min(5, variance));
                        console.log(`🔍 Found variance property: ${variance}`);
                    }
                });
            } 
            // Format 2: Direct object with property keys
            else if (typeof obj.properties === 'object') {
                console.log(`🔍 Properties are in object format:`, obj.properties);
                
                // Case-insensitive property lookup
                for (const key in obj.properties) {
                    const lowerKey = key.toLowerCase();
                    const value = obj.properties[key];
                    
                    // Current system properties
                    if (lowerKey === 'strength') {
                        strength = parseFloat(value) || strength;
                        console.log(`🔍 Found strength property: ${strength}`);
                    } else if (lowerKey === 'width') {
                        width = parseFloat(value) || width;
                    } else if (lowerKey === 'direction') {
                        direction = String(value).toLowerCase();
                        console.log(`🔍 Found direction property: "${direction}"`);
                    } else if (lowerKey === 'harpoon_only' || lowerKey === 'harpoononly') {
                        harpoonOnly = value === 'true' || value === true;
                    }
                    // Current effects properties
                    else if (lowerKey === 'type') {
                        type = String(value).toLowerCase();
                        console.log(`🔍 Found type property: "${type}"`);
                    } else if (lowerKey === 'scale') {
                        scale = parseFloat(value) || scale;
                        console.log(`🔍 Found scale property: ${scale}`);
                    } else if (lowerKey === 'frequency') {
                        frequency = parseInt(value) || frequency;
                        console.log(`🔍 Found frequency property: ${frequency}`);
                    } else if (lowerKey === 'lifetime') {
                        lifetime = parseInt(value) || lifetime;
                        console.log(`🔍 Found lifetime property: ${lifetime}`);
                    } else if (lowerKey === 'variance') {
                        variance = parseFloat(value) || variance;
                        // Clamp variance between 1-5
                        variance = Math.max(1, Math.min(5, variance));
                        console.log(`🔍 Found variance property: ${variance}`);
                    }
                }
            } else {
                console.warn(`❌ Properties exist but in unexpected format:`, typeof obj.properties);
            }
        } else {
            console.warn(`❌ No properties found on object`, obj.id || "(unnamed)");
            
            // Try to check if properties are directly on the object (some Tiled exports do this)
            for (const key in obj) {
                const lowerKey = key.toLowerCase();
                // Current system properties
                if (lowerKey === 'strength') {
                    strength = parseFloat(obj[key]) || strength;
                    console.log(`🔍 Found strength property on object: ${strength}`);
                }
                if (lowerKey === 'width') width = parseFloat(obj[key]) || width;
                if (lowerKey === 'direction') {
                    direction = String(obj[key]).toLowerCase();
                    console.log(`🔍 Found direction property on object: "${direction}"`);
                }
                if (lowerKey === 'harpoon_only' || lowerKey === 'harpoononly') {
                    harpoonOnly = obj[key] === 'true' || obj[key] === true;
                }
                // Current effects properties
                if (lowerKey === 'type') {
                    type = String(obj[key]).toLowerCase();
                    console.log(`🔍 Found type property on object: "${type}"`);
                }
                if (lowerKey === 'scale') {
                    scale = parseFloat(obj[key]) || scale;
                    console.log(`🔍 Found scale property on object: ${scale}`);
                }
                if (lowerKey === 'frequency') {
                    frequency = parseInt(obj[key]) || frequency;
                    console.log(`🔍 Found frequency property on object: ${frequency}`);
                }
                if (lowerKey === 'lifetime') {
                    lifetime = parseInt(obj[key]) || lifetime;
                    console.log(`🔍 Found lifetime property on object: ${lifetime}`);
                }
                if (lowerKey === 'variance') {
                    variance = parseFloat(obj[key]) || variance;
                    // Clamp variance between 1-5
                    variance = Math.max(1, Math.min(5, variance));
                    console.log(`🔍 Found variance property on object: ${variance}`);
                }
            }
        }
        
        console.log(`🔍 Final extracted properties:`, { 
            strength, width, direction, harpoonOnly,
            type, scale, frequency, lifetime, variance
        });
        
        // Ensure strength is within a wider range (1-10)
        strength = Phaser.Math.Clamp(strength, 1, 10);
        
        return { 
            strength, width, direction, harpoonOnly,
            type, scale, frequency, lifetime, variance
        };
    }
    
    /**
     * Create a segment from two points
     * @param {Object} start - Start point with x, y
     * @param {Object} end - End point with x, y
     * @param {number} strength - The current strength
     * @param {number} width - The current influence width
     * @param {string} direction - The current direction
     * @param {boolean} harpoonOnly - Whether the current affects only harpoon shots
     * @param {Object} directionVector - Optional force direction vector
     * @param {number} forceAngle - Optional force angle
     */
    createSegment(start, end, strength, width, direction, harpoonOnly, directionVector, forceAngle) {
        // Calculate segment length
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) {
            console.warn('❌ Zero-length segment, skipping');
            return;
        }
        
        // Calculate default direction for the segment (normal to segment line)
        const segmentAngle = Math.atan2(dy, dx);
        const segmentNormalAngle = segmentAngle + Math.PI / 2; // Perpendicular (90 degrees)
        
        // Use provided force angle if available, otherwise use perpendicular
        const finalForceAngle = (forceAngle !== undefined) ? forceAngle : segmentNormalAngle;
        
        // Use provided direction vector if available, otherwise calculate from force angle
        const finalDirectionVector = directionVector ? directionVector : {
            x: Math.cos(finalForceAngle),
            y: Math.sin(finalForceAngle)
        };
        
        // Create the segment
        this.currents.push({
            start: { x: start.x, y: start.y },
            end: { x: end.x, y: end.y },
            strength: strength,
            width: width,
            direction: direction,
            forceAngle: finalForceAngle,
            directionVector: finalDirectionVector,
            harpoonOnly: harpoonOnly
        });
    }
    
    /**
     * Create persistent debug visuals for all current segments
     */
    createPersistentDebugVisuals() {
        if (!this.debugGraphics) {
            this.debugGraphics = this.scene.add.graphics();
            this.debugGraphics.setDepth(1000);
        }
        
        // Clear any existing graphics
        this.debugGraphics.clear();
        
        // Draw each current segment
        this.currents.forEach(segment => {
            // Draw segment line
            this.debugGraphics.lineStyle(2, 0x00ffff, 0.8);
            this.debugGraphics.lineBetween(
                segment.start.x, segment.start.y,
                segment.end.x, segment.end.y
            );
            
            // Draw influence area
            this.debugGraphics.lineStyle(1, 0x00ffff, 0.4);
            
            // Calculate midpoint of segment
            const midX = (segment.start.x + segment.end.x) / 2;
            const midY = (segment.start.y + segment.end.y) / 2;
            
            // Draw circle showing influence range
            this.debugGraphics.strokeCircle(midX, midY, segment.width);
            
            // Draw direction arrow if direction is set
            if (segment.direction) {
                // Draw a direction arrow
                const arrowLength = Math.min(segment.width, 50);
                const arrowX = midX + segment.directionVector.x * arrowLength;
                const arrowY = midY + segment.directionVector.y * arrowLength;
                
                this.debugGraphics.lineStyle(3, 0xff0000, 0.9);
                this.debugGraphics.lineBetween(midX, midY, arrowX, arrowY);
                
                // Draw arrowhead
                const headLength = arrowLength * 0.3;
                const angle = Math.atan2(segment.directionVector.y, segment.directionVector.x);
                const headAngle1 = angle - Math.PI * 0.8;
                const headAngle2 = angle + Math.PI * 0.8;
                
                this.debugGraphics.lineBetween(
                    arrowX, arrowY,
                    arrowX - Math.cos(headAngle1) * headLength,
                    arrowY - Math.sin(headAngle1) * headLength
                );
                
                this.debugGraphics.lineBetween(
                    arrowX, arrowY,
                    arrowX - Math.cos(headAngle2) * headLength,
                    arrowY - Math.sin(headAngle2) * headLength
                );
            }
        });
        
        // Draw each polygon area with direction indicators
        this.polygonAreas.forEach(polygon => {
            // Draw polygon outline
            this.debugGraphics.lineStyle(2, 0x00ffff, 0.8);
            
            this.debugGraphics.beginPath();
            this.debugGraphics.moveTo(polygon.points[0].x, polygon.points[0].y);
            
            for (let i = 1; i < polygon.points.length; i++) {
                this.debugGraphics.lineTo(polygon.points[i].x, polygon.points[i].y);
            }
            
            this.debugGraphics.closePath();
            this.debugGraphics.strokePath();
            
            // Calculate center of polygon
            let centerX = 0, centerY = 0;
            for (let i = 0; i < polygon.points.length; i++) {
                centerX += polygon.points[i].x;
                centerY += polygon.points[i].y;
            }
            centerX /= polygon.points.length;
            centerY /= polygon.points.length;
            
            // Draw direction arrow
            if (polygon.direction) {
                // Larger, more visible arrow
                const arrowLength = 80;
                const arrowX = centerX + polygon.directionVector.x * arrowLength;
                const arrowY = centerY + polygon.directionVector.y * arrowLength;
                
                // Draw thick, highly visible arrow
                this.debugGraphics.lineStyle(4, 0xff3300, 1.0);
                this.debugGraphics.lineBetween(centerX, centerY, arrowX, arrowY);
                
                // Draw arrowhead
                const headLength = arrowLength * 0.3;
                const angle = Math.atan2(polygon.directionVector.y, polygon.directionVector.x);
                const headAngle1 = angle - Math.PI * 0.8;
                const headAngle2 = angle + Math.PI * 0.8;
                
                this.debugGraphics.lineBetween(
                    arrowX, arrowY,
                    arrowX - Math.cos(headAngle1) * headLength,
                    arrowY - Math.sin(headAngle1) * headLength
                );
                
                this.debugGraphics.lineBetween(
                    arrowX, arrowY,
                    arrowX - Math.cos(headAngle2) * headLength,
                    arrowY - Math.sin(headAngle2) * headLength
                );
                
                // Add direction text
                const text = this.scene.add.text(
                    centerX, centerY - 20,
                    `Direction: ${polygon.direction}`,
                    { font: '14px Arial', fill: '#ff0000', backgroundColor: '#000000' }
                );
                text.setOrigin(0.5);
                text.setDepth(1001);
                
                // Add to debug visuals for cleanup
                if (!this.debugTexts) this.debugTexts = [];
                this.debugTexts.push(text);
            } else {
                // Draw a warning for polygons without direction
                const text = this.scene.add.text(
                    centerX, centerY - 20,
                    `NO DIRECTION SET!`,
                    { font: '14px Arial', fill: '#ff0000', backgroundColor: '#000000' }
                );
                text.setOrigin(0.5);
                text.setDepth(1001);
                
                if (!this.debugTexts) this.debugTexts = [];
                this.debugTexts.push(text);
            }
            
            // Add strength text with more emphasis based on the value
            const strengthText = this.scene.add.text(
                centerX, centerY + 10,
                `Strength: ${polygon.strength.toFixed(1)}`,
                { 
                    font: `${14 + polygon.strength}px Arial`, // Font size increases with strength
                    fill: this.getStrengthColor(polygon.strength), // Color based on strength
                    backgroundColor: '#000000'
                }
            );
            strengthText.setOrigin(0.5);
            strengthText.setDepth(1001);
            
            if (!this.debugTexts) this.debugTexts = [];
            this.debugTexts.push(strengthText);
        });
        
        // Add system info text
        this.debugText = this.scene.add.text(
            20, 20,
            `Current System: ${this.currents.length} segments,\n${this.polygonAreas.length} polygons`,
            { font: '16px Arial', fill: '#00ffff', backgroundColor: '#000000' }
        );
        this.debugText.setDepth(1001);
    }
    
    /**
     * Get a color based on strength value (1-5)
     * @param {number} strength - The strength value
     * @returns {string} HTML color string
     */
    getStrengthColor(strength) {
        // Colors range from yellow (weak) to red (strong)
        switch(Math.floor(strength)) {
            case 1: return '#ffff00'; // Yellow
            case 2: return '#ffaa00'; // Orange-yellow
            case 3: return '#ff7700'; // Orange
            case 4: return '#ff4400'; // Red-orange
            case 5: 
            default: return '#ff0000'; // Red
        }
    }
    
    /**
     * Create a test current for debugging
     * This is only used if no currents are found in the map
     */
    createTestCurrent() {
        console.log('🌊 Creating test current in the center of the screen');
        
        // Get player position or use map center
        let playerX = 0, playerY = 0;
        let centerX = 0, centerY = 0;
        
        if (this.player && this.player.sprite) {
            playerX = this.player.sprite.x;
            playerY = this.player.sprite.y;
        }
        
        // Use camera center for positioning
        if (this.scene.cameras && this.scene.cameras.main) {
            centerX = this.scene.cameras.main.worldView.centerX;
            centerY = this.scene.cameras.main.worldView.centerY;
        }
        
        // Default to center of map if camera is not available
        if (!centerX && this.scene.map) {
            centerX = this.scene.map.widthInPixels / 2;
            centerY = this.scene.map.heightInPixels / 2;
        }
        
        // If all else fails, use arbitrary position
        if (!centerX) {
            centerX = 500;
            centerY = 500;
        }
        
        // If player exists, create current near player
        const startX = playerX || centerX - 150;
        const startY = playerY || centerY - 150;
        
        // Create a simple test current
        const testSegment = {
            start: { x: startX, y: startY },
            end: { x: startX + 300, y: startY },
            width: 50,
            strength: 2.0,
            forceAngle: 0, // Right direction
            harpoonOnly: false,
            length: 300,
            directionVector: { x: 1, y: 0 }
        };
        
        // Add the test segment
        this.currents.push(testSegment);
        
        // Add a second perpendicular segment
        const testSegment2 = {
            start: { x: startX + 300, y: startY },
            end: { x: startX + 300, y: startY + 300 },
            width: 50,
            strength: 2.0,
            forceAngle: Math.PI/2, // Down direction
            harpoonOnly: false,
            length: 300,
            directionVector: { x: 0, y: 1 }
        };
        
        // Add the second test segment
        this.currents.push(testSegment2);
        
        console.log(`🌊 Created ${this.currents.length} test current segments`);
    }
    
    /**
     * Convert a named direction to an angle in radians
     * @param {string} direction - Direction name ('up', 'down', 'left', 'right', etc.)
     * @returns {number} Angle in radians
     */
    directionToAngle(direction) {
        if (!direction) return 0;
        
        // Convert direction string to lowercase and trim
        const dir = direction.toLowerCase().trim();
        
        // Map direction names to angles (in radians)
        switch (dir) {
            case 'up': return -Math.PI/2;      // -90°
            case 'down': return Math.PI/2;     // 90°
            case 'left': return Math.PI;       // 180°
            case 'right': return 0;            // 0°
            case 'up-right': return -Math.PI/4;    // -45°
            case 'up-left': return -3*Math.PI/4;   // -135°
            case 'down-right': return Math.PI/4;   // 45°
            case 'down-left': return 3*Math.PI/4;  // 135°
            default:
                console.warn(`🌊 Unknown direction: "${dir}", defaulting to right (0°)`);
                return 0;  // Default to right
        }
    }
    
    /**
     * Calculate the distance from a point to a line segment
     * @param {number} px - Point X coordinate
     * @param {number} py - Point Y coordinate
     * @param {number} x1 - Segment start X coordinate
     * @param {number} y1 - Segment start Y coordinate
     * @param {number} x2 - Segment end X coordinate
     * @param {number} y2 - Segment end Y coordinate
     * @returns {number} The shortest distance from the point to the segment
     */
    distanceToSegment(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Check if a point is inside a polygon
     * @param {number} x - Point X coordinate
     * @param {number} y - Point Y coordinate
     * @param {Array} points - Array of polygon points {x, y}
     * @returns {boolean} True if the point is inside the polygon
     */
    isPointInPolygon(x, y, points) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const xi = points[i].x, yi = points[i].y;
            const xj = points[j].x, yj = points[j].y;
            
            const intersect = ((yi > y) != (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }
    
    /**
     * Update the current system
     * @param {number} time - The current time
     * @param {number} delta - The time delta in milliseconds
     */
    update(time, delta) {
        if (!this.player || !this.player.sprite || !this.player.sprite.body) {
            return;
        }
        
        // Ensure critical properties are defined to prevent errors
        if (this.maxForce === undefined) this.maxForce = 300;
        if (this.forceMultiplier === undefined) this.forceMultiplier = 1;
        
        // Debug visualizations are disabled
        /*
        // Don't clear persistent debug graphics, only dynamic force indicators
        if (this.isDebugMode && this.forceGraphics) {
            this.forceGraphics.clear();
        } else if (this.isDebugMode && !this.forceGraphics) {
            // Create a separate graphics object for forces
            this.forceGraphics = this.scene.add.graphics();
            this.forceGraphics.setDepth(1001);
        }
        
        // Update debug text with player position
        if (this.isDebugMode && this.debugText) {
            this.debugText.setText(
                `Current System: ${this.currents.length} segments\nPlayer: (${Math.floor(playerX)},${Math.floor(playerY)})`
            );
        }
        */
        
        const playerX = this.player.sprite.x;
        const playerY = this.player.sprite.y;
        
        // Accumulate forces from all affecting currents
        let totalForceX = 0;
        let totalForceY = 0;
        let affectedByAnyCurrent = false;
        let affectedByPolygon = false;
        let affectingPolygon = null;
        
        // First check if player is inside any polygon areas
        for (let i = 0; i < this.polygonAreas.length; i++) {
            const polygon = this.polygonAreas[i];
            
            // Skip if this polygon is missing data or is for harpoon only
            if (!polygon || !polygon.points || polygon.harpoonOnly) {
                continue;
            }
            
            // Check if player is inside this polygon
            const isInside = this.isPointInPolygon(playerX, playerY, polygon.points);
            
            if (isInside) {
                affectedByPolygon = true;
                affectedByAnyCurrent = true;
                affectingPolygon = polygon;
                
                // Calculate force based on the polygon's direction
                let forceX = 0, forceY = 0;
                
                // Ensure polygon has required properties
                polygon.strength = polygon.strength || 1;
                
                if (polygon.direction && polygon.directionVector) {
                    // Always use explicit direction if provided
                    forceX = polygon.directionVector.x * polygon.strength * this.maxForce * this.forceMultiplier;
                    forceY = polygon.directionVector.y * polygon.strength * this.maxForce * this.forceMultiplier;
                } else {
                    // If no explicit direction, find the nearest edge and use its direction
                    let closestDist = Infinity;
                    let closestSegment = null;
                    
                    // Find the closest segment
                    for (let j = 0; j < polygon.points.length; j++) {
                        const start = polygon.points[j];
                        const end = polygon.points[(j + 1) % polygon.points.length];
                        
                        const dist = this.distanceToSegment(
                            playerX, playerY,
                            start.x, start.y,
                            end.x, end.y
                        );
                        
                        if (dist < closestDist) {
                            closestDist = dist;
                            closestSegment = { start, end };
                        }
                    }
                    
                    if (closestSegment) {
                        const angle = Phaser.Math.Angle.Between(
                            closestSegment.start.x, closestSegment.start.y,
                            closestSegment.end.x, closestSegment.end.y
                        );
                        
                        // Calculate normal to the segment (perpendicular)
                        const normalAngle = angle + Math.PI / 2;
                        
                        // Apply force in normal direction (pushing inward)
                        forceX = Math.cos(normalAngle) * polygon.strength * this.maxForce * this.forceMultiplier;
                        forceY = Math.sin(normalAngle) * polygon.strength * this.maxForce * this.forceMultiplier;
                    } else {
                        // Fallback to a default direction if no segments found
                        forceX = 0;
                        forceY = polygon.strength * this.maxForce * this.forceMultiplier; // Default to downward
                    }
                }
                
                // Add to total force
                totalForceX += forceX;
                totalForceY += forceY;
                
                // Debug visualization removed
                /*
                // Debug visualization
                if (this.isDebugMode && this.forceGraphics) {
                    // Draw polygon in a highlighted color
                    this.forceGraphics.lineStyle(3, 0xff00ff, 0.7);
                    
                    // Draw polygon
                    this.forceGraphics.beginPath();
                    this.forceGraphics.moveTo(polygon.points[0].x, polygon.points[0].y);
                    
                    for (let j = 1; j < polygon.points.length; j++) {
                        this.forceGraphics.lineTo(polygon.points[j].x, polygon.points[j].y);
                    }
                    
                    this.forceGraphics.closePath();
                    this.forceGraphics.strokePath();
                    
                    // Draw force vector
                    this.forceGraphics.lineStyle(4, 0xff0000, 0.9);
                    this.forceGraphics.lineBetween(
                        playerX, playerY,
                        playerX + forceX / 4,
                        playerY + forceY / 4
                    );
                    
                    // Show force text
                    if (!this.polygonForceText) {
                        this.polygonForceText = this.scene.add.text(
                            playerX, playerY - 60,
                            `Inside Polygon #${i}: X=${forceX.toFixed(0)}, Y=${forceY.toFixed(0)}`,
                            { font: '16px Arial', fill: '#ff80ff', backgroundColor: '#000000' }
                        );
                        this.polygonForceText.setDepth(1002);
                    } else {
                        this.polygonForceText.setPosition(playerX, playerY - 60);
                        this.polygonForceText.setText(`Inside Polygon #${i}: X=${forceX.toFixed(0)}, Y=${forceY.toFixed(0)}`);
                        this.polygonForceText.setVisible(true);
                    }
                }
                */
            }
        }
        
        // If not affected by a polygon, check line segments as before
        if (!affectedByPolygon) {
            this.currents.forEach((segment, index) => {
                // Skip if this segment is for harpoon only (future feature)
                if (segment.harpoonOnly) {
                    return;
                }
                
                // Calculate distance to the current segment
                const distance = this.distanceToSegment(
                    playerX, playerY,
                    segment.start.x, segment.start.y,
                    segment.end.x, segment.end.y
                );
                
                // Check if player is within the current's influence
                const isAffected = distance <= segment.width;
                
                if (isAffected) {
                    affectedByAnyCurrent = true;
                    
                    // Calculate influence factor (1.0 at center, 0.0 at edge)
                    const influenceFactor = 1.0 - (distance / segment.width);
                    
                    // Calculate force based on distance and strength
                    const forceMagnitude = segment.strength * influenceFactor * this.maxForce * this.forceMultiplier;
                    
                    // Add force to the total
                    totalForceX += segment.directionVector.x * forceMagnitude;
                    totalForceY += segment.directionVector.y * forceMagnitude;
                    
                    // Debug visualization removed
                    /*
                    // Debug visualization if enabled
                    if (this.isDebugMode && this.forceGraphics) {
                        // Draw a line from player to closest point on segment
                        this.forceGraphics.lineStyle(2, 0x00ffff, 0.7);
                        this.forceGraphics.lineBetween(
                            playerX, playerY,
                            playerX + segment.directionVector.x * 50 * influenceFactor,
                            playerY + segment.directionVector.y * 50 * influenceFactor
                        );
                        
                        // Draw a circle showing distance to segment
                        this.forceGraphics.lineStyle(1, 0x00ffff, 0.7);
                        this.forceGraphics.strokeCircle(playerX, playerY, distance);
                        
                        // Print segment info
                        if (!this.segmentTexts) this.segmentTexts = [];
                        
                        if (!this.segmentTexts[index]) {
                            this.segmentTexts[index] = this.scene.add.text(
                                playerX, playerY - 40 - (index * 20),
                                `Segment #${index}: dist=${Math.floor(distance)}/${segment.width}, force=${forceMagnitude.toFixed(0)}`,
                                { font: '14px Arial', fill: '#ffff00', backgroundColor: '#000000' }
                            );
                            this.segmentTexts[index].setDepth(1002);
                        } else {
                            this.segmentTexts[index].setPosition(playerX, playerY - 40 - (index * 20));
                            this.segmentTexts[index].setText(
                                `Segment #${index}: dist=${Math.floor(distance)}/${segment.width}, force=${forceMagnitude.toFixed(0)}`
                            );
                            this.segmentTexts[index].setVisible(true);
                        }
                    }
                    */
                } else if (this.isDebugMode && this.segmentTexts && this.segmentTexts[index]) {
                    // Hide segment text if not affected
                    this.segmentTexts[index].setVisible(false);
                }
            });
        } else if (this.isDebugMode && this.segmentTexts) {
            // Hide all segment texts if affected by polygon
            this.segmentTexts.forEach(text => {
                if (text) text.setVisible(false);
            });
        }
        
        // Apply the accumulated force to the player if affected by any current
        if (affectedByAnyCurrent) {
            // Validate values to prevent NaN and infinite values
            if (isNaN(totalForceX) || !isFinite(totalForceX)) totalForceX = 0;
            if (isNaN(totalForceY) || !isFinite(totalForceY)) totalForceY = 0;

            // Clamp forces to reasonable values to prevent extreme acceleration
            totalForceX = Math.max(-5000, Math.min(5000, totalForceX)); // Increased from -2500/2500
            totalForceY = Math.max(-5000, Math.min(5000, totalForceY)); // Increased from -2500/2500
            
            // Convert time delta to seconds for physics calculations
            const deltaSeconds = delta / 1000;
            
            try {
                // Apply force directly to player velocity
                // Use a stronger direct approach that both accelerates and sets minimum velocity
                if (this.player && this.player.sprite && this.player.sprite.body) {
                    this.player.sprite.body.velocity.x += totalForceX * deltaSeconds;
                    this.player.sprite.body.velocity.y += totalForceY * deltaSeconds;
                    
                    // Ensure minimum current velocity (in the direction of the force)
                    if (Math.abs(totalForceX) > 10) {
                        const minVelocityX = Math.sign(totalForceX) * Math.min(Math.abs(totalForceX), 250); // Increased from 100
                        if (Math.sign(this.player.sprite.body.velocity.x) === Math.sign(totalForceX)) {
                            this.player.sprite.body.velocity.x = Math.sign(totalForceX) * 
                                Math.max(Math.abs(this.player.sprite.body.velocity.x), Math.abs(minVelocityX));
                        }
                    }
                    
                    if (Math.abs(totalForceY) > 10) {
                        const minVelocityY = Math.sign(totalForceY) * Math.min(Math.abs(totalForceY), 250); // Increased from 100
                        if (Math.sign(this.player.sprite.body.velocity.y) === Math.sign(totalForceY)) {
                            this.player.sprite.body.velocity.y = Math.sign(totalForceY) * 
                                Math.max(Math.abs(this.player.sprite.body.velocity.y), Math.abs(minVelocityY));
                        }
                    }
                    
                    // Apply a larger instant position nudge for more immediate feedback
                    this.player.sprite.x += totalForceX * deltaSeconds * 0.2; // Increased from 0.1
                    this.player.sprite.y += totalForceY * deltaSeconds * 0.2; // Increased from 0.1
                }
            } catch (error) {
                console.warn('Error applying current forces to player:', error);
            }
            
            // Debug visualization removed
            /*
            // Debug visualization of total force
            if (this.isDebugMode && this.forceGraphics) {
                this.forceGraphics.lineStyle(5, 0xff0000, 0.9);
                this.forceGraphics.lineBetween(
                    playerX, playerY,
                    playerX + totalForceX / 4,
                    playerY + totalForceY / 4
                );
                
                // Show total force text
                if (!this.forceText) {
                    this.forceText = this.scene.add.text(
                        playerX, playerY - 20,
                        `Total Force: X=${totalForceX.toFixed(0)}, Y=${totalForceY.toFixed(0)}`,
                        { font: '16px Arial', fill: '#ff0000', backgroundColor: '#000000' }
                    );
                    this.forceText.setDepth(1002);
                } else {
                    this.forceText.setPosition(playerX, playerY - 20);
                    this.forceText.setText(`Total Force: X=${totalForceX.toFixed(0)}, Y=${totalForceY.toFixed(0)}`);
                    this.forceText.setVisible(true);
                }
            }
            */
        } else {
            // Hide force text if not affected
            if (this.isDebugMode && this.forceText) {
                this.forceText.setVisible(false);
            }
            if (this.isDebugMode && this.polygonForceText) {
                this.polygonForceText.setVisible(false);
            }
        }
    }
    
    /**
     * Register a processor with the EntityLayerSystem
     * @param {EntityLayerSystem} entityLayerSystem - The entity layer system
     */
    registerWithEntitySystem(entityLayerSystem) {
        if (!entityLayerSystem) return;
        
        // Register a processor for current polylines and polygons
        entityLayerSystem.registerEntityProcessor('current', (obj, layer) => {
            if (obj.polyline) {
                this.processPolyline(obj, obj.polyline);
            } else if (obj.polygon) {
                this.processPolygon(obj, obj.polygon);
            }
        });
        
        // Register a processor for current effects
        entityLayerSystem.registerEntityProcessor('current_effects', (obj, layer) => {
            // If this is the first object processed from current_effects layer,
            // calculate the depth based on layer ordering in Tiled
            if (!this.currentEffectsDepth) {
                this.currentEffectsDepth = this.getLayerDepthFromMap('current_effects');
                console.log(`🫧 Using depth ${this.currentEffectsDepth} for current_effects objects (via EntityLayerSystem)`);
            }
            
            console.log(`🫧 Processing current effect via EntityLayerSystem:`, {
                id: obj.id,
                name: obj.name || "(unnamed)",
                type: obj.type || "(no type)",
                shape: obj.ellipse ? "ellipse" : (obj.point ? "point" : "other"),
                x: obj.x,
                y: obj.y,
                properties: obj.properties
            });
            
            // Extract properties
            const props = this.extractProperties(obj);
            
            console.log(`🫧 Current effect properties extracted from EntityLayerSystem:`, props);
            
            // Get effect properties with defaults
            const effectType = props.type || 'bubble';
            const scale = props.scale || 0.5;
            const frequency = props.frequency || 500; // ms between spawns
            const lifetime = props.lifetime || 2000; // ms until effect disappears
            const direction = props.direction || 'up';
            const variance = props.variance || 1; // default variance
            
            console.log(`🫧 Creating effect: type=${effectType}, scale=${scale}, frequency=${frequency}, lifetime=${lifetime}, direction=${direction}, variance=${variance}`);
            
            // Handle different object types
            if (obj.polygon) {
                // For polygon shapes, create spawners throughout the polygon area
                this.createPolygonEffects(obj, effectType, scale, frequency, lifetime, direction, variance);
            } else if (obj.ellipse) {
                // For ellipse shapes, create spawners throughout the ellipse area
                this.createEllipseEffects(obj, effectType, scale, frequency, lifetime, direction, variance);
            } else {
                // For point or other objects, just create a single effect at the center
                this.createEffectAt(obj.x, obj.y, effectType, scale, frequency, lifetime, direction, variance);
                console.log(`🫧 Created ${effectType} point effect at (${obj.x}, ${obj.y})`);
            }
        });
        
        console.log('CurrentSystem registered with EntityLayerSystem for processing polylines, polygons, and current effects');
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        // Clean up debug graphics
        if (this.debugGraphics) {
            this.debugGraphics.destroy();
            this.debugGraphics = null;
        }
        
        // Clean up current visualizations
        this.cleanupVisuals();
        
        // Clear data arrays
        this.currents = [];
        this.polygonAreas = [];
        
        console.log('CurrentSystem destroyed');
    }
    
    /**
     * Set a default direction for all currents and polygons that don't have an explicit direction
     * @param {string} direction - The direction to set ('up', 'down', 'left', 'right', etc.)
     */
    setDefaultCurrentDirection(direction) {
        const forceAngle = this.directionToAngle(direction);
        const dirX = Math.cos(forceAngle);
        const dirY = Math.sin(forceAngle);
        
        // Update polygons
        this.polygonAreas.forEach(polygon => {
            if (!polygon.direction) {
                console.log(`🌊 Setting default direction "${direction}" for polygon`);
                polygon.direction = direction;
                polygon.forceAngle = forceAngle;
                polygon.directionVector = { x: dirX, y: dirY };
            }
        });
        
        // Update line segments
        this.currents.forEach(segment => {
            if (!segment.direction) {
                segment.forceAngle = forceAngle;
                segment.directionVector = { x: dirX, y: dirY };
            }
        });
        
        console.log(`🌊 Set default direction "${direction}" for currents without explicit direction`);
    }

    /**
     * Initialize the current system
     * @param {Phaser.GameObjects.GameObject} player - The player entity
     * @param {Phaser.Tilemaps.Tilemap} map - The tilemap containing currents
     */
    init(player, map) {
        this.player = player;
        
        // Process any current objects in the map
        this.processCurrentsLayer(map);
        
        // Process any manually placed current effects
        this.processCurrentEffectsLayer(map);
        
        console.log('🌊 CurrentSystem initialized with player and map data');
    }

    /**
     * Process the current_effects layer from a Tiled map
     * @param {Phaser.Tilemaps.Tilemap} map - The tilemap containing the current effects
     */
    processCurrentEffectsLayer(map) {
        if (!map.objects) {
            console.log('❌ No object layers found in map for current effects');
            return;
        }
        
        console.log('🫧 Searching for current_effects layer in:', map.objects.map(layer => layer.name));
        
        // Find the "current_effects" layer
        const effectsLayer = map.objects.find(layer => 
            layer.name.toLowerCase() === 'current_effects');
        
        if (!effectsLayer) {
            console.log('ℹ️ No current_effects layer found in map. Add one to place manual current effects.');
            return;
        }
        
        console.log(`🫧 Found current_effects layer: ${effectsLayer.name} with ${effectsLayer.objects?.length || 0} objects`);
        
        if (!effectsLayer.objects || effectsLayer.objects.length === 0) {
            console.log('ℹ️ No objects found in current_effects layer');
            return;
        }
        
        // Calculate the proper depth for this layer based on its position in Tiled
        // This respects the Tiled layer ordering while preserving the depth system
        this.currentEffectsDepth = this.getLayerDepthFromMap('current_effects');
        console.log(`🫧 Using depth ${this.currentEffectsDepth} for current_effects objects`);
        
        // Process each effect object
        effectsLayer.objects.forEach(obj => {
            console.log(`🫧 Processing effect object:`, {
                id: obj.id,
                name: obj.name || "(unnamed)",
                type: obj.type || "(no type)",
                shape: obj.ellipse ? "ellipse" : (obj.polygon ? "polygon" : obj.point ? "point" : "other"),
                x: obj.x,
                y: obj.y,
                width: obj.width,
                height: obj.height,
                properties: obj.properties,
                ellipse: !!obj.ellipse,
                polygon: !!obj.polygon && Array.isArray(obj.polygon) ? obj.polygon.length : 0
            });
            
            // Extract properties
            const props = this.extractProperties(obj);
            
            console.log(`🫧 Extracted properties:`, props);
            
            // Get effect properties with defaults
            const effectType = props.type || 'bubble';
            const scale = props.scale || 0.5;
            const frequency = props.frequency || 500; // ms between spawns
            const lifetime = props.lifetime || 2000; // ms until effect disappears
            const direction = props.direction || 'up';
            const variance = props.variance || 1; // default variance
            
            console.log(`🫧 Creating effect: type=${effectType}, scale=${scale}, frequency=${frequency}, lifetime=${lifetime}, direction=${direction}, variance=${variance}`);
            
            // Handle different object types
            if (obj.polygon) {
                // For polygon shapes, create spawners throughout the polygon area
                this.createPolygonEffects(obj, effectType, scale, frequency, lifetime, direction, variance);
            } else if (obj.ellipse) {
                // For ellipse shapes, create spawners throughout the ellipse area
                this.createEllipseEffects(obj, effectType, scale, frequency, lifetime, direction, variance);
            } else {
                // For point or other objects, just create a single effect at the center
                this.createEffectAt(obj.x, obj.y, effectType, scale, frequency, lifetime, direction, variance);
                console.log(`🫧 Created ${effectType} point effect at (${obj.x}, ${obj.y})`);
            }
        });
    }
    
    /**
     * Create effect spawners throughout a polygon area
     * @param {Object} obj - The polygon object from Tiled
     * @param {string} type - The effect type (bubble, ripple, etc.)
     * @param {number} scale - The scale of the effect
     * @param {number} frequency - How often to spawn effects (ms)
     * @param {number} lifetime - How long effects last (ms)
     * @param {string} direction - The direction of movement
     * @param {number} variance - Size variance of bubbles (1-5)
     */
    createPolygonEffects(obj, type, scale, frequency, lifetime, direction, variance = 1) {
        if (!obj.polygon || !Array.isArray(obj.polygon)) {
            console.log(`🫧 No valid polygon data found for object ${obj.id}`);
            return;
        }
        
        // Convert polygon points to absolute coordinates
        const polygonPoints = obj.polygon.map(point => ({
            x: obj.x + point.x,
            y: obj.y + point.y
        }));
        
        console.log(`🫧 Processing polygon with ${polygonPoints.length} points`);
        
        // Calculate polygon bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        polygonPoints.forEach(point => {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        });
        
        const width = maxX - minX;
        const height = maxY - minY;
        
        // Determine number of effect points based on polygon size
        const area = width * height;
        const density = 1 / 10000; // One point per 10000 square pixels
        let numPoints = Math.max(3, Math.ceil(area * density));
        
        // Cap at reasonable number to avoid performance issues
        numPoints = Math.min(numPoints, 10);
        
        console.log(`🫧 Creating ${numPoints} effect points for polygon area ${Math.floor(area)}`);
        
        // Helper function to check if a point is inside a polygon
        const isPointInPolygon = (x, y, polygon) => {
            let inside = false;
            for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                const xi = polygon[i].x, yi = polygon[i].y;
                const xj = polygon[j].x, yj = polygon[j].y;
                
                const intersect = ((yi > y) !== (yj > y)) &&
                    (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        };
        
        // Create multiple effect points within the polygon
        let createdPoints = 0;
        let attempts = 0;
        const maxAttempts = 100;
        
        // Special handling for very small polygons - use edge-based approach
        if (width < 50 || height < 50 || numPoints <= 3) {
            console.log(`🫧 Using edge-based placement for small polygon`);
            
            // Place points along the edges and one in the center
            // First, calculate the center
            let centerX = 0, centerY = 0;
            polygonPoints.forEach(point => {
                centerX += point.x;
                centerY += point.y;
            });
            centerX /= polygonPoints.length;
            centerY /= polygonPoints.length;
            
            // Create one effect at the center
            this.createEffectAt(centerX, centerY, type, scale, frequency, lifetime, direction, variance);
            createdPoints++;
            
            // Create effects at edge midpoints
            for (let i = 0; i < polygonPoints.length; i++) {
                const start = polygonPoints[i];
                const end = polygonPoints[(i + 1) % polygonPoints.length];
                
                // Create effect at midpoint of each edge
                const midX = (start.x + end.x) / 2;
                const midY = (start.y + end.y) / 2;
                
                // Slightly offset from the edge towards the center
                const towardsCenterX = (centerX - midX) * 0.2;
                const towardsCenterY = (centerY - midY) * 0.2;
                
                this.createEffectAt(
                    midX + towardsCenterX, 
                    midY + towardsCenterY, 
                    type, scale, frequency, lifetime, direction, variance
                );
                createdPoints++;
            }
        } else {
            // For larger polygons, use random distribution
            while (createdPoints < numPoints && attempts < maxAttempts) {
                attempts++;
                
                // Generate a random point within the bounding box
                const x = minX + Math.random() * width;
                const y = minY + Math.random() * height;
                
                // Check if the point is inside the polygon
                if (isPointInPolygon(x, y, polygonPoints)) {
                    // Create an effect at this point with modified frequency
                    // Increase individual frequency as we have multiple spawners
                    const adjustedFrequency = frequency * (1 + (createdPoints * 0.5));
                    
                    this.createEffectAt(x, y, type, scale, adjustedFrequency, lifetime, direction, variance);
                    createdPoints++;
                }
            }
        }
        
        console.log(`🫧 Created ${createdPoints} effect points for polygon out of ${attempts} attempts`);
    }
    
    /**
     * Create effect spawners throughout an ellipse area
     * @param {Object} obj - The ellipse object from Tiled
     * @param {string} type - The effect type (bubble, ripple, etc.)
     * @param {number} scale - The scale of the effect
     * @param {number} frequency - How often to spawn effects (ms)
     * @param {number} lifetime - How long effects last (ms)
     * @param {string} direction - The direction of movement
     * @param {number} variance - Size variance of bubbles (1-5)
     */
    createEllipseEffects(obj, type, scale, frequency, lifetime, direction, variance = 1) {
        if (!obj.ellipse || !obj.width || !obj.height) {
            console.log(`🫧 No valid ellipse data found for object ${obj.id}`);
            return;
        }
        
        // Calculate ellipse parameters
        const centerX = obj.x;
        const centerY = obj.y;
        const width = obj.width;
        const height = obj.height;
        const radiusX = width / 2;
        const radiusY = height / 2;
        
        console.log(`🫧 Processing ellipse at (${centerX}, ${centerY}) with size ${width}x${height}`);
        
        // Determine number of effect points based on ellipse size
        const area = Math.PI * radiusX * radiusY;
        const density = 1 / 5000; // One point per 5000 square pixels
        let numPoints = Math.max(3, Math.ceil(area * density));
        
        // Cap at reasonable number to avoid performance issues
        numPoints = Math.min(numPoints, 10);
        
        console.log(`🫧 Creating ${numPoints} effect points for ellipse area ${Math.floor(area)}`);
        
        // Create multiple effect points within the ellipse
        let createdPoints = 0;
        
        // Create one effect at the center
        this.createEffectAt(centerX, centerY, type, scale, frequency, lifetime, direction, variance);
        createdPoints++;
        
        // Create points at cardinal directions if ellipse is large enough
        if (radiusX > 20 && radiusY > 20 && numPoints > 1) {
            // Points at 25% from the edge toward the center
            const offsetFactor = 0.75; // How far from center (0 = center, 1 = edge)
            
            // Create points at cardinal and ordinal directions
            const angles = [0, Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI, 5*Math.PI/4, 3*Math.PI/2, 7*Math.PI/4];
            const numAngles = Math.min(angles.length, numPoints - 1);
            
            for (let i = 0; i < numAngles; i++) {
                const angle = angles[i];
                const x = centerX + Math.cos(angle) * radiusX * offsetFactor;
                const y = centerY + Math.sin(angle) * radiusY * offsetFactor;
                
                // Adjust frequency for each spawner
                const adjustedFrequency = frequency * (1 + (i * 0.5));
                
                this.createEffectAt(x, y, type, scale, adjustedFrequency, lifetime, direction, variance);
                createdPoints++;
                
                // Stop if we've created the desired number of points
                if (createdPoints >= numPoints) break;
            }
        }
        
        console.log(`🫧 Created ${createdPoints} effect points for ellipse`);
    }
    
    /**
     * Create a current effect at the specified position
     * @param {number} x - The x position
     * @param {number} y - The y position
     * @param {string} type - The effect type (bubble, ripple, etc.)
     * @param {number} scale - The scale of the effect
     * @param {number} frequency - How often to spawn new effects (ms)
     * @param {number} lifetime - How long effects last (ms)
     * @param {string} direction - The direction of movement
     * @param {number} variance - The size variance of bubbles (1-5)
     */
    createEffectAt(x, y, type, scale, frequency, lifetime, direction, variance = 1) {
        // Ensure scale is a number and convert from string if needed
        scale = Number(scale) || 0.5;
        frequency = Number(frequency) || 500;
        lifetime = Number(lifetime) || 2000;
        variance = Number(variance) || 1;
        
        // Clamp variance between 1-5
        variance = Math.max(1, Math.min(5, variance));
        
        console.log(`🫧 Creating effect with parsed values: x=${x}, y=${y}, type=${type}, scale=${scale}, frequency=${frequency}ms, lifetime=${lifetime}ms, direction=${direction}, variance=${variance}`);
        
        // Convert direction string to vector
        const directionVector = this.getDirectionVector(direction);
        
        // Create a container for the effect
        const container = this.scene.add.container(x, y);
        
        // Use the calculated depth from Tiled layer order, or fall back to a default of 35
        const effectDepth = this.currentEffectsDepth || 35;
        container.setDepth(effectDepth);
        
        // Special handling for ripple effect
        if (type === 'ripple') {
            const timer = this.scene.time.addEvent({
                delay: frequency,
                callback: () => {
                    // Create a circle for the ripple
                    const ripple = this.scene.add.circle(0, 0, 5, 0xaaffff, 0.8);
                    container.add(ripple);
                    
                    // Random offset for spawn position
                    const offsetX = Phaser.Math.Between(-10, 10);
                    const offsetY = Phaser.Math.Between(-10, 10);
                    ripple.setPosition(offsetX, offsetY);
                    
                    // Expand and fade out the ripple
                    this.scene.tweens.add({
                        targets: ripple,
                        radius: 30,
                        alpha: 0,
                        scale: { from: 0.5, to: 2 },
                        duration: lifetime,
                        ease: 'Quad.easeOut',
                        onComplete: () => {
                            container.remove(ripple);
                            ripple.destroy();
                        }
                    });
                    
                    // Add a second ring for more visual interest
                    const innerRipple = this.scene.add.circle(offsetX, offsetY, 3, 0xffffff, 1);
                    container.add(innerRipple);
                    
                    this.scene.tweens.add({
                        targets: innerRipple,
                        radius: 20,
                        alpha: 0,
                        scale: { from: 0.3, to: 1.5 },
                        duration: lifetime * 0.7,
                        ease: 'Quad.easeOut',
                        onComplete: () => {
                            container.remove(innerRipple);
                            innerRipple.destroy();
                        }
                    });
                },
                callbackScope: this,
                loop: true
            });
            
            // Store reference for cleanup
            if (!this.effectTimers) {
                this.effectTimers = [];
            }
            this.effectTimers.push({ timer, container });
            
            // Immediately create one ripple
            timer.callback.call(this);
            
            return container;
        }
        
        // Original bubble effect code for non-ripple types
        const availableTextures = [];
        ['air_pocket1', 'air_pocket2', 'air_pocket3', 'bubble', 'bg_bubble1', 'bg_bubble2', 'bg_bubble3'].forEach(texture => {
            if (this.scene.textures.exists(texture)) {
                availableTextures.push(texture);
            }
        });
        
        const timer = this.scene.time.addEvent({
            delay: frequency,
            callback: () => {
                let sprite;
                const offsetX = Phaser.Math.Between(-10, 10);
                const offsetY = Phaser.Math.Between(-10, 10);
                
                if (availableTextures.length > 0) {
                    const randomTexture = availableTextures[Math.floor(Math.random() * availableTextures.length)];
                    sprite = this.scene.add.sprite(offsetX, offsetY, randomTexture);
                } else {
                    const graphics = this.scene.add.graphics();
                    graphics.fillStyle(0x88ffff, 0.5);
                    graphics.fillCircle(0, 0, 8);
                    graphics.fillStyle(0xaaffff, 0.7);
                    graphics.fillCircle(0, 0, 6);
                    graphics.fillStyle(0xccffff, 0.9);
                    graphics.fillCircle(0, 0, 4);
                    graphics.fillStyle(0xffffff, 0.8);
                    graphics.fillCircle(-2, -2, 2);
                    graphics.lineStyle(1, 0xffffff, 0.6);
                    graphics.strokeCircle(0, 0, 8);
                    graphics.x = offsetX;
                    graphics.y = offsetY;
                    sprite = graphics;
                }
                
                const finalScale = scale * Phaser.Math.FloatBetween(
                    1 - (variance * 0.08),
                    1 + (variance * 0.08)
                );
                
                if (sprite.setScale) {
                    sprite.setScale(finalScale);
                }
                
                container.add(sprite);
                
                this.scene.tweens.add({
                    targets: sprite,
                    x: offsetX + directionVector.x * 100,
                    y: offsetY + directionVector.y * 100,
                    alpha: 0,
                    scale: sprite.setScale ? finalScale * 1.5 : 0.1,
                    duration: lifetime,
                    ease: 'Sine.easeOut',
                    onComplete: () => {
                        container.remove(sprite);
                        sprite.destroy();
                    }
                });
            },
            callbackScope: this,
            loop: true
        });
        
        timer.callback.call(this);
        this.effectTimers.push({ timer, container });
        return container;
    }
    
    /**
     * Get a direction vector from a direction string
     * @param {string} direction - The direction (up, down, left, right, etc.)
     * @returns {Phaser.Math.Vector2} - The normalized direction vector
     */
    getDirectionVector(direction) {
        const vector = new Phaser.Math.Vector2(0, 0);
        
        switch(direction.toLowerCase()) {
            case 'up':
                vector.y = -1;
                break;
            case 'down':
                vector.y = 1;
                break;
            case 'left':
                vector.x = -1;
                break;
            case 'right':
                vector.x = 1;
                break;
            case 'upleft':
            case 'up-left':
                vector.x = -0.7071;
                vector.y = -0.7071;
                break;
            case 'upright':
            case 'up-right':
                vector.x = 0.7071;
                vector.y = -0.7071;
                break;
            case 'downleft':
            case 'down-left':
                vector.x = -0.7071;
                vector.y = 0.7071;
                break;
            case 'downright':
            case 'down-right':
                vector.x = 0.7071;
                vector.y = 0.7071;
                break;
            default:
                console.warn(`Unknown direction: ${direction}, defaulting to up`);
                vector.y = -1;
        }
        
        return vector;
    }

    /**
     * Get the appropriate depth value for an object based on its layer position in the Tiled map
     * @param {string} layerName - The name of the layer (e.g., 'current_effects')
     * @param {number} defaultDepth - Default depth to use if layer info can't be determined
     * @return {number} The depth value to use
     */
    getLayerDepthFromMap(layerName, defaultDepth = 35) {
        // Safety check for scene and map
        if (!this.scene || !this.scene.map || !this.scene.map.layers) {
            console.log(`🫧 Cannot determine layer depth - no map available`);
            return defaultDepth;
        }
        
        try {
            // Get all layers from the map
            const layers = this.scene.map.layers;
            
            // Find our target layer by name
            const targetLayerIndex = layers.findIndex(layer => 
                layer.name.toLowerCase() === layerName.toLowerCase());
            
            // Find the obstacles layer index for reference
            const obstaclesLayerIndex = layers.findIndex(layer => 
                layer.name.toLowerCase() === 'obstacles');
            
            // Log the findings for debugging
            console.log(`🫧 Layer depths - ${layerName}: index ${targetLayerIndex}, Obstacles: index ${obstaclesLayerIndex}`);
            
            if (targetLayerIndex === -1) {
                // Layer not found, use default
                return defaultDepth;
            }
            
            // Base depth calculation - start with a baseline depth
            // This preserves the general Phaser depth ordering for standard layers
            let baseDepth = 30; // Default layer depth
            
            // Determine relative position compared to obstacles layer
            if (obstaclesLayerIndex !== -1) {
                if (targetLayerIndex < obstaclesLayerIndex) {
                    // Our layer is BEFORE obstacles in Tiled (should render behind)
                    baseDepth = 35; // Between default (30) and obstacles (40)
                } else {
                    // Our layer is AFTER obstacles in Tiled (should render in front)
                    baseDepth = 45; // Between obstacles (40) and foreground (50)
                }
            }
            
            // Preserve special system depths for UI, player, etc. by using the baseDepth
            // calculated above rather than a direct mapping from Tiled indices
            
            console.log(`🫧 Calculated depth for ${layerName}: ${baseDepth}`);
            return baseDepth;
            
        } catch (error) {
            console.error(`Error determining layer depth for ${layerName}:`, error);
            return defaultDepth;
        }
    }

    /**
     * Add a visual representation of a current segment
     * @param {Object} start - Start point {x, y}
     * @param {Object} end - End point {x, y}
     * @param {string} direction - Direction of the current
     */
    addCurrentVisual(start, end, direction) {
        try {
            // Calculate the midpoint of the segment
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            
            // Calculate the angle between start and end points
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            
            // Create a sprite at the midpoint using the danger_currents_small image
            const visual = this.scene.add.sprite(midX, midY, 'danger_currents_small');
            visual.setOrigin(0.5, 0.5);
            
            // Set the scale based on the segment length
            const distance = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);
            const scale = Math.min(distance / 200, 1); // Adjust scale based on segment length
            visual.setScale(scale);
            
            // Rotate to match the segment direction
            visual.setRotation(angle);
            
            // Apply a visual effect to make it look more dynamic
            visual.setAlpha(0.8);
            
            // Add a simple animation to make it look like flowing water
            this.scene.tweens.add({
                targets: visual,
                alpha: { from: 0.6, to: 0.9 },
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
            
            // Store the visual for later cleanup
            this.currentVisuals.push(visual);
            
            console.log(`🌊 Added current visual at (${midX}, ${midY})`);
        } catch (error) {
            console.error('Error creating current visual:', error);
        }
    }
    
    /**
     * Clean up all current visuals
     */
    cleanupVisuals() {
        this.currentVisuals.forEach(visual => {
            if (visual && !visual.destroyed) {
                visual.destroy();
            }
        });
        this.currentVisuals = [];
    }
} 