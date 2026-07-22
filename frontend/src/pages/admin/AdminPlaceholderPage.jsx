export function AdminPlaceholderPage({ title, description }) {
  return (
    <div className="rounded-[28px] border border-gold/20 bg-ivory-2 p-8 text-center">
      <p className="text-xs font-black uppercase tracking-[.12em] text-gold">Coming in Phase 3</p>
      <h1 className="mt-2 font-display text-2xl text-navy">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        {description || 'This admin module will be built in a later phase.'}
      </p>
    </div>
  )
}
