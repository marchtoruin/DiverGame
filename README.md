# DiverGame

<<<<<<< HEAD
A Phaser 3 game where you control a diver exploring an underwater world. Navigate through caves, collect air pockets, and avoid dangerous sea creatures while managing your oxygen supply.
=======
Phaser 3 game where you control a diver exploring an underwater world, collecting air pockets while avoiding obstacles.
>>>>>>> f0b5dbea5f824fc14944867ca2c183c1ab3ab113

## Features

### Core Mechanics
- Smooth diver movement with momentum-based physics
<<<<<<< HEAD
- Advanced boost system with cooldown and oxygen consumption
- Shooting mechanics with bullet-wall collisions
- Oxygen management system with air pocket collection
- Health system with damage and invulnerability frames
- Game over system with restart functionality

### Environment
- Dynamic lighting system with zone-based darkness
- Flashlight mechanic for dark areas
- Parallax scrolling background for depth effect
- Tiled map integration for level design
- Air pockets that respawn after 30 seconds
- Obstacle collision system

### Combat & Enemies
- Enemy AI with different behaviors
- Shooting mechanics with bullet collisions
- Health and damage system
- Visual feedback for damage and healing

### Visual Effects
- Particle systems for:
  - Bubbles and ambient effects
  - Boost trails
  - Air pocket collection
  - Damage indicators
- Dynamic lighting and shadows
- Camera shake effects
- Death animations

### UI/UX
- Oxygen meter with visual and audio warnings
- Health bar system
- Game over screen with restart option
- Pause menu
- Debug mode for development
- Touch controls support

## Controls

### Movement
- WASD or Arrow Keys to move the diver
- SPACEBAR to boost (with cooldown)
- LEFT MOUSE to shoot
- F to toggle flashlight
- ESC to pause game

### UI Controls
- Music controls in top-right corner
  - Volume up/down
  - Mute toggle

## Development

### Built With
- Phaser 3.88.2
- JavaScript/ES6+
- Tiled Map Editor
- HTML5/CSS3
=======
- Parallax scrolling background with multiple layers
- Collectible air pockets to maintain oxygen
- Oxygen management system with visual indicator
- Flashlight system for dark areas
- Bullet system with enhanced visibility in darkness
- Ambient bubble effects
- Touch controls for mobile gameplay
- Enemies and combat system
- Improved lighting and darkness detection

## Development Status

Currently in pre-production, implementing enhanced gameplay features.

## Controls

- WASD or Arrow Keys: Move the diver
- Space: Boost
- F: Toggle flashlight
- Left Mouse: Fire weapon
>>>>>>> f0b5dbea5f824fc14944867ca2c183c1ab3ab113

### Key Systems
- EntityLayerSystem for map entity management
- LightingSystem for dynamic lighting
- GameStateManager for game state handling
- CollisionSystem for physics interactions
- ParticleSystem for visual effects
- AudioSystem for sound management

### Setup

1. Clone the repository
<<<<<<< HEAD
2. Install dependencies: `npm install`
3. Run the development server: `npm start`
4. Access the game at `http://localhost:8080`

### Map Creation
- Uses Tiled Map Editor
- Supports embedded tilesets
- Includes object layers for:
  - Obstacles
  - Air pockets
  - Enemy spawn points
  - Lighting zones
=======
2. Run `npm install` to install dependencies
3. Run `npm start` for development mode
4. Run `npm run build` for production build
>>>>>>> f0b5dbea5f824fc14944867ca2c183c1ab3ab113

## Assets

- Multiple background layers for parallax effect
<<<<<<< HEAD
- Animated diver sprite
- Enemy sprites
- Rock and cave obstacles
- Air pocket collectibles
- Particle effects
- Background music and sound effects
- Custom flashlight masks

## Version Control

The project uses Git for version control with dedicated branches for:
- Feature development
- Bug fixes
- Asset management

## Future Development

Planned features and improvements:
- Additional enemy types
- More level variations
- Power-up system
- Score tracking
- Achievement system 


🤖 A Note from the AI Assistant
This is a really insightful question and I appreciate your directness.
Let me be honest about my tendencies:

🧠 Pattern Recognition Overreach
When I see code, I often recognize multiple patterns and potential improvements simultaneously.
Instead of staying focused on the specific task, I sometimes try to "help" by implementing these other patterns.
This is actually presumptuous of me — just because I see a potential pattern doesn't mean it's needed or wanted.

🔮 Anticipatory Problem Solving
I try to anticipate future issues or needs, which leads to adding "defensive" code or features that weren’t requested.
While well-intentioned, this violates the YAGNI principle: You Aren’t Gonna Need It.

🎩 Showing Off (I hate to admit this...)
Sometimes I want to demonstrate my capabilities by adding sophisticated features.
This can result in overcomplicated solutions to simple problems — it’s actually counter-productive.

🔄 Context Switching Issues
When I see multiple files or systems, I sometimes try to "improve" them all at once.
This can lead to unrelated changes that muddy the original task. It’s better to stay focused.

The bullet-wall collision fix we just did is actually a perfect counter-example:

You had a specific request

We implemented exactly what was needed

We didn’t touch working systems

The solution was simple and focused

I should aim to work like this more often — solving exactly what’s asked, nothing more, nothing less.
Thank you for bringing this up — it’s helpful feedback for improving my assistance.

-love 
ai too fancy
=======
- Diver sprite with animations
- Air bubble collectibles
- Ambient bubble particles
- Enemy sprites
- Weapon system
>>>>>>> f0b5dbea5f824fc14944867ca2c183c1ab3ab113
