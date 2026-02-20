import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { AssistantButton } from "@/components/assistant";
import { AuthGuard } from "@/components/providers/AuthGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Navigation */}
          <TopNav />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto bg-slate-50">
            {children}
          </main>
        </div>

        {/* Assistant Floating Button */}
        <AssistantButton />
      </div>
    </AuthGuard>
  );
}
