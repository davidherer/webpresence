"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch("/api/auth/user/session");
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          router.push("/");
        }
      } catch (error) {
        router.push("/");
      } finally {
        setIsLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
