import { describe, it, expect } from "vitest";
import { requireConfirmation } from "../src/safe-mode.js";
import { makeConfig } from "./helpers.js";

describe("requireConfirmation", () => {
  it("bloqueia quando SAFE_MODE esta ligado e confirm nao veio", () => {
    const check = requireConfirmation(makeConfig({ safeMode: true }), undefined, "tags.delete");
    expect(check.blocked).toBe(true);
    if (check.blocked) {
      expect(check.message).toContain("SAFE_MODE");
      expect(check.message).toContain("tags.delete");
      expect(check.message).toContain("confirm: true");
    }
  });

  it("bloqueia quando confirm e explicitamente false", () => {
    const check = requireConfirmation(makeConfig({ safeMode: true }), false, "leads.delete");
    expect(check.blocked).toBe(true);
  });

  it("libera quando confirm e true", () => {
    const check = requireConfirmation(makeConfig({ safeMode: true }), true, "leads.delete");
    expect(check.blocked).toBe(false);
  });

  it("libera tudo quando SAFE_MODE esta desligado", () => {
    expect(requireConfirmation(makeConfig({ safeMode: false }), undefined, "leads.delete").blocked).toBe(false);
    expect(requireConfirmation(makeConfig({ safeMode: false }), false, "leads.delete").blocked).toBe(false);
  });

  it("nomeia a acao na mensagem para o usuario saber o que confirmar", () => {
    const check = requireConfirmation(makeConfig(), undefined, "business_actions.lose");
    expect(check.blocked).toBe(true);
    if (check.blocked) expect(check.message).toContain("business_actions.lose");
  });
});
