"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { ChatHeader } from "@/components/chat-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { Vote } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { cn, fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { parseMetadataFromText, removeMetadataFromText } from "@/lib/utils/metadata-parser";
import { Artifact } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { SourceSidebar, type MessageMetadata } from "./source-sidebar";
import { toast } from "./toast";
import type { VisibilityType } from "./visibility-selector";

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  autoResume,
  initialLastContext,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
  initialLastContext?: AppUsage;
}) {
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>("");
  const [usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [messageMetadata, setMessageMetadata] = useState<Record<string, MessageMetadata>>({});
  const currentModelIdRef = useRef(currentModelId);

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        return {
          body: {
            id: request.id,
            message: request.messages.at(-1),
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibilityType,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      if (dataPart.type === "data-usage") {
        setUsage(dataPart.data);
      }
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        // Check if it's a credit card error
        if (
          error.message?.includes("AI Gateway requires a valid credit card")
        ) {
          setShowCreditCardAlert(true);
        } else {
          toast({
            type: "error",
            description: error.message,
          });
        }
      }
    },
  });

  const searchParams = useSearchParams();
  const query = searchParams.get("query");

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    if (query && !hasAppendedQuery) {
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, hasAppendedQuery, id]);

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
  );

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  // Parse metadata from assistant messages
  useEffect(() => {
    const newMetadata: Record<string, MessageMetadata> = {};
    let latestMessageWithMetadata: string | null = null;
    let firstMessageWithMetadata: string | null = null;
    
    messages.forEach((message) => {
      if (message.role === "assistant") {
        const textParts = message.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("");
        
        const metadata = parseMetadataFromText(textParts);
        if (metadata) {
          // Find the corresponding user message (the last user message before this assistant message)
          const messageIndex = messages.indexOf(message);
          let userMessageIndex = -1;
          for (let i = messageIndex - 1; i >= 0; i--) {
            if (messages[i].role === "user") {
              userMessageIndex = i;
              break;
            }
          }
          
          if (userMessageIndex !== -1) {
            const userMessage = messages[userMessageIndex];
            const userPrompt = userMessage.parts
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("");
            
            newMetadata[message.id] = {
              ...metadata,
              userPrompt,
            };
          } else {
            newMetadata[message.id] = metadata;
          }
          
          // Track the first and latest message with metadata
          if (!firstMessageWithMetadata) {
            firstMessageWithMetadata = message.id;
          }
          latestMessageWithMetadata = message.id;
        }
      }
    });
    
    setMessageMetadata(newMetadata);
    
    // Automatically open sidebar for the latest message with metadata
    // Prioritize first message if sidebar is closed, otherwise use latest
    if (latestMessageWithMetadata && newMetadata[latestMessageWithMetadata]) {
      // If sidebar is closed, open for first message (if it exists) or latest
      if (selectedMessageId === null) {
        const messageToOpen = firstMessageWithMetadata || latestMessageWithMetadata;
        setSelectedMessageId(messageToOpen);
      } 
      // If sidebar is open for a different message, update to latest
      else if (selectedMessageId !== latestMessageWithMetadata) {
        setSelectedMessageId(latestMessageWithMetadata);
      }
    }
  }, [messages, selectedMessageId]);

  const selectedMetadata = selectedMessageId
    ? messageMetadata[selectedMessageId]
    : null;

  return (
    <>
      <div className={cn(
        "overscroll-behavior-contain flex h-dvh min-w-0 touch-pan-y flex-col bg-background relative",
        selectedMessageId && selectedMetadata && "pr-80"
      )}>
        <ChatHeader
          chatId={id}
          isReadonly={isReadonly}
          selectedVisibilityType={initialVisibilityType}
        />

        <Messages
          chatId={id}
          isArtifactVisible={isArtifactVisible}
          isReadonly={isReadonly}
          messages={messages}
          regenerate={regenerate}
          selectedModelId={initialChatModel}
          setMessages={setMessages}
          status={status}
          votes={votes}
          onMessageClick={(messageId) => {
            if (messageMetadata[messageId]) {
              setSelectedMessageId(
                selectedMessageId === messageId ? null : messageId
              );
            }
          }}
          selectedMessageId={selectedMessageId}
        />

        <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
          {!isReadonly && (
            <MultimodalInput
              attachments={attachments}
              chatId={id}
              input={input}
              messages={messages}
              onModelChange={setCurrentModelId}
              selectedModelId={currentModelId}
              selectedVisibilityType={visibilityType}
              sendMessage={sendMessage}
              setAttachments={setAttachments}
              setInput={setInput}
              setMessages={setMessages}
              status={status}
              stop={stop}
            />
          )}
        </div>
      </div>

      <SourceSidebar
        metadata={selectedMetadata}
        isOpen={selectedMessageId !== null && selectedMetadata !== null}
        onClose={() => setSelectedMessageId(null)}
      />

      <Artifact
        attachments={attachments}
        chatId={id}
        input={input}
        isReadonly={isReadonly}
        messages={messages}
        regenerate={regenerate}
        selectedModelId={currentModelId}
        selectedVisibilityType={visibilityType}
        sendMessage={sendMessage}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status={status}
        stop={stop}
        votes={votes}
      />

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = "/";
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
