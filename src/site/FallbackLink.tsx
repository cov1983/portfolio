// The Fallback Page link (spec: Title Screen, AC-1.1, 1.2), the same paragraph on the Title Screen
// and on the readable failure (AC-22.2): one text, one href, so a test finds it by either.
export function FallbackLink() {
  return (
    <p className="fallback">
      <a href="/exhibits">Every Exhibit, the Bio and the Contact as a plain page</a>
    </p>
  )
}
