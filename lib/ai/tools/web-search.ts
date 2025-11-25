import { tool } from "ai";
import { z } from "zod";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Search the web using Serper API (if API key is set), then Tavily, then DuckDuckGo as fallback
 * 
 * Priority order:
 * 1. Serper API (best results, Google search) - Get API key from https://serper.dev
 * 2. Tavily API (good results) - Get API key from https://tavily.com
 * 3. DuckDuckGo (free, no API key required)
 */
async function searchWeb(query: string, maxResults: number = 5): Promise<SearchResult[]> {
  const serperApiKey = process.env.SERPER_API_KEY;
  
  // Try Serper API first (best results, Google search)
  if (serperApiKey) {
    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Serper returns results in organic array
        if (data.organic && Array.isArray(data.organic)) {
          return data.organic.slice(0, maxResults).map((result: any) => ({
            title: result.title || 'No title',
            url: result.link || result.url || '',
            snippet: result.snippet || result.description || 'No snippet available',
          }));
        }
      }
    } catch (error) {
      console.error('Serper API error:', error);
      // Fall through to Tavily
    }
  }

  const tavilyApiKey = process.env.TAVILY_API_KEY;
  
  // Try Tavily API second (good results, requires API key)
  if (tavilyApiKey) {
    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query,
          search_depth: 'basic',
          max_results: maxResults,
          include_answer: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return (data.results || []).map((result: any) => ({
          title: result.title || 'No title',
          url: result.url || '',
          snippet: result.content || result.snippet || 'No snippet available',
        }));
      }
    } catch (error) {
      console.error('Tavily API error:', error);
      // Fall through to DuckDuckGo
    }
  }

  // Fallback to DuckDuckGo (free, no API key required)
  try {
    // Use DuckDuckGo Instant Answer API (more reliable than HTML scraping)
    const instantAnswerUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const response = await fetch(instantAnswerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (response.ok) {
      const data = await response.json();
      const results: SearchResult[] = [];

      // Add RelatedTopics if available
      if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
        for (const topic of data.RelatedTopics.slice(0, maxResults)) {
          if (topic.FirstURL && topic.Text) {
            results.push({
              title: topic.Text.split(' - ')[0] || topic.Text,
              url: topic.FirstURL,
              snippet: topic.Text,
            });
          }
        }
      }

      // Add Abstract if available
      if (data.AbstractURL && data.AbstractText && results.length < maxResults) {
        results.unshift({
          title: data.Heading || query,
          url: data.AbstractURL,
          snippet: data.AbstractText,
        });
      }

      if (results.length > 0) {
        return results.slice(0, maxResults);
      }
    }

    // If Instant Answer API doesn't return results, try HTML scraping as last resort
    const htmlUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const htmlResponse = await fetch(htmlUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (htmlResponse.ok) {
      const html = await htmlResponse.text();
      const results: SearchResult[] = [];
      
      // Simple regex parsing (basic implementation)
      const linkRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
      const snippetRegex = /<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([^<]*)<\/a>/gi;
      
      const links: Array<{url: string, title: string}> = [];
      const snippets: string[] = [];
      
      let match;
      while ((match = linkRegex.exec(html)) !== null && links.length < maxResults) {
        links.push({ url: match[1], title: match[2] });
      }

      let snippetMatch;
      while ((snippetMatch = snippetRegex.exec(html)) !== null) {
        snippets.push(snippetMatch[1]);
      }

      for (let i = 0; i < Math.min(links.length, maxResults); i++) {
        if (links[i]?.url && links[i]?.title) {
          results.push({
            title: links[i].title.trim(),
            url: links[i].url.trim(),
            snippet: snippets[i]?.trim() || 'No snippet available',
          });
        }
      }

      if (results.length > 0) {
        return results;
      }
    }
  } catch (error) {
    console.error('Web search error:', error);
  }
  
  // Final fallback: Return a helpful message
  return [{
    title: `Search results for: ${query}`,
    url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    snippet: `No automatic search results available. Please configure Tavily API (https://tavily.com) for better results, or search manually.`,
  }];
}

export const webSearch = tool({
  description: `Search the web for current information, facts, news, or any topic. 
  Use this tool when you need to find sources, verify information, or get up-to-date data.
  Always use this tool to find sources for your answers.`,
  inputSchema: z.object({
    query: z.string().describe("The search query to look up on the web"),
    maxResults: z.number().optional().default(5).describe("Maximum number of results to return (default: 5)"),
  }),
  execute: async ({ query, maxResults = 5 }) => {
    if (!query || query.trim().length === 0) {
      return {
        error: "Search query cannot be empty",
      };
    }

    try {
      const results = await searchWeb(query, maxResults);
      
      return {
        query,
        results,
        count: results.length,
        message: results.length > 0 
          ? `Found ${results.length} search result(s) for "${query}"`
          : `No results found for "${query}"`,
      };
    } catch (error) {
      return {
        error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        query,
      };
    }
  },
});

