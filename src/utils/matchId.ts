/** Yerel üretilmiş id’ler (`group-…`, seed maçlar) UUID değil; Supabase satırları UUID. */
export function isRemoteUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

/** Seed/demo maç id’leri UUID değil; Supabase maçları UUID. */
export function isRemoteMatchId(id: string): boolean {
  return isRemoteUuid(id);
}
