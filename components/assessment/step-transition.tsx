"use client";

import { type ReactNode, useRef } from "react";
import { SwitchTransition, CSSTransition } from "react-transition-group";

const TIMEOUT = 250;

export function StepTransition({
  stepKey,
  direction,
  children,
}: {
  stepKey: string | number;
  direction: "forward" | "back";
  children: ReactNode;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="w-full max-w-md"
      style={{ "--step-x": direction === "forward" ? "80px" : "-80px" } as React.CSSProperties}
    >
      <SwitchTransition mode="out-in">
        <CSSTransition
          key={stepKey}
          nodeRef={nodeRef}
          timeout={TIMEOUT}
          classNames="step"
        >
          <div ref={nodeRef}>
            {children}
          </div>
        </CSSTransition>
      </SwitchTransition>
    </div>
  );
}
