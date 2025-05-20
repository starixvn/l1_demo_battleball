# Battleball

A simple physics-based game using PixiJS for rendering and Matter.js for physics simulation.

## Setup Instructions

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm start
```

This will start the development server at http://localhost:9000.

## Build for Production

To build the project for production:

```bash
npm run build
```

The build output will be in the `dist` directory.

## Game Controls

- Click anywhere on the screen to create a new ball.
- Watch the balls interact with physics!

## Technology Stack

- PixiJS - Fast 2D rendering library
- Matter.js - 2D physics engine
- TypeScript - Typed JavaScript
- Webpack - Module bundler

## Project Structure

```
battleball/
├── src/                  # Source files
│   ├── assets/           # Game assets
│   ├── entities/         # Game entities (ball, etc.)
│   ├── scenes/           # Game scenes
│   ├── systems/          # Game systems (physics, etc.)
│   ├── utils/            # Utility functions
│   ├── game.ts           # Main game class
│   ├── index.html        # HTML template
│   ├── index.ts          # Entry point
│   └── types.ts          # TypeScript types
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── webpack.config.js     # Webpack configuration
``` 