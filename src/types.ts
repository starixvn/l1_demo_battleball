import * as PIXI from 'pixi.js';
import * as Matter from 'matter-js';

export interface GameOptions {
  width: number;
  height: number;
  backgroundColor: number;
}

export interface PhysicsObject {
  body: Matter.Body;
  sprite: PIXI.Sprite | PIXI.Graphics;
  update: () => void;
}

export interface Scene {
  container: PIXI.Container;
  init: () => void;
  update: (delta: number) => void;
  destroy: () => void;
} 