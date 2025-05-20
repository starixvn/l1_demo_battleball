import * as Matter from 'matter-js';
import { PhysicsObject } from '../types';

export class PhysicsSystem {
  private engine: Matter.Engine;
  private world: Matter.World;
  private runner: Matter.Runner;
  private physicsObjects: PhysicsObject[] = [];

  constructor() {
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: 0.5 }
    });
    
    this.world = this.engine.world;
    this.runner = Matter.Runner.create();
  }

  public start(): void {
    Matter.Runner.run(this.runner, this.engine);
  }

  public stop(): void {
    Matter.Runner.stop(this.runner);
  }

  public addObject(object: PhysicsObject): void {
    this.physicsObjects.push(object);
    Matter.Composite.add(this.world, object.body);
  }

  public removeObject(object: PhysicsObject): void {
    const index = this.physicsObjects.indexOf(object);
    if (index > -1) {
      this.physicsObjects.splice(index, 1);
      Matter.Composite.remove(this.world, object.body);
    }
  }

  public update(): void {
    // Matter.js updates are handled by the runner
    // This method is for updating sprites based on physics body positions
    for (const object of this.physicsObjects) {
      object.update();
    }
  }

  public createWalls(width: number, height: number, thickness: number = 50): void {
    const walls = [
      // Top wall
      Matter.Bodies.rectangle(width / 2, -thickness / 2, width, thickness, { isStatic: true }),
      // Bottom wall
      Matter.Bodies.rectangle(width / 2, height + thickness / 2, width, thickness, { isStatic: true }),
      // Left wall
      Matter.Bodies.rectangle(-thickness / 2, height / 2, thickness, height, { isStatic: true }),
      // Right wall
      Matter.Bodies.rectangle(width + thickness / 2, height / 2, thickness, height, { isStatic: true })
    ];

    Matter.Composite.add(this.world, walls);
  }

  public get matterEngine(): Matter.Engine {
    return this.engine;
  }

  public get matterWorld(): Matter.World {
    return this.world;
  }

  public destroy(): void {
    Matter.Runner.stop(this.runner);
    Matter.World.clear(this.world, false);
    Matter.Engine.clear(this.engine);
  }
} 