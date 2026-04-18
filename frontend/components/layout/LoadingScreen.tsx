export function LoadingScreen({ label = "Loading MentorSync..." }: { label?: string }) {
  return (
    <div className="app-shell flex items-center justify-center">
      <div className="glass-panel w-full max-w-lg p-10 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-ocean/20 border-t-ocean" />
        <p className="mt-5 text-lg font-medium text-ink">{label}</p>
      </div>
    </div>
  );
}
