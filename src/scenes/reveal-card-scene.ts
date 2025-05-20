import * as PIXI from 'pixi.js';
import { Scene } from '../types';
import { Game } from '../game';
import { GameScene } from './game-scene';

// Types
interface BallData {
  name: string;
  color: number;
  stats: {
    hardness: number;
    bounce: number;
  };
  playerCount?: number;
  material?: {
    name: string;
    color: number;
  };
  featureCard?: {
    name: string;
    color: number;
    speedBoost: number;
    durationMs: number;
    description?: string;
  };
}

// Material card data
interface MaterialCard {
  name: string;
  color: number;
  hardness: number;
  bounce: number;
}

export class RevealCardScene implements Scene {
  public container: PIXI.Container;
  private game: Game;
  private selectedBall: BallData;
  private opponentBall: BallData;
  private cardContainer: PIXI.Container;
  private countdownContainer: PIXI.Container;
  private countdownText: PIXI.Text;
  private countdownValue: number = 3; // 3 second countdown
  private countdownInterval: NodeJS.Timeout | null = null;
  
  // Two cards, one for each team
  private selectedTeamCard: MaterialCard | null = null;
  private opponentTeamCard: MaterialCard | null = null;
  
  // Track which card is currently being revealed
  private currentRevealStep: number = 0; // 0: first material card, 1: second material card, 2: first feature card, 3: second feature card, 4: completed
  
  // Available material cards
  private materialCards: MaterialCard[] = [
    { name: "Wood", color: 0x8B4513, hardness: 40, bounce: 60 },
    { name: "Iron", color: 0x71797E, hardness: 85, bounce: 30 },
    { name: "Aluminum", color: 0xD3D3D3, hardness: 65, bounce: 55 },
    { name: "Crystal", color: 0x89CFF0, hardness: 95, bounce: 20 },
    { name: "Granite", color: 0x808080, hardness: 90, bounce: 25 },
    { name: "Marble", color: 0xF5F5F5, hardness: 75, bounce: 35 },
    { name: "Rubber", color: 0x000000, hardness: 30, bounce: 90 }
  ];

  constructor(game: Game, selectedBall: BallData, opponentBall: BallData) {
    this.game = game;
    this.container = new PIXI.Container();
    this.selectedBall = selectedBall;
    this.opponentBall = opponentBall;
    
    // Set default player counts if not provided
    if (this.selectedBall.playerCount === undefined) {
      this.selectedBall.playerCount = 1;
    }
    
    if (this.opponentBall.playerCount === undefined) {
      this.opponentBall.playerCount = 0;
    }
    
    this.cardContainer = new PIXI.Container();
    this.countdownContainer = new PIXI.Container();
    this.countdownText = new PIXI.Text("", {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 36,
      fill: 0xFFCC00,
      align: 'center',
      stroke: '#000000',
      strokeThickness: 4
    });
  }

  public init(): void {
    const app = this.game.getApp();
    
    // Create gaming style background
    this.createBackground(app);
    
    // Create header with VS display
    this.createVsHeader(app);
    
    // Create the card reveal area
    this.createCardRevealArea(app);
    
    // Create countdown display (hidden initially)
    this.createCountdownDisplay(app);
    
    // Start with card hidden, ready for reveal animation
    this.startCardRevealSequence();
  }
  
  private createBackground(app: PIXI.Application): void {
    // Dark gradient background (similar to ball-selection-scene)
    const background = new PIXI.Container();
    
    // Create radial gradient
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
    
    // Add some animated particles
    for (let i = 0; i < 80; i++) {
      const particle = new PIXI.Graphics();
      const size = 1 + Math.random() * 3;
      const alpha = 0.2 + Math.random() * 0.5;
      
      particle.beginFill(0xffffff, alpha);
      particle.drawCircle(0, 0, size);
      particle.endFill();
      
      particle.x = Math.random() * app.screen.width;
      particle.y = Math.random() * app.screen.height;
      
      // Add animation data as properties
      (particle as any).vx = (Math.random() - 0.5) * 0.5;
      (particle as any).vy = (Math.random() - 0.5) * 0.5;
      
      background.addChild(particle);
    }
    
    // Animate particles
    const ticker = (delta: number) => {
      for (let i = 1; i < background.children.length; i++) {
        const particle = background.children[i] as any;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        
        // Wrap around screen edges
        if (particle.x < 0) particle.x = app.screen.width;
        if (particle.x > app.screen.width) particle.x = 0;
        if (particle.y < 0) particle.y = app.screen.height;
        if (particle.y > app.screen.height) particle.y = 0;
      }
    };
    
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
  
  private createVsHeader(app: PIXI.Application): void {
    const headerContainer = new PIXI.Container();
    headerContainer.position.set(app.screen.width / 2, 80);
    
    // Title with gaming style
    const title = new PIXI.Text('FEATURE CARD REVEAL', {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 48,
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
    title.anchor.set(0.5);
    headerContainer.addChild(title);
    
    // VS display container
    const vsContainer = new PIXI.Container();
    vsContainer.position.set(0, 80);
    
    // Left ball (selected)
    const leftBallInfo = this.createTeamDisplay(
      this.selectedBall.name,
      this.selectedBall.color,
      this.selectedBall.playerCount,
      -200
    );
    
    // Right ball (opponent)
    const rightBallInfo = this.createTeamDisplay(
      this.opponentBall.name,
      this.opponentBall.color,
      this.opponentBall.playerCount,
      200
    );
    
    // VS text
    const vsText = new PIXI.Text('VS', {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 60,
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
    vsText.anchor.set(0.5);
    
    vsContainer.addChild(leftBallInfo);
    vsContainer.addChild(rightBallInfo);
    vsContainer.addChild(vsText);
    
    headerContainer.addChild(vsContainer);
    this.container.addChild(headerContainer);
  }
  
  private createTeamDisplay(name: string, color: number, playerCount: number | undefined, xPos: number): PIXI.Container {
    const teamContainer = new PIXI.Container();
    teamContainer.position.set(xPos, 0);
    
    // Ensure playerCount is a number
    const displayPlayerCount = playerCount || 0;
    
    // Background with team color
    const bgCircle = new PIXI.Graphics();
    bgCircle.beginFill(color, 0.3);
    bgCircle.drawCircle(0, 0, 60);
    bgCircle.endFill();
    
    // Add glow effect using multiple circles
    for (let i = 0; i < 3; i++) {
      const glow = new PIXI.Graphics();
      const radius = 55 - i * 5;
      const alpha = 0.2 - i * 0.05;
      glow.beginFill(color, alpha);
      glow.drawCircle(0, 0, radius);
      glow.endFill();
      bgCircle.addChild(glow);
    }
    
    // Team name text
    const nameText = new PIXI.Text(name, {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 28,
      fill: 0xffffff,
      align: 'center',
      stroke: color,
      strokeThickness: 3
    });
    nameText.anchor.set(0.5);
    nameText.position.set(0, -80);
    
    // Player count
    const countContainer = new PIXI.Container();
    countContainer.position.set(0, 40);
    
    const countBg = new PIXI.Graphics();
    countBg.beginFill(0x000000, 0.6);
    countBg.lineStyle(2, color, 0.8);
    countBg.drawRoundedRect(-80, -15, 160, 30, 8);
    countBg.endFill();
    
    const countText = new PIXI.Text(`PLAYERS: ${displayPlayerCount}`, {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 18,
      fill: 0xffffff,
      align: 'center',
      stroke: '#000000',
      strokeThickness: 2
    });
    countText.anchor.set(0.5);
    
    countContainer.addChild(countBg);
    countContainer.addChild(countText);
    
    teamContainer.addChild(bgCircle);
    teamContainer.addChild(nameText);
    teamContainer.addChild(countContainer);
    
    return teamContainer;
  }
  
  private createCardRevealArea(app: PIXI.Application): void {
    // Card reveal container
    this.cardContainer = new PIXI.Container();
    this.cardContainer.position.set(app.screen.width / 2, app.screen.height / 2 + 60);
    
    // Platform/stage for the cards - make it wider to accommodate two cards
    const platform = new PIXI.Graphics();
    platform.beginFill(0x333333, 0.7);
    platform.drawRoundedRect(-350, -20, 700, 40, 10);
    platform.endFill();
    
    // Add glow to platform
    const platformGlow = new PIXI.Graphics();
    platformGlow.beginFill(0x4477ff, 0.2);
    platformGlow.drawRoundedRect(-360, -30, 720, 60, 10);
    platformGlow.endFill();
    
    // Instruction text
    const instructionText = new PIXI.Text('REVEALING TEAM FEATURE CARDS...', {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 24,
      fill: 0xffcc00,
      align: 'center',
      stroke: '#000000',
      strokeThickness: 3
    });
    instructionText.anchor.set(0.5);
    instructionText.position.set(0, -150);
    
    this.cardContainer.addChild(platformGlow);
    this.cardContainer.addChild(platform);
    this.cardContainer.addChild(instructionText);
    
    this.container.addChild(this.cardContainer);
  }
  
  private createCountdownDisplay(app: PIXI.Application): void {
    this.countdownContainer.position.set(app.screen.width / 2, app.screen.height - 70);
    
    // Background
    const bg = new PIXI.Graphics();
    bg.beginFill(0x000000, 0.7);
    bg.lineStyle(3, 0xFFCC00, 0.9);
    bg.drawRoundedRect(-100, -25, 200, 50, 10);
    bg.endFill();
    
    // Position countdown text
    this.countdownText.anchor.set(0.5);
    this.countdownText.text = `BATTLE IN: ${this.countdownValue}`;
    
    this.countdownContainer.addChild(bg);
    this.countdownContainer.addChild(this.countdownText);
    this.countdownContainer.alpha = 0; // Hidden initially
    
    this.container.addChild(this.countdownContainer);
  }
  
  private startCardRevealSequence(): void {
    const app = this.game.getApp();
    
    // Check if feature cards need to be assigned
    if (!this.selectedBall.material) {
      // Select random material cards for both teams
      this.selectedTeamCard = this.materialCards[Math.floor(Math.random() * this.materialCards.length)];
      // Make sure opponent gets a different card
      let opponentCardIndex;
      do {
        opponentCardIndex = Math.floor(Math.random() * this.materialCards.length);
      } while (this.materialCards[opponentCardIndex].name === this.selectedTeamCard.name);
      this.opponentTeamCard = this.materialCards[opponentCardIndex];
    } else {
      // Use existing materials
      this.selectedTeamCard = {
        name: this.selectedBall.material.name,
        color: this.selectedBall.material.color,
        hardness: this.selectedBall.stats.hardness,
        bounce: this.selectedBall.stats.bounce
      };
      
      this.opponentTeamCard = {
        name: this.opponentBall.material!.name,
        color: this.opponentBall.material!.color,
        hardness: this.opponentBall.stats.hardness,
        bounce: this.opponentBall.stats.bounce
      };
    }
    
    // Start revealing the first card (selected team's material card)
    setTimeout(() => {
      this.revealNextCard();
    }, 1000);
  }

  private revealNextCard(): void {
    const app = this.game.getApp();
    
    // Content to reveal based on current step
    let xPos = 0;
    let team: BallData = this.selectedBall; // Default to avoid undefined
    let cardType: string = "";
    let card: any = null;
    
    if (this.currentRevealStep === 0) {
      // First material card (selected team)
      xPos = -170;
      team = this.selectedBall;
      cardType = "MATERIAL";
      card = this.selectedTeamCard;
    } else if (this.currentRevealStep === 1) {
      // Second material card (opponent team)
      xPos = 170;
      team = this.opponentBall;
      cardType = "MATERIAL";
      card = this.opponentTeamCard;
    } else if (this.currentRevealStep === 2) {
      // First feature card (selected team)
      xPos = -170;
      team = this.selectedBall;
      cardType = "FEATURE";
      card = team.featureCard;
    } else if (this.currentRevealStep === 3) {
      // Second feature card (opponent team)
      xPos = 170;
      team = this.opponentBall;
      cardType = "FEATURE";
      card = team.featureCard;
    }
    
    // Only proceed if we have a valid card to reveal
    if (card) {
      // Create card back
      const cardBack = this.createCardBack(team.color);
      cardBack.position.set(xPos, 0);
      
      // Add userData property for custom data
      (cardBack as any).userData = { cardType }; 
      this.cardContainer.addChild(cardBack);
      
      // Animation to bring card in
      let elapsed = 0;
      cardBack.y = -600; // Start above screen
      
      const bringCardIn = (delta: number) => {
        elapsed += delta;
        
        if (elapsed < 60) {
          const progress = Math.min(1, elapsed / 60);
          // Ease-out function
          const easeOut = 1 - Math.pow(1 - progress, 3);
          cardBack.y = -600 + (easeOut * 600);
          
          // Add some bounce at the end
          if (progress > 0.9) {
            const bounce = Math.sin((progress - 0.9) * 10 * Math.PI) * 10 * (1 - (progress - 0.9) * 10);
            cardBack.y += bounce;
          }
        } else {
          app.ticker.remove(bringCardIn);
          
          // After card arrives, start flipping animation
          setTimeout(() => {
            this.flipCardAnimation(cardBack, card, team);
          }, 500);
        }
      };
      
      app.ticker.add(bringCardIn);
    } else {
      // If we don't have more cards to reveal, show countdown
      this.showCompletionMessage();
    }
  }
  
  // Create card back with cardType parameter to create different card designs
  private createCardBack(teamColor: number): PIXI.Container {
    const card = new PIXI.Container();
    
    // Add userData for custom properties
    (card as any).userData = { cardType: "unknown" };
    
    // Card back with gaming style
    const cardGraphic = new PIXI.Graphics();
    cardGraphic.lineStyle(5, 0xffcc00, 1);
    cardGraphic.beginFill(0x222266);
    cardGraphic.drawRoundedRect(-100, -150, 200, 300, 10);
    cardGraphic.endFill();
    
    // Pattern on card back
    const pattern = new PIXI.Graphics();
    pattern.lineStyle(2, 0x4477ff, 0.6);
    
    // Grid pattern
    for (let x = -80; x <= 80; x += 40) {
      pattern.moveTo(x, -130);
      pattern.lineTo(x, 130);
    }
    
    for (let y = -130; y <= 130; y += 40) {
      pattern.moveTo(-80, y);
      pattern.lineTo(80, y);
    }
    
    // Decorative center logo with team color
    const logo = new PIXI.Graphics();
    logo.beginFill(teamColor, 0.9);
    logo.drawCircle(0, 0, 30);
    logo.endFill();
    
    // Create star shape manually instead of using drawStar
    const logoInner = new PIXI.Graphics();
    logoInner.beginFill(0x222266);
    this.drawStarShape(logoInner, 0, 0, 6, 30, 15);
    logoInner.endFill();
    
    logo.addChild(logoInner);
    
    card.addChild(cardGraphic);
    card.addChild(pattern);
    card.addChild(logo);
    
    return card;
  }
  
  // Flip card animation with different card types
  private flipCardAnimation(cardBack: PIXI.Container, cardData: any, team: BallData): void {
    const app = this.game.getApp();
    const cardType = (cardBack as any).userData?.cardType || "MATERIAL";
    
    // Create the front of the card based on card type
    let cardFront: PIXI.Container;
    
    if (cardType === "MATERIAL") {
      cardFront = this.createMaterialCardFront(cardData, team);
    } else {
      cardFront = this.createFeatureCardFront(cardData, team);
    }
    
    cardFront.visible = false;
    cardFront.position.copyFrom(cardBack.position);
    this.cardContainer.addChild(cardFront);
    
    let elapsed = 0;
    let halfwayPoint = false;
    
    const flipCard = (delta: number) => {
      elapsed += delta;
      
      if (elapsed < 30) {
        // First half of flip animation - card back gets thinner
        const progress = elapsed / 30;
        cardBack.scale.x = 1 - progress;
        
        // Add some up-down motion
        cardBack.y = Math.sin(progress * Math.PI) * 20;
      } 
      else if (!halfwayPoint) {
        // At halfway point, switch from back to front
        halfwayPoint = true;
        cardBack.visible = false;
        cardFront.visible = true;
        cardFront.scale.x = 0;
      } 
      else if (elapsed < 60) {
        // Second half of flip animation - card front gets wider
        const progress = (elapsed - 30) / 30;
        cardFront.scale.x = progress;
        
        // Continue up-down motion
        cardFront.y = Math.sin((progress + 1) * Math.PI) * 20;
      } 
      else {
        // Flip complete
        app.ticker.remove(flipCard);
        cardFront.scale.x = 1;
        cardFront.y = 0;
        
        // Move to next card or show completion
        this.currentRevealStep++;
        
        if (this.currentRevealStep < 4) {
          // Reveal next card after a delay
          setTimeout(() => {
            this.revealNextCard();
          }, 1000);
        } else {
          // All cards revealed, show completion message
          this.showCompletionMessage();
        }
      }
    };
    
    app.ticker.add(flipCard);
  }
  
  // Create material card front
  private createMaterialCardFront(material: MaterialCard, team: BallData): PIXI.Container {
    const card = new PIXI.Container();
    
    // Card front with material color
    const cardGraphic = new PIXI.Graphics();
    cardGraphic.lineStyle(5, 0xffcc00, 1);
    cardGraphic.beginFill(0xffffff);
    cardGraphic.drawRoundedRect(-100, -150, 200, 300, 10);
    cardGraphic.endFill();
    
    // Add "MATERIAL CARD" header
    const cardTypeText = new PIXI.Text("MATERIAL CARD", {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 16,
      fill: 0x333333,
      align: 'center'
    });
    cardTypeText.anchor.set(0.5);
    cardTypeText.position.set(0, -130);
    
    // Team indicator at the top
    const teamBanner = new PIXI.Graphics();
    teamBanner.beginFill(team.color, 0.8);
    teamBanner.drawRoundedRect(-90, -110, 180, 30, 5);
    teamBanner.endFill();
    
    const teamText = new PIXI.Text(team.name, {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 18,
      fill: 0xffffff,
      align: 'center',
      stroke: '#000000',
      strokeThickness: 2
    });
    teamText.anchor.set(0.5);
    teamText.position.set(0, -95);
    
    // Material name
    const nameText = new PIXI.Text(material.name, {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 36,
      fill: material.color,
      align: 'center',
      stroke: '#000000',
      strokeThickness: 4
    });
    nameText.anchor.set(0.5);
    nameText.position.set(0, -50);
    
    // Material icon/representation
    const materialIcon = new PIXI.Graphics();
    materialIcon.beginFill(material.color);
    if (material.name === "Crystal") {
      // Diamond shape for crystal
      this.drawDiamond(materialIcon, 0, 0, 60);
    } else if (material.name === "Rubber") {
      // Bouncy shape for rubber
      this.drawBouncyBall(materialIcon, 0, 0, 50);
    } else {
      // Default circle for other materials
      materialIcon.drawCircle(0, 0, 50);
    }
    materialIcon.endFill();
    
    // Add shading/highlight
    const highlight = new PIXI.Graphics();
    highlight.beginFill(0xffffff, 0.3);
    highlight.drawCircle(-20, -20, 20);
    highlight.endFill();
    materialIcon.addChild(highlight);
    
    // Stats display
    const statsContainer = new PIXI.Container();
    statsContainer.position.set(0, 80);
    
    // Hardness stat
    const hardnessLabel = new PIXI.Text("Hardness:", {
      fontFamily: 'Arial',
      fontSize: 16,
      fill: 0x333333,
      align: 'left'
    });
    hardnessLabel.anchor.set(1, 0.5);
    hardnessLabel.position.set(-10, -15);
    
    const hardnessValue = new PIXI.Text(material.hardness.toString(), {
      fontFamily: 'Arial',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0x333333,
      align: 'left'
    });
    hardnessValue.anchor.set(0, 0.5);
    hardnessValue.position.set(10, -15);
    
    // Bounce stat
    const bounceLabel = new PIXI.Text("Bounce:", {
      fontFamily: 'Arial',
      fontSize: 16,
      fill: 0x333333,
      align: 'left'
    });
    bounceLabel.anchor.set(1, 0.5);
    bounceLabel.position.set(-10, 15);
    
    const bounceValue = new PIXI.Text(material.bounce.toString(), {
      fontFamily: 'Arial',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0x333333,
      align: 'left'
    });
    bounceValue.anchor.set(0, 0.5);
    bounceValue.position.set(10, 15);
    
    statsContainer.addChild(hardnessLabel);
    statsContainer.addChild(hardnessValue);
    statsContainer.addChild(bounceLabel);
    statsContainer.addChild(bounceValue);
    
    card.addChild(cardGraphic);
    card.addChild(cardTypeText);
    card.addChild(teamBanner);
    card.addChild(teamText);
    card.addChild(nameText);
    card.addChild(materialIcon);
    card.addChild(statsContainer);
    
    return card;
  }
  
  // Create feature card front
  private createFeatureCardFront(feature: any, team: BallData): PIXI.Container {
    const card = new PIXI.Container();
    
    if (!feature) {
      // If no feature card, create a placeholder
      const placeholderCard = new PIXI.Graphics();
      placeholderCard.lineStyle(5, 0xffcc00, 1);
      placeholderCard.beginFill(0x333333);
      placeholderCard.drawRoundedRect(-100, -150, 200, 300, 10);
      placeholderCard.endFill();
      
      const noCardText = new PIXI.Text("NO FEATURE CARD", {
        fontFamily: 'Impact, Arial Black, sans-serif',
        fontSize: 24,
        fill: 0xffffff,
        align: 'center',
        stroke: '#000000',
        strokeThickness: 3
      });
      noCardText.anchor.set(0.5);
      
      card.addChild(placeholderCard);
      card.addChild(noCardText);
      return card;
    }
    
    // Card front with feature color
    const cardGraphic = new PIXI.Graphics();
    cardGraphic.lineStyle(5, 0xffcc00, 1);
    cardGraphic.beginFill(0x111111);
    cardGraphic.drawRoundedRect(-100, -150, 200, 300, 10);
    cardGraphic.endFill();
    
    // Add "FEATURE CARD" header
    const cardTypeText = new PIXI.Text("FEATURE CARD", {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 16,
      fill: 0xffffff,
      align: 'center'
    });
    cardTypeText.anchor.set(0.5);
    cardTypeText.position.set(0, -130);
    
    // Team indicator at the top
    const teamBanner = new PIXI.Graphics();
    teamBanner.beginFill(team.color, 0.8);
    teamBanner.drawRoundedRect(-90, -110, 180, 30, 5);
    teamBanner.endFill();
    
    const teamText = new PIXI.Text(team.name, {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 18,
      fill: 0xffffff,
      align: 'center',
      stroke: '#000000',
      strokeThickness: 2
    });
    teamText.anchor.set(0.5);
    teamText.position.set(0, -95);
    
    // Feature name
    const nameText = new PIXI.Text(feature.name, {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 30,
      fill: feature.color,
      align: 'center',
      stroke: '#000000',
      strokeThickness: 4
    });
    nameText.anchor.set(0.5);
    nameText.position.set(0, -50);
    
    // Feature icon/effect
    const featureEffect = new PIXI.Container();
    featureEffect.position.set(0, 0);
    
    // Create effect based on card type
    switch (feature.name) {
      case "Speed Burst":
        // Create flame-like effect
        const flames = new PIXI.Graphics();
        flames.beginFill(feature.color, 0.8);
        
        // Create flame shape
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const length = 35 + Math.random() * 10;
          flames.moveTo(0, 0);
          flames.lineTo(
            Math.cos(angle) * length,
            Math.sin(angle) * length
          );
        }
        
        flames.endFill();
        featureEffect.addChild(flames);
        break;
        
      case "Power Strike":
        // Create lightning effect
        const lightning = new PIXI.Graphics();
        lightning.lineStyle(5, feature.color, 0.9);
        
        // Draw lightning bolt
        lightning.moveTo(-30, -30);
        lightning.lineTo(-10, 0);
        lightning.lineTo(-25, 10);
        lightning.lineTo(0, 35);
        
        // Draw second bolt
        lightning.moveTo(30, -30);
        lightning.lineTo(10, 0);
        lightning.lineTo(25, 10);
        lightning.lineTo(0, 35);
        
        featureEffect.addChild(lightning);
        break;
        
      default:
        // Default glow effect
        const glow = new PIXI.Graphics();
        glow.beginFill(feature.color, 0.4);
        glow.drawCircle(0, 0, 40);
        glow.endFill();
        featureEffect.addChild(glow);
    }
    
    // Animate the feature effect
    const animateEffect = (delta: number) => {
      featureEffect.rotation += 0.01 * delta;
    };
    
    this.game.getApp().ticker.add(animateEffect);
    
    // Feature stats
    const statsContainer = new PIXI.Container();
    statsContainer.position.set(0, 80);
    
    // Speed boost stat
    const speedLabel = new PIXI.Text("Speed Boost:", {
      fontFamily: 'Arial',
      fontSize: 16,
      fill: 0xffffff,
      align: 'left'
    });
    speedLabel.anchor.set(1, 0.5);
    speedLabel.position.set(-5, -15);
    
    const speedValue = new PIXI.Text(`${Math.round((feature.speedBoost - 1) * 100)}%`, {
      fontFamily: 'Arial',
      fontSize: 18,
      fontWeight: 'bold',
      fill: feature.color,
      align: 'left'
    });
    speedValue.anchor.set(0, 0.5);
    speedValue.position.set(5, -15);
    
    // Duration stat
    const durationLabel = new PIXI.Text("Duration:", {
      fontFamily: 'Arial',
      fontSize: 16,
      fill: 0xffffff,
      align: 'left'
    });
    durationLabel.anchor.set(1, 0.5);
    durationLabel.position.set(-5, 15);
    
    const durationValue = new PIXI.Text(`${feature.durationMs / 1000}s`, {
      fontFamily: 'Arial',
      fontSize: 18,
      fontWeight: 'bold',
      fill: feature.color,
      align: 'left'
    });
    durationValue.anchor.set(0, 0.5);
    durationValue.position.set(5, 15);
    
    statsContainer.addChild(speedLabel);
    statsContainer.addChild(speedValue);
    statsContainer.addChild(durationLabel);
    statsContainer.addChild(durationValue);
    
    // Description
    if (feature.description) {
      const descriptionText = new PIXI.Text(feature.description, {
        fontFamily: 'Arial',
        fontSize: 12,
        fill: 0xdddddd,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: 180
      });
      descriptionText.anchor.set(0.5, 0);
      descriptionText.position.set(0, 120);
      
      card.addChild(descriptionText);
    }
    
    card.addChild(cardGraphic);
    card.addChild(cardTypeText);
    card.addChild(teamBanner);
    card.addChild(teamText);
    card.addChild(nameText);
    card.addChild(featureEffect);
    card.addChild(statsContainer);
    
    return card;
  }
  
  // Manual implementation of drawStar since it's not available in PIXI.Graphics
  private drawStarShape(graphics: PIXI.Graphics, x: number, y: number, points: number, outerRadius: number, innerRadius: number): void {
    // Start at the top point
    graphics.moveTo(x, y - outerRadius);
    
    // Draw the star points
    for (let i = 0; i < points * 2; i++) {
      // Use outer or inner radius based on whether i is odd or even
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      // Calculate the angle (starting from the top, moving clockwise)
      const angle = (Math.PI * 2 * i) / (points * 2) - Math.PI / 2;
      
      // Calculate point coordinates
      const pointX = x + radius * Math.cos(angle);
      const pointY = y + radius * Math.sin(angle);
      
      // Draw line to the point
      graphics.lineTo(pointX, pointY);
    }
    
    // Close the shape by returning to the first point
    graphics.lineTo(x, y - outerRadius);
  }
  
  private drawDiamond(graphics: PIXI.Graphics, x: number, y: number, size: number): void {
    graphics.moveTo(x, y - size);
    graphics.lineTo(x + size, y);
    graphics.lineTo(x, y + size);
    graphics.lineTo(x - size, y);
    graphics.lineTo(x, y - size);
  }
  
  private drawBouncyBall(graphics: PIXI.Graphics, x: number, y: number, radius: number): void {
    graphics.drawCircle(x, y, radius);
    
    // Add some bounce lines
    graphics.lineStyle(3, 0xffffff, 0.5);
    graphics.moveTo(x - radius * 0.7, y - radius * 0.7);
    graphics.lineTo(x + radius * 0.7, y + radius * 0.7);
    
    graphics.moveTo(x + radius * 0.7, y - radius * 0.7);
    graphics.lineTo(x - radius * 0.7, y + radius * 0.7);
  }
  
  private showCompletionMessage(): void {
    const app = this.game.getApp();
    
    // Create container for the message
    const messageContainer = new PIXI.Container();
    messageContainer.position.set(app.screen.width / 2, app.screen.height - 180);
    
    // Background
    const msgBg = new PIXI.Graphics();
    msgBg.beginFill(0x000000, 0.7);
    msgBg.lineStyle(3, 0x00ff00, 0.9);
    msgBg.drawRoundedRect(-200, -30, 400, 60, 15);
    msgBg.endFill();
    
    // Message
    const message = new PIXI.Text('CARDS REVEALED!', {
      fontFamily: 'Impact, Arial Black, sans-serif',
      fontSize: 36,
      fill: 0xffffff,
      align: 'center',
      stroke: 0x00ff00,
      strokeThickness: 3
    });
    message.anchor.set(0.5, 0.5);
    
    messageContainer.addChild(msgBg);
    messageContainer.addChild(message);
    
    this.container.addChild(messageContainer);
    
    // Animation
    messageContainer.alpha = 0;
    messageContainer.scale.set(0.8);
    
    let elapsed = 0;
    const animateMessage = (delta: number) => {
      elapsed += delta;
      
      if (elapsed < 15) {
        const progress = elapsed / 15;
        messageContainer.alpha = progress;
        messageContainer.scale.set(0.8 + (progress * 0.2));
      } else {
        app.ticker.remove(animateMessage);
        
        // Show countdown timer
        this.startCountdown();
      }
    };
    
    app.ticker.add(animateMessage);
  }
  
  private startCountdown(): void {
    // Show countdown
    this.countdownContainer.alpha = 0;
    
    // Animate countdown appearing
    let elapsed = 0;
    const fadeIn = (delta: number) => {
      elapsed += delta;
      
      if (elapsed < 30) {
        this.countdownContainer.alpha = Math.min(1, elapsed / 30);
      } else {
        this.game.getApp().ticker.remove(fadeIn);
        
        // Start the countdown interval
        this.countdownInterval = setInterval(() => {
          this.countdownValue--;
          this.countdownText.text = `BATTLE IN: ${this.countdownValue}`;
          
          // Pulse effect when number changes
          this.pulseCountdown();
          
          if (this.countdownValue <= 0) {
            // Clear interval and proceed to game
            if (this.countdownInterval) {
              clearInterval(this.countdownInterval);
              this.countdownInterval = null;
            }
            this.proceedToGame();
          }
        }, 1000);
      }
    };
    
    this.game.getApp().ticker.add(fadeIn);
  }
  
  private pulseCountdown(): void {
    // Save original scale
    const originalScale = this.countdownText.scale.x;
    
    // Pulse by scaling up
    this.countdownText.scale.set(originalScale * 1.3);
    
    // Color based on time left
    if (this.countdownValue <= 5) {
      this.countdownText.style.fill = 0xFF0000; // Red for last 5 seconds
    } else if (this.countdownValue <= 10) {
      this.countdownText.style.fill = 0xFFAA00; // Orange for 6-10 seconds
    }
    
    // Scale back down with easing
    setTimeout(() => {
      this.countdownText.scale.set(originalScale * 1.2);
      
      setTimeout(() => {
        this.countdownText.scale.set(originalScale * 1.1);
        
        setTimeout(() => {
          this.countdownText.scale.set(originalScale);
        }, 50);
      }, 50);
    }, 100);
  }
  
  private proceedToGame(): void {
    if (!this.selectedTeamCard || !this.selectedBall) return;
    
    // Clean up any intervals
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    
    // Update the ball with material properties
    const playerBall = {
      ...this.selectedBall,
      stats: {
        hardness: this.selectedTeamCard.hardness,
        bounce: this.selectedTeamCard.bounce
      },
      material: {
        name: this.selectedTeamCard.name,
        color: this.selectedTeamCard.color
      },
      // Preserve feature card
      featureCard: this.selectedBall.featureCard
    };
    
    // Update opponent ball with material properties
    const opponentBall = {
      ...this.opponentBall,
      stats: {
        hardness: this.opponentTeamCard!.hardness,
        bounce: this.opponentTeamCard!.bounce
      },
      material: {
        name: this.opponentTeamCard!.name,
        color: this.opponentTeamCard!.color
      },
      // Preserve feature card
      featureCard: this.opponentBall.featureCard
    };
    
    // Start the game with the modified balls
    const gameScene = new GameScene(this.game, playerBall, opponentBall);
    this.game.setScene(gameScene);
  }
  
  public update(delta: number): void {
    // Animation updates handled by PIXI ticker
  }
  
  public destroy(): void {
    // Clean up any intervals
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    
    // Clean up any event listeners
    this.container.removeChildren();
  }
} 