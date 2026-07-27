type PlaceholderPageProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PlaceholderPage({ eyebrow, title, description }: PlaceholderPageProps) {
  return (
    <main className="min-h-screen bg-mist">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-leaf">{eyebrow}</p>
        <h1 className="mt-4 text-4xl font-semibold text-ink sm:text-6xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-700">{description}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded border border-zinc-200 bg-white p-4">
            <p className="text-sm font-semibold text-ink">Next.js</p>
            <p className="mt-2 text-sm text-zinc-600">App Router with strict TypeScript.</p>
          </div>
          <div className="rounded border border-zinc-200 bg-white p-4">
            <p className="text-sm font-semibold text-ink">Supabase</p>
            <p className="mt-2 text-sm text-zinc-600">Server-only service role access and RLS-first schema.</p>
          </div>
          <div className="rounded border border-zinc-200 bg-white p-4">
            <p className="text-sm font-semibold text-ink">Payments</p>
            <p className="mt-2 text-sm text-zinc-600">Mock provider now, 2C2P adapter stubbed for production.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
