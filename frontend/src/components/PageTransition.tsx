"use client";

import { usePathname, useSearchParams } from "next/navigation";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams?.toString();
  const key = query ? `${pathname}?${query}` : pathname;

  return (
    <div key={key} className="page-transition">
      {children}
    </div>
  );
}
