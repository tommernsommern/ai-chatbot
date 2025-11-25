"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo } from "react";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlusIcon } from "./icons";
import { useSidebar } from "./ui/sidebar";
import type { VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
  onSidebarToggle,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  onSidebarToggle?: () => void;
}) {
  const router = useRouter();
  const { open } = useSidebar();

  return (
    <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      <SidebarToggle onToggle={onSidebarToggle} />

      {/* Always render button, use CSS to hide on desktop when sidebar is open */}
      {/* On mobile (< 768px), always show. On desktop, only show when sidebar is closed */}
      <Button
        className={cn(
          "order-2 ml-auto h-8 px-2 md:order-1 md:ml-0 md:h-fit md:px-2",
          open && "md:hidden"
        )}
        onClick={() => {
          router.push("/");
          router.refresh();
        }}
        variant="outline"
      >
        <PlusIcon />
        <span className="md:sr-only">Ny samtale</span>
      </Button>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.isReadonly === nextProps.isReadonly &&
    prevProps.onSidebarToggle === nextProps.onSidebarToggle
  );
});
