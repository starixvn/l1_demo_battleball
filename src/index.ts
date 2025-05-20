import { Game } from './game';
import { StartScene } from './scenes/start-scene';

// Wait for the DOM to be loaded
window.addEventListener('DOMContentLoaded', () => {
  // Get container element
  const container = document.getElementById('game-container');
  
  if (!container) {
    console.error('Container element not found');
    return;
  }
  
  // Create game instance
  const game = new Game({
    width: 800,
    height: 600,
    backgroundColor: 0x1a1a2e
  });
  
  // Start the game
  game.start(container);
  
  // Load start scene
  const startScene = new StartScene(game);
  game.setScene(startScene);
  
  // Handle window resize
  window.addEventListener('resize', () => {
    // You could add responsive resizing logic here
  });
  
  // Handle cleanup when browser window is closed
  window.addEventListener('beforeunload', () => {
    game.destroy();
  });
}); 