export default function StoreChangePasswordPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-5 py-10 text-neutral-950">
      <section className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center">
        <p className="text-sm font-semibold uppercase text-amber-700">Required</p>
        <h1 className="mt-3 text-3xl font-semibold">Change password</h1>
        <p className="mt-4 text-sm leading-6 text-neutral-600">
          This account is marked `must_change_password`. Store operations stay blocked until the first password change
          is completed.
        </p>
      </section>
    </main>
  );
}
