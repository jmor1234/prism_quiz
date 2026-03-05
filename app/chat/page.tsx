"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLatestThread, createThread } from "@/lib/chat/thread-store";
import { Loader2 } from "lucide-react";

export default function ChatRedirectPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) return;
    setReady(true);

    (async () => {
      const latest = await getLatestThread();
      if (latest) {
        router.replace(`/chat/${latest.id}`);
      } else {
        const id = await createThread();
        router.replace(`/chat/${id}`);
      }
    })();
  }, [ready, router]);

  return (
    <div className="min-h-screen flex items-center justify-center" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <span className="sr-only">Loading chat...</span>
    </div>
  );
}
