"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // Always show the same confirmation regardless of whether the email is
    // registered — confirming/denying an account's existence here is a
    // real (if minor) information leak.
    setSent(true);
  }

  if (sent) {
    return (
      <main className="max-w-sm mx-auto px-6 py-24">
        <h1 className="text-2xl font-semibold mb-4">Check your email</h1>
        <p className="text-neutral-400 text-sm">
          If an account exists for <span className="text-neutral-100">{email}</span>, we sent a
          password reset link to it.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-sm mx-auto px-6 py-24">
      <h1 className="text-2xl font-semibold mb-8">Reset your password</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 transition-colors py-2.5 rounded-lg font-medium text-neutral-950"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="text-sm text-neutral-500 mt-6">
        <Link href="/login" className="text-brand-500 hover:underline">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
