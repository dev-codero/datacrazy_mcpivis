import { Config } from "./config.js";

export function requireConfirmation(
  config: Config,
  confirm: boolean | undefined,
  action: string
): { blocked: true; message: string } | { blocked: false } {
  if (!config.safeMode || confirm) {
    return { blocked: false };
  }
  return {
    blocked: true,
    message: `⚠️ SAFE_MODE ativado. Para executar "${action}", passe confirm: true. Esta acao nao pode ser desfeita.`,
  };
}
