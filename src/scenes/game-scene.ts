import * as PIXI from 'pixi.js';
import * as Matter from 'matter-js';
import { Scene } from '../types';
import { Game } from '../game';
import { createBall } from '../entities/ball';

// Ball data type
interface BallData {
  name: string;
  color: number;
  stats: {
    hardness: number;
    bounce: number;
  };
  material?: {
    name: string;
    color: number;
  };
  featureCard?: {
    name: string;
    color: number;
    speedBoost: number;
    durationMs: number;
  };
}

interface GameBall {
  object: any; // PhysicsObject
  health: number;
  maxHealth: number;
  data: BallData;
  healthBar: PIXI.Graphics;
  powerBoost: number; // New property for wall bounce power boost
  lastWallHit: number; // Timestamp of last wall hit
  materialEffect: PIXI.Container | null; // Visual effect for material
  speedBoost: number; // Feature card speed boost multiplier
  speedBoostActive: boolean; // Whether speed boost is active
  speedBoostEndTime: number; // When the speed boost ends
  hitCounter: number; // Count consecutive hits for feature card activation
  featureCardEffect: PIXI.Container | null; // Visual effect for feature card
}

export class GameScene implements Scene {
  public container: PIXI.Container;
  private game: Game;
  private balls: GameBall[] = [];
  private arenaWidth: number;
  private arenaHeight: number;
  private arenaGraphics: PIXI.Graphics = new PIXI.Graphics();
  private uiContainer: PIXI.Container;
  private messageText: PIXI.Text = new PIXI.Text("");
  private gameOver: boolean = false;
  private selectedBall: BallData | null = null;
  private opponentBall: BallData | null = null;
  
  // Wall identifiers
  private walls: {
    top: Matter.Body;
    bottom: Matter.Body;
    left: Matter.Body;
    right: Matter.Body;
  } = {} as any;
  
  // Collision detection
  private collisionHandler: (event: Matter.IEventCollision<Matter.Engine>) => void;

  constructor(game: Game, selectedBall: BallData | null = null, opponentBall: BallData | null = null) {
    this.game = game;
    this.container = new PIXI.Container();
    this.uiContainer = new PIXI.Container();
    this.selectedBall = selectedBall;
    this.opponentBall = opponentBall;
    
    const app = this.game.getApp();
    // Ensure proper landscape orientation of the arena
    this.arenaWidth = app.screen.width * 0.9;  // Increased from 0.8 for more horizontal space
    this.arenaHeight = app.screen.height * 0.7; // Reduced from 0.8 for more pronounced landscape
    
    // Bind collision handler
    this.collisionHandler = this.handleCollision.bind(this);
  }

  public init(): void {
    const app = this.game.getApp();
    const physics = this.game.getPhysicsSystem();
    
    // Disable gravity to ensure more controlled ball movement
    Matter.Body.setVelocity = Matter.Body.setVelocity || function(){};
    physics.matterEngine.gravity.y = 0;
    physics.matterEngine.gravity.x = 0;
    
    // Access Matter.js engine and add collision event listener
    Matter.Events.on(physics.matterEngine, 'collisionStart', this.collisionHandler);
    
    // Create stadium-like arena
    this.createStadium();
    
    // Create UI elements
    this.createUI();
    
    let player1Ball, player2Ball;
    
    // Check if balls were provided in constructor
    if (this.selectedBall && this.opponentBall) {
      // Position balls in diagonal corners of the arena
      const fieldX = (app.screen.width - this.arenaWidth) / 2;
      const fieldY = (app.screen.height - this.arenaHeight) / 2;
      
      // Bottom-left corner for player 1
      player1Ball = this.createGameBall(
        fieldX + this.arenaWidth * 0.1,  // 10% from left edge
        fieldY + this.arenaHeight * 0.9, // 90% from top edge
        this.selectedBall
      );
      
      // Top-right corner for player 2
      player2Ball = this.createGameBall(
        fieldX + this.arenaWidth * 0.9,  // 90% from left edge
        fieldY + this.arenaHeight * 0.1, // 10% from top edge
        this.opponentBall
      );
    } else {
      // Position default balls in diagonal corners
      const fieldX = (app.screen.width - this.arenaWidth) / 2;
      const fieldY = (app.screen.height - this.arenaHeight) / 2;
      
      // Bottom-left corner for player 1
      player1Ball = this.createGameBall(
        fieldX + this.arenaWidth * 0.1,
        fieldY + this.arenaHeight * 0.9,
        {
          name: "Emma",
          color: 0xff0000,
          stats: { hardness: 85, bounce: 70 },
          material: { name: "Wood", color: 0x8B4513 }
        }
      );
      
      // Top-right corner for player 2
      player2Ball = this.createGameBall(
        fieldX + this.arenaWidth * 0.9,
        fieldY + this.arenaHeight * 0.1,
        {
          name: "Matt",
          color: 0x0000ff,
          stats: { hardness: 75, bounce: 90 },
          material: { name: "Rubber", color: 0x000000 }
        }
      );
    }
    
    // Launch the balls toward the center
    this.launchBalls();
    
    // Show ready message
    this.showMessage("BATTLE START!", 2000);
  }
  
  private createStadium(): void {
    const app = this.game.getApp();
    const physics = this.game.getPhysicsSystem();
    
    // Create arena graphics - football stadium style
    this.arenaGraphics = new PIXI.Graphics();
    
    // Calculate field position
    const fieldX = (app.screen.width - this.arenaWidth) / 2;
    const fieldY = (app.screen.height - this.arenaHeight) / 2;
    
    // Stadium field (green with white lines)
    this.arenaGraphics.beginFill(0x28A745); // Soccer field green
    this.arenaGraphics.drawRect(
      fieldX,
      fieldY,
      this.arenaWidth,
      this.arenaHeight
    );
    this.arenaGraphics.endFill();
    
    // Add field markings
    this.arenaGraphics.lineStyle(3, 0xFFFFFF, 0.8);
    
    // Outer border
    this.arenaGraphics.drawRect(
      fieldX,
      fieldY,
      this.arenaWidth,
      this.arenaHeight
    );
    
    // Center line
    this.arenaGraphics.moveTo(
      app.screen.width / 2,
      fieldY
    );
    this.arenaGraphics.lineTo(
      app.screen.width / 2,
      fieldY + this.arenaHeight
    );
    
    // Center circle
    this.arenaGraphics.drawCircle(
      app.screen.width / 2,
      app.screen.height / 2,
      60
    );
    
    this.container.addChild(this.arenaGraphics);
    
    // Create arena walls (invisible physics objects with labels)
    const wallThickness = 20;
    
    // Physics engine needs static bodies for the walls
    this.walls = {
      // Top wall
      top: Matter.Bodies.rectangle(
        fieldX + this.arenaWidth / 2,
        fieldY,
        this.arenaWidth,
        wallThickness,
        { isStatic: true, restitution: 0.9, label: "wall_top" }
      ),
      // Bottom wall
      bottom: Matter.Bodies.rectangle(
        fieldX + this.arenaWidth / 2,
        fieldY + this.arenaHeight,
        this.arenaWidth,
        wallThickness,
        { isStatic: true, restitution: 0.9, label: "wall_bottom" }
      ),
      // Left wall
      left: Matter.Bodies.rectangle(
        fieldX,
        fieldY + this.arenaHeight / 2,
        wallThickness,
        this.arenaHeight,
        { isStatic: true, restitution: 0.9, label: "wall_left" }
      ),
      // Right wall
      right: Matter.Bodies.rectangle(
        fieldX + this.arenaWidth,
        fieldY + this.arenaHeight / 2,
        wallThickness,
        this.arenaHeight,
        { isStatic: true, restitution: 0.9, label: "wall_right" }
      )
    };
    
    // Remove previous walls if they exist
    physics.matterWorld.bodies.forEach(body => {
      if (body.label.startsWith("wall_")) {
        Matter.Composite.remove(physics.matterWorld, body);
      }
    });
    
    // Add walls to physics world
    Matter.Composite.add(physics.matterWorld, Object.values(this.walls));
    
    // Create visual cue for powered walls
    this.createWallPowerEffects();
  }
  
  private createWallPowerEffects(): void {
    const app = this.game.getApp();
    const fieldX = (app.screen.width - this.arenaWidth) / 2;
    const fieldY = (app.screen.height - this.arenaHeight) / 2;
    
    // Create glow effects around the walls
    const wallGlow = new PIXI.Graphics();
    
    // Top wall glow
    wallGlow.beginFill(0x00FFFF, 0.2);
    wallGlow.drawRect(
      fieldX - 5,
      fieldY - 15,
      this.arenaWidth + 10,
      20
    );
    
    // Bottom wall glow
    wallGlow.beginFill(0xFF00FF, 0.2);
    wallGlow.drawRect(
      fieldX - 5,
      fieldY + this.arenaHeight - 5,
      this.arenaWidth + 10,
      20
    );
    
    // Left wall glow
    wallGlow.beginFill(0xFFFF00, 0.2);
    wallGlow.drawRect(
      fieldX - 15,
      fieldY - 5,
      20,
      this.arenaHeight + 10
    );
    
    // Right wall glow
    wallGlow.beginFill(0x00FF00, 0.2);
    wallGlow.drawRect(
      fieldX + this.arenaWidth - 5,
      fieldY - 5,
      20,
      this.arenaHeight + 10
    );
    
    this.container.addChild(wallGlow);
  }
  
  private createUI(): void {
    const app = this.game.getApp();
    
    // Create message text
    this.messageText = new PIXI.Text("", {
      fontFamily: 'Arial',
      fontSize: 48,
      fontWeight: 'bold',
      fill: 0xFFFFFF,
      align: 'center',
      stroke: 0x000000,
      strokeThickness: 6,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowBlur: 4,
      dropShadowDistance: 2
    });
    this.messageText.anchor.set(0.5);
    this.messageText.position.set(app.screen.width / 2, app.screen.height / 2);
    this.messageText.visible = false;
    
    this.uiContainer.addChild(this.messageText);
    this.container.addChild(this.uiContainer);
  }
  
  private createGameBall(x: number, y: number, data: BallData): GameBall {
    const physics = this.game.getPhysicsSystem();
    const radius = 30;
    
    // Calculate ball properties based on stats
    const restitution = data.stats.bounce / 100;
    const density = 0.001 + (data.stats.hardness / 100) * 0.003; // Slightly reduced density for better movement
    
    // Create ball with physics
    const ball = createBall(x, y, radius, data.color, restitution);
    ball.body.density = density;
    
    // Set label for collision detection
    ball.body.label = data.name;
    
    // Set friction and air friction - lower values for smoother movement
    ball.body.friction = 0.01;
    ball.body.frictionAir = 0.0005;
    
    // Increase restitution to ensure better bouncing
    ball.body.restitution = Math.max(0.7, restitution);
    
    // Add to physics system
    physics.addObject(ball);
    
    // Add to scene
    this.container.addChild(ball.sprite);
    
    // Create health bar above the ball
    const healthBar = new PIXI.Graphics();
    this.container.addChild(healthBar);
    
    // Calculate initial health based on hardness
    const maxHealth = data.stats.hardness * 2;
    
    // Create material effect if available
    let materialEffect = null;
    if (data.material) {
      materialEffect = this.createMaterialEffect(data.material.name, data.material.color);
      this.container.addChild(materialEffect);
    }
    
    // Create feature card effect if available
    let featureCardEffect = null;
    if (data.featureCard) {
      featureCardEffect = this.createFeatureCardEffect(data.featureCard.name, data.featureCard.color);
      featureCardEffect.visible = false; // Initially hidden
      this.container.addChild(featureCardEffect);
    }
    
    // Create game ball object
    const gameBall: GameBall = {
      object: ball,
      health: maxHealth,
      maxHealth: maxHealth,
      data: data,
      healthBar: healthBar,
      powerBoost: 1.0, // No initial boost
      lastWallHit: 0,
      materialEffect: materialEffect,
      speedBoost: 1.0, // No initial speed boost
      speedBoostActive: false,
      speedBoostEndTime: 0,
      hitCounter: 0,
      featureCardEffect: featureCardEffect
    };
    
    // Add to array
    this.balls.push(gameBall);
    
    // Update health bar initially
    this.updateHealthBar(gameBall);
    
    return gameBall;
  }
  
  private createMaterialEffect(materialName: string, color: number): PIXI.Container {
    const container = new PIXI.Container();
    
    // Create material effect based on type
    switch (materialName) {
      case "Wood":
        // Wood grain pattern
        for (let i = 0; i < 5; i++) {
          const line = new PIXI.Graphics();
          line.lineStyle(2, 0x3D1C02, 0.5);
          line.moveTo(-20 + Math.random() * 10, -20 + i * 10);
          line.lineTo(20 + Math.random() * 10, -20 + i * 10);
          container.addChild(line);
        }
        break;
        
      case "Iron":
        // Metallic shine
        const metalShine = new PIXI.Graphics();
        metalShine.beginFill(0xCCCCCC, 0.6);
        metalShine.drawCircle(-10, -10, 5);
        container.addChild(metalShine);
        break;
        
      case "Crystal":
        // Crystal facets
        const facets = new PIXI.Graphics();
        facets.lineStyle(2, 0x89CFF0, 0.7);
        facets.moveTo(0, -15);
        facets.lineTo(15, 0);
        facets.lineTo(0, 15);
        facets.lineTo(-15, 0);
        facets.lineTo(0, -15);
        container.addChild(facets);
        break;
        
      case "Rubber":
        // Bouncy effect
        const bounce = new PIXI.Graphics();
        bounce.lineStyle(2, 0xFFFFFF, 0.6);
        bounce.drawCircle(0, 0, 15);
        bounce.moveTo(-10, -10);
        bounce.lineTo(10, 10);
        bounce.moveTo(10, -10);
        bounce.lineTo(-10, 10);
        container.addChild(bounce);
        break;
        
      default:
        // Default material effect
        const defaultEffect = new PIXI.Graphics();
        defaultEffect.beginFill(color, 0.3);
        defaultEffect.drawCircle(0, 0, 20);
        defaultEffect.endFill();
        container.addChild(defaultEffect);
    }
    
    return container;
  }
  
  private createFeatureCardEffect(cardName: string, color: number): PIXI.Container {
    const container = new PIXI.Container();
    
    // Create effect based on card type
    switch (cardName) {
      case "Speed Burst":
        // Create flame-like effect
        const flames = new PIXI.Graphics();
        flames.beginFill(color, 0.8);
        
        // Create flame shape
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const length = 15 + Math.random() * 10;
          flames.moveTo(0, 0);
          flames.lineTo(
            Math.cos(angle) * length,
            Math.sin(angle) * length
          );
        }
        
        flames.endFill();
        container.addChild(flames);
        break;
        
      case "Power Strike":
        // Create lightning effect
        const lightning = new PIXI.Graphics();
        lightning.lineStyle(3, color, 0.8);
        
        // Draw lightning bolt
        lightning.moveTo(-20, -20);
        lightning.lineTo(-5, 0);
        lightning.lineTo(-15, 5);
        lightning.lineTo(0, 20);
        
        container.addChild(lightning);
        break;
        
      case "Energy Shield":
        // Create shield effect
        const shield = new PIXI.Graphics();
        shield.beginFill(color, 0.3);
        shield.drawCircle(0, 0, 35);
        shield.endFill();
        
        shield.lineStyle(2, color, 0.8);
        shield.drawCircle(0, 0, 35);
        
        container.addChild(shield);
        break;
        
      default:
        // Default glow effect
        const glow = new PIXI.Graphics();
        glow.beginFill(color, 0.4);
        glow.drawCircle(0, 0, 35);
        glow.endFill();
        container.addChild(glow);
    }
    
    return container;
  }
  
  private updateHealthBar(ball: GameBall): void {
    const healthPercent = ball.health / ball.maxHealth;
    const width = 60;
    const height = 6;
    
    // Position above the ball
    const x = ball.object.body.position.x - width / 2;
    const y = ball.object.body.position.y - 45;
    
    // Draw health bar
    ball.healthBar.clear();
    
    // Background
    ball.healthBar.beginFill(0x000000, 0.5);
    ball.healthBar.drawRect(x, y, width, height);
    ball.healthBar.endFill();
    
    // Health
    const color = healthPercent > 0.5 ? 0x00FF00 : healthPercent > 0.25 ? 0xFFFF00 : 0xFF0000;
    ball.healthBar.beginFill(color);
    ball.healthBar.drawRect(x, y, width * healthPercent, height);
    ball.healthBar.endFill();
    
    // Update material effect position if exists
    if (ball.materialEffect) {
      ball.materialEffect.position.set(
        ball.object.body.position.x,
        ball.object.body.position.y
      );
    }
  }
  
  private launchBalls(): void {
    // Apply initial force to the balls to start them moving toward the center
    if (this.balls.length >= 2) {
      const app = this.game.getApp();
      const centerX = app.screen.width / 2;
      const centerY = app.screen.height / 2;
      
      // Get ball positions
      const ball1Pos = this.balls[0].object.body.position;
      const ball2Pos = this.balls[1].object.body.position;
      
      // Calculate angles to center
      const angle1 = Math.atan2(centerY - ball1Pos.y, centerX - ball1Pos.x);
      const angle2 = Math.atan2(centerY - ball2Pos.y, centerX - ball2Pos.x);
      
      // Force magnitude - increased for more obvious movement
      const force = 0.05; // Increased from 0.01
      
      // Apply force to first ball toward center
      Matter.Body.applyForce(
        this.balls[0].object.body,
        this.balls[0].object.body.position,
        {
          x: Math.cos(angle1) * force,
          y: Math.sin(angle1) * force
        }
      );
      
      // Apply force to second ball toward center
      Matter.Body.applyForce(
        this.balls[1].object.body,
        this.balls[1].object.body.position,
        {
          x: Math.cos(angle2) * force,
          y: Math.sin(angle2) * force
        }
      );
      
      // Reduce friction to allow better movement
      this.balls.forEach(ball => {
        ball.object.body.friction = 0.001;
        ball.object.body.frictionAir = 0.0005;
        ball.object.body.restitution = 0.9; // High bounce
      });
    }
  }
  
  private handleCollision(event: Matter.IEventCollision<Matter.Engine>): void {
    // Skip if game is over
    if (this.gameOver) return;
    
    const pairs = event.pairs;
    const currentTime = Date.now();
    
    for (const pair of pairs) {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;
      
      // Check for wall collisions
      if (bodyA.isStatic || bodyB.isStatic) {
        // Identify which body is the ball and which is the wall
        const ballBody = bodyA.isStatic ? bodyB : bodyA;
        const wallBody = bodyA.isStatic ? bodyA : bodyB;
        
        // Find the corresponding game ball
        const ball = this.balls.find(b => b.object.body === ballBody);
        
        if (ball) {
          // Apply power boost from wall hit
          ball.powerBoost = 1.5; // 50% more power
          ball.lastWallHit = currentTime;
          
          // Get current velocity
          const currentVelocity = ballBody.velocity;
          const speed = Matter.Vector.magnitude(currentVelocity);
          
          // Determine which wall was hit to reflect properly
          let newVelocity = { x: currentVelocity.x, y: currentVelocity.y };
          const wallName = wallBody.label;
          
          // Calculate distance from center of arena to determine boost factor
          const app = this.game.getApp();
          const arenaCenter = {
            x: (app.screen.width) / 2,
            y: (app.screen.height) / 2
          };
          const distanceFromCenter = Matter.Vector.magnitude(
            Matter.Vector.sub(ballBody.position, arenaCenter)
          );
          const maxPossibleDistance = Math.min(this.arenaWidth, this.arenaHeight) / 2;
          const distanceRatio = Math.min(1, distanceFromCenter / maxPossibleDistance);
          
          // Reduce boost for balls near the edge (further from center)
          const baseBoost = 1.15; // Base 15% boost
          const edgeBoost = 1.05;  // Minimum 5% boost at edges
          const adaptiveBoost = edgeBoost + (baseBoost - edgeBoost) * (1 - distanceRatio);
          const speedBoost = adaptiveBoost;
          
          if (wallName === "wall_top" || wallName === "wall_bottom") {
            // Vertical wall - reflect and boost y component
            newVelocity.y = -currentVelocity.y * speedBoost;
          } else if (wallName === "wall_left" || wallName === "wall_right") {
            // Horizontal wall - reflect and boost x component
            newVelocity.x = -currentVelocity.x * speedBoost;
          }
          
          // Apply the new velocity
          const maxSpeed = 15; // Maximum speed limit
          const newSpeed = Matter.Vector.magnitude(newVelocity);
          if (newSpeed > maxSpeed) {
            // Scale down to maximum speed if exceeded
            const scaleFactor = maxSpeed / newSpeed;
            newVelocity.x *= scaleFactor;
            newVelocity.y *= scaleFactor;
          }
          Matter.Body.setVelocity(ballBody, newVelocity);
          
          // Show visual feedback for wall hit with enhanced effects
          this.showWallHitEffect(wallBody, ball, speedBoost);
        }
        
        continue;
      }
      
      // Ball to ball collision
      const ballA = this.balls.find(ball => ball.object.body === bodyA);
      const ballB = this.balls.find(ball => ball.object.body === bodyB);
      
      if (ballA && ballB) {
        // Increment hit counters
        ballA.hitCounter++;
        ballB.hitCounter++;
        
        // Check for feature card activation
        this.checkFeatureCardActivation(ballA, currentTime);
        this.checkFeatureCardActivation(ballB, currentTime);
        
        // Calculate collision force (simplified)
        const velocityA = Matter.Vector.magnitude(bodyA.velocity);
        const velocityB = Matter.Vector.magnitude(bodyB.velocity);
        
        // Apply material effects to damage calculation
        const materialMultiplierA = this.getMaterialDamageMultiplier(ballA.data.material?.name);
        const materialMultiplierB = this.getMaterialDamageMultiplier(ballB.data.material?.name);
        
        // Damage is based on opponent's velocity, hardness, power boost and material
        const damageToA = Math.floor(
          velocityB * 2 * 
          (ballB.data.stats.hardness / 100) * 
          ballB.powerBoost *
          ballB.speedBoost * // Include speed boost in damage
          materialMultiplierB
        );
        
        const damageToB = Math.floor(
          velocityA * 2 * 
          (ballA.data.stats.hardness / 100) * 
          ballA.powerBoost *
          ballA.speedBoost * // Include speed boost in damage
          materialMultiplierA
        );
        
        // Apply damage
        ballA.health -= damageToA;
        ballB.health -= damageToB;
        
        // Update health bars
        this.updateHealthBar(ballA);
        this.updateHealthBar(ballB);
        
        // Flash ball on hit
        this.flashBall(ballA.object.sprite, ballA.data.material?.color || ballA.data.color);
        this.flashBall(ballB.object.sprite, ballB.data.material?.color || ballB.data.color);
        
        // Show damage numbers
        this.showDamageNumber(damageToA, ballA.object.body.position);
        this.showDamageNumber(damageToB, ballB.object.body.position);
        
        // Check for game over
        if (ballA.health <= 0 || ballB.health <= 0) {
          this.gameOver = true;
          this.endGame();
        }
      }
    }
  }
  
  private getMaterialDamageMultiplier(materialName?: string): number {
    // Different materials have different damage multipliers
    switch (materialName) {
      case "Wood": return 1.0;   // Standard
      case "Iron": return 1.5;   // Heavy, deals more damage
      case "Crystal": return 1.8; // Hard but brittle
      case "Rubber": return 0.7; // Soft, deals less damage
      case "Granite": return 1.6; // Heavy and solid
      case "Marble": return 1.3; // Medium hardness
      default: return 1.0;       // Default multiplier
    }
  }
  
  private showWallHitEffect(wallBody: Matter.Body, ball: GameBall, speedBoost: number = 1.0): void {
    // Create a flash effect where the ball hit the wall
    const flash = new PIXI.Graphics();
    flash.beginFill(0xFFFFFF, 0.7);
    
    // Position based on which wall was hit
    let x = 0, y = 0, width = 0, height = 0;
    const app = this.game.getApp();
    const fieldX = (app.screen.width - this.arenaWidth) / 2;
    const fieldY = (app.screen.height - this.arenaHeight) / 2;
    
    switch (wallBody.label) {
      case "wall_top":
        x = ball.object.body.position.x - 20;
        y = fieldY - 10;
        width = 40;
        height = 20;
        break;
      case "wall_bottom":
        x = ball.object.body.position.x - 20;
        y = fieldY + this.arenaHeight - 10;
        width = 40;
        height = 20;
        break;
      case "wall_left":
        x = fieldX - 10;
        y = ball.object.body.position.y - 20;
        width = 20;
        height = 40;
        break;
      case "wall_right":
        x = fieldX + this.arenaWidth - 10;
        y = ball.object.body.position.y - 20;
        width = 20;
        height = 40;
        break;
    }
    
    // Draw flash
    flash.drawRect(x, y, width, height);
    flash.endFill();
    
    this.container.addChild(flash);
    
    // Create a trailing effect behind the ball to show speed
    const trail = new PIXI.Graphics();
    const ballPos = ball.object.body.position;
    const ballVel = ball.object.body.velocity;
    const normalizedVel = Matter.Vector.normalise(ballVel);
    
    // Adjust trail size based on actual boost amount
    const trailFactor = Math.max(0.8, speedBoost - 1);
    // Draw speed trail
    trail.beginFill(0xFFFF00, 0.5);
    trail.moveTo(ballPos.x, ballPos.y);
    trail.lineTo(
      ballPos.x - normalizedVel.x * 40 * trailFactor,
      ballPos.y - normalizedVel.y * 40 * trailFactor
    );
    trail.lineTo(
      ballPos.x - normalizedVel.x * 35 * trailFactor + normalizedVel.y * 8,
      ballPos.y - normalizedVel.y * 35 * trailFactor - normalizedVel.x * 8
    );
    trail.lineTo(
      ballPos.x - normalizedVel.x * 35 * trailFactor - normalizedVel.y * 8,
      ballPos.y - normalizedVel.y * 35 * trailFactor + normalizedVel.x * 8
    );
    trail.endFill();
    
    this.container.addChild(trail);
    
    // Show speed boost text
    const boostValue = Math.max(5, Math.round((speedBoost - 1) * 100)); // Minimum 5% for display
    const powerText = new PIXI.Text(`SPEED +${boostValue}%!`, {
      fontFamily: 'Impact',
      fontSize: 20,
      fill: 0xFFFF00,
      stroke: 0x000000,
      strokeThickness: 4
    });
    powerText.anchor.set(0.5);
    powerText.position.set(ball.object.body.position.x, ball.object.body.position.y - 60);
    
    this.container.addChild(powerText);
    
    // Animate and remove effects
    let elapsed = 0;
    const animatePowerUp = (delta: number): void => {
      elapsed += delta;
      
      if (elapsed < 20) {
        flash.alpha = Math.max(0, 1 - elapsed / 10);
        trail.alpha = Math.max(0, 1 - elapsed / 15);
        powerText.y -= 1.5;
        powerText.alpha = Math.max(0, 1 - elapsed / 20);
      } else {
        this.game.getApp().ticker.remove(animatePowerUp);
        this.container.removeChild(flash);
        this.container.removeChild(trail);
        this.container.removeChild(powerText);
      }
    };
    
    app.ticker.add(animatePowerUp);
  }
  
  private showDamageNumber(damage: number, position: Matter.Vector): void {
    if (damage <= 0) return;
    
    // Create damage text
    const damageText = new PIXI.Text(`-${damage}`, {
      fontFamily: 'Impact',
      fontSize: 16,
      fill: 0xFF0000,
      stroke: 0x000000,
      strokeThickness: 4
    });
    damageText.anchor.set(0.5);
    damageText.position.set(position.x, position.y - 30);
    
    this.container.addChild(damageText);
    
    // Animate up and fade out
    let elapsed = 0;
    const animateDamageText = (delta: number): void => {
      elapsed += delta;
      
      if (elapsed < 30) {
        damageText.y -= 0.5;
        damageText.alpha = 1 - (elapsed / 30);
      } else {
        this.game.getApp().ticker.remove(animateDamageText);
        this.container.removeChild(damageText);
      }
    };
    
    this.game.getApp().ticker.add(animateDamageText);
  }
  
  private flashBall(sprite: PIXI.Graphics, color: number): void {
    // Save original tint
    const originalTint = sprite.tint;
    
    // Flash white
    sprite.tint = 0xFFFFFF;
    
    // Reset after a short delay
    setTimeout(() => {
      sprite.tint = originalTint;
    }, 100);
  }
  
  private endGame(): void {
    // Find winner (the ball with health remaining)
    const winner = this.balls.find(ball => ball.health > 0);
    
    if (winner) {
      this.showMessage(`${winner.data.name} WINS!`, 0);
      
      // Add victory animation
      this.playVictoryAnimation(winner);
    } else {
      this.showMessage("DRAW!", 0);
    }
    
    // Slow down simulation for dramatic effect
    Matter.Engine.update(this.game.getPhysicsSystem().matterEngine, 0, 0.5);
  }
  
  private playVictoryAnimation(winner: GameBall): void {
    // Create celebration particles around winning ball
    for (let i = 0; i < 30; i++) {
      const particle = new PIXI.Graphics();
      particle.beginFill(winner.data.color);
      particle.drawCircle(0, 0, 2 + Math.random() * 3);
      particle.endFill();
      
      // Position around winner
      const angle = Math.random() * Math.PI * 2;
      const distance = 30 + Math.random() * 20;
      particle.position.set(
        winner.object.body.position.x + Math.cos(angle) * distance,
        winner.object.body.position.y + Math.sin(angle) * distance
      );
      
      this.container.addChild(particle);
      
      // Animate particle
      let elapsed = 0;
      const vx = Math.cos(angle) * (0.5 + Math.random() * 1);
      const vy = Math.sin(angle) * (0.5 + Math.random() * 1) - 0.5; // Slight upward bias
      
      const animateParticle = (delta: number): void => {
        elapsed += delta;
        
        if (elapsed < 60) {
          particle.position.x += vx * delta;
          particle.position.y += vy * delta;
          particle.alpha = 1 - (elapsed / 60);
        } else {
          this.game.getApp().ticker.remove(animateParticle);
          this.container.removeChild(particle);
        }
      };
      
      this.game.getApp().ticker.add(animateParticle);
    }
  }
  
  private showMessage(text: string, duration: number = 0): void {
    this.messageText.text = text;
    this.messageText.visible = true;
    
    // Center the message
    this.messageText.position.set(
      this.game.getApp().screen.width / 2,
      this.game.getApp().screen.height / 2
    );
    
    // Hide after duration if not permanent
    if (duration > 0) {
      setTimeout(() => {
        this.messageText.visible = false;
      }, duration);
    }
  }

  public update(delta: number): void {
    const currentTime = Date.now();
    
    // Update health bars positions and effects
    for (const ball of this.balls) {
      this.updateHealthBar(ball);
      
      // Ensure balls stay within arena bounds
      this.keepBallInArena(ball);
      
      // Update ball position-based effects
      if (ball.materialEffect) {
        ball.materialEffect.position.set(
          ball.object.body.position.x,
          ball.object.body.position.y
        );
      }
      
      if (ball.featureCardEffect) {
        ball.featureCardEffect.position.set(
          ball.object.body.position.x,
          ball.object.body.position.y
        );
        
        // Animate feature card effect if active
        if (ball.speedBoostActive) {
          ball.featureCardEffect.rotation += 0.05;
        }
      }
      
      // Decay power boost over time
      if (ball.powerBoost > 1.0) {
        // Power boost lasts for 3 seconds
        const elapsed = currentTime - ball.lastWallHit;
        if (elapsed > 3000) {
          ball.powerBoost = 1.0;
        } else {
          // Linear decay
          ball.powerBoost = 1.0 + 0.5 * (1 - elapsed / 3000);
        }
      }
      
      // Check and update speed boost state
      if (ball.speedBoostActive) {
        // Check if boost should end
        if (currentTime >= ball.speedBoostEndTime) {
          ball.speedBoostActive = false;
          ball.speedBoost = 1.0;
          
          // Hide feature card effect
          if (ball.featureCardEffect) {
            ball.featureCardEffect.visible = false;
          }
        } else {
          // Pulsate the effect during active period
          if (ball.featureCardEffect) {
            ball.featureCardEffect.alpha = 0.7 + Math.sin(currentTime * 0.01) * 0.3;
          }
        }
      }
    }
  }

  private keepBallInArena(ball: GameBall): void {
    const app = this.game.getApp();
    const fieldX = (app.screen.width - this.arenaWidth) / 2;
    const fieldY = (app.screen.height - this.arenaHeight) / 2;
    
    const ballBody = ball.object.body;
    const ballRadius = 30; // Same as in createGameBall
    
    // Check boundaries and adjust if needed
    let needsAdjustment = false;
    let adjustedPosition = { x: ballBody.position.x, y: ballBody.position.y };
    
    // Check horizontal boundaries
    if (ballBody.position.x - ballRadius < fieldX) {
      adjustedPosition.x = fieldX + ballRadius + 1;
      needsAdjustment = true;
    } else if (ballBody.position.x + ballRadius > fieldX + this.arenaWidth) {
      adjustedPosition.x = fieldX + this.arenaWidth - ballRadius - 1;
      needsAdjustment = true;
    }
    
    // Check vertical boundaries
    if (ballBody.position.y - ballRadius < fieldY) {
      adjustedPosition.y = fieldY + ballRadius + 1;
      needsAdjustment = true;
    } else if (ballBody.position.y + ballRadius > fieldY + this.arenaHeight) {
      adjustedPosition.y = fieldY + this.arenaHeight - ballRadius - 1;
      needsAdjustment = true;
    }
    
    // Apply adjustment if needed
    if (needsAdjustment) {
      Matter.Body.setPosition(ballBody, adjustedPosition);
      
      // Slightly dampen velocity when boundary correction happens
      const currentVelocity = ballBody.velocity;
      Matter.Body.setVelocity(ballBody, {
        x: currentVelocity.x * 0.9,
        y: currentVelocity.y * 0.9
      });
    }
  }

  public destroy(): void {
    const physics = this.game.getPhysicsSystem();
    
    // Remove collision listener
    Matter.Events.off(physics.matterEngine, 'collisionStart', this.collisionHandler);
    
    // Remove all physics objects
    for (const ball of this.balls) {
      physics.removeObject(ball.object);
    }
    
    // Remove walls from world
    for (const wall of Object.values(this.walls)) {
      Matter.Composite.remove(physics.matterWorld, wall);
    }
    
    // Clear arrays
    this.balls = [];
    
    // Remove container children
    this.container.removeChildren();
  }

  // New method to check and activate feature card powers
  private checkFeatureCardActivation(ball: GameBall, currentTime: number): void {
    // Only process if ball has a feature card
    if (!ball.data.featureCard) return;
    
    // Require 3 consecutive hits to activate feature card
    if (ball.hitCounter >= 3 && !ball.speedBoostActive) {
      // Activate speed boost
      ball.speedBoostActive = true;
      ball.speedBoost = ball.data.featureCard.speedBoost || 2.0; // Default to double speed
      ball.speedBoostEndTime = currentTime + (ball.data.featureCard.durationMs || 5000); // Default 5 second duration
      ball.hitCounter = 0; // Reset hit counter
      
      // Apply speed boost to ball physics
      const currentVelocity = ball.object.body.velocity;
      const velocityMagnitude = Matter.Vector.magnitude(currentVelocity);
      
      if (velocityMagnitude > 0) {
        // Normalize and scale velocity
        const normalizedVel = Matter.Vector.normalise(currentVelocity);
        Matter.Body.setVelocity(ball.object.body, {
          x: normalizedVel.x * velocityMagnitude * ball.speedBoost,
          y: normalizedVel.y * velocityMagnitude * ball.speedBoost
        });
      }
      
      // Show feature card effect
      if (ball.featureCardEffect) {
        ball.featureCardEffect.visible = true;
        ball.featureCardEffect.alpha = 1;
      }
      
      // Show activation message
      this.showFeatureCardActivation(ball);
    }
  }

  // New method to display feature card activation
  private showFeatureCardActivation(ball: GameBall): void {
    if (!ball.data.featureCard) return;
    
    // Create activation text
    const activationText = new PIXI.Text(`${ball.data.featureCard.name} ACTIVATED!`, {
      fontFamily: 'Impact',
      fontSize: 24,
      fill: ball.data.featureCard.color,
      stroke: 0x000000,
      strokeThickness: 4,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowDistance: 2
    });
    
    activationText.anchor.set(0.5);
    activationText.position.set(
      ball.object.body.position.x,
      ball.object.body.position.y - 70
    );
    
    this.container.addChild(activationText);
    
    // Animate and remove text
    let elapsed = 0;
    const animateText = (delta: number): void => {
      elapsed += delta;
      
      if (elapsed < 30) {
        activationText.y -= 1;
        activationText.scale.set(1 + Math.sin(elapsed * 0.2) * 0.2);
      } else {
        this.game.getApp().ticker.remove(animateText);
        this.container.removeChild(activationText);
      }
    };
    
    this.game.getApp().ticker.add(animateText);
  }
} 