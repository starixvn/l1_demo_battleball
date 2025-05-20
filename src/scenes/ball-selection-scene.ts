import * as PIXI from 'pixi.js';
import { Scene } from '../types';
import { Game } from '../game';
import { GameScene } from './game-scene';
import { RevealCardScene } from './reveal-card-scene';

// Ball data type
interface BallData {
  name: string;
  color: number;
  stats: {
    hardness: number;
    bounce: number;
  };
  playerCount: number;
  targetPlayerCount: number; // For smooth animation
  material?: {
    name: string;
    color: number;
  };
  featureCard?: {
    name: string;
    color: number;
    speedBoost: number;
    durationMs: number;
    description: string;
  };
}

// Extended type definitions for PIXI objects to support custom properties
interface AnimatedParticle extends PIXI.Graphics {
  vx: number;
  vy: number;
}

interface BallContainer extends PIXI.Container {
  userData: {
    targetX: number;
    targetY: number;
    playerCountText?: PIXI.Text;
    playerCountValue?: PIXI.Text; // For the actual number
    animating?: boolean;
  };
}

interface PulseObject extends PIXI.DisplayObject {
  userData: {
    pulseFunction?: (delta: number) => void;
  };
}

interface BackgroundContainer extends PIXI.Container {
  userData: (delta: number) => void;
}

export class BallSelectionScene implements Scene {
  public container: PIXI.Container;
  private game: Game;
  private title!: PIXI.Text;
  private balls: {graphic: BallContainer, data: BallData}[] = [];
  private selectedBall: BallData | null = null;
  private vsGraphic!: PIXI.Text;
  private animationActive: boolean = true;
  private playerJoinInterval: NodeJS.Timeout | null = null;
  private playerCountLabel!: PIXI.Text;
  private totalPlayerCountValue: number = 0;
  private targetTotalPlayerCount: number = 0;
  
  // Define ball options - both now have the same stats
  private ballOptions: BallData[] = [
    {
      name: "Emma",
      color: 0xff0000, // Red
      stats: {
        hardness: 50,
        bounce: 50
      },
      playerCount: 0,
      targetPlayerCount: 0,
      material: {
        name: "Wood",
        color: 0x8B4513
      },
      featureCard: {
        name: "Speed Burst",
        color: 0xFFCC00, // Golden yellow
        speedBoost: 2.5, // 150% faster
        durationMs: 4000, // 4 seconds
        description: "3 consecutive hits to activate! Increases speed by 150% for 4 seconds."
      }
    },
    {
      name: "Matt",
      color: 0x0066ff, // Blue
      stats: {
        hardness: 50,
        bounce: 50
      },
      playerCount: 0,
      targetPlayerCount: 0,
      material: {
        name: "Rubber",
        color: 0x000000
      },
      featureCard: {
        name: "Power Strike",
        color: 0xFF00FF, // Magenta
        speedBoost: 2.0, // 100% faster
        durationMs: 6000, // 6 seconds
        description: "3 consecutive hits to activate! Increases speed by 100% for 6 seconds."
      }
    }
  ];

  constructor(game: Game) {
    this.game = game;
    this.container = new PIXI.Container();
  }

  public init(): void {
    const app = this.game.getApp();
    
    // Create background with gaming style
    this.createBackground(app);
    
    // Create title text with gaming style
    this.title = new PIXI.Text('SELECT YOUR FIGHTER', {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 56,
      fill: ['#ffffff', '#ffcc00'], // Gradient
      fillGradientType: 1,
      fillGradientStops: [0.2, 1],
      align: 'center',
      fontWeight: 'bold',
      stroke: '#000000',
      strokeThickness: 5,
      dropShadow: true,
      dropShadowColor: '#000000',
      dropShadowBlur: 4,
      dropShadowAngle: Math.PI / 6,
      dropShadowDistance: 6
    });
    this.title.anchor.set(0.5);
    this.title.position.set(app.screen.width / 2, 80);
    this.container.addChild(this.title);
    
    // Add a multiplayer label with gaming style
    const playerCountContainer = new PIXI.Container();
    playerCountContainer.position.set(app.screen.width / 2, 130);
    
    // Background for player count - make it wider to handle larger numbers
    const countBg = new PIXI.Graphics();
    countBg.beginFill(0x000000, 0.5);
    countBg.lineStyle(2, 0x00ff00, 0.8);
    countBg.drawRoundedRect(-130, -15, 260, 30, 10); // Increased width from 220 to 260
    countBg.endFill();
    playerCountContainer.addChild(countBg);
    
    // Label text
    const playerLabel = new PIXI.Text('PLAYERS ONLINE: ', {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 20,
      fill: 0x00ff00,
      align: 'right',
      stroke: '#000000',
      strokeThickness: 3
    });
    playerLabel.anchor.set(1, 0.5);
    playerLabel.position.set(40, 0);
    playerCountContainer.addChild(playerLabel);
    
    // Count value with more impressive styling but prepared for larger values
    this.playerCountLabel = new PIXI.Text('0', {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 28, // Increased from 24
      fill: 0xffffff,
      align: 'left',
      stroke: '#00ff00',
      strokeThickness: 3,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowDistance: 2,
      dropShadowBlur: 2
    });
    this.playerCountLabel.anchor.set(0, 0.5);
    this.playerCountLabel.position.set(45, 0);
    playerCountContainer.addChild(this.playerCountLabel);
    
    this.container.addChild(playerCountContainer);
    
    // Start simulating random players joining
    this.simulateRandomPlayers();
    
    // Create "VS" text in the center
    this.vsGraphic = new PIXI.Text('VS', {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 72,
      fill: ['#ff0000', '#0000ff'], // Red to Blue gradient
      fillGradientType: 1,
      fillGradientStops: [0.2, 0.8],
      align: 'center',
      fontWeight: 'bold',
      stroke: '#ffffff',
      strokeThickness: 4,
      dropShadow: true,
      dropShadowColor: '#000000',
      dropShadowBlur: 4,
      dropShadowDistance: 6
    });
    this.vsGraphic.anchor.set(0.5);
    this.vsGraphic.position.set(app.screen.width / 2, app.screen.height / 2 - 20);
    this.vsGraphic.alpha = 0;
    this.container.addChild(this.vsGraphic);
    
    // Create ball options with initial positions off-screen
    this.createBallOptions();
    
    // Start entrance animation
    this.animateEntrance();
    
    // Set up ticker for smooth animations
    app.ticker.add(this.updatePlayerCounts.bind(this));
  }

  private simulateRandomPlayers(): void {
    // Every second, add random players to teams (increased frequency from 8-13 seconds)
    this.playerJoinInterval = setInterval(() => {
      if (this.animationActive) return; // Don't add players during animations
      
      // Generate a random number of players to join (1-3)
      const numPlayers = 1 + Math.floor(Math.random() * 3);
      
      // Choose a random team for them to join
      const teamIndex = Math.floor(Math.random() * this.ballOptions.length);
      
      // Update target count (actual count will animate towards this)
      this.ballOptions[teamIndex].targetPlayerCount += numPlayers;
      
      // Update total player count target
      this.targetTotalPlayerCount += numPlayers;
      
      // Show join notification
      this.showPlayerJoinNotification(numPlayers, this.ballOptions[teamIndex].name);
      
    }, 1000); // Increased frequency - random players join every 1 second
  }
  
  private updateTotalPlayerCount(): void {
    // This will be handled by the ticker now
    this.playerCountLabel.text = this.totalPlayerCountValue.toString();
  }
  
  private updatePlayerCounts(delta: number): void {
    let updated = false;
    
    // Update total count with slower animation
    if (this.totalPlayerCountValue < this.targetTotalPlayerCount) {
      // Only increment on some frames for a more visible count-up effect
      if (Math.random() < 0.2) { // 20% chance per frame to increment
        this.totalPlayerCountValue++;
        this.playerCountLabel.text = this.totalPlayerCountValue.toString();
        
        // Enhanced pulse effect for total count
        this.enhancedPulseEffect(this.playerCountLabel);
        updated = true;
      }
    }
    
    // Update individual ball counts with slower animation
    this.balls.forEach((ball, index) => {
      const data = ball.data;
      
      if (data.playerCount < data.targetPlayerCount) {
        // Only increment occasionally for a more visible count-up
        if (Math.random() < 0.15) { // 15% chance per frame to increment
          data.playerCount++;
          this.updatePlayerCountDisplay(index, true);
          updated = true;
        }
      }
    });
    
    // If any updates were made, add a longer delay before the next update
    if (updated) {
      const app = this.game.getApp();
      app.ticker.remove(this.updatePlayerCounts.bind(this));
      
      setTimeout(() => {
        app.ticker.add(this.updatePlayerCounts.bind(this));
      }, 400); // Increased delay between count increments
    }
  }
  
  private enhancedPulseEffect(text: PIXI.Text): void {
    // Save original position
    const originalY = text.y;
    
    // Change color only without scaling
    const originalColor = text.style.fill;
    text.style.fill = 0xffff00; // Bright yellow
    
    // Add a moderate, consistent glow effect using standard filters
    const blurFilter = new PIXI.filters.BlurFilter(5);
    blurFilter.padding = 10;
    blurFilter.quality = 1;
    
    // Create a ColorMatrixFilter for the yellow glow color - consistent intensity
    const colorMatrix = new PIXI.filters.ColorMatrixFilter();
    colorMatrix.matrix[0] = 1.3; // Red component
    colorMatrix.matrix[6] = 1.3; // Green component
    colorMatrix.matrix[12] = 0.1; // Blue component
    
    const originalFilters = text.filters || [];
    text.filters = [...originalFilters, blurFilter, colorMatrix];
    
    // Small bounce effect
    text.y = originalY - 5;
    
    // Step 2: Return to normal with easing
    setTimeout(() => {
      text.y = originalY - 2;
      text.style.fill = 0xffffff; // White intermediate
      
      setTimeout(() => {
        text.y = originalY;
        text.style.fill = originalColor;
        
        // Remove the glow filters
        setTimeout(() => {
          text.filters = originalFilters;
        }, 200);
      }, 150);
    }, 250);
  }
  
  private pulseText(text: PIXI.Text): void {
    // Save original position
    const originalY = text.y;
    
    // Bounce effect
    text.y = originalY - 4;
    
    // More noticeable color change with multiple stages
    const originalColor = text.style.fill;
    
    // Bright yellow flash
    text.style.fill = 0xffff00;
    
    // Add temporary shadow for depth
    const originalShadowDistance = text.style.dropShadowDistance || 0;
    const originalShadowColor = text.style.dropShadowColor;
    const originalShadowBlur = text.style.dropShadowBlur;
    
    text.style.dropShadow = true;
    text.style.dropShadowColor = 0xff8800;
    text.style.dropShadowDistance = 3;
    text.style.dropShadowBlur = 5;
    
    // Add a spark effect around the text
    this.createCountSparkEffect(text);
    
    // Return to normal gradually
    setTimeout(() => {
      text.y = originalY - 2;
      text.style.fill = 0xff8800; // Orange intermediate
      
      setTimeout(() => {
        text.y = originalY;
        text.style.fill = originalColor;
        
        // Reset shadow properties
        text.style.dropShadowColor = originalShadowColor;
        text.style.dropShadowDistance = originalShadowDistance;
        text.style.dropShadowBlur = originalShadowBlur;
      }, 150);
    }, 200);
  }
  
  private createCountSparkEffect(text: PIXI.Text): void {
    const sparkContainer = new PIXI.Container();
    sparkContainer.position.copyFrom(text.position);
    this.container.addChild(sparkContainer);
    
    // Consistent number of particles
    const numParticles = 6;
    
    // Create multiple spark particles
    for (let i = 0; i < numParticles; i++) {
      const angle = (Math.PI * 2) * (i / numParticles);
      const distance = 20 + Math.random() * 10;
      
      const spark = new PIXI.Graphics();
      spark.beginFill(0xffff00, 0.8);
      
      // Randomly choose between circle and star shape for variety
      if (Math.random() > 0.5) {
        spark.drawCircle(0, 0, 2 + Math.random() * 2);
      } else {
        this.drawStar(spark, 0, 0, 5, 4 + Math.random() * 3, 2);
      }
      
      spark.endFill();
      
      // Position around the text
      spark.x = Math.cos(angle) * distance;
      spark.y = Math.sin(angle) * distance;
      
      // Add to container
      sparkContainer.addChild(spark);
      
      // Animate the spark
      const speed = 0.5 + Math.random() * 0.5;
      const fadeSpeed = 0.03 + Math.random() * 0.03;
      let sparkAlpha = 1.0;
      
      const animateSpark = (delta: number) => {
        // Move outward
        spark.x += Math.cos(angle) * speed * delta;
        spark.y += Math.sin(angle) * speed * delta;
        
        // Fade out
        sparkAlpha -= fadeSpeed * delta;
        spark.alpha = Math.max(0, sparkAlpha);
        
        // Remove when fully transparent
        if (spark.alpha <= 0) {
          this.game.getApp().ticker.remove(animateSpark);
          sparkContainer.removeChild(spark);
          
          // Remove container if empty
          if (sparkContainer.children.length === 0) {
            this.container.removeChild(sparkContainer);
          }
        }
      };
      
      this.game.getApp().ticker.add(animateSpark);
    }
  }
  
  private drawStar(graphics: PIXI.Graphics, x: number, y: number, points: number, radius: number, innerRadius: number): void {
    // Draw a star shape for more interesting particles
    graphics.moveTo(x, y - radius);
    
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? radius : innerRadius;
      const angle = (Math.PI * 2 * i) / (points * 2) - Math.PI / 2;
      graphics.lineTo(
        x + r * Math.cos(angle),
        y + r * Math.sin(angle)
      );
    }
  }
  
  private showPlayerJoinNotification(count: number, team: string): void {
    const app = this.game.getApp();
    
    // Create notification container
    const notifContainer = new PIXI.Container();
    notifContainer.position.set(app.screen.width / 2, app.screen.height - 20);
    notifContainer.alpha = 0;
    
    // Background with team color
    const teamColor = team === "Emma" ? 0xff0000 : 0x0066ff;
    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0.7);
    bg.lineStyle(2, teamColor, 0.8);
    bg.drawRoundedRect(-150, -15, 300, 30, 10);
    bg.endFill();
    
    // Notification text with enhanced styling
    const notification = new PIXI.Text(`${count} player${count > 1 ? 's' : ''} joined ${team}!`, {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 20,
      fill: 0xffffff,
      align: 'center',
      stroke: teamColor,
      strokeThickness: 3,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowDistance: 2,
      dropShadowBlur: 2
    });
    notification.anchor.set(0.5);
    
    // Add team-colored indicators/icons
    const leftIcon = new PIXI.Graphics();
    leftIcon.beginFill(teamColor);
    leftIcon.drawCircle(-120, 0, 8);
    leftIcon.endFill();
    
    const rightIcon = new PIXI.Graphics();
    rightIcon.beginFill(teamColor);
    rightIcon.drawCircle(120, 0, 8);
    rightIcon.endFill();
    
    notifContainer.addChild(bg);
    notifContainer.addChild(leftIcon);
    notifContainer.addChild(rightIcon);
    notifContainer.addChild(notification);
    this.container.addChild(notifContainer);
    
    // Animate notification with improved animation
    let elapsed = 0;
    const animate = (delta: number) => {
      elapsed += delta;
      
      if (elapsed < 15) {
        // Fade in and slide up
        notifContainer.alpha = Math.min(1, elapsed / 15);
        notifContainer.y -= 1 * delta;
      } else if (elapsed < 120) { // Increased display time
        // Keep visible with more pronounced pulsing effect
        const pulseScale = 1 + 0.05 * Math.sin(elapsed * 0.08);
        notifContainer.scale.set(pulseScale);
        
        // Subtle color cycling for emphasis
        if (elapsed % 30 < 15) {
          bg.tint = 0xffffff;
        } else {
          bg.tint = 0xdddddd;
        }
        
        // Make icons pulse in alternating pattern
        leftIcon.scale.set(1 + 0.3 * Math.sin(elapsed * 0.1));
        rightIcon.scale.set(1 + 0.3 * Math.cos(elapsed * 0.1));
      } else if (elapsed < 135) {
        // Fade out
        notifContainer.alpha = Math.max(0, 1 - (elapsed - 120) / 15);
      } else {
        app.ticker.remove(animate);
        this.container.removeChild(notifContainer);
      }
    };
    
    app.ticker.add(animate);
  }

  private createBallOptions(): void {
    const app = this.game.getApp();
    
    // Create ball containers that will slide in from the sides
    const ballSize = 120;
    const padding = 40;
    const containerWidth = ballSize * 2;
    const containerHeight = app.screen.height * 0.5;
    
    // Center position calculation with wider spacing
    const centerX = app.screen.width / 2;
    const centerY = app.screen.height / 2 + 40;
    const spacing = app.screen.width * 0.35; // Wider spacing for balls
    
    for (let i = 0; i < this.ballOptions.length; i++) {
      const ballData = this.ballOptions[i];
      
      // Create off-screen starting positions for entrance animation
      const targetX = centerX + (i === 0 ? -spacing : spacing);
      const targetY = centerY;
      const startX = i === 0 ? -ballSize * 2 : app.screen.width + ballSize * 2;
      const startY = targetY;
      
      // Create container for the ball and its UI
      const ballContainer = new PIXI.Container() as BallContainer;
      ballContainer.interactive = true;
      ballContainer.eventMode = 'static';
      ballContainer.cursor = 'pointer';
      ballContainer.position.set(startX, startY);
      
      // Store target positions for animation
      ballContainer.userData = {
        targetX,
        targetY
      };
      
      // Create metallic ball texture
      const ballTexture = this.createMetallicBallTexture(ballData.color);
      const ball = new PIXI.Sprite(ballTexture);
      ball.anchor.set(0.5);
      ball.width = ballSize;
      ball.height = ballSize;
      ballContainer.addChild(ball);
      
      // LAYOUT VERTICAL POSITIONS
      // Define consistent vertical positions for UI elements to prevent overlap
      const namePositionY = -ballSize * 0.8;      // Name position (above ball)
      const playerCountY = ballSize * 0.4;        // Player count (directly below ball)
      
      // Create name display
      const nameContainer = new PIXI.Container();
      nameContainer.position.set(0, namePositionY);

      // Name background
      const nameBg = new PIXI.Graphics();
      nameBg.beginFill(0x000000, 0.6);
      nameBg.lineStyle(2, ballData.color, 0.8);
      nameBg.drawRoundedRect(-80, -25, 160, 50, 10);
      nameBg.endFill();
      nameContainer.addChild(nameBg);
      
      // Name text
      const nameText = new PIXI.Text(ballData.name, {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontSize: 32,
        fill: 0xFFFFFF,
        align: 'center',
        fontWeight: 'bold',
        stroke: ballData.color,
        strokeThickness: 4
      });
      nameText.anchor.set(0.5);
      nameContainer.addChild(nameText);
      
      ballContainer.addChild(nameContainer);
      
      // Create player count display under the ball
      const countContainer = new PIXI.Container();
      countContainer.position.set(0, playerCountY);
      
      // Player count label
      const playerLabel = new PIXI.Text("PLAYERS", {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontSize: 18,
        fill: 0xFFFFFF,
        align: 'center'
      });
      playerLabel.anchor.set(0.5, 0);
      countContainer.addChild(playerLabel);
      
      // Count value with custom formatting
      const countValue = new PIXI.Text("0", {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontSize: 40,
        fill: ballData.color,
        align: 'center',
        fontWeight: 'bold',
        stroke: 0x000000,
        strokeThickness: 4
      });
      countValue.anchor.set(0.5, 0);
      countValue.position.set(0, 22);
      countContainer.addChild(countValue);
      
      // Store reference to count text for animation
      ballContainer.userData.playerCountText = playerLabel;
      ballContainer.userData.playerCountValue = countValue;
      
      ballContainer.addChild(countContainer);
      
      // Add event listener for selection
      ballContainer.on('pointerdown', () => {
        if (this.animationActive) return; // Prevent selection during animation
        this.selectBall(ballData, ballContainer);
      });
      
      // Add to container
      this.container.addChild(ballContainer);
      this.balls.push({graphic: ballContainer, data: ballData});
    }
  }
  
  private updatePlayerCountDisplay(teamIndex: number, isIncrement: boolean = false): void {
    const ball = this.balls[teamIndex];
    const valueText = ball.graphic.userData.playerCountValue;
    
    if (valueText) {
      // Update the text with a more impressive font size and styling
      valueText.text = ball.data.playerCount.toString();
      
      if (isIncrement) {
        // Enhanced animation for player count increases
        this.pulseText(valueText);
        
        // Add more dramatic visual feedback to the ball
        const ballGraphic = ball.graphic.getChildAt(1) as PIXI.Graphics;
        const platform = ball.graphic.getChildAt(0) as PIXI.Graphics;
        const originalBallTint = ballGraphic.tint;
        const originalPlatformAlpha = platform.alpha;
        
        // Flash ball yellow
        ballGraphic.tint = 0xffff00;
        
        // Make platform glow stronger
        platform.alpha = 0.8;
        
        // Create expanding ring effect
        const ring = new PIXI.Graphics();
        ring.lineStyle(3, ball.data.color, 1);
        ring.drawCircle(0, 0, 60);
        ring.alpha = 0.8;
        ball.graphic.addChild(ring);
        
        // Animate the ring expansion
        let ringScale = 1;
        const animateRing = (delta: number) => {
          ringScale += 0.04 * delta;
          ring.scale.set(ringScale);
          ring.alpha = Math.max(0, 1 - (ringScale - 1) / 1.5);
          
          if (ring.alpha <= 0) {
            this.game.getApp().ticker.remove(animateRing);
            ball.graphic.removeChild(ring);
          }
        };
        this.game.getApp().ticker.add(animateRing);
        
        // Return ball to normal
        setTimeout(() => {
          ballGraphic.tint = originalBallTint;
          platform.alpha = originalPlatformAlpha;
        }, 250);
      }
    }
  }
  
  private createMetallicBallTexture(color: number): PIXI.Texture {
    const size = 120;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Convert hex color to rgb
      const r = (color >> 16) & 0xFF;
      const g = (color >> 8) & 0xFF;
      const b = color & 0xFF;
      
      // Create lighter and darker versions for gradient
      const lighterColor = `rgb(${Math.min(255, r + 100)}, ${Math.min(255, g + 100)}, ${Math.min(255, b + 100)})`;
      const baseColor = `rgb(${r}, ${g}, ${b})`;
      const darkerColor = `rgb(${Math.max(0, r - 80)}, ${Math.max(0, g - 80)}, ${Math.max(0, b - 80)})`;
      
      // Create radial gradient for metallic effect
      const gradient = ctx.createRadialGradient(40, 40, 10, 60, 60, size);
      gradient.addColorStop(0, lighterColor);
      gradient.addColorStop(0.5, baseColor);
      gradient.addColorStop(1, darkerColor);
      
      ctx.fillStyle = gradient;
      ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    return PIXI.Texture.from(canvas);
  }
  
  private animateEntrance(): void {
    const app = this.game.getApp();
    this.animationActive = true;
    
    // Animate each ball sliding in from the sides
    let ballsReachedCenter = 0;
    const animateBalls = (delta: number) => {
      let allBallsInPosition = true;
      
      this.balls.forEach((ball, index) => {
        const container = ball.graphic;
        const targetX = container.userData.targetX;
        const targetY = container.userData.targetY;
        
        // Ease towards target position
        const dx = targetX - container.x;
        const dy = targetY - container.y;
        
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          container.x += dx * 0.1 * delta;
          container.y += dy * 0.1 * delta;
          allBallsInPosition = false;
        } else {
          container.x = targetX;
          container.y = targetY;
          ballsReachedCenter++;
          
          // Trigger VS animation once both balls are in position
          if (ballsReachedCenter === 2) {
            this.animateVsText();
            app.ticker.remove(animateBalls);
            // Make balls interactive after animation
            setTimeout(() => {
              this.animationActive = false;
            }, 1500);
          }
        }
      });
    };
    
    app.ticker.add(animateBalls);
  }
  
  private animateVsText(): void {
    const app = this.game.getApp();
    let elapsed = 0;
    
    const animateVs = (delta: number) => {
      elapsed += delta;
      
      if (elapsed < 15) {
        // Scale up with elastic effect
        const progress = elapsed / 15;
        const elasticScale = 1 + Math.sin(progress * Math.PI) * 0.3;
        this.vsGraphic.scale.set(elasticScale);
        this.vsGraphic.alpha = progress;
      } else {
        // Keep pulsing slightly
        const pulse = 1 + Math.sin(elapsed * 0.05) * 0.05;
        this.vsGraphic.scale.set(pulse);
        app.ticker.remove(animateVs);
      }
    };
    
    app.ticker.add(animateVs);
  }
  
  private pulseEffect(object: PIXI.DisplayObject): void {
    const app = this.game.getApp();
    let elapsed = 0;
    
    // Don't apply scaling to player count elements
    if ((object as any).text !== undefined && 
        ((object as any).text === this.playerCountLabel.text || 
         this.balls.some(ball => ball.graphic.userData.playerCountValue === object))) {
      return; // Skip scaling for player count text
    }
    
    const pulse = (delta: number) => {
      elapsed += delta * 0.1;
      object.scale.set(1.05 + Math.sin(elapsed) * 0.05);
    };
    
    app.ticker.add(pulse);
    // Use any to avoid TypeScript errors
    (object as any).userData = { pulseFunction: pulse };
  }
  
  private stopPulseEffect(object: PIXI.DisplayObject): void {
    // Use any to avoid TypeScript errors
    if ((object as any).userData && (object as any).userData.pulseFunction) {
      const app = this.game.getApp();
      app.ticker.remove((object as any).userData.pulseFunction);
      object.scale.set(1.0);
    }
  }

  private selectBall(ballData: BallData, ballContainer: BallContainer): void {
    // Store selected ball
    this.selectedBall = ballData;
    
    // Disable interaction during transition
    this.animationActive = true;
    
    // Stop all other animations
    this.game.getApp().ticker.remove(this.updatePlayerCounts.bind(this));
    
    // Get opponent ball (the other one)
    const opponentBall = this.ballOptions.find(b => b !== ballData);
    
    // Show message about team joined
    this.showTeamJoinedMessage(ballData.name);
    
    // After a delay, show feature card countdown
    setTimeout(() => {
      // Show feature card countdown
      this.showFeatureCardCountdown();
      
      // Start simulating more players joining after selection
      setTimeout(() => {
        this.simulatePlayersJoiningAfterSelection();
      }, 2000);
      
      // Change scene after a delay
      setTimeout(() => {
        // Create reveal card scene with selected ball and opponent
        const revealScene = new RevealCardScene(this.game, {
          name: ballData.name,
          color: ballData.color,
          stats: ballData.stats,
          material: ballData.material,
          featureCard: ballData.featureCard
        }, {
          name: opponentBall?.name || "Opponent",
          color: opponentBall?.color || 0x0000ff,
          stats: opponentBall?.stats || { hardness: 50, bounce: 50 },
          material: opponentBall?.material,
          featureCard: opponentBall?.featureCard
        });
        
        // Switch to the new scene
        this.game.setScene(revealScene);
      }, 5000);
    }, 2000);
  }
  
  private showTeamJoinedMessage(teamName: string): void {
    const app = this.game.getApp();
    
    // Create container for the message
    const messageContainer = new PIXI.Container();
    messageContainer.position.set(app.screen.width / 2, app.screen.height / 2 - 80);
    
    // Create background
    const teamColor = teamName === "Emma" ? 0xff0000 : 0x0066ff;
    const msgBg = new PIXI.Graphics();
    msgBg.beginFill(0x000000, 0.7);
    msgBg.lineStyle(3, teamColor, 0.9);
    msgBg.drawRoundedRect(-200, -30, 400, 60, 15);
    msgBg.endFill();
    
    // Create text
    const joinMessage = new PIXI.Text(`YOU JOINED ${teamName.toUpperCase()} TEAM!`, {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 28,
      fill: 0xffffff,
      align: 'center',
      stroke: teamColor,
      strokeThickness: 3,
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowDistance: 2,
      dropShadowBlur: 2
    });
    joinMessage.anchor.set(0.5);
    
    // Add to container
    messageContainer.addChild(msgBg);
    messageContainer.addChild(joinMessage);
    
    // Add to scene
    this.container.addChild(messageContainer);
    
    // Animation
    messageContainer.alpha = 0;
    
    // Animate in with custom animation
    let elapsed = 0;
    const animateIn = (delta: number) => {
      elapsed += delta;
      
      if (elapsed < 10) {
        messageContainer.alpha = Math.min(1, elapsed / 10);
      } else {
        app.ticker.remove(animateIn);
      }
    };
    
    app.ticker.add(animateIn);
    
    // Keep message visible for the entire countdown sequence
  }
  
  private showFeatureCardCountdown(): void {
    const app = this.game.getApp();
    
    // Container for countdown display
    const countdownContainer = new PIXI.Container();
    countdownContainer.position.set(app.screen.width / 2, app.screen.height / 2);
    
    // Background rectangle with gradient
    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0.8);
    bg.drawRect(-app.screen.width / 2, -app.screen.height / 2, app.screen.width, app.screen.height);
    bg.endFill();
    
    countdownContainer.addChild(bg);
    
    // Title text - modified to be about secret feature cards
    const titleText = new PIXI.Text("SECRET FEATURE CARDS AWAIT!", {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 48,
      fill: ['#ffffff', '#ffcc00'], // Gradient fill
      fillGradientType: 1,
      fillGradientStops: [0.2, 1],
      align: 'center',
      fontWeight: 'bold',
      stroke: '#000000',
      strokeThickness: 5,
      dropShadow: true,
      dropShadowColor: '#000000',
      dropShadowBlur: 4,
      dropShadowDistance: 2
    });
    titleText.anchor.set(0.5);
    titleText.position.set(0, -100);
    countdownContainer.addChild(titleText);
    
    // Add a mysterious card silhouette
    if (this.selectedBall) {
      // Team name display
      const teamNameContainer = new PIXI.Container();
      teamNameContainer.position.set(0, -170);
      
      // Team name background
      const teamNameBg = new PIXI.Graphics();
      teamNameBg.beginFill(0x000000, 0.7);
      teamNameBg.lineStyle(2, this.selectedBall.color, 0.9);
      teamNameBg.drawRoundedRect(-120, -20, 240, 40, 10);
      teamNameBg.endFill();
      
      // Team name text
      const teamNameText = new PIXI.Text(this.selectedBall.name, {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontSize: 24,
        fill: 0xFFFFFF,
        align: 'center',
        stroke: this.selectedBall.color,
        strokeThickness: 3
      });
      teamNameText.anchor.set(0.5);
      
      teamNameContainer.addChild(teamNameBg);
      teamNameContainer.addChild(teamNameText);
      countdownContainer.addChild(teamNameContainer);
      
      // Mystery card silhouette
      const mysteryCard = new PIXI.Graphics();
      mysteryCard.beginFill(0x111111, 0.9);
      mysteryCard.lineStyle(4, this.selectedBall.color, 1);
      mysteryCard.drawRoundedRect(-120, -150, 240, 300, 15);
      mysteryCard.endFill();
      
      // Question mark
      const questionText = new PIXI.Text("?", {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontSize: 120,
        fill: this.selectedBall.color,
        align: 'center',
        stroke: '#000000',
        strokeThickness: 6
      });
      questionText.anchor.set(0.5);
      questionText.position.set(0, 0);
      
      // Card shimmer effect
      const shimmer = new PIXI.Graphics();
      shimmer.beginFill(0xffffff, 0.3);
      shimmer.drawRect(-120, -150, 20, 300);
      shimmer.endFill();
      
      // Mystery card container
      const cardContainer = new PIXI.Container();
      cardContainer.position.set(0, 0);
      cardContainer.addChild(mysteryCard);
      cardContainer.addChild(questionText);
      cardContainer.addChild(shimmer);
      
      // Animate shimmer
      const animateShimmer = (delta: number) => {
        shimmer.x += 2;
        if (shimmer.x > 120) {
          shimmer.x = -120;
        }
      };
      app.ticker.add(animateShimmer);
      
      // Add pulse effect to the card
      const pulseCard = (delta: number) => {
        cardContainer.scale.set(1 + Math.sin(Date.now() * 0.002) * 0.05);
      };
      app.ticker.add(pulseCard);
      
      countdownContainer.addChild(cardContainer);
      
      // Mystery text with more exciting description
      const mysteryText = new PIXI.Text("Your special abilities will be revealed soon!", {
        fontFamily: 'Arial',
        fontSize: 24,
        fill: 0xFFFFFF,
        align: 'center',
        stroke: '#000000',
        strokeThickness: 2
      });
      mysteryText.anchor.set(0.5);
      mysteryText.position.set(0, 180);
      countdownContainer.addChild(mysteryText);
      
      // Add decorative stars around the card
      this.addDecorativeStars(cardContainer, this.selectedBall.color);
    }
    
    // Countdown text
    const countdownText = new PIXI.Text("READY TO BATTLE", {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 64,
      fill: 0xFF0000,
      align: 'center',
      stroke: '#FFFFFF',
      strokeThickness: 6
    });
    countdownText.anchor.set(0.5);
    countdownText.position.set(0, 250);
    countdownContainer.addChild(countdownText);
    
    // Animate the "READY TO BATTLE" text
    const animateCountdown = (delta: number) => {
      countdownText.scale.set(1 + Math.sin(Date.now() * 0.01) * 0.1);
      
      // Alternate colors for more impact
      const hue = (Date.now() * 0.1) % 360;
      countdownText.style.fill = PIXI.utils.rgb2hex([
        0.8 + Math.sin(Date.now() * 0.01) * 0.2, 
        0.2 + Math.sin(Date.now() * 0.005 + 1) * 0.2, 
        0.2 + Math.sin(Date.now() * 0.003 + 2) * 0.2
      ]);
    };
    
    app.ticker.add(animateCountdown);
    
    this.container.addChild(countdownContainer);
    
    // Animate in
    countdownContainer.alpha = 0;
    
    const animateIn = (delta: number) => {
      countdownContainer.alpha += 0.05;
      
      if (countdownContainer.alpha >= 1) {
        app.ticker.remove(animateIn);
      }
    };
    
    app.ticker.add(animateIn);
  }
  
  private addDecorativeStars(container: PIXI.Container, color: number): void {
    const app = this.game.getApp();
    
    // Create several stars around the card
    for (let i = 0; i < 8; i++) {
      const star = new PIXI.Graphics();
      const angle = (i / 8) * Math.PI * 2;
      const distance = 180 + Math.random() * 40;
      
      // Position around the card
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      
      // Different sized stars
      const size = 4 + Math.random() * 8;
      
      // Draw star
      star.beginFill(color, 0.7);
      this.drawStar(star, 0, 0, 5, size, size/2);
      star.endFill();
      
      star.position.set(x, y);
      
      // Add animation
      const speed = 0.02 + Math.random() * 0.03;
      const rotationSpeed = 0.01 + Math.random() * 0.03;
      const originalScale = 0.5 + Math.random() * 0.5;
      star.scale.set(originalScale);
      
      const animateStar = (delta: number) => {
        // Rotate star
        star.rotation += rotationSpeed * delta;
        
        // Pulse size
        const pulseFactor = Math.sin(Date.now() * speed) * 0.3;
        star.scale.set(originalScale * (1 + pulseFactor));
      };
      
      app.ticker.add(animateStar);
      container.addChild(star);
    }
  }
  
  private simulatePlayersJoiningAfterSelection(): void {
    // Clear existing interval
    if (this.playerJoinInterval) {
      clearInterval(this.playerJoinInterval);
      this.playerJoinInterval = null;
    }
    
    // Generate random player counts
    const emmaPlayers = 3 + Math.floor(Math.random() * 7); // 3-9 players
    const mattPlayers = 3 + Math.floor(Math.random() * 7); // 3-9 players
    
    // Stagger the joining - first team after 3 seconds
    setTimeout(() => {
      if (this.ballOptions[0].name !== this.selectedBall?.name) {
        this.ballOptions[0].targetPlayerCount += emmaPlayers;
        this.targetTotalPlayerCount += emmaPlayers;
        this.showPlayerJoinNotification(emmaPlayers, this.ballOptions[0].name);
      }
    }, 3000);
    
    // Second team after 7 seconds
    setTimeout(() => {
      if (this.ballOptions[1].name !== this.selectedBall?.name) {
        this.ballOptions[1].targetPlayerCount += mattPlayers;
        this.targetTotalPlayerCount += mattPlayers;
        this.showPlayerJoinNotification(mattPlayers, this.ballOptions[1].name);
      }
    }, 7000);
  }

  public update(delta: number): void {
    // Animation updates are handled by PIXI ticker
  }

  public destroy(): void {
    const app = this.game.getApp();
    
    // Clear any ongoing intervals
    if (this.playerJoinInterval) {
      clearInterval(this.playerJoinInterval);
      this.playerJoinInterval = null;
    }
    
    // Clean up background ticker if exists
    const background = this.container.getChildAt(0) as BackgroundContainer;
    if (background && background.userData) {
      app.ticker.remove(background.userData);
    }
    
    // Clean up all interactive elements
    this.balls.forEach(ball => {
      const ballGraphic = ball.graphic.getChildAt(1) as PIXI.Graphics;
      ballGraphic.eventMode = 'none';
      ballGraphic.off('pointerover');
      ballGraphic.off('pointerout');
      ballGraphic.off('pointerdown');
      this.stopPulseEffect(ballGraphic);
    });
    
    this.container.removeChildren();
  }

  private createBackground(app: PIXI.Application): void {
    // Create dark gradient background
    const background = new PIXI.Container() as BackgroundContainer;
    
    // Radial gradient
    const gradientTexture = this.createGradientTexture(
      0x000B27, // Dark blue center
      0x000000, // Black edges
      app.screen.width,
      app.screen.height
    );
    
    const bgGraphic = new PIXI.Graphics();
    bgGraphic.beginTextureFill({texture: gradientTexture});
    bgGraphic.drawRect(0, 0, app.screen.width, app.screen.height);
    bgGraphic.endFill();
    background.addChild(bgGraphic);
    
    // Add some particle effects
    for (let i = 0; i < 80; i++) {
      const particle = new PIXI.Graphics() as AnimatedParticle;
      const size = 1 + Math.random() * 3;
      const alpha = 0.2 + Math.random() * 0.5;
      
      particle.beginFill(0xffffff, alpha);
      particle.drawCircle(0, 0, size);
      particle.endFill();
      
      particle.x = Math.random() * app.screen.width;
      particle.y = Math.random() * app.screen.height;
      
      // Add animation data as properties
      particle.vx = (Math.random() - 0.5) * 0.5;
      particle.vy = (Math.random() - 0.5) * 0.5;
      
      background.addChild(particle);
    }
    
    // Animate particles
    const ticker = (delta: number) => {
      for (let i = 1; i < background.children.length; i++) {
        const particle = background.children[i] as AnimatedParticle;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        
        // Wrap around screen edges
        if (particle.x < 0) particle.x = app.screen.width;
        if (particle.x > app.screen.width) particle.x = 0;
        if (particle.y < 0) particle.y = app.screen.height;
        if (particle.y > app.screen.height) particle.y = 0;
      }
    };
    
    // Store ticker for cleanup
    background.userData = ticker;
    app.ticker.add(ticker);
    
    // Add grid lines for a tech feel
    this.addGridLines(background, app.screen.width, app.screen.height);
    
    this.container.addChild(background);
  }
  
  private addGridLines(container: PIXI.Container, width: number, height: number): void {
    const gridGraphic = new PIXI.Graphics();
    gridGraphic.lineStyle(1, 0x3333ff, 0.2);
    
    // Horizontal lines
    for (let y = 0; y < height; y += 40) {
      gridGraphic.moveTo(0, y);
      gridGraphic.lineTo(width, y);
    }
    
    // Vertical lines
    for (let x = 0; x < width; x += 40) {
      gridGraphic.moveTo(x, 0);
      gridGraphic.lineTo(x, height);
    }
    
    container.addChild(gridGraphic);
  }
  
  private createGradientTexture(colorFrom: number, colorTo: number, width: number, height: number): PIXI.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Create radial gradient
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.max(width, height);
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      
      // Add color stops
      const fromColor = PIXI.utils.hex2string(colorFrom);
      const toColor = PIXI.utils.hex2string(colorTo);
      gradient.addColorStop(0, fromColor);
      gradient.addColorStop(1, toColor);
      
      // Fill with gradient
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
    
    return PIXI.Texture.from(canvas);
  }
} 