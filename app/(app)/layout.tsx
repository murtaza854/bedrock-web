import { Sidebar } from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 max-w-7xl flex-1 p-8 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
