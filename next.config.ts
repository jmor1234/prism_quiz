import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/quiz",
        permanent: false,
      },
      // Pre-rename slug, superseded twice. Left pointing at best-life-harbor
      // rather than retargeted: browsers that already cached this 308 will
      // never re-request it, so retargeting changes nothing for them, and the
      // second hop below lands them in the right place either way.
      {
        source: "/quiz/best-life-care",
        destination: "/quiz/best-life-harbor",
        permanent: true,
      },
      // The partner intake is now the generic /quiz/prism-assessment.
      //
      // Deliberately 307, not 308: the result path below was handed out as a
      // shareable link, and a 308 is cached by browsers indefinitely — if the
      // destination ever needs adjusting, clients that cached it can't be
      // reached. Promote both to permanent once the rename has baked.
      {
        source: "/quiz/best-life-harbor",
        destination: "/quiz/prism-assessment",
        permanent: false,
      },
      {
        source: "/quiz/best-life-harbor/result/:quizId",
        destination: "/quiz/prism-assessment/result/:quizId",
        permanent: false,
      },
      {
        source: "/admin/best-life-care",
        destination: "/admin/best-life-harbor",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
