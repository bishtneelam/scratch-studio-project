// Pure editor state transitions. No browser APIs or animation scheduling here.
const {
  id,
  makeBlock,
  updateBlock,
  removeBlock,
  placeBlock,
} = require("./program");
const {
  applyImmediate,
  clamp,
  direction,
  LIMIT_X,
  LIMIT_Y,
} = require("./motion");
const MAX_SPRITES = 6;
const COLORS = [
  "#6366f1",
  "#e87935",
  "#10a884",
  "#d65b99",
  "#2796d2",
  "#ab7c25",
];
const SPAWN_POINTS = [
  [-150, 90],
  [150, 90],
  [-150, -90],
  [150, -90],
  [0, 120],
  [0, -120],
];
function makeSprite(index, x = 0, y = 0) {
  return {
    id: id(),
    name: `Sprite ${index + 1}`,
    x,
    y,
    direction: 0,
    color: COLORS[index % COLORS.length],
    hue: index * 65,
    blocks: [],
    bubble: null,
    activeBlock: null,
  };
}
function createEditorState() {
  const sprite = makeSprite(0);
  return {
    sprites: [sprite],
    selectedId: sprite.id,
    running: false,
    runMode: null,
    swaps: 0,
    lastSwap: "",
    status: "Ready. Add blocks or try an action.",
    saved: null,
    nextSprite: 1,
  };
}
function selectedSprite(state) {
  return (
    state.sprites.find((sprite) => sprite.id === state.selectedId) ||
    state.sprites[0]
  );
}
function clearPlayback(sprite) {
  return sprite.bubble || sprite.activeBlock
    ? {
        ...sprite,
        bubble: null,
        activeBlock: null,
      }
    : sprite;
}
function editSelected(state, patch) {
  const target = selectedSprite(state).id;
  const update = (sprites) =>
    sprites.map((sprite) =>
      sprite.id === target
        ? {
            ...sprite,
            ...patch,
          }
        : sprite,
    );
  // Keep explicit user edits when Reset is used after playback.
  return {
    ...state,
    sprites: update(state.sprites),
    // A script edit commits the visible programs together. After a collision,
    // updating only one saved program could duplicate it and restore stale code
    // on the other sprite during replay. Positions keep their saved start points.
    saved:
      state.saved &&
      update(
        "blocks" in patch
          ? state.saved.map((sprite) => ({
              ...sprite,
              blocks: state.sprites.find((current) => current.id === sprite.id)
                .blocks,
            }))
          : state.saved,
      ),
  };
}
// Both green-flag and movement-block playback continue from the live scene.
function playbackSprites(state) {
  return state.sprites;
}
function editorReducer(state, action) {
  switch (action.type) {
    case "SELECT":
      return state.sprites.some((sprite) => sprite.id === action.id)
        ? {
            ...state,
            selectedId: action.id,
          }
        : state;
    case "EDIT": {
      if (state.running) return state;
      const blocks = selectedSprite(state).blocks;
      let next;
      if (action.operation === "add") next = [...blocks, action.block];
      else if (action.operation === "change")
        next = updateBlock(blocks, action.id, action.patch);
      else if (action.operation === "remove")
        next = removeBlock(blocks, action.id);
      else if (action.operation === "place")
        next = placeBlock(
          blocks,
          action.payload,
          action.parentId,
          action.index,
          action.position,
        );
      else if (action.operation === "clear") next = [];
      else return state;
      return next === blocks
        ? state
        : editSelected(state, {
            blocks: next,
          });
    }
    case "MOVE_SPRITE": {
      if (
        state.running ||
        !state.sprites.some((sprite) => sprite.id === action.id)
      )
        return state;
      const patch = {
        x: clamp(action.x, LIMIT_X),
        y: clamp(action.y, LIMIT_Y),
      };
      const move = (sprites) =>
        sprites.map((sprite) =>
          sprite.id === action.id ? { ...sprite, ...patch } : sprite,
        );
      return {
        ...state,
        sprites: move(state.sprites),
        selectedId: action.id,
        saved: move(state.saved || state.sprites.map(clearPlayback)),
      };
    }
    case "UPDATE": {
      if (state.running) return state;
      const patch = {};
      if ("name" in action.patch)
        patch.name = String(action.patch.name).slice(0, 24);
      if ("x" in action.patch) patch.x = clamp(action.patch.x, LIMIT_X);
      if ("y" in action.patch) patch.y = clamp(action.patch.y, LIMIT_Y);
      if ("direction" in action.patch)
        patch.direction = direction(action.patch.direction);
      return editSelected(state, patch);
    }
    case "ADD_SPRITE":
      if (state.running || state.sprites.length >= MAX_SPRITES) return state;
      return {
        ...state,
        sprites: [...state.sprites, action.sprite],
        selectedId: action.sprite.id,
        saved: state.saved && [...state.saved, action.sprite],
        nextSprite: state.nextSprite + 1,
        status: `${action.sprite.name} added. Give it its own script.`,
      };
    case "DELETE_SPRITE": {
      if (state.running || state.sprites.length <= 1) return state;
      const sprites = state.sprites.filter((sprite) => sprite.id !== action.id);
      if (sprites.length === state.sprites.length) return state;
      return {
        ...state,
        sprites,
        selectedId: sprites.some((sprite) => sprite.id === state.selectedId)
          ? state.selectedId
          : sprites[0].id,
        saved:
          state.saved &&
          state.saved.filter((sprite) => sprite.id !== action.id),
      };
    }
    case "RUN_START":
      return {
        ...state,
        saved: (action.initialSprites || state.sprites).map(clearPlayback),
        sprites: action.sprites,
        running: true,
        runMode: action.mode || "all",
        swaps: 0,
        lastSwap: "",
        status: action.status,
      };
    case "FRAME":
      return {
        ...state,
        sprites: action.result.sprites,
        swaps: action.result.swaps,
        lastSwap: action.result.lastSwap,
        running: !action.result.done,
        runMode: action.result.done ? null : state.runMode,
        status: action.result.done
          ? "Finished. Reset restores the scene before playback."
          : state.status,
      };
    case "STOP":
      return {
        ...state,
        sprites: state.sprites.map(clearPlayback),
        running: false,
        runMode: null,
        status: "Stopped. You can edit your scripts.",
      };
    case "RESET":
      return {
        ...state,
        sprites: state.saved
          ? state.saved.map(clearPlayback)
          : state.sprites.map((sprite, index) => ({
              ...clearPlayback(sprite),
              x: index * 90 - (state.sprites.length - 1) * 45,
              y: 0,
              direction: 0,
            })),
        running: false,
        swaps: 0,
        lastSwap: "",
        runMode: null,
        status: "Scene reset.",
      };
    case "PREVIEW":
      if (state.running) return state;
      return {
        ...state,
        sprites: state.sprites.map((sprite) =>
          sprite.id === action.id
            ? applyImmediate(sprite, action.block)
            : sprite,
        ),
        status: `Tried ${action.block.type} on ${selectedSprite(state).name}.`,
      };
    case "CLEAR_BUBBLE":
      return {
        ...state,
        sprites: state.sprites.map((sprite) =>
          sprite.id === action.id && sprite.bubble
            ? {
                ...sprite,
                bubble: null,
              }
            : sprite,
        ),
      };
    case "LOAD_DEMO":
      return {
        ...state,
        sprites: action.sprites,
        selectedId: action.sprites[0].id,
        saved: action.sprites,
        nextSprite: 2,
        running: false,
        swaps: 0,
        lastSwap: "",
        runMode: null,
        status:
          "Collision demo loaded. Press the green flag to run both sprites.",
      };
    case "STATUS":
      return {
        ...state,
        status: action.message,
      };
    default:
      return state;
  }
}
function collisionDemo() {
  return [-150, 150].map((x, index) => ({
    ...makeSprite(index, x),
    blocks: [
      {
        ...makeBlock("repeat"),
        times: 35,
        children: [
          {
            ...makeBlock("move"),
            steps: index ? -8 : 8,
          },
        ],
      },
    ],
  }));
}
function newSprite(state) {
  const [x, y] = SPAWN_POINTS[(state.nextSprite - 1) % SPAWN_POINTS.length];
  return makeSprite(state.nextSprite, x, y);
}
module.exports = {
  createEditorState,
  playbackSprites,
  editorReducer,
  selectedSprite,
  collisionDemo,
  newSprite,
  MAX_SPRITES,
};
