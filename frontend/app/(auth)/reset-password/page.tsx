"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase's password-recovery link lands here with a recovery token in
    // the URL fragment; supabase-js parses it automatically and fires this
    // event. Also check getSession() directly in case the event already
    // fired before this listener was attached.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 1500);
  }

  if (done) {
    return (
      <main className="max-w-sm mx-auto px-6 py-24">
        <h1 className="text-2xl font-semibold mb-4">Password updated</h1>
        <p className="text-neutral-400 text-sm">Taking you to your dashboard…</p>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="max-w-sm mx-auto px-6 py-24">
        <h1 className="text-2xl font-semibold mb-4">Reset your password</h1>
        <p className="text-neutral-500 text-sm">
          Waiting for the reset link's session — if you navigated here directly rather than from
          the email link, request a new reset link instead.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-sm mx-auto px-6 py-24">
      <h1 className="text-2xl font-semibold mb-8">Choose a new password</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          placeholder="New password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 transition-colors py-2.5 rounded-lg font-medium text-neutral-950"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
    </main>
  );
}
