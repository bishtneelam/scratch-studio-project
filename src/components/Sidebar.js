import React, { useState } from "react";
import BlockCard from "./BlockCard";
import { beginDrag } from "../lib/drag";
import { makeBlock, cloneBlock } from "../lib/program";
const categories = [
  { name: "Motion", types: ["move", "turn", "turnLeft", "goto"] },
  { name: "Looks", types: ["say", "think"] },
  { name: "Control", types: ["repeat"] },
];
function Sidebar({ disabled, onAdd, onPreview, spriteId, spriteX, spriteY }) {
  const [templates, setTemplates] = useState(() =>
    Object.fromEntries(
      categories
        .flatMap((c) => c.types)
        .map((type) => [
          type,
          type === "turnLeft"
            ? { ...makeBlock("turn"), rotation: "anticlockwise" }
            : makeBlock(type),
        ]),
    ),
  );
  const [categoryName, setCategoryName] = useState("Motion");
  // Draft coordinates belong to the current sprite position. Deriving them
  // avoids a second state update on every animation frame.
  const anchor = `${spriteId}:${spriteX}:${spriteY}`;
  const gotoTemplate =
    templates.goto.anchor === anchor
      ? templates.goto
      : { ...templates.goto, x: spriteX, y: spriteY };
  const templateFor = (type) =>
    type === "goto" ? gotoTemplate : templates[type];
  const actionName = (type) =>
    type === "turnLeft" ? "anticlockwise turn" : type;
  return (
    <aside className="palette panel">
      <nav className="category-rail" aria-label="Block categories">
        {categories.map((category) => (
          <button
            key={category.name}
            className={
              categoryName === category.name ? "category-selected" : ""
            }
            onClick={() => {
              setCategoryName(category.name);
              document
                .getElementById(`category-${category.name}`)
                .scrollIntoView({ block: "start", behavior: "smooth" });
            }}
          >
            <span className={`category-dot ${category.name.toLowerCase()}`} />
            {category.name}
          </button>
        ))}
      </nav>
      <div className="palette-scroll">
        {categories.map((category) => (
          <section
            key={category.name}
            id={`category-${category.name}`}
            className="block-category"
          >
            <h3>{category.name}</h3>
            {category.types.map((type) => (
              <div key={type} className="palette-item">
                <BlockCard
                  block={templateFor(type)}
                  draggable={!disabled}
                  onDragStart={(e) =>
                    beginDrag(e, {
                      source: "palette",
                      block: templateFor(type),
                    })
                  }
                  onChange={(patch) =>
                    setTemplates((prev) => ({
                      ...prev,
                      [type]: {
                        ...templateFor(type),
                        ...patch,
                        ...(type === "goto" ? { anchor } : {}),
                      },
                    }))
                  }
                />
                <div className="block-actions">
                  <button
                    disabled={disabled}
                    onClick={() => onAdd(cloneBlock(templateFor(type)))}
                    aria-label={`Add ${actionName(type)} block`}
                  >
                    + Add
                  </button>
                  {type !== "repeat" && (
                    <button
                      disabled={disabled}
                      onClick={() => onPreview(cloneBlock(templateFor(type)))}
                      aria-label={`Try ${actionName(type)} block`}
                    >
                      Try ↗
                    </button>
                  )}
                </div>
              </div>
            ))}
          </section>
        ))}
        <p className="palette-tip">
          Drag to add a block.
          <br />
          Try runs a single action.
        </p>
      </div>
    </aside>
  );
}

export default React.memo(Sidebar);
