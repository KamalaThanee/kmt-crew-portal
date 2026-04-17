"use client";
import { useSearchParams } from "next/navigation";

export default function InventoryPage() {
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter");

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white uppercase mb-4">
        {filter === "low-stock" ? "Low Stock Items" : "All Inventory"}
      </h1>
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 text-center text-slate-500">
        Waiting for Database Schema to show table here...
      </div>
    </div>
  );
}
