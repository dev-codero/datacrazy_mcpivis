export interface Config {
  apiToken: string;
  apiUrl: string;
  safeMode: boolean;
}

export function loadConfig(): Config {
  const apiToken = process.env.DATACRAZY_API_TOKEN;
  if (!apiToken) {
    throw new Error("DATACRAZY_API_TOKEN environment variable is required");
  }
  return {
    apiToken,
    apiUrl: process.env.DATACRAZY_API_URL || "https://api.datacrazy.io/v1",
    safeMode: process.env.SAFE_MODE !== "false",
  };
}
