export const DEFAULT_CHAT_MODEL: string = "chat-model";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "chat-model",
    name: "gpt-5.1",
    description: "Avansert multimodal modell med visjon og tekstkapasitet",
  },
];
