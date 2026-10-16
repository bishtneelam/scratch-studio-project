import React from "react";
import CatSprite from "./CatSprite";
import Stage from "./Stage";
import { number } from "../lib/program";
import { LIMIT_X, LIMIT_Y } from "../lib/motion";
import { MAX_SPRITES } from "../lib/editor";

export default function PreviewArea({
  sprites,
  selectedId,
  onSelect,
  onAdd,
  onDelete,
  disabled,
  swaps,
  lastSwap,
  onPlay,
  onStop,
  onUpdate,
  onMove,
}) {
  const selected = sprites.find((s) => s.id === selectedId) || sprites[0];
  const coordinate = (field, limit) => (
    <input
      aria-label={`Sprite ${field}`}
      type="number"
      value={Math.round(selected[field])}
      disabled={disabled}
      onChange={(event) =>
        onUpdate({
          [field]: Math.max(
            -limit,
            Math.min(limit, number(event.target.value)),
          ),
        })
      }
    />
  );
  return (
    <section className="preview-column">
      <div className="stage-toolbar">
        <div className="stage-run-controls">
          <button
            className="flag-button"
            disabled={disabled}
            onClick={onPlay}
            aria-label="Play all"
            title="Run all sprites"
          >
            ⚑
          </button>
          <button
            className="stop-button"
            disabled={!disabled}
            onClick={onStop}
            aria-label="Stop"
            title="Stop all sprites"
          >
            ●
          </button>
        </div>
        <span className="stage-caption">Stage</span>
        <span className="stage-dimensions">480 × 360</span>
      </div>
      <Stage
        sprites={sprites}
        onSelect={onSelect}
        onMove={onMove}
        disabled={disabled}
      />
      <div className="target-pane">
        <div className="sprites-panel">
          <div className="sprite-properties">
            <div className="property-row">
              <label className="name-property">
                Sprite{" "}
                <input
                  aria-label="Sprite name"
                  value={selected.name}
                  disabled={disabled}
                  maxLength={24}
                  onChange={(event) => onUpdate({ name: event.target.value })}
                />
              </label>
              <label>↔ x {coordinate("x", LIMIT_X)}</label>
              <label>↕ y {coordinate("y", LIMIT_Y)}</label>
            </div>
            <div className="property-row secondary-properties">
              <span className="sprite-visible">
                Visible <span>◉</span>
              </span>
              <label>
                Direction {coordinate("direction", 360)}
                <span className="degree-mark">°</span>
              </label>
            </div>
          </div>
          <div className="sprite-list">
            {sprites.map((sprite, index) => (
              <div
                key={sprite.id}
                className={`sprite-item ${selectedId === sprite.id ? "selected" : ""}`}
              >
                <button
                  className={`sprite-tile ${selectedId === sprite.id ? "selected" : ""}`}
                  onClick={() => onSelect(sprite.id)}
                  aria-label={`Select ${sprite.name} script`}
                >
                  <div
                    className="sprite-thumb"
                    style={{ filter: `hue-rotate(${sprite.hue || 0}deg)` }}
                  >
                    <CatSprite size={40} />
                  </div>
                  <span>{sprite.name || "Sprite"}</span>
                </button>
                {selectedId === sprite.id && (
                  <button
                    className="delete-sprite"
                    disabled={disabled || sprites.length === 1}
                    aria-label={`Remove ${sprite.name}`}
                    onClick={() => onDelete(sprite.id)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="sprite-actions">
            <button
              disabled={disabled || sprites.length >= MAX_SPRITES}
              onClick={onAdd}
              className="add-sprite"
              aria-label="Add sprite"
              title="Add sprite"
            >
              +<span>Add sprite</span>
            </button>
          </div>
        </div>
        <aside className="backdrop-panel">
          <strong>Stage</strong>
          <div className="backdrop-thumbnail" />
          <span>Backdrops</span>
          <span>1</span>
        </aside>
      </div>
      <div
        className={`collision-card ${swaps ? "has-collision" : ""}`}
        aria-live="polite"
      >
        <strong>Collision swap</strong>
        <span>
          {swaps} {swaps === 1 ? "swap" : "swaps"}
        </span>
        <p>{lastSwap || "Touching sprites exchange their scripts."}</p>
      </div>
    </section>
  );
}
