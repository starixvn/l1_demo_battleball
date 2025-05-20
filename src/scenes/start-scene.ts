import * as PIXI from 'pixi.js';
import { Scene } from '../types';
import { Game } from '../game';
import { BallSelectionScene } from './ball-selection-scene';

export class StartScene implements Scene {
  public container: PIXI.Container;
  private game: Game;
  private title!: PIXI.Text;
  private playButton!: PIXI.Container;
  private background!: PIXI.Graphics;
  private pulseAnimationFunction: ((delta: number) => void) | null = null;

  constructor(game: Game) {
    this.game = game;
    this.container = new PIXI.Container();
  }

  public init(): void {
    const app = this.game.getApp();
    
    // Create background
    this.background = new PIXI.Graphics();
    this.background.beginFill(0x1a1a2e);
    this.background.drawRect(0, 0, app.screen.width, app.screen.height);
    this.background.endFill();
    
    // Add some background decoration
    for (let i = 0; i < 50; i++) {
      const circle = new PIXI.Graphics();
      const size = 2 + Math.random() * 5;
      const alpha = 0.1 + Math.random() * 0.3;
      
      circle.beginFill(0xffffff, alpha);
      circle.drawCircle(0, 0, size);
      circle.endFill();
      
      circle.x = Math.random() * app.screen.width;
      circle.y = Math.random() * app.screen.height;
      
      this.background.addChild(circle);
    }
    
    this.container.addChild(this.background);
    
    // Create title text
    this.title = new PIXI.Text('Battleball', {
      fontFamily: 'Arial',
      fontSize: 72,
      fill: 0xffffff,
      align: 'center',
      fontWeight: 'bold',
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowBlur: 6,
      dropShadowDistance: 6
    });
    this.title.anchor.set(0.5);
    this.title.position.set(app.screen.width / 2, app.screen.height / 3);
    this.container.addChild(this.title);
    
    // Create play button
    this.playButton = this.createButton('Play Now', app.screen.width / 2, app.screen.height * 0.6);
    this.container.addChild(this.playButton);
    
    // Initial animation
    this.title.scale.set(0.5);
    this.title.alpha = 0;
    
    // Animate title in
    this.animateIn();
  }

  private animateIn(): void {
    // Using PIXI's ticker for animation
    const app = this.game.getApp();
    let elapsed = 0;
    
    const animate = (delta: number) => {
      elapsed += delta;
      
      if (elapsed < 30) {
        this.title.scale.set(0.5 + (elapsed / 30) * 0.5);
        this.title.alpha = elapsed / 30;
      } else {
        app.ticker.remove(animate);
        this.startButtonAnimation();
      }
    };
    
    app.ticker.add(animate);
  }

  private startButtonAnimation(): void {
    // Animate button appearance
    this.playButton.alpha = 0;
    this.playButton.scale.set(0.8);
    
    const app = this.game.getApp();
    let elapsed = 0;
    
    const animate = (delta: number) => {
      elapsed += delta;
      
      if (elapsed < 20) {
        this.playButton.alpha = elapsed / 20;
        this.playButton.scale.set(0.8 + (elapsed / 20) * 0.2);
      } else {
        app.ticker.remove(animate);
        this.startPulseAnimation();
      }
    };
    
    app.ticker.add(animate);
  }

  private startPulseAnimation(): void {
    // Subtle pulse animation for the button
    const app = this.game.getApp();
    let elapsed = 0;
    
    const animate = (delta: number) => {
      elapsed += delta / 60;
      this.playButton.scale.set(1 + Math.sin(elapsed * 3) * 0.04);
    };
    
    app.ticker.add(animate);
    this.pulseAnimationFunction = animate; // Store the animation function for cleanup
  }

  private createButton(text: string, x: number, y: number): PIXI.Container {
    const buttonContainer = new PIXI.Container();
    buttonContainer.position.set(x, y);
    
    // Button background
    const background = new PIXI.Graphics();
    background.beginFill(0x3498db);
    background.drawRoundedRect(-100, -25, 200, 50, 10);
    background.endFill();
    
    // Button text
    const buttonText = new PIXI.Text(text, {
      fontFamily: 'Arial',
      fontSize: 24,
      fill: 0xffffff,
      align: 'center'
    });
    buttonText.anchor.set(0.5);
    
    // Button hover effect
    background.eventMode = 'static';
    background.cursor = 'pointer';
    
    background.on('pointerover', () => {
      background.tint = 0x2980b9;
    });
    
    background.on('pointerout', () => {
      background.tint = 0xffffff;
    });
    
    background.on('pointerdown', () => {
      this.startGame();
    });
    
    buttonContainer.addChild(background);
    buttonContainer.addChild(buttonText);
    
    return buttonContainer;
  }

  private startGame(): void {
    // Create and switch to ball selection scene
    const ballSelectionScene = new BallSelectionScene(this.game);
    this.game.setScene(ballSelectionScene);
  }

  public update(delta: number): void {
    // Animation updates are handled by PIXI ticker
  }

  public destroy(): void {
    // Remove event listeners and clean up resources
    if (this.playButton) {
      const background = this.playButton.getChildAt(0) as PIXI.Graphics;
      if (background) {
        background.off('pointerover');
        background.off('pointerout');
        background.off('pointerdown');
      }
      
      // Remove pulse animation
      if (this.pulseAnimationFunction) {
        const app = this.game.getApp();
        app.ticker.remove(this.pulseAnimationFunction);
      }
    }
    
    this.container.removeChildren();
  }
} 