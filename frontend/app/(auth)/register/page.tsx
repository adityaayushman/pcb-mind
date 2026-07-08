"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (!data.session) {
      // Email confirmation is required — this is success, not a failure,
      // and previously rendered through the same red error state as an
      // actual signup failure.
      setAwaitingConfirmation(true);
      return;
    }

    // Create the organization + profile row via the backend
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/bootstrap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({ full_name: fullName, organization_name: orgName }),
    });

    router.push("/dashboard");
  }

  if (awaitingConfirmation) {
    return (
      <main className="max-w-sm mx-auto px-6 py-24">
        <h1 className="text-2xl font-semibold mb-4">Check your email</h1>
        <p className="text-neutral-400 text-sm">
          We sent a confirmation link to <span className="text-neutral-100">{email}</span>.
          Click it to finish creating your account, then{" "}
          <Link href="/login" className="text-brand-500 hover:underline">
            sign in
          </Link>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-sm mx-auto px-6 py-24">
      <h1 className="text-2xl font-semibold mb-8">Create your account</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          placeholder="Full name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5"
        />
        <input
          placeholder="Organization name"
          required
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5"
        />
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5"
        />
        <input
          type="password"
          placeholder="Password"
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
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </main>
  );
}
