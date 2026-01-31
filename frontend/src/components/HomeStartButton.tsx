"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuth } from "@/app/providers";
import { Button } from "@/components/ui/button";

type HomeStartButtonProps = {
  className?: string;
};

export function HomeStartButton({ className }: HomeStartButtonProps) {
  const { user, loading } = useAuth();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated || loading) {
    return (
      <Button size="lg" className={className} disabled>
        読み込み中...
      </Button>
    );
  }

  const href = user ? "/assignments" : "/auth/login";
  const label = user ? "授業一覧へ" : "始める";

  return (
    <Button asChild size="lg" className={className}>
      <Link href={href}>{label}</Link>
    </Button>
  );
}
