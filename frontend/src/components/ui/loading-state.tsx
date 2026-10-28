export function LoadingState({ label = 'Loading your workspace…' }: { label?: string }) {
  return (
    <section className="loading-state" role="status" aria-live="polite">
      <p>{label}</p>
      <div aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}
