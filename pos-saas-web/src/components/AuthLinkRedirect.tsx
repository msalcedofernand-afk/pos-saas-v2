"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function AuthLinkRedirect() {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.slice(1));
    if (!params.has("access_token") && !params.has("error_code")) return;
    const target = params.get("type") === "signup" ? "/register/restaurant" : "/auth/update-password";
    router.replace(`${target}${hash}`);
  }, [router]);
  return null;
}
