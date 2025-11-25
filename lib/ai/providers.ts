import { openai } from "@ai-sdk/openai";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        // Using OpenAI models - set OPENAI_API_KEY in .env.local
        // GPT-4o-mini: $0.15/$0.60 per million tokens (billigst med god kvalitet)
        // GPT-3.5-turbo: $0.50/$1.50 per million tokens (billigere, lavere kvalitet)
        // GPT-4o: $2.50/$10.00 per million tokens (best kvalitet, dyrere)
        "chat-model": openai("gpt-4o-mini"),
        "chat-model-reasoning": wrapLanguageModel({
          model: openai("gpt-4o-mini"),
          middleware: extractReasoningMiddleware({ tagName: "think" }),
        }),
        "title-model": openai("gpt-4o-mini"),
        "artifact-model": openai("gpt-4o"),
      },
    });
