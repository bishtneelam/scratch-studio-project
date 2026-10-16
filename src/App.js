import React from "react";
import Sidebar from "./components/Sidebar";
import MidArea from "./components/MidArea";
import PreviewArea from "./components/PreviewArea";
import useEditor from "./hooks/useEditor";
import "./styles.css";

export default function App() {
  const editor = useEditor();
  const { state, selected } = editor;
  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">S</span>
          <div>
            <h1>Scratch Studio</h1>
            <p>Visual coding editor</p>
          </div>
        </div>
        <div className="toolbar">
          <button
            className="secondary-button"
            disabled={state.running}
            onClick={editor.loadDemo}
          >
            Load collision demo
          </button>
          <button className="secondary-button" onClick={editor.reset}>
            ↺ Reset
          </button>
        </div>
      </header>
      <div className="status-bar" role="status">
        <span className={`status-dot ${state.running ? "is-running" : ""}`} />
        {state.status}
      </div>
      <div className="editor-layout">
        <Sidebar
          spriteId={selected.id}
          spriteX={Math.round(selected.x)}
          spriteY={Math.round(selected.y)}
          disabled={state.running}
          onPreview={editor.preview}
          onAdd={editor.addBlock}
        />
        <MidArea
          spriteId={selected.id}
          name={selected.name}
          blocks={selected.blocks}
          activeBlock={selected.activeBlock}
          disabled={state.running}
          canRun={!state.running || state.runMode === "stack"}
          onRun={editor.play}
          onChange={editor.changeBlock}
          onRemove={editor.removeBlock}
          onPlace={editor.placeBlock}
          onClear={editor.clearProgram}
        />
        <PreviewArea
          sprites={state.sprites}
          selectedId={selected.id}
          disabled={state.running}
          onSelect={editor.select}
          onAdd={editor.addSprite}
          onDelete={editor.deleteSprite}
          onMove={editor.moveSprite}
          onUpdate={editor.update}
          onPlay={editor.play}
          onStop={editor.stop}
          swaps={state.swaps}
          lastSwap={state.lastSwap}
        />
      </div>
    </main>
  );
}
