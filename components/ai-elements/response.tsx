"use client";

import { cn } from "@/lib/utils";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";

type ResponseProps = ComponentProps<typeof Streamdown> & {
  variant?: "default" | "report";
};

export const Response = memo(
  ({ className, variant = "default", ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        "[&_a]:text-blue-600 [&_a]:dark:text-blue-400 [&_a]:hover:underline",
        variant === "report" && "report-markdown",
        className
      )}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children && prevProps.variant === nextProps.variant
);

Response.displayName = "Response";
