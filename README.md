# Scratch Studio

A simple visual coding editor built with React, JavaScript, SVG, and Tailwind CSS. Drag blocks into the workspace to control characters, called sprites.

# Scratch Studio

🔗 **Live demo:** [https://meek-pithivier-9feff3.netlify.app](https://meek-pithivier-9feff3.netlify.app/)


## Run the project

Install Node.js 18 or newer, then run:

```sh
npm ci
npm start
```

Open [localhost:3000](http://localhost:3000).

## Features

- Move a sprite forward or backward.
- Turn a sprite clockwise or anticlockwise and move in its new direction.
- Go to a specific x/y position.
- Repeat the blocks placed inside a Repeat block.
- Show speech and thought bubbles for a chosen duration.
- Drag, connect, edit, and delete blocks.
- Add up to six sprites, each with its own script.
- Drag sprites on the stage while stopped.
- Swap entire scripts when two sprites collide during Play all.

## How to use

1. Select a sprite below the stage.
2. Drag blocks from the left into the middle workspace, or click **+ Add**.
3. Edit the values inside each block. To create a loop, drop blocks inside Repeat.
4. Click a workspace block to run it and the connected blocks below it for the selected sprite. Repeated clicks queue another run from the current position, so Move and Turn continue together. Stop clears pending runs.
5. Click the **green flag** to run all sprites with collision swaps enabled.
6. Click **Stop** to stop playback. Click **Reset** to restore the saved starting scene.

The green flag replays from the saved starting scene. You can drag sprites or edit their x/y fields to change their starting positions.

## Try the collision feature

Click **Load collision demo**, then the **green flag**. The sprites move towards each other and exchange their scripts when they touch.

After editing a script following a collision, the next run uses the scripts currently shown for both sprites.

The whole script is exchanged, including Repeat counts. For example, if one sprite has Repeat 80 and the other has Repeat 35, those counts also swap. Select each sprite to see its new script.

## Main files

- `src/App.js`: page layout.
- `src/components/`: blocks, workspace, stage, and sprite controls.
- `src/hooks/`: editor actions, playback, and sprite dragging.
- `src/lib/editor.js`: editor state and updates.
- `src/lib/program.js`: block editing and connections.
- `src/lib/runtime.js`: runs scripts and swaps them on collision.
- `src/lib/motion.js`: movement and collision calculations.
- `src/lib/drag.js`: block dragging.
- `tests/`: automated tests.

## Test and build

```sh
npm test
npm run build
```

The production website is generated in `build/`. Run `npm run check` to run both tests and the build.

## Notes

- The stage is 480 × 360. Its centre is x:0, y:0.
- Sprites stop at the stage edges; they do not bounce.
- Sprites at the same coordinates overlap and may look like one character.
- Each sprite has a separate script. Clear or replace each one separately.
- Refreshing the page clears the project. Saving projects is not implemented.
- This project implements the assignment features, rather than the full Scratch editor.
