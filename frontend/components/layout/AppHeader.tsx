"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { initialsFromEmail } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

export function AppHeader() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  return (
    <header className="glass-panel mb-6 flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between md:p-5">
      <div>
        <Link href="/dashboard" className="text-2xl font-semibold tracking-tight text-ink">
          MentorSync
        </Link>
        <p className="mt-1 max-w-xl text-sm text-slate-600">
          Collaborate live with video, code, and chat in one focused room.
        </p>
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ocean font-mono text-sm font-semibold text-white">
                {initialsFromEmail(user.email)}
              </div>
              <div className="text-sm">
                <p className="font-medium text-ink">{user.email}</p>
                <p className="text-slate-500">{user.role}</p>
              </div>
            </div>
            <button
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              onClick={() => {
                logout();
                router.push("/auth/login");
              }}
            >
              Logout
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}
