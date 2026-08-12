"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api";

export default function AuthGuard({ children }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time auth check on mount
      setChecked(true);
    }
  }, [router]);

  if (!checked) return null; // avoid a flash of protected content pre-redirect
  return children;
}
