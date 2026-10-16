const test = require("node:test");
const assert = require("node:assert/strict");
const { makeBlock } = require("../src/lib/program");
const { startRuntime, tick } = require("../src/lib/runtime");
const { applyImmediate } = require("../src/lib/motion");
const {
  createEditorState,
  editorReducer,
  collisionDemo,
  playbackSprites,
} = require("../src/lib/editor");
const block = (type, fields = {}) => ({ ...makeBlock(type), ...fields });
const sprite = (id, blocks, x = 0, y = 0, direction = 0) => ({
  id,
  name: id,
  blocks,
  x,
  y,
  direction,
});
function finish(sprites, options = {}) {
  const runtime = startRuntime(sprites, options);
  for (let now = 0; now < 400000; now += 16) {
    const result = tick(runtime, now);
    assert(
      result.sprites.every((s) => Number.isFinite(s.x) && Number.isFinite(s.y)),
    );
    if (result.done) return result;
  }
  assert.fail("Program did not finish");
}
for (const angle of [0, 45, 90, 135, 180, 225, 270, 315]) {
  for (const steps of [-1000, -10, 0, 10, 1000]) {
    test(`Move ${steps} at ${angle} degrees agrees with preview and stays on stage`, () => {
      const command = block("move", { steps });
      const initial = sprite("a", [command], 0, 0, angle);
      const actual = finish([initial]).sprites[0];
      const expected = applyImmediate(initial, command);
      assert.equal(actual.x, expected.x);
      assert.equal(actual.y, expected.y);
      assert(Math.abs(actual.x) <= 208 && Math.abs(actual.y) <= 148);
    });
  }
}
for (const times of [0, 1, 5, 80, 1000, -5, 2.7]) {
  test(`Repeat ${times} executes the expected count and then continues`, () => {
    const result = finish([
      sprite("a", [
        block("repeat", { times, children: [block("turn", { degrees: 1 })] }),
        block("say", { text: "Done", seconds: 0 }),
      ]),
    ]);
    assert.equal(
      result.sprites[0].direction,
      Math.max(0, Math.min(1000, Math.floor(times))) % 360,
    );
    assert.equal(result.sprites[0].bubble, null);
    assert.equal(result.sprites[0].activeBlock, null);
  });
}
for (const steps of [8, 10, -8, -10]) {
  test(`Repeat 80 Move ${steps} finishes at the stage edge`, () => {
    const result = finish([
      sprite("a", [
        block("repeat", { times: 80, children: [block("move", { steps })] }),
      ]),
    ]);
    assert.equal(result.sprites[0].x, Math.sign(steps) * 208);
    assert.equal(result.sprites[0].activeBlock, null);
  });
}
for (const type of ["say", "think"]) {
  for (const seconds of [0, -1, 0.1, 2, 61]) {
    test(`${type} duration ${seconds} does not stall another sprite`, () => {
      const a = sprite("a", [block(type, { seconds, text: "Hello" })], -150);
      const b = sprite("b", [block("move", { steps: 10 })], 150);
      const runtime = startRuntime([a, b]);
      tick(runtime, 0);
      const moving = tick(runtime, 160);
      assert.equal(moving.sprites[1].x, 160);
      assert.equal(finish([a, b]).sprites[0].bubble, null);
    });
  }
}
test("two 80-repeat programs swap once and preserve unequal loop counts", () => {
  const a = sprite(
    "a",
    [block("repeat", { times: 80, children: [block("move", { steps: 10 })] })],
    -150,
  );
  const b = sprite(
    "b",
    [block("repeat", { times: 35, children: [block("move", { steps: -10 })] })],
    150,
  );
  const result = finish([a, b]);
  assert.equal(result.swaps, 1);
  assert.equal(result.sprites[0].blocks, b.blocks);
  assert.equal(result.sprites[1].blocks, a.blocks);
});
test("three overlapping sprites process each contact once instead of silently losing pairs", () => {
  const runtime = startRuntime(
    ["a", "b", "c"].map((id) => sprite(id, [block("say", { seconds: 1 })])),
  );
  for (let now = 0; now < 2000; now += 16) tick(runtime, now);
  assert.equal(runtime.swaps, 3);
});
test("six separated sprites execute independently", () => {
  const sprites = [
    [-150, -100],
    [0, -100],
    [150, -100],
    [-150, 100],
    [0, 100],
    [150, 100],
  ].map(([x, y], index) =>
    sprite(String(index), [block("move", { steps: index + 1 })], x, y),
  );
  const result = finish(sprites);
  assert.equal(result.swaps, 0);
  result.sprites.forEach((s, i) => assert.equal(s.x, sprites[i].x + i + 1));
});
test("editing one program after a collision preserves the other visible program on replay", () => {
  let state = editorReducer(createEditorState(), {
    type: "LOAD_DEMO",
    sprites: collisionDemo(),
  });
  const result = finish(state.sprites);
  state = editorReducer(state, { type: "RUN_START", sprites: state.sprites });
  state = editorReducer(state, { type: "FRAME", result });
  const otherProgram = state.sprites[1].blocks;
  state = editorReducer(state, {
    type: "EDIT",
    operation: "change",
    id: state.sprites[0].blocks[0].id,
    patch: { times: 80 },
  });
  assert.equal(playbackSprites(state)[1].blocks, otherProgram);
  assert.equal(playbackSprites(state)[0].blocks[0].times, 80);
  const ids = playbackSprites(state).flatMap((s) => s.blocks.map((b) => b.id));
  assert.equal(new Set(ids).size, ids.length);
});

test("fast movement hits the nearer sprite first regardless of sprite-list order", () => {
  const mover = sprite("a", [block("move", { steps: 400 })], -180);
  const farther = sprite("b", [], 100);
  const nearer = sprite("c", [], -50);
  const runtime = startRuntime([mover, farther, nearer]);
  tick(runtime, 0);
  const result = tick(runtime, 160);
  assert.equal(result.swaps, 1);
  assert.equal(result.sprites[2].blocks, mover.blocks);
  assert.equal(result.sprites[1].blocks, farther.blocks);
  assert(Math.abs(result.sprites[0].x + 110) < 1e-7);
});
for (const times of [0, -10, 1000]) {
  test(`nested empty repeats ${times} finish without blocking or skipping following code`, () => {
    const result = finish([
      sprite("a", [
        block("repeat", {
          times,
          children: [block("repeat", { times: 1000, children: [] })],
        }),
        block("goto", { x: 12, y: 34 }),
      ]),
    ]);
    assert.equal(result.sprites[0].x, 12);
    assert.equal(result.sprites[0].y, 34);
  });
}
for (const degrees of [-1080, -90, 0, 90, 1080]) {
  test(`Turn ${degrees} normalizes direction before moving`, () => {
    const result = finish([
      sprite("a", [block("turn", { degrees }), block("move", { steps: 10 })]),
    ]).sprites[0];
    assert.equal(result.direction, ((degrees % 360) + 360) % 360);
    assert(
      Math.abs(result.x - Math.cos((degrees * Math.PI) / 180) * 10) < 1e-6,
    );
    assert(
      Math.abs(result.y + Math.sin((degrees * Math.PI) / 180) * 10) < 1e-6,
    );
  });
}
