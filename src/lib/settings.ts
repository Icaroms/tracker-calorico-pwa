/**
 * settings.ts
 * -----------
 * Acesso único às preferências guardadas no localStorage. Antes cada tela
 * (App, LogFood, History, Settings) lia a chave do Gemini por conta própria,
 * cada uma com sua própria checagem de `typeof localStorage`.
 *
 * try/catch porque localStorage pode lançar erro (modo privado do Safari
 * antigo, armazenamento cheio, política do navegador) — nesse caso o app
 * segue funcionando, só sem a chave.
 */
const GEMINI_KEY = 'geminiApiKey';

export function getGeminiApiKey(): string | undefined {
  try {
    return localStorage.getItem(GEMINI_KEY)?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export function setGeminiApiKey(key: string): void {
  try { localStorage.setItem(GEMINI_KEY, key.trim()); } catch { /* sem armazenamento disponível */ }
}

export function clearGeminiApiKey(): void {
  try { localStorage.removeItem(GEMINI_KEY); } catch { /* idem */ }
}
