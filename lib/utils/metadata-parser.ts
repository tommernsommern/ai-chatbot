import type { MessageMetadata, SourceInfo, UncertaintyInfo } from "@/components/source-sidebar";

const METADATA_REGEX = /<metadata>([\s\S]*?)<\/metadata>/i;

export function parseMetadataFromText(text: string): MessageMetadata | null {
  const match = text.match(METADATA_REGEX);
  if (!match) return null;

  try {
    const metadataJson = match[1].trim();
    const parsed = JSON.parse(metadataJson);

    return {
      confidence: parsed.confidence,
      conclusion: parsed.conclusion || parsed.summary || undefined,
      sources: parsed.sources?.map((source: any) => ({
        url: source.url,
        title: source.title || source.url,
        trustLevel: source.trustLevel || "medium",
      })) as SourceInfo[],
      uncertainties: parsed.uncertainties?.map((uncertainty: any) => ({
        topic: uncertainty.topic || "Ukjent område",
        reason: uncertainty.reason || "Ingen grunn oppgitt",
        whatToCheck: uncertainty.whatToCheck || "Ingen spesifikk sjekk oppgitt",
      })) as UncertaintyInfo[],
    };
  } catch (error) {
    console.error("Failed to parse metadata:", error);
    return null;
  }
}

export function removeMetadataFromText(text: string): string {
  if (!text) return text;
  
  // Remove metadata tags (case-insensitive, multiline) - multiple passes to catch all variations
  let cleaned = text;
  
  // Remove standard metadata tags (including incomplete ones during streaming)
  cleaned = cleaned.replace(METADATA_REGEX, "");
  
  // Remove with different case variations
  cleaned = cleaned.replace(/<METADATA>[\s\S]*?<\/METADATA>/gi, "");
  cleaned = cleaned.replace(/<Metadata>[\s\S]*?<\/Metadata>/gi, "");
  
  // Remove incomplete metadata tags (during streaming, tag might not be closed yet)
  cleaned = cleaned.replace(/<metadata>[\s\S]*$/gi, "");
  cleaned = cleaned.replace(/<METADATA>[\s\S]*$/gi, "");
  cleaned = cleaned.replace(/<Metadata>[\s\S]*$/gi, "");
  
  // Remove escaped HTML entity versions
  cleaned = cleaned.replace(/&lt;metadata&gt;[\s\S]*?&lt;\/metadata&gt;/gi, "");
  cleaned = cleaned.replace(/&lt;METADATA&gt;[\s\S]*?&lt;\/METADATA&gt;/gi, "");
  
  // Remove any remaining metadata-like patterns (self-closing, malformed, etc.)
  cleaned = cleaned.replace(/<metadata[\s\S]*?\/metadata>/gi, "");
  cleaned = cleaned.replace(/<metadata[\s\S]*?>/gi, "");
  cleaned = cleaned.replace(/<\/metadata>/gi, "");
  
  // Remove any trust:score patterns that might appear
  cleaned = cleaned.replace(/trust:score_[a-z]+/gi, "");
  cleaned = cleaned.replace(/trust\s*:\s*score[_\s]*[a-z]+/gi, "");
  
  // Remove JSON objects that look like metadata (even without tags)
  // This catches cases where AI outputs JSON directly
  try {
    // More aggressive: remove any JSON-like structure with confidence field
    // This pattern matches nested JSON objects with confidence, sources, uncertainties
    const confidenceJsonPattern = /\{[^{}]*(?:"confidence"|"sources"|"uncertainties")[^{}]*\}/gi;
    let prevCleaned = "";
    let iterations = 0;
    while (prevCleaned !== cleaned && iterations < 10) {
      prevCleaned = cleaned;
      cleaned = cleaned.replace(confidenceJsonPattern, "");
      iterations++;
    }
    
    // Remove multiline JSON blocks that might be metadata
    // Match JSON objects that span multiple lines with confidence field
    const multilineJsonPattern = /\{[^}]*"confidence"\s*:\s*\d+[^}]*"sources"\s*:\s*\[[^\]]*\][^}]*\}/gs;
    cleaned = cleaned.replace(multilineJsonPattern, "");
    
    // Remove any JSON object with confidence field (simpler pattern for edge cases)
    const simpleConfidencePattern = /\{\s*"confidence"\s*:\s*\d+[^}]*\}/gi;
    cleaned = cleaned.replace(simpleConfidencePattern, "");
    
    // Remove JSON arrays that might contain metadata
    const jsonArrayPattern = /\[\s*\{[^}]*"confidence"[^}]*\}[^\]]*\]/gi;
    cleaned = cleaned.replace(jsonArrayPattern, "");
  } catch (e) {
    // If regex fails, continue
  }
  
  // Remove any standalone JSON blocks that might be metadata
  // This pattern matches JSON objects with typical metadata structure (multiline)
  const metadataJsonPattern = /\{\s*"confidence"\s*:\s*\d+\s*,\s*"sources"\s*:[\s\S]*?\}/gs;
  cleaned = cleaned.replace(metadataJsonPattern, "");
  
  // Also remove if JSON appears at the end of text (common case)
  const endJsonPattern = /\n\s*\{\s*"confidence"[\s\S]*?\}\s*$/s;
  cleaned = cleaned.replace(endJsonPattern, "");
  
  // Final pass: remove any remaining JSON-like structures
  // This is a catch-all for any JSON that might have been missed
  const finalJsonPattern = /\{[^}]*"confidence"[^}]*"sources"[^}]*\}/gs;
  cleaned = cleaned.replace(finalJsonPattern, "");
  
  // Remove any line that starts with JSON-like structure
  const jsonLinePattern = /^\s*\{[^}]*"confidence"[^}]*\}[^\n]*$/gm;
  cleaned = cleaned.replace(jsonLinePattern, "");
  
  // Remove JSON objects that might be formatted as code blocks or indented
  const indentedJsonPattern = /^\s*\{\s*"confidence"[\s\S]*?\}\s*$/gm;
  cleaned = cleaned.replace(indentedJsonPattern, "");
  
  // Remove JSON that appears after newlines (common formatting)
  const newlineJsonPattern = /\n\s*\{\s*"confidence"[\s\S]*?\}\s*\n?/gs;
  cleaned = cleaned.replace(newlineJsonPattern, "\n");
  
  // Remove any remaining JSON-like patterns with quotes and brackets
  const quoteJsonPattern = /"confidence"\s*:\s*\d+[^}]*"sources"[^}]*/gi;
  cleaned = cleaned.replace(quoteJsonPattern, "");
  
  // Final cleanup: remove any standalone curly braces that might be left
  cleaned = cleaned.replace(/\n\s*\{\s*\n\s*\}\s*\n/g, "\n");
  
  return cleaned.trim();
}

