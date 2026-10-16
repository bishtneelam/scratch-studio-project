const test = require("node:test");
const assert = require("node:assert/strict");
const { startRuntime, tick } = require("../src/lib/runtime");
const { makeBlock } = require("../src/lib/program");
const { applyImmediate, contactTime } = require("../src/lib/motion");
const sprite = (id, blocks, x = 0) => ({
  id,
  name: id,
  x,
  y: 0,
  direction: 0,
  blocks,
  activeBlock: null,
  bubble: null,
});
test("fast sprites cannot pass through each other between frames", () => {
  const left = sprite(
    "left",
    [
      {
        ...makeBlock("move"),
        steps: 400,
      },
    ],
    -100,
  );
  const right = sprite(
    "right",
    [
      {
        ...makeBlock("move"),
        steps: -400,
      },
    ],
    100,
  );
  const runtime = startRuntime([left, right]);
  tick(runtime, 0);
  const result = tick(runtime, 160);
  assert.equal(result.swaps, 1);
  assert(Math.abs(result.sprites[0].x + 30) < 1e-7);
  assert(Math.abs(result.sprites[1].x - 30) < 1e-7);
  assert.equal(result.sprites[0].blocks, right.blocks);
  assert.equal(left.x, -100); // Runtime never mutates React's original objects.
});
test("non-contacting movement and stationary sprites do not collide", () => {
  assert.equal(
    contactTime(
      {
        x: -100,
        y: 100,
      },
      {
        x: 100,
        y: 100,
      },
      {
        x: 100,
        y: 0,
      },
      {
        x: -100,
        y: 0,
      },
    ),
    null,
  );
  assert.equal(
    contactTime(
      {
        x: -100,
        y: 0,
      },
      {
        x: -100,
        y: 0,
      },
      {
        x: 100,
        y: 0,
      },
      {
        x: 100,
        y: 0,
      },
    ),
    null,
  );
});
test("zero-duration speech completes even with the same frame timestamp", () => {
  const runtime = startRuntime([
    sprite("a", [
      {
        ...makeBlock("say"),
        seconds: 0,
      },
      makeBlock("move"),
    ]),
  ]);
  tick(runtime, 0);
  tick(runtime, 0);
  tick(runtime, 160);
  assert.equal(runtime.sprites[0].x, 10);
  assert.equal(runtime.sprites[0].bubble, null);
  assert(Number.isFinite(runtime.sprites[0].x));
});
test("preview and program movement use the same coordinate and direction rules", () => {
  for (const angle of [0, 45, 90, 180, 270]) {
    const block = {
      ...makeBlock("move"),
      steps: -25,
    };
    const before = {
      ...sprite("a", [block]),
      direction: angle,
    };
    const preview = applyImmediate(before, block);
    const runtime = startRuntime([before]);
    tick(runtime, 0);
    tick(runtime, 160);
    assert.equal(runtime.sprites[0].x, preview.x);
    assert.equal(runtime.sprites[0].y, preview.y);
  }
});
test("unchanged sprite objects retain identity for memoized rendering", () => {
  const runtime = startRuntime([sprite("idle", [])]);
  const before = runtime.sprites[0];
  tick(runtime, 0);
  assert.equal(runtime.sprites[0], before);
});

test("Go To after Move does not sweep across sprites or pull a teleport back", () => {
  const runtime = startRuntime([
    sprite(
      "a",
      [
        { ...makeBlock("move"), steps: 10 },
        { ...makeBlock("goto"), x: 150, y: 0 },
      ],
      -150,
    ),
    sprite("b", [], 0),
  ]);
  tick(runtime, 0);
  tick(runtime, 160);
  assert.equal(runtime.sprites[0].x, -140);
  const result = tick(runtime, 176);
  assert.equal(result.swaps, 0);
  assert.equal(result.sprites[0].x, 150);
});
test("teleporting across a moving sprite does not create a swept collision", () => {
  const runtime = startRuntime([
    sprite(
      "a",
      [
        { ...makeBlock("say"), seconds: 0 },
        { ...makeBlock("goto"), x: 150, y: 0 },
      ],
      -150,
    ),
    sprite("b", [{ ...makeBlock("move"), steps: 10 }], 0),
  ]);
  tick(runtime, 0);
  const result = tick(runtime, 80);
  assert.equal(result.swaps, 0);
  assert.equal(result.sprites[0].x, 150);
});

test("repeat highlight stays steady across movement boundaries and clears at completion", () => {
  const move = { ...makeBlock("move"), steps: 1 };
  const loop = { ...makeBlock("repeat"), times: 3, children: [move] };
  const runtime = startRuntime([sprite("a", [loop])]);
  assert.equal(tick(runtime, 0).sprites[0].activeBlock, move.id);
  // Each completed move has a collision-resolution frame before the next block.
  for (const now of [160, 176, 336, 352, 512]) {
    assert.equal(tick(runtime, now).sprites[0].activeBlock, move.id);
  }
  const result = tick(runtime, 528);
  assert.equal(result.done, true);
  assert.equal(result.sprites[0].activeBlock, null);
  assert.equal(result.sprites[0].x, 3);
});

test("anticlockwise block uses positive degrees and affects subsequent movement", () => {
  const turn = { ...makeBlock("turn"), degrees: 90, rotation: "anticlockwise" };
  const initial = sprite("a", [turn, { ...makeBlock("move"), steps: 10 }]);
  assert.equal(applyImmediate(initial, turn).direction, 270);
  const runtime = startRuntime([initial]);
  for (let now = 0; now < 1000; now += 16) tick(runtime, now);
  assert.equal(runtime.sprites[0].direction, 270);
  assert(Math.abs(runtime.sprites[0].x) < 1e-7);
  assert.equal(runtime.sprites[0].y, 10);
});
