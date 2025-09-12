"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createThread, listThreads } from "@/lib/thread-store";

export default function ChatRedirect() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const list = await listThreads();
      if (list.length > 0) {
        router.replace(`/chat/${list[0].id}`);
      } else {
        const id = await createThread();
        router.replace(`/chat/${id}`);
      }
    })();
  }, [router]);

  return null;
}


