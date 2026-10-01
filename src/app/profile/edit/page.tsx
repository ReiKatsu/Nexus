import { redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";

import EditProfileForm from "./EditProfileForm";

export default async function EditProfilePage() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");

  const { data: profile, error } = await supabase.from("profiles")
    .select("nama_lengkap, bio, role_app, status_akun, primary_class_id")
    .eq("user_id", auth.user.id).maybeSingle();
  if (!error && profile?.role_app === "STUDENT" && profile.primary_class_id === null) {
    redirect("/onboarding");
  }

  if (error || !profile || profile.status_akun !== "ACTIVE") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold">Edit profil belum tersedia</h1>
        <p role="alert" className="mt-4 text-red-700">Data profil atau akses akun sedang tidak tersedia.</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar displayName={profile.nama_lengkap} activeItem="profile"
        isAdmin={profile.role_app === "ADMIN"} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold">Edit nama dan bio</h1>
        <p className="mt-2 text-sm text-slate-600">
          Perubahan tersimpan pada profil NEXUS milikmu.
        </p>
        <EditProfileForm name={profile.nama_lengkap} bio={profile.bio ?? ""} />
      </main>
    </div>
  );
}
