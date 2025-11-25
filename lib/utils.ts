import type {
  CoreAssistantMessage,
  CoreToolMessage,
  UIMessage,
  UIMessagePart,
} from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { formatISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import type { DBMessage, Document } from '@/lib/db/schema';
import { ChatSDKError, type ErrorCode } from './errors';
import type { ChatMessage, ChatTools, CustomUIDataTypes } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const { code, cause } = await response.json();
    throw new ChatSDKError(code as ErrorCode, cause);
  }

  return response.json();
};

export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const { code, cause } = await response.json();
      throw new ChatSDKError(code as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ChatSDKError('offline:chat');
    }

    throw error;
  }
}

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type ResponseMessageWithoutId = CoreToolMessage | CoreAssistantMessage;
type ResponseMessage = ResponseMessageWithoutId & { id: string };

export function getMostRecentUserMessage(messages: UIMessage[]) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Document[],
  index: number,
) {
  if (!documents) { return new Date(); }
  if (index > documents.length) { return new Date(); }

  return documents[index].createdAt;
}

export function getTrailingMessageId({
  messages,
}: {
  messages: ResponseMessage[];
}): string | null {
  const trailingMessage = messages.at(-1);

  if (!trailingMessage) { return null; }

  return trailingMessage.id;
}

export function sanitizeText(text: string) {
  if (!text) return text;
  
  // Remove function call tags and metadata tags
  let cleaned = text
    .replace('<has_function_call>', '')
    .replace(/<metadata>[\s\S]*?<\/metadata>/gi, '')
    .replace(/<METADATA>[\s\S]*?<\/METADATA>/gi, '')
    .replace(/<Metadata>[\s\S]*?<\/Metadata>/gi, '');
  
  // Remove any trust:score patterns
  cleaned = cleaned.replace(/trust:score_[a-z]+/gi, '');
  cleaned = cleaned.replace(/trust\s*:\s*score[_\s]*[a-z]+/gi, '');
  
  // Remove JSON objects that look like metadata (even without tags)
  // This catches cases where AI outputs JSON directly in the response
  try {
    // Remove multiline JSON blocks with metadata structure
    const metadataJsonPattern = /\{\s*"confidence"\s*:\s*\d+\s*,\s*"sources"\s*:[\s\S]*?\}/gs;
    let prevCleaned = "";
    let iterations = 0;
    while (prevCleaned !== cleaned && iterations < 10) {
      prevCleaned = cleaned;
      cleaned = cleaned.replace(metadataJsonPattern, "");
      iterations++;
    }
    
    // Remove any JSON object with confidence field (simpler pattern)
    const simpleJsonPattern = /\{\s*"confidence"\s*:\s*\d+[^}]*\}/gi;
    cleaned = cleaned.replace(simpleJsonPattern, "");
    
    // Remove JSON at the end of text (common case)
    const endJsonPattern = /\n\s*\{\s*"confidence"[\s\S]*?\}\s*$/s;
    cleaned = cleaned.replace(endJsonPattern, "");
    
    // Remove nested JSON with confidence
    const nestedJsonPattern = /\{[^{}]*(?:"confidence"|"sources"|"uncertainties")[^{}]*\}/gi;
    iterations = 0;
    while (prevCleaned !== cleaned && iterations < 10) {
      prevCleaned = cleaned;
      cleaned = cleaned.replace(nestedJsonPattern, "");
      iterations++;
    }
    
    // Remove JSON that appears after newlines
    const newlineJsonPattern = /\n\s*\{\s*"confidence"[\s\S]*?\}\s*\n?/gs;
    cleaned = cleaned.replace(newlineJsonPattern, "\n");
    
    // Remove indented JSON blocks
    const indentedJsonPattern = /^\s*\{\s*"confidence"[\s\S]*?\}\s*$/gm;
    cleaned = cleaned.replace(indentedJsonPattern, "");
    
    // Remove any remaining JSON-like patterns
    const quoteJsonPattern = /"confidence"\s*:\s*\d+[^}]*"sources"[^}]*/gi;
    cleaned = cleaned.replace(quoteJsonPattern, "");
  } catch (e) {
    // If regex fails, continue
  }
  
  return cleaned.trim();
}

export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as 'user' | 'assistant' | 'system',
    parts: message.parts as UIMessagePart<CustomUIDataTypes, ChatTools>[],
    metadata: {
      createdAt: formatISO(message.createdAt),
    },
  }));
}

export function getTextFromMessage(message: ChatMessage | UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => (part as { type: 'text'; text: string}).text)
    .join('');
}
