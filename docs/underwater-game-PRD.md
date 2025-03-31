# Product Requirements Document (PRD): Underwater Exploration Game

---

## 1. Overview
**Project Name:** Underwater Exploration Game  
**Genre:** 2D Adventure / Survival  
**Engine:** Phaser.js (JavaScript)  
**Platform:** Web (Playable in Browser)  
**Target Audience:** Casual and indie game players who enjoy exploration-based mechanics.

---

## 2. Objective & Gameplay
The player controls a **diver** exploring an underwater world, searching for **air pockets** to maintain their oxygen levels. The primary challenge is **oxygen management**, requiring players to navigate strategically while exploring caves and open water.

**Win Condition:** Survive and explore as long as possible, potentially discovering hidden upgrades and treasures.  
**Lose Condition:** Running out of oxygen.

---

## 3. Core Features

### 3.1 Player Mechanics
- **Movement:** 4-directional movement (WASD / Arrow Keys), with slight underwater momentum.
- **Oxygen System:** A depleting oxygen bar that refills when touching air pockets.
- **Collision Detection:** The diver cannot pass through underwater obstacles (e.g., rocks, cave walls).
- **Upgrades:** Collectible items that increase maximum oxygen capacity.

### 3.2 Environmental Elements
- **Air Pockets:** Bubbles or vents scattered throughout the level that refill oxygen.
- **Caves & Obstacles:** Restrictive areas that require careful movement.
- **Background Parallax:** Layered backgrounds to enhance the depth of the underwater world.
- **Hidden Treasures (Optional):** Collectibles that reward exploration.

### 3.3 User Interface (UI)
- **Oxygen Bar:** Displays remaining oxygen levels.
- **Game Over Screen:** Triggered when oxygen runs out.
- **Upgrade Notifications:** Alerts when the player collects an oxygen tank upgrade.

---

## 4. Technical Requirements

### 4.1 Development Tools
- **Phaser.js:** Game framework for rendering and physics.
- **Node.js:** Local testing and development.
- **Cursor AI:** AI-assisted coding.

### 4.2 Key Development Tasks
1. **Basic Game Setup:** Create Phaser game configuration, load assets.
2. **Player Controls:** Implement movement with fluid underwater physics.
3. **Oxygen System:** Create a timer-based oxygen depletion and air pocket interaction.
4. **Collision Detection:** Block movement through walls/obstacles.
5. **UI Elements:** Implement the oxygen bar and game over screen.
6. **Upgrades System:** Code an oxygen tank upgrade mechanic.
7. **Visual Effects:** Add parallax scrolling and ambient effects (e.g., bubbles, lighting).

---

## 5. Scope & Limitations
- **Initial Scope:** Focus on core mechanics—player movement, oxygen system, and simple environment.
- **Stretch Goals:** Add more environmental hazards, animated sea creatures, and difficulty scaling.
- **Limitations:** Keep performance optimized for smooth browser play, avoiding heavy asset loads.

---

## 6. Milestones & Timeline

### Phase 1: Core Gameplay (Weeks 1-2)
- Implement player movement, oxygen system, and air pockets.
- Create initial level design with obstacles.

### Phase 2: UI & Enhancements (Weeks 3-4)
- Add UI elements (oxygen bar, game over screen).
- Implement upgrade system for oxygen tanks.
- Improve visual effects (bubbles, parallax background).

### Phase 3: Playtesting & Refinements (Weeks 5-6)
- Test movement and oxygen balancing.
- Optimize performance and refine level design.
- Gather feedback and finalize the game loop.

---

## 7. Success Metrics
- **Playable Prototype:** A fully functional underwater exploration experience.
- **Smooth Controls:** Responsive movement with realistic underwater feel.
- **Engaging Mechanics:** Oxygen management adds tension without being too punishing.
- **Performance Optimization:** Runs smoothly in a browser without lag.

---

## 8. Open Questions & Risks
- **Balancing Oxygen Levels:** How quickly should oxygen deplete for a fair challenge?
- **Upgrade Frequency:** How often should players find oxygen tank upgrades?
- **Collision Complexity:** Should walls be simple or include destructible elements?
- **Scope Creep:** Avoid adding too many features that slow down development.

---

### Next Steps
- Begin development with a **basic Phaser setup and player movement**.
- Implement the **oxygen system** and **UI oxygen bar**.
- Refine core gameplay and **test oxygen balancing** before expanding features.

---
