import * as PIXI from 'pixi.js';
import { GameOptions, Scene } from './types';
import { PhysicsSystem } from './systems/physics-system';

export class Game {
  private app: PIXI.Application;
  private currentScene: Scene | null = null;
  private physicsSystem: PhysicsSystem;
  private transition: PIXI.Graphics | null = null;

  constructor(options: GameOptions) {
    // Create PIXI Application
    this.app = new PIXI.Application({
      width: options.width,
      height: options.height,
      backgroundColor: options.backgroundColor,
      antialias: true
    });

    // Create Physics System
    this.physicsSystem = new PhysicsSystem();
    this.physicsSystem.createWalls(options.width, options.height);
    this.physicsSystem.start();

    // Add ticker for game loop
    this.app.ticker.add(this.update.bind(this));
  }

  public getApp(): PIXI.Application {
    return this.app;
  }

  public getPhysicsSystem(): PhysicsSystem {
    return this.physicsSystem;
  }

  public start(containerElement: HTMLElement): void {
    containerElement.appendChild(this.app.view as HTMLCanvasElement);
  }

  public setScene(scene: Scene): void {
    this.transitionToScene(scene);
  }

  private transitionToScene(newScene: Scene): void {
    // Create transition overlay
    const transition = new PIXI.Graphics();
    transition.beginFill(0x000000);
    transition.drawRect(0, 0, this.app.screen.width, this.app.screen.height);
    transition.endFill();
    transition.alpha = 0;
    this.app.stage.addChild(transition);
    this.transition = transition;

    // Fade out
    let elapsed = 0;
    const fadeOut = (delta: number) => {
      elapsed += delta;
      transition.alpha = Math.min(1, elapsed / 10); // 10 frames for fade out

      if (elapsed >= 10) {
        this.app.ticker.remove(fadeOut);
        
        // Switch scenes
        this.switchSceneContent(newScene);
        
        // Fade in
        elapsed = 0;
        this.app.ticker.add(fadeIn);
      }
    };

    // Fade in
    const fadeIn = (delta: number) => {
      elapsed += delta;
      transition.alpha = Math.max(0, 1 - elapsed / 10); // 10 frames for fade in

      if (elapsed >= 10) {
        this.app.ticker.remove(fadeIn);
        this.app.stage.removeChild(transition);
        this.transition = null;
      }
    };

    this.app.ticker.add(fadeOut);
  }

  private switchSceneContent(newScene: Scene): void {
    // Remove current scene if it exists
    if (this.currentScene) {
      this.app.stage.removeChild(this.currentScene.container);
      this.currentScene.destroy();
    }

    // Set and initialize new scene
    this.currentScene = newScene;
    this.app.stage.addChild(newScene.container);
    newScene.init();
    
    // Make sure transition is on top
    if (this.transition) {
      this.app.stage.removeChild(this.transition);
      this.app.stage.addChild(this.transition);
    }
  }

  private update(delta: number): void {
    if (this.currentScene) {
      this.currentScene.update(delta);
    }
    this.physicsSystem.update();
  }

  public destroy(): void {
    this.app.ticker.remove(this.update.bind(this));
    if (this.currentScene) {
      this.currentScene.destroy();
    }
    this.physicsSystem.destroy();
    this.app.destroy(true, { children: true, texture: true, baseTexture: true });
  }
} 