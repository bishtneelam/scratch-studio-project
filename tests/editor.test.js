const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createEditorState,
  playbackSprites,
  editorReducer,
  selectedSprite,
  collisionDemo,
  newSprite,
  MAX_SPRITES,
} = require("../src/lib/editor");
const { makeBlock, updateBlock, removeBlock } = require("../src/lib/program");
function reduce(state, type, fields = {}) {
  return editorReducer(state, {
    type,
    ...fields,
  });
}
function freeze(value) {
  Object.freeze(value);
  Object.values(value).forEach((item) => {
    if (item && typeof item === "object" && !Object.isFrozen(item))
      freeze(item);
  });
  return value;
}
test("editor updates are immutable and affect only the selected sprite", () => {
  let state = createEditorState();
  state = reduce(state, "ADD_SPRITE", {
    sprite: newSprite(state),
  });
  freeze(state);
  const next = reduce(state, "EDIT", {
    operation: "add",
    block: makeBlock("move"),
  });
  assert.equal(next.sprites[0], state.sprites[0]);
  assert.equal(next.sprites[0].blocks.length, 0);
  assert.equal(next.sprites[1].blocks.length, 1);
  assert.equal(state.sprites[1].blocks.length, 0);
});
test("unknown block edits preserve references instead of rerendering the tree", () => {
  const blocks = [
    {
      ...makeBlock("repeat"),
      children: [makeBlock("move")],
    },
  ];
  assert.equal(
    updateBlock(blocks, "missing", {
      steps: 20,
    }),
    blocks,
  );
  assert.equal(removeBlock(blocks, "missing"), blocks);
  const updated = updateBlock(blocks, blocks[0].children[0].id, {
    steps: 20,
  });
  assert.notEqual(updated, blocks);
  assert.equal(blocks[0].children[0].steps, 10);
});
test("running locks script changes, property edits, additions, and deletion", () => {
  const state = {
    ...createEditorState(),
    running: true,
  };
  for (const action of [
    {
      type: "EDIT",
      operation: "clear",
    },
    {
      type: "UPDATE",
      patch: {
        x: 10,
      },
    },
    {
      type: "ADD_SPRITE",
      sprite: newSprite(state),
    },
    {
      type: "DELETE_SPRITE",
      id: state.selectedId,
    },
  ])
    assert.equal(editorReducer(state, action), state);
});
test("selection is valid and at least one sprite always remains", () => {
  const state = createEditorState();
  assert.equal(
    reduce(state, "SELECT", {
      id: "missing",
    }),
    state,
  );
  assert.equal(
    reduce(state, "DELETE_SPRITE", {
      id: state.selectedId,
    }),
    state,
  );
  let next = reduce(state, "ADD_SPRITE", {
    sprite: newSprite(state),
  });
  next = reduce(next, "DELETE_SPRITE", {
    id: next.selectedId,
  });
  assert.equal(next.selectedId, next.sprites[0].id);
});
test("sprite limit and unique identities remain consistent", () => {
  let state = createEditorState();
  for (let i = 0; i < MAX_SPRITES + 2; i++)
    state = reduce(state, "ADD_SPRITE", {
      sprite: newSprite(state),
    });
  assert.equal(state.sprites.length, MAX_SPRITES);
  assert.equal(
    new Set(state.sprites.map((sprite) => sprite.id)).size,
    MAX_SPRITES,
  );
});
test("reset restores pre-run programs after collisions and preserves later user edits", () => {
  let state = reduce(createEditorState(), "LOAD_DEMO", {
    sprites: collisionDemo(),
  });
  const original = state.sprites;
  state = reduce(state, "RUN_START", {
    sprites: original,
    status: "Running",
  });
  const swapped = original.map((sprite, i) => ({
    ...sprite,
    x: 10,
    blocks: original[1 - i].blocks,
  }));
  state = reduce(state, "FRAME", {
    result: {
      sprites: swapped,
      done: true,
      swaps: 1,
      lastSwap: "Swapped",
    },
  });
  state = reduce(state, "RESET");
  assert.equal(state.sprites[0].x, -150);
  assert.equal(state.sprites[0].blocks, original[0].blocks);
  const block = makeBlock("say");
  state = reduce(state, "EDIT", {
    operation: "add",
    block,
  });
  state = reduce(state, "RESET");
  assert.equal(state.sprites[0].blocks.at(-1).id, block.id);
});
test("reset never resurrects a deleted sprite", () => {
  let state = reduce(createEditorState(), "LOAD_DEMO", {
    sprites: collisionDemo(),
  });
  const removed = state.sprites[1].id;
  state = reduce(state, "DELETE_SPRITE", {
    id: removed,
  });
  state = reduce(state, "RESET");
  assert.equal(state.sprites.length, 1);
  assert(!state.sprites.some((sprite) => sprite.id === removed));
});
test("Stop clears playback indicators without moving the sprite", () => {
  const state = createEditorState();
  state.sprites[0] = {
    ...state.sprites[0],
    x: 50,
    bubble: {
      type: "say",
      text: "Hi",
    },
    activeBlock: "block",
  };
  const next = reduce(
    {
      ...state,
      running: true,
    },
    "STOP",
  );
  assert.equal(next.running, false);
  assert.equal(next.sprites[0].x, 50);
  assert.equal(next.sprites[0].bubble, null);
  assert.equal(next.sprites[0].activeBlock, null);
});
test("property edits are normalized and cannot overwrite program state", () => {
  const next = reduce(createEditorState(), "UPDATE", {
    patch: {
      x: Infinity,
      y: 900,
      direction: -90,
      blocks: ["invalid"],
    },
  });
  const sprite = selectedSprite(next);
  assert.equal(sprite.x, 0);
  assert.equal(sprite.y, 148);
  assert.equal(sprite.direction, 270);
  assert.deepEqual(sprite.blocks, []);
});

test("green flag replays collisions repeatedly while clicked stacks use live positions", () => {
  const { startRuntime, tick } = require("../src/lib/runtime");
  let state = reduce(createEditorState(), "LOAD_DEMO", {
    sprites: collisionDemo(),
  });
  const original = state.sprites;
  for (let run = 0; run < 3; run++) {
    const initialSprites = playbackSprites(state);
    assert.deepEqual(
      initialSprites.map((sprite) => sprite.x),
      [-150, 150],
    );
    assert.equal(initialSprites[0].blocks, original[0].blocks);
    const runtime = startRuntime(initialSprites);
    state = reduce(state, "RUN_START", {
      sprites: runtime.sprites,
      initialSprites,
      status: "Running",
    });
    let result;
    for (let now = 0; now <= 20000; now += 80) {
      result = tick(runtime, now);
      if (result.done) break;
    }
    assert.equal(result.done, true);
    assert.equal(result.swaps, 1);
    state = reduce(state, "FRAME", { result });
    assert.equal(playbackSprites(state, true), state.sprites);
    assert.equal(state.sprites[0].blocks, original[1].blocks);
  }
});

test("stage dragging targets its sprite and persists position for Reset and replay", () => {
  const state = reduce(createEditorState(), "LOAD_DEMO", {
    sprites: collisionDemo(),
  });
  const id = state.sprites[1].id;
  const next = reduce(state, "MOVE_SPRITE", { id, x: 75, y: 90 });
  assert.equal(next.selectedId, id);
  assert.equal(next.sprites[0], state.sprites[0]);
  assert.equal(next.sprites[1].x, 75);
  assert.equal(next.sprites[1].y, 90);
  assert.equal(next.sprites[1].blocks, state.sprites[1].blocks);
  assert.equal(reduce(next, "RESET").sprites[1].x, 75);
  assert.equal(playbackSprites(next)[1].y, 90);
});
test("stage dragging clamps to the stage and is ignored during playback", () => {
  const state = createEditorState();
  const action = { type: "MOVE_SPRITE", id: state.selectedId, x: 999, y: -999 };
  const next = editorReducer(state, action);
  assert.equal(next.sprites[0].x, 208);
  assert.equal(next.sprites[0].y, -148);
  assert.equal(reduce(next, "RESET").sprites[0].x, 208);
  assert.equal(playbackSprites(next)[0].y, -148);
  const running = { ...state, running: true };
  assert.equal(editorReducer(running, action), running);
  assert.equal(editorReducer(state, { ...action, id: "missing" }), state);
});

test("replacing both programs after a collision never restores old Repeat blocks", () => {
  const { startRuntime, tick } = require("../src/lib/runtime");
  let state = reduce(createEditorState(), "LOAD_DEMO", {
    sprites: collisionDemo(),
  });
  function dispatch(type, fields) {
    state = reduce(state, type, fields);
  }
  function play() {
    const initialSprites = playbackSprites(state);
    const runtime = startRuntime(initialSprites);
    dispatch("RUN_START", { sprites: runtime.sprites, initialSprites });
    for (let now = 0; now < 60000; now += 16) {
      const result = tick(runtime, now);
      dispatch("FRAME", { result });
      if (result.done) return;
    }
    assert.fail("Playback must finish");
  }
  for (const sprite of state.sprites) {
    dispatch("SELECT", { id: sprite.id });
    dispatch("EDIT", {
      operation: "change",
      id: sprite.blocks[0].id,
      patch: { times: 80 },
    });
    dispatch("EDIT", {
      operation: "change",
      id: sprite.blocks[0].children[0].id,
      patch: { steps: sprite.x < 0 ? 10 : -10 },
    });
  }
  play();
  assert.equal(state.swaps, 1);
  for (const sprite of state.sprites) {
    dispatch("SELECT", { id: sprite.id });
    dispatch("EDIT", { operation: "clear" });
    dispatch("EDIT", { operation: "add", block: makeBlock("goto") });
  }
  for (let run = 0; run < 2; run++) {
    play();
    for (const sprite of state.sprites) {
      assert.equal(sprite.x, 0);
      assert.equal(sprite.y, 0);
      assert.deepEqual(
        sprite.blocks.map((block) => block.type),
        ["goto"],
      );
    }
    dispatch("RESET");
    assert(
      state.sprites.every((sprite) =>
        sprite.blocks.every((block) => block.type === "goto"),
      ),
    );
  }
});
