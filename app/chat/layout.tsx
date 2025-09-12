import { cookies } from "next/headers";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset>
        <div className="sticky top-0 z-40 flex items-center gap-2 bg-background/80 px-3 py-2 backdrop-blur">
          <SidebarTrigger />
          <div className="text-sm text-muted-foreground">Chat</div>
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}


