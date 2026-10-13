import './site.css'

// The World's HTML overlay (spec, Implementation decisions: exactly the current caption, the Reset
// control and a one-line key legend; plan §2, module site: no three, Rapier or World model). T5b
// ships the Reset control and the legend; the caption element is T8a's. Activating the control
// with a pointer hands focus back to the World container so the keys keep working (AC-12.2):
// src/world/World.tsx does that in `onReset`, since Reset is the model's, never app state.
type Props = { onReset: () => void }

export function WorldOverlay({ onReset }: Props) {
  return (
    <div className="world-overlay">
      <button type="button" className="reset" onClick={onReset}>
        Reset
      </button>
      <p className="key-legend">Arrows or WASD steer · R resets · Esc shows the Title Screen</p>
    </div>
  )
}
