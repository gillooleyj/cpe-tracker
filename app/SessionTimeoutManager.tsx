"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";
import SessionTimeoutModal from "./SessionTimeoutModal";

// Configurable via .env — defaults to 15 minutes per NIST SP 800-171 AC.L1-3.1.11.
const TIMEOUT_MINUTES = Number(
  process.env.NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES ?? "15"
);
const TIMEOUT_MS = TIMEOUT_MINUTES * 60 * 1_000;
const WARNING_MS = 2 * 60 * 1_000; // show warning 2 min before logout

export default function SessionTimeoutManager() {
  const { user } = useAuth();
  const router = useRouter();

  const handleTimeout = useCallback(async () => {
    await supabase.auth.signOut();
    // The ?timeout=1 param tells the login page to show the expiry message.
    router.push("/login?timeout=1");
    router.refresh();
  }, [router]);

  const { showWarning, secondsLeft, keepAlive } = useInactivityTimeout({
    timeoutMs: TIMEOUT_MS,
    warningMs: WARNING_MS,
    onTimeout: handleTimeout,
    // Timer only runs while a user is logged in.
    enabled: !!user,
  });

  async function handleLogOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (!showWarning) return null;

  return (
    <SessionTimeoutModal
      secondsLeft={secondsLeft}
      onStayLoggedIn={keepAlive}
      onLogOut={handleLogOut}
    />
  );
}
