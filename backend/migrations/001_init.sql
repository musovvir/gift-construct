-- Minimal cache for resolved NFT attributes.
-- Later you can normalize into gifts/models/backdrops/patterns/owners tables.

CREATE TABLE IF NOT EXISTS nft_resolve_cache (
  slug TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nft_resolve_cache_fetched_at ON nft_resolve_cache (fetched_at DESC);


