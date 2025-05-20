import * as PIXI from 'pixi.js';
import * as Matter from 'matter-js';
import { PhysicsObject } from '../types';

export function createBall(
  x: number, 
  y: number, 
  radius: number, 
  color: number = 0xff0000,
  restitution: number = 0.7
): PhysicsObject {
  // Create PIXI Graphics for the ball
  const graphics = new PIXI.Graphics();
  graphics.beginFill(color);
  graphics.drawCircle(0, 0, radius);
  graphics.endFill();
  
  // Create Matter.js body
  const body = Matter.Bodies.circle(x, y, radius, {
    restitution: restitution,  // Bounciness
    friction: 0.1,
    density: 0.001
  });
  
  // Create physics object
  const ball: PhysicsObject = {
    body,
    sprite: graphics,
    update: () => {
      // Update sprite position based on physics body
      const position = body.position;
      graphics.position.set(position.x, position.y);
      graphics.rotation = body.angle;
    }
  };
  
  // Initial update to set position
  ball.update();
  
  return ball;
} 