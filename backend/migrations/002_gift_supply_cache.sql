-- Cache for gift supply stats (issued/total).

CREATE TABLE IF NOT EXISTS gift_supply_cache (
  period TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_supply_cache_fetched_at ON gift_supply_cache (fetched_at DESC);


