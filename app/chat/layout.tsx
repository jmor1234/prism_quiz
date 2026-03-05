import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Prism Health — Chat",
  description:
    "Chat directly with Prism's AI health agent. Describe what you're experiencing and get research-backed insights.",
  openGraph: {
    title: "Prism Health — Chat",
    description:
      "Chat directly with Prism's AI health agent. Describe what you're experiencing and get research-backed insights.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prism Health — Chat",
    description:
      "Chat directly with Prism's AI health agent. Describe what you're experiencing and get research-backed insights.",
  },
};

export default function ChatLayout({ children }: { children: ReactNode }) {
  return children;
}
