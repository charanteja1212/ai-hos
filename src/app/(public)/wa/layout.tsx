import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hospital Services",
  description: "Book appointments, manage your healthcare",
};

export default function WaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-lg mx-auto min-h-screen flex flex-col">
        <div className="h-1 bg-cyan-700" />
        <main className="flex-1 px-4 py-5 pb-20">
          {children}
        </main>
      </div>
    </div>
  );
}
