"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;
    const isAdminDomain = hostname.startsWith("admin.");
    const isAdminRoute = pathname?.startsWith("/admin");

    // If on admin domain, redirect to /admin/users if trying to access non-admin pages
    if (isAdminDomain && !isAdminRoute && pathname !== "/login" && pathname !== "/signup") {
      router.replace("/admin/users");
      return;
    }

    // If on normal domain, redirect to / if trying to access admin pages
    if (!isAdminDomain && isAdminRoute) {
      router.replace("/");
      return;
    }

    setIsAuthorized(true);
  }, [pathname, router]);

  if (!isAuthorized) {
    return null; // or a loading spinner
  }

  return <>{children}</>;
}
