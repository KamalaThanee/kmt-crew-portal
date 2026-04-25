"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const userStr = localStorage.getItem("kmt_user");
    if (!userStr) {
      router.replace("/login");
      return;
    }

    const user = JSON.parse(userStr);
    const isAdmin = ["Safety Officer", "Chief Officer", "Barge Master"].includes(user.position);

    if (isAdmin) {
      router.replace("/admin/dashboard");
    } else {
      router.replace("/ppe");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}
