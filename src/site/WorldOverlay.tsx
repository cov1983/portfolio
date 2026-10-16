import './site.css'

// The World's HTML overlay (spec, Implementation decisions: exactly the current caption, the Reset
// control and a one-line key legend; plan §2, module site: no three, Rapier or World model).
// The caption is the Announcer's (T8a): one `role="status"` element that is always there, so the
// text inserted when a caption is shown is announced; it holds text only while the app shows a
// caption, keyed by place so the fade-in starts again for a new place (none under reduced motion,
// AC-18.3). Activating the Reset control with a pointer hands focus back to the World container
// so the keys keep working (AC-12.2): src/world/World.tsx does that in `onReset`, since Reset is
// the model's, never app state.
export type OverlayCaption = { place: string; text: string }

type Props = { caption: OverlayCaption | null; onReset: () => void }

export function WorldOverlay({ caption, onReset }: Props) {
  return (
    <div className="world-overlay">
      <p role="status" className="caption">
        {caption !== null && <span key={caption.place}>{caption.text}</span>}
      </p>
      <button type="button" className="reset" onClick={onReset}>
        Reset
      </button>
      <p className="key-legend">Arrows or WASD steer · R resets · Esc shows the Title Screen</p>
    </div>
  )
}
