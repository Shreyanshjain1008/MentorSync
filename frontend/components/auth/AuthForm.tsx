"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { api } from "@/lib/api";
import { parseError } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import type { UserRole } from "@/types/auth";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "mentor" as UserRole,
  });

  const isSignup = mode === "signup";

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const response = isSignup
          ? await api.signup(form)
          : await api.login({ email: form.email, password: form.password });

        if (!response.access_token) {
          throw new Error(`${isSignup ? "Signup" : "Login"} succeeded but no active session was returned. Please try again.`);
        }

        setAuth(response);
        router.replace("/dashboard");
      } catch (submissionError) {
        setError(parseError(submissionError));
      }
    });
  };

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-ink">Email</span>
        <input
          required
          type="email"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ocean"
          placeholder="mentor@domain.com"
          value={form.email}
          onChange={(event) => setForm((state) => ({ ...state, email: event.target.value }))}
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-ink">Password</span>
        <input
          required
          minLength={8}
          type="password"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ocean"
          placeholder="StrongPass123"
          value={form.password}
          onChange={(event) => setForm((state) => ({ ...state, password: event.target.value }))}
        />
      </label>

      {isSignup ? (
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Role</span>
          <select
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ocean"
            value={form.role}
            onChange={(event) => setForm((state) => ({ ...state, role: event.target.value as UserRole }))}
          >
            <option value="mentor">Mentor</option>
            <option value="student">Student</option>
          </select>
        </label>
      ) : null}

      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div> : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl bg-ink px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Working..." : isSignup ? "Create account" : "Login"}
      </button>

      <p className="text-center text-sm text-slate-500">
        {isSignup ? "Already have an account?" : "Need an account?"}{" "}
        <Link
          className="font-medium text-ocean underline decoration-ocean/40 underline-offset-4"
          href={isSignup ? "/auth/login" : "/auth/signup"}
        >
          {isSignup ? "Login" : "Sign up"}
        </Link>
      </p>
    </form>
  );
}
