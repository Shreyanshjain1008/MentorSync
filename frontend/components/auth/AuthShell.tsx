export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="app-shell grid min-h-screen items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden rounded-4xl border border-slate-200/70 bg-white/70 p-10 shadow-float backdrop-blur xl:block">
        <span className="inline-flex rounded-full bg-ink px-3 py-1 font-mono text-xs uppercase tracking-[0.24em] text-white">
          {eyebrow}
        </span>
        <h2 className="balance-text mt-6 text-6xl font-semibold leading-[0.95] text-ink">
          Syncing Knowledge. Empowering Growth.
        </h2>
        <p className="mt-5 max-w-xl text-lg text-slate-600">
          MentorSync brings video, code, and chat into one focused room so each 1-on-1 session feels
          crisp, fast, and intentional.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { label: "Video", value: "Peer WebRTC" },
            { label: "Code", value: "Monaco sync" },
            { label: "Chat", value: "Real-time notes" },
          ].map((item) => (
            <div key={item.label} className="rounded-3xl bg-slate-950 px-5 py-6 text-white">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
              <p className="mt-3 text-xl font-medium">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-panel mx-auto w-full max-w-xl p-6 md:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-ocean">{eyebrow}</p>
        <h2 className="mt-3 text-4xl font-semibold tracking-tight text-ink">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{subtitle}</p>
        <div className="mt-8">{children}</div>
      </section>
    </main>
  );
}
