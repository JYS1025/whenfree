export interface RequestLike {
  url: string;
  headers: {
    get(name: string): string | null;
  };
}

export function isAgentRequest(request: RequestLike): boolean {
  const url = new URL(request.url);

  // 1. Explicit query parameter override
  const format = url.searchParams.get("format");
  if (format === "json") return true;
  if (format === "html") return false;

  // 2. Inspect Accept header
  const acceptHeader = request.headers.get("accept") || "";

  // If application/json is explicitly requested and text/html is NOT prioritized over it
  if (acceptHeader.includes("application/json")) {
    const jsonIndex = acceptHeader.indexOf("application/json");
    const htmlIndex = acceptHeader.indexOf("text/html");

    // If text/html is absent or json appears before html, treat as agent/API request
    if (htmlIndex === -1 || jsonIndex < htmlIndex) {
      return true;
    }
  }

  // 3. Inspect User-Agent for known autonomous agents, scripts, and scrapers
  const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
  const agentSignatures = [
    "claudebot",
    "gptbot",
    "chatgpt",
    "anthropic",
    "openai",
    "langchain",
    "langgraph",
    "semantic-kernel",
    "python-requests",
    "aiohttp",
    "httpx",
    "curl",
    "wget",
    "httpie",
    "postman",
    "insomnia",
    "node-fetch",
    "undici",
    "axios",
    "go-http-client",
    "java/",
    "okhttp",
  ];

  if (agentSignatures.some((sig) => userAgent.includes(sig))) {
    // If standard browser header text/html is not explicitly preferred
    if (!acceptHeader.includes("text/html")) {
      return true;
    }
  }

  return false;
}
