"use client";

import { ExternalLinkIcon, XIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";

export type SourceInfo = {
  url: string;
  title: string;
  trustLevel: "high" | "medium" | "low";
};

export type UncertaintyInfo = {
  topic: string;
  reason: string;
  whatToCheck: string;
};

export type MessageMetadata = {
  userPrompt?: string;
  conclusion?: string; // Konklusjon fra AI-en
  confidence?: number; // 0-100
  sources?: SourceInfo[];
  uncertainties?: UncertaintyInfo[];
};

type SourceSidebarProps = {
  metadata: MessageMetadata | null;
  isOpen: boolean;
  onClose: () => void;
};

export function SourceSidebar({ metadata, isOpen, onClose }: SourceSidebarProps) {
  if (!isOpen || !metadata) {
    return null;
  }

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return "bg-gray-200";
    if (confidence >= 80) return "bg-green-500";
    if (confidence >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getConfidenceLabel = (confidence?: number) => {
    if (!confidence) return "Ukjent";
    if (confidence >= 80) return "Høy";
    if (confidence >= 60) return "Middels";
    return "Lav";
  };

  const getTrustLevelColor = (level: string) => {
    switch (level) {
      case "high":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "low":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getTrustLevelLabel = (level: string) => {
    switch (level) {
      case "high":
        return "Høy tillit";
      case "medium":
        return "Middels tillit";
      case "low":
        return "Lav tillit";
      default:
        return "Ukjent";
    }
  };

  if (!isOpen || !metadata) {
    return null;
  }

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className="fixed inset-0 bg-black/50 z-30 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed right-0 top-0 h-full w-full md:w-80 border-l bg-background p-4 overflow-y-auto z-40 shadow-lg">
        {/* Close button */}
        <div className="flex justify-end mb-4">
          <Button
            className="h-8 w-8 p-0"
            onClick={onClose}
            variant="ghost"
            type="button"
          >
            <XIcon className="h-4 w-4" />
            <span className="sr-only">Lukk kilder og sikkerhet</span>
          </Button>
        </div>
        <div className="space-y-4">
        {/* User Prompt */}
        {metadata.userPrompt && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Din melding</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{metadata.userPrompt}</p>
            </CardContent>
          </Card>
        )}

        {/* Konklusjon */}
        {metadata.conclusion && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Konklusjon</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{metadata.conclusion}</p>
            </CardContent>
          </Card>
        )}

        {/* Confidence Level */}
        {metadata.confidence !== undefined && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sikkerhetsnivå</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {getConfidenceLabel(metadata.confidence)}
                </span>
                <Badge
                  className={getConfidenceColor(metadata.confidence)}
                >
                  {metadata.confidence}%
                </Badge>
              </div>
              <Progress value={metadata.confidence} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Dette viser hvor sikker AI-en er på svaret sitt
              </p>
            </CardContent>
          </Card>
        )}

        {/* Sources */}
        {metadata.sources && metadata.sources.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Kilder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {metadata.sources.map((source, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-3 space-y-2 hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium line-clamp-2 flex-1">
                      {source.title}
                    </h4>
                    <Badge
                      className={`text-xs ${getTrustLevelColor(source.trustLevel)}`}
                    >
                      {getTrustLevelLabel(source.trustLevel)}
                    </Badge>
                  </div>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <span className="truncate">{source.url}</span>
                    <ExternalLinkIcon className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {(!metadata.sources || metadata.sources.length === 0) && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground text-center">
                Ingen kilder tilgjengelig
              </p>
            </CardContent>
          </Card>
        )}

        {/* Uncertainties */}
        {metadata.uncertainties && metadata.uncertainties.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Usikkerhetsområder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {metadata.uncertainties.map((uncertainty, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-3 space-y-2 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900"
                >
                  <h4 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200">
                    {uncertainty.topic}
                  </h4>
                  <div className="space-y-1">
                    <p className="text-xs text-yellow-800 dark:text-yellow-300">
                      <span className="font-medium">Hvorfor usikker:</span> {uncertainty.reason}
                    </p>
                    <p className="text-xs text-yellow-800 dark:text-yellow-300">
                      <span className="font-medium">Bør dobbeltsjekkes:</span> {uncertainty.whatToCheck}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </>
  );
}

