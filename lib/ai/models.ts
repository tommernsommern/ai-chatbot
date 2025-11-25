export const DEFAULT_CHAT_MODEL: string = "chat-model";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "chat-model",
    name: "gpt-4o-mini",
    description: "Kostnadseffektiv modell med god kvalitet ($0.15/$0.60 per million tokens)",
  },
];
