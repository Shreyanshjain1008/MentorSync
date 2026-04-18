"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuthStore } from "@/store/auth-store";

export function useAuthGuard() {
  const router = useRouter();
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!user || !accessToken) {
      logout();
      router.replace("/auth/login");
    }
  }, [accessToken, hasHydrated, logout, router, user]);

  if (!hasHydrated || !user || !accessToken) {
    return null;
  }

  return user;
}
