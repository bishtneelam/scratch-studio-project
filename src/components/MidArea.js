import React, { useEffect, useMemo } from "react";
import BlockCard from "./BlockCard";
import { beginDrag, cancelActiveDrag } from "../lib/drag";
import { workspaceGroups } from "../lib/program";

function DropSlot({ disabled, parentId, index, empty, owner, head = false }) {
  return (
    <div
      data-drop-parent={parentId || ""}
      data-drop-index={index}
      data-drop-owner={owner || ""}
      data-drop-head={head}
      data-enabled={!disabled}
      className={`drop-slot ${empty ? "empty-slot" : ""}`}
    >
      {empty && <span>Drop blocks here</span>}
    </div>
  );
}
function BlockList({
  blocks,
  parentId = null,
  offset = 0,
  disabled,
  onChange,
  onRemove,
  onPlace,
  activeBlock,
  onRun,
  canRun,
}) {
  return (
    <div className="block-list">
      <DropSlot
        {...{ disabled, parentId }}
        owner={parentId}
        head={!parentId}
        index={offset}
        empty={!blocks.length}
      />
      {blocks.map((block, index) => (
        <React.Fragment key={block.id}>
          <div className="workspace-block" data-block-id={block.id}>
            <BlockCard
              block={block}
              active={activeBlock === block.id}
              draggable={!disabled}
              onDragStart={(event) =>
                beginDrag(event, {
                  source: "workspace",
                  id: block.id,
                  tail: true,
                })
              }
              onChange={(patch) => !disabled && onChange(block.id, patch)}
              onRun={canRun ? () => onRun(block.id) : undefined}
            >
              {block.type === "repeat" && (
                <div className="repeat-body">
                  <BlockList
                    blocks={block.children}
                    parentId={block.id}
                    {...{
                      disabled,
                      onChange,
                      onRemove,
                      onPlace,
                      activeBlock,
                      onRun,
                      canRun,
                    }}
                  />
                </div>
              )}
            </BlockCard>
            <div className="workspace-tools">
              <button
                disabled={disabled}
                aria-label={`Delete ${block.type} block`}
                onClick={() => onRemove(block.id)}
              >
                ×
              </button>
            </div>
          </div>
          <DropSlot
            {...{ disabled, parentId }}
            owner={block.id}
            index={offset + index + 1}
          />
        </React.Fragment>
      ))}
    </div>
  );
}
function MidArea({
  spriteId,
  name,
  blocks,
  activeBlock,
  disabled,
  onChange,
  onRemove,
  onPlace,
  onClear,
  onRun,
  canRun,
}) {
  const groups = useMemo(() => workspaceGroups(blocks), [blocks]);
  useEffect(() => cancelActiveDrag, [spriteId, disabled]);
  const width = Math.max(
    1200,
    ...groups.map((group) => group.position.x + 650),
  );
  const height = Math.max(
    1000,
    ...groups.map((group) => group.position.y + 700),
  );
  useEffect(() => {
    const handleDrop = (event) => {
      if (!disabled)
        onPlace(
          event.detail.payload,
          event.detail.parentId,
          event.detail.index,
          event.detail.position,
        );
    };
    window.addEventListener("scratch-drop", handleDrop);
    return () => window.removeEventListener("scratch-drop", handleDrop);
  }, [disabled, onPlace]);
  return (
    <section className="workspace panel">
      <div className="panel-heading">
        <div>
          <h2>
            Code <span className="script-target">{name}</span>
          </h2>
        </div>
        <button
          className="text-button"
          disabled={disabled || !blocks.length}
          onClick={onClear}
        >
          Clear
        </button>
      </div>
      <p className="workspace-instruction">
        Click a block to run it and the blocks below. Drag to move or connect.
      </p>
      <div className="workspace-scroll">
        <div
          className="workspace-canvas"
          data-workspace-canvas
          data-enabled={!disabled}
          style={{ width, height }}
        >
          {groups.map((group) => (
            <div
              key={group.blocks[0].id}
              className="script-stack"
              style={{ left: group.position.x, top: group.position.y }}
            >
              <BlockList
                blocks={group.blocks}
                offset={group.start}
                activeBlock={activeBlock}
                {...{ disabled, onChange, onRemove, onPlace, onRun, canRun }}
              />
            </div>
          ))}
        </div>
      </div>
      {!blocks.length && (
        <p className="workspace-hint">
          Drag a block from the left and release it anywhere here.
        </p>
      )}
    </section>
  );
}

export default React.memo(MidArea);
