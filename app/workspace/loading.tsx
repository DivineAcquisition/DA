export default function WorkspaceLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="h-8 w-48 rounded-lg bg-white/10" />
      <div className="h-4 w-80 max-w-full rounded bg-white/[0.06]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 rounded-2xl bg-white/[0.04]" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-white/[0.04]" />
    </div>
  );
}
