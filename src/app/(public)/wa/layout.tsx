import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hospital Services",
  description: "Book appointments, manage your healthcare",
};

export default function WaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-950 dark:via-blue-950/20 dark:to-indigo-950/10">
      <div className="max-w-lg mx-auto min-h-screen flex flex-col">
        {/* Top gradient bar */}
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        <main className="flex-1 px-4 py-6 pb-20">
          {children}
        </main>
      </div>
    </div>
  );
}
