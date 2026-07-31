export default function StoreLoginPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-5 py-10 text-neutral-950">
      <section className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center">
        <p className="text-sm font-semibold uppercase text-emerald-700">Store</p>
        <h1 className="mt-3 text-3xl font-semibold">Store login</h1>
        <p className="mt-4 text-sm leading-6 text-neutral-600">
          Store accounts use Supabase Auth. The production login form will exchange email and password for the secure
          `kc_access_token` cookie used by the protected store console.
        </p>
      </section>
    </main>
  );
}
