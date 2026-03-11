import type { Metadata } from "next";
import { AssessmentClient } from "@/components/assessment/assessment-client";

export const metadata: Metadata = {
  title: "Health Assessment | Prism Health",
  description:
    "Get a personalized health assessment powered by evidence-based bioenergetic analysis. Discover the root-cause patterns behind your health concerns.",
};

export default function AssessmentPage() {
  return <AssessmentClient />;
}
