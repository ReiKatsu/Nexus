import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 lg:py-14">
      <div
        aria-hidden="true"
        className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-indigo-200/50 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-violet-200/50 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-lg">
        <header className="mb-8 text-center">
          <div className="mb-5 inline-flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-bold text-white shadow-lg shadow-indigo-200">
              N
            </span>
            <span className="text-xl font-bold tracking-[0.22em] text-slate-900">
              NEXUS
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Masuk ke NEXUS
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500 sm:text-base">
            Gunakan akun mahasiswa UNESA Anda untuk melanjutkan.
          </p>
        </header>

        <section className="rounded-3xl border border-white/80 bg-white/90 p-6 shadow-xl shadow-slate-200/60 backdrop-blur sm:p-10">
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
