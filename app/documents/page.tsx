import Link from "next/link";

export default function DocumentsPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6 text-zinc-950">
      <section className="w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          Documents
        </p>
        <h1 className="mt-4 text-3xl font-semibold">
          Document support arrives in Phase 3.
        </h1>
        <p className="mt-4 leading-7 text-zinc-600">
          This route is reserved for upload, indexing, and retrieval workflows.
          Phase 2 focuses on the chat foundation and provider wiring.
        </p>
        <Link
          className="mt-8 inline-flex rounded-2xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white"
          href="/chat"
        >
          Back to chat
        </Link>
      </section>
    </main>
  );
}
