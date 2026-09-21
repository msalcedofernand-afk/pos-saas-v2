import type { Metadata } from "next";
import { DashboardShell } from "@/components/layout/DashboardShell";

export const metadata: Metadata = { title: "Panel operativo", robots: { index: false, follow: false } };

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <DashboardShell>{children}</DashboardShell>;
}
