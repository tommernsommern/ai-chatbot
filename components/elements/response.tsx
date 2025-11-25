"use client";

import { type ComponentProps, memo, useMemo } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import { removeMetadataFromText } from "@/lib/utils/metadata-parser";

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, children, ...props }: ResponseProps) => {
    // Remove metadata from text before rendering, even during streaming
    const cleanedChildren = useMemo(() => {
      if (typeof children === "string") {
        return removeMetadataFromText(children);
      }
      return children;
    }, [children]);

    return (
      <Streamdown
        className={cn(
          "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto",
          className
        )}
        {...props}
      >
        {cleanedChildren}
      </Streamdown>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";
