import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hospital Services",
  description: "Book appointments, manage your healthcare",
};

export default function WaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {children}
    </div>
  );
}
