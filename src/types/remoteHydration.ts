/** Seçenekler uzaktan listeleme / grup hidrasyonu use-case'lerine iletilir. */
export type RemoteHydrateOpts = {
  /** true: TTL atlanır (çek-bırak, oturum açılışı, gerçek zamanlı tetik, mutasyon sonrası). */
  force?: boolean;
};
