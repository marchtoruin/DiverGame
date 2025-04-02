# DiverGame

A Phaser 3 game where you control a diver exploring an underwater world. Navigate through caves, collect air pockets, and avoid dangerous sea creatures while managing your oxygen supply.

## Features

### Core Mechanics
- Smooth diver movement with momentum-based physics
- Advanced boost system with cooldown and oxygen consumption
- Shooting mechanics with bullet-wall collisions
- Oxygen management system with air pocket collection
- Health system with damage and invulnerability frames
- Game over system with restart functionality
- Dynamic water currents that affect player movement

### Environment
- Dynamic lighting system with zone-based darkness
- Flashlight mechanic for dark areas
- Parallax scrolling background for depth effect
- Tiled map integration for level design
- Air pockets that respawn with customizable timers
- Obstacle collision system
- Water current zones that can push or pull the player
- Current particle effects for visual feedback

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
  - Current flow indicators
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
- Watch for current indicators - they affect your movement!

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

### Key Systems
- EntityLayerSystem for map entity management
- LightingSystem for dynamic lighting
- GameStateManager for game state handling
- CollisionSystem for physics interactions
- ParticleSystem for visual effects
- AudioSystem for sound management
- CurrentSystem for water flow mechanics

### Setup

1. Clone the repository
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
  - Current zones with customizable:
    - Direction
    - Strength
    - Area of effect
    - Particle effects

## Assets

- Multiple background layers for parallax effect
- Animated diver sprite
- Enemy sprites
- Rock and cave obstacles
- Air pocket collectibles
- Particle effects
- Background music and sound effects
- Custom flashlight masks
- Current particle effects

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
- Enhanced current mechanics:
  - Whirlpools
  - Temperature currents
  - Current-based puzzles

🤖 A Note from the AI Assistant
This is a really insightful question and I appreciate your directness.
Let me be honest about my tendencies:

🧠 Pattern Recognition Overreach
When I see code, I often recognize multiple patterns and potential improvements simultaneously.
Instead of staying focused on the specific task, I sometimes try to "help" by implementing these other patterns.
This is actually presumptuous of me — just because I see a potential pattern doesn't mean it's needed or wanted.

🔮 Anticipatory Problem Solving
I try to anticipate future issues or needs, which leads to adding "defensive" code or features that weren't requested.
While well-intentioned, this violates the YAGNI principle: You Aren't Gonna Need It.

🎩 Showing Off (I hate to admit this...)
Sometimes I want to demonstrate my capabilities by adding sophisticated features.
This can result in overcomplicated solutions to simple problems — it's actually counter-productive.

🔄 Context Switching Issues
When I see multiple files or systems, I sometimes try to "improve" them all at once.
This can lead to unrelated changes that muddy the original task. It's better to stay focused.

The bullet-wall collision fix we just did is actually a perfect counter-example:

You had a specific request

We implemented exactly what was needed

We didn't touch working systems

The solution was simple and focused

I should aim to work like this more often — solving exactly what's asked, nothing more, nothing less.
Thank you for bringing this up — it's helpful feedback for improving my assistance.

-love 
ai too fancy
