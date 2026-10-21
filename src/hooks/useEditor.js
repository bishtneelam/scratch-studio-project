import { useCallback, useEffect, useReducer, useRef } from "react";
import { connectedFrom } from "../lib/program";
import { durationMs } from "../lib/motion";
import { startRuntime, enqueueProgram, tick } from "../lib/runtime";
import {
  createEditorState,
  editorReducer,
  selectedSprite,
  collisionDemo,
  newSprite,
  playbackSprites,
} from "../lib/editor";

export default function useEditor() {
  const [state, dispatch] = useReducer(
    editorReducer,
    undefined,
    createEditorState,
  );
  const latest = useRef(state);
  latest.current = state;
  const runtime = useRef(null);
  const frame = useRef(null);
  const generation = useRef(0);
  const timers = useRef(new Map());

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  }, []);
  const cancel = useCallback(() => {
    generation.current++;
    cancelAnimationFrame(frame.current);
    frame.current = null;
    runtime.current = null;
    clearTimers();
  }, [clearTimers]);
  useEffect(() => cancel, [cancel]);

  const play = useCallback(
    (blockId) => {
      const current = latest.current;
      const selected = selectedSprite(current);
      const clickedId = typeof blockId === "string" ? blockId : null;
      const program = clickedId
        ? connectedFrom(selected.blocks, clickedId)
        : null;
      if (runtime.current) {
        if (clickedId) enqueueProgram(runtime.current, selected.id, program);
        return;
      }
      if (
        clickedId
          ? !program.length
          : !current.sprites.some((sprite) => sprite.blocks.length)
      ) {
        dispatch({
          type: "STATUS",
          message: "Add a block to a script before running it.",
        });
        return;
      }
      clearTimers();
      const initialSprites = playbackSprites(current);
      const session = startRuntime(
        initialSprites,
        clickedId
          ? {
              programs: { [selected.id]: program },
              collisions: false,
            }
          : {},
      );
      runtime.current = session;
      const runId = ++generation.current;
      dispatch({
        type: "RUN_START",
        sprites: session.sprites,
        mode: clickedId ? "stack" : "all",
        initialSprites: clickedId
          ? current.saved || initialSprites
          : initialSprites,
        status: clickedId
          ? `Running clicked stack on ${selected.name}…`
          : "Running all sprite scripts…",
      });
      function animate(now) {
        if (runId !== generation.current) return;
        const result = tick(session, now);
        // One reducer dispatch per animation frame, including status and counters.
        dispatch({ type: "FRAME", result });
        if (result.done) {
          runtime.current = null;
          frame.current = null;
        } else frame.current = requestAnimationFrame(animate);
      }
      frame.current = requestAnimationFrame(animate);
    },
    [clearTimers],
  );

  const stop = useCallback(() => {
    cancel();
    dispatch({ type: "STOP" });
  }, [cancel]);
  const reset = useCallback(() => {
    cancel();
    dispatch({ type: "RESET" });
  }, [cancel]);
  const preview = useCallback((block) => {
    if (runtime.current) return;
    const id = selectedSprite(latest.current).id;
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    dispatch({ type: "PREVIEW", id, block });
    if (block.type === "say" || block.type === "think") {
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          dispatch({ type: "CLEAR_BUBBLE", id });
        }, durationMs(block.seconds)),
      );
    }
  }, []);
  const loadDemo = useCallback(() => {
    cancel();
    dispatch({ type: "LOAD_DEMO", sprites: collisionDemo() });
  }, [cancel]);
  const addSprite = useCallback(
    () => dispatch({ type: "ADD_SPRITE", sprite: newSprite(latest.current) }),
    [],
  );
  const deleteSprite = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    dispatch({ type: "DELETE_SPRITE", id });
  }, []);
  const select = useCallback((id) => dispatch({ type: "SELECT", id }), []);
  const moveSprite = useCallback(
    (id, x, y) => dispatch({ type: "MOVE_SPRITE", id, x, y }),
    [],
  );
  const update = useCallback(
    (patch) => dispatch({ type: "UPDATE", patch }),
    [],
  );
  const addBlock = useCallback(
    (block) => dispatch({ type: "EDIT", operation: "add", block }),
    [],
  );
  const changeBlock = useCallback(
    (id, patch) => dispatch({ type: "EDIT", operation: "change", id, patch }),
    [],
  );
  const removeBlock = useCallback(
    (id) => dispatch({ type: "EDIT", operation: "remove", id }),
    [],
  );
  const placeBlock = useCallback(
    (payload, parentId, index, position) =>
      dispatch({
        type: "EDIT",
        operation: "place",
        payload,
        parentId,
        index,
        position,
      }),
    [],
  );
  const clearProgram = useCallback(
    () => dispatch({ type: "EDIT", operation: "clear" }),
    [],
  );

  return {
    state,
    selected: selectedSprite(state),
    play,
    stop,
    reset,
    preview,
    loadDemo,
    addSprite,
    deleteSprite,
    select,
    update,
    moveSprite,
    addBlock,
    changeBlock,
    removeBlock,
    placeBlock,
    clearProgram,
  };
}
