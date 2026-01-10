package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type config struct {
	Port string

	DatabaseURL string
	CacheTTL    time.Duration

	ChangesAPIBase string
	ChangesCDNBase string

	PosoAPIBase string
	PosoTGAuth  string

	ModelProbeConcurrency int
}

type server struct {
	cfg config
	db  *sql.DB

	httpClient *http.Client

	// in-memory id-to-name cache
	idToName      map[string]string
	idToNameFetched time.Time
}

func main() {
	cfg := loadConfig()

	var db *sql.DB
	if cfg.DatabaseURL != "" {
		var err error
		db, err = sql.Open("pgx", cfg.DatabaseURL)
		if err != nil {
			log.Fatalf("db open: %v", err)
		}
		db.SetMaxOpenConns(10)
		db.SetMaxIdleConns(10)
		db.SetConnMaxLifetime(30 * time.Minute)

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := db.PingContext(ctx); err != nil {
			log.Fatalf("db ping: %v", err)
		}
	}

	s := &server{
		cfg: cfg,
		db:  db,
		httpClient: &http.Client{
			Timeout: 12 * time.Second,
		},
		idToName: map[string]string{},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /v1/nft/resolve", s.handleResolveNFT)
	mux.HandleFunc("GET /v1/gifts/supply", s.handleGiftSupply)

	addr := ":" + cfg.Port
	log.Printf("listening on %s", addr)
	if err := http.ListenAndServe(addr, withCORS(mux)); err != nil {
		log.Fatal(err)
	}
}

func loadConfig() config {
	port := getenv("PORT", "8080")
	dbURL := os.Getenv("DATABASE_URL")

	cacheTTLSeconds, _ := strconv.Atoi(getenv("CACHE_TTL_SECONDS", "900"))
	if cacheTTLSeconds <= 0 {
		cacheTTLSeconds = 900
	}

	conc, _ := strconv.Atoi(getenv("MODEL_PROBE_CONCURRENCY", "5"))
	if conc <= 0 {
		conc = 5
	}
	if conc > 20 {
		conc = 20
	}

	return config{
		Port: port,

		DatabaseURL: dbURL,
		CacheTTL:    time.Duration(cacheTTLSeconds) * time.Second,

		ChangesAPIBase: getenv("CHANGES_API_BASE", "https://api.changes.tg"),
		ChangesCDNBase: getenv("CHANGES_CDN_BASE", "https://cdn.changes.tg"),

		PosoAPIBase: getenv("POSO_API_BASE", "https://poso.see.tg"),
		PosoTGAuth:  os.Getenv("POSO_TGAUTH"),

		ModelProbeConcurrency: conc,
	}
}

type resolvedNFT struct {
	Slug   string `json:"slug"`
	Gift   string `json:"gift"`
	Number int    `json:"number"`

	Model    string `json:"model,omitempty"`
	Backdrop string `json:"backdrop,omitempty"`
	Pattern  string `json:"pattern,omitempty"` // Telegram page uses "Symbol"
	Owner    string `json:"owner,omitempty"`

	AvailabilityIssued int `json:"availability_issued,omitempty"`
	AvailabilityTotal  int `json:"availability_total,omitempty"`
}

func (s *server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":   true,
		"time": time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *server) handleResolveNFT(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	slug := strings.TrimSpace(r.URL.Query().Get("slug"))
	if slug == "" {
		http.Error(w, "missing slug", http.StatusBadRequest)
		return
	}

	giftSlug, num, err := parseGiftSlug(slug)
	if err != nil {
		http.Error(w, "invalid slug, expected GiftSlug-123", http.StatusBadRequest)
		return
	}

	// 1) Try DB cache
	if s.db != nil {
		if data, ok := s.getCache(ctx, slug); ok {
			writeJSON(w, http.StatusOK, data)
			return
		}
	}

	// 2) Try resolve from public Telegram page (no auth): https://t.me/nft/<slug>
	if parsed, ok := s.resolveFromTelegramPage(ctx, slug); ok {
		if s.db != nil {
			_ = s.putCache(ctx, slug, parsed)
		}
		writeJSON(w, http.StatusOK, parsed)
		return
	}

	// 3) Map giftSlug -> giftTitle via CDN id-to-name
	giftTitle, err := s.resolveGiftTitle(ctx, giftSlug)
	if err != nil {
		http.Error(w, "failed to resolve gift title", http.StatusBadGateway)
		return
	}

	// 4) Fetch models list for this gift
	models, err := s.fetchModels(ctx, giftTitle)
	if err != nil {
		http.Error(w, "failed to fetch models", http.StatusBadGateway)
		return
	}
	if len(models) == 0 {
		http.Error(w, "no models for gift", http.StatusNotFound)
		return
	}

	// 5) Probe poso by (title, model_name, num) in parallel (optional fallback, may require auth)
	found, raw, err := s.probePoso(ctx, giftTitle, num, models)
	if err != nil {
		http.Error(w, "resolve failed", http.StatusBadGateway)
		return
	}
	if !found {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	// Save to DB cache (raw), return raw
	if s.db != nil {
		_ = s.putCache(ctx, slug, raw)
	}

	writeJSON(w, http.StatusOK, raw)
}

func (s *server) handleGiftSupply(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	gift := strings.TrimSpace(r.URL.Query().Get("gift"))
	if gift == "" {
		http.Error(w, "missing gift (use ?gift=KissedFrog or ?gift=Kissed Frog)", http.StatusBadRequest)
		return
	}

	slugBase := giftToSlug(gift)
	if slugBase == "" {
		http.Error(w, "invalid gift", http.StatusBadRequest)
		return
	}

	cacheKey := "gift:" + slugBase

	// DB cache
	if s.db != nil {
		if data, ok := s.getGiftSupplyCache(ctx, cacheKey); ok {
			writeJSON(w, http.StatusOK, data)
			return
		}
	}

	issued, total, ok := s.resolveGiftSupplyFromTelegram(ctx, slugBase)
	if !ok {
		http.Error(w, "failed to resolve supply from Telegram page", http.StatusBadGateway)
		return
	}

	data := map[string]any{
		"slug":               slugBase,
		"gift":               gift,
		"issued":             issued,
		"total":              total,
		"availability_issued": issued,
		"availability_total":  total,
	}

	if s.db != nil {
		_ = s.putGiftSupplyCache(ctx, cacheKey, data)
	}

	writeJSON(w, http.StatusOK, data)
}

func parseGiftSlug(slug string) (giftSlug string, num int, err error) {
	slug = strings.TrimSpace(slug)
	lastDash := strings.LastIndex(slug, "-")
	if lastDash <= 0 || lastDash == len(slug)-1 {
		return "", 0, errors.New("bad format")
	}
	gift := slug[:lastDash]
	nStr := slug[lastDash+1:]
	n, err := strconv.Atoi(nStr)
	if err != nil || n <= 0 {
		return "", 0, errors.New("bad num")
	}
	return gift, n, nil
}

func (s *server) resolveFromTelegramPage(ctx context.Context, slug string) (resolvedNFT, bool) {
	u := "https://t.me/nft/" + url.PathEscape(slug)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; constructor-react-v2-backend/1.0)")
	req.Header.Set("Accept", "text/html")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return resolvedNFT{}, false
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return resolvedNFT{}, false
	}

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return resolvedNFT{}, false
	}
	body := string(bodyBytes)

	giftSlug, num, err := parseGiftSlug(slug)
	if err != nil {
		return resolvedNFT{}, false
	}
	out := resolvedNFT{
		Slug:   slug,
		Gift:   giftSlug,
		Number: num,
	}

	// Prefer stable table rows.
	out.Owner = extractTHValue(body, "Owner")
	out.Model = stripRarity(extractTHValue(body, "Model"))
	out.Backdrop = stripRarity(extractTHValue(body, "Backdrop"))
	out.Pattern = stripRarity(extractTHValue(body, "Symbol"))

	issued, total := extractQuantity(body)
	out.AvailabilityIssued = issued
	out.AvailabilityTotal = total

	// Use proper gift title from og:title when available.
	if title := extractGiftTitle(body); title != "" {
		out.Gift = title
	}

	// Fallback: meta description (sometimes table is missing/changes).
	if out.Model == "" || out.Backdrop == "" || out.Pattern == "" {
		desc := extractMetaContent(body, "twitter:description")
		if desc != "" {
			model, backdrop, symbol := parseMetaDescription(desc)
			if out.Model == "" {
				out.Model = model
			}
			if out.Backdrop == "" {
				out.Backdrop = backdrop
			}
			if out.Pattern == "" {
				out.Pattern = symbol
			}
		}
	}

	if out.Model == "" && out.Backdrop == "" && out.Pattern == "" && out.AvailabilityIssued == 0 && out.AvailabilityTotal == 0 {
		return resolvedNFT{}, false
	}
	return out, true
}

func (s *server) resolveGiftSupplyFromTelegram(ctx context.Context, giftSlug string) (issued int, total int, ok bool) {
	// Try a few numbers until we hit an existing collectible page.
	for n := 1; n <= 10; n++ {
		slug := fmt.Sprintf("%s-%d", giftSlug, n)
		parsed, ok := s.resolveFromTelegramPage(ctx, slug)
		if !ok {
			continue
		}
		if parsed.AvailabilityIssued > 0 && parsed.AvailabilityTotal > 0 {
			return parsed.AvailabilityIssued, parsed.AvailabilityTotal, true
		}
	}
	return 0, 0, false
}

func giftToSlug(nameOrSlug string) string {
	s := strings.TrimSpace(nameOrSlug)
	if s == "" {
		return ""
	}
	// If it already looks like a slug (no spaces), keep it but strip punctuation.
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func extractMetaContent(htmlText, metaName string) string {
	re := regexp.MustCompile(`<meta[^>]+name="` + regexp.QuoteMeta(metaName) + `"[^>]+content="([^"]*)"`)
	m := re.FindStringSubmatch(htmlText)
	if len(m) < 2 {
		return ""
	}
	return html.UnescapeString(m[1])
}

func parseMetaDescription(desc string) (model, backdrop, symbol string) {
	lines := strings.Split(desc, "\n")
	for _, ln := range lines {
		ln = strings.TrimSpace(ln)
		if ln == "" {
			continue
		}
		if strings.HasPrefix(ln, "Model:") {
			model = strings.TrimSpace(strings.TrimPrefix(ln, "Model:"))
		} else if strings.HasPrefix(ln, "Backdrop:") {
			backdrop = strings.TrimSpace(strings.TrimPrefix(ln, "Backdrop:"))
		} else if strings.HasPrefix(ln, "Symbol:") {
			symbol = strings.TrimSpace(strings.TrimPrefix(ln, "Symbol:"))
		}
	}
	return
}

func extractTHValue(htmlText, th string) string {
	re := regexp.MustCompile(`<tr><th>` + regexp.QuoteMeta(th) + `</th><td>([\s\S]*?)</td></tr>`)
	m := re.FindStringSubmatch(htmlText)
	if len(m) < 2 {
		return ""
	}
	val := regexp.MustCompile(`<[^>]+>`).ReplaceAllString(m[1], "")
	val = html.UnescapeString(val)
	return strings.TrimSpace(val)
}

func stripRarity(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return s
	}
	re := regexp.MustCompile(`\s+\d+(\.\d+)?%$`)
	return strings.TrimSpace(re.ReplaceAllString(s, ""))
}

func extractQuantity(htmlText string) (issued int, total int) {
	raw := extractTHValue(htmlText, "Quantity")
	if raw == "" {
		return 0, 0
	}
	parts := strings.Split(raw, "/")
	if len(parts) < 2 {
		return 0, 0
	}
	left := digitsOnly(parts[0])
	right := digitsOnly(parts[1])
	i, _ := strconv.Atoi(left)
	t, _ := strconv.Atoi(right)
	return i, t
}

func digitsOnly(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func extractGiftTitle(htmlText string) string {
	re := regexp.MustCompile(`<meta[^>]+property="og:title"[^>]+content="([^"]+)"`)
	m := re.FindStringSubmatch(htmlText)
	if len(m) < 2 {
		return ""
	}
	val := html.UnescapeString(m[1])
	if idx := strings.LastIndex(val, "#"); idx > 0 {
		val = strings.TrimSpace(val[:idx])
	}
	if val == "" || !utf8.ValidString(val) {
		return ""
	}
	val = strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) {
			return ' '
		}
		return r
	}, val)
	return strings.TrimSpace(val)
}

func (s *server) resolveGiftTitle(ctx context.Context, giftSlug string) (string, error) {
	// cache for 6h
	if time.Since(s.idToNameFetched) < 6*time.Hour && len(s.idToName) > 0 {
		if v := s.idToName[giftSlug]; v != "" {
			return v, nil
		}
		// sometimes keys are lowercase
		if v := s.idToName[strings.ToLower(giftSlug)]; v != "" {
			return v, nil
		}
	}

	u := strings.TrimRight(s.cfg.ChangesCDNBase, "/") + "/gifts/id-to-name.json"
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return "", fmt.Errorf("cdn status %d", resp.StatusCode)
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 5<<20))

	var m map[string]string
	if err := json.Unmarshal(body, &m); err != nil {
		return "", err
	}
	s.idToName = m
	s.idToNameFetched = time.Now()

	if v := m[giftSlug]; v != "" {
		return v, nil
	}
	if v := m[strings.ToLower(giftSlug)]; v != "" {
		return v, nil
	}
	// fallback: use slug as-is
	return giftSlug, nil
}

func (s *server) fetchModels(ctx context.Context, giftTitle string) ([]string, error) {
	u := strings.TrimRight(s.cfg.ChangesAPIBase, "/") + "/models/" + url.PathEscape(giftTitle)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("changes status %d", resp.StatusCode)
	}

	var arr []any
	if err := json.NewDecoder(resp.Body).Decode(&arr); err != nil {
		return nil, err
	}

	out := make([]string, 0, len(arr))
	for _, it := range arr {
		switch v := it.(type) {
		case string:
			out = append(out, v)
		case map[string]any:
			if name, ok := v["name"].(string); ok && name != "" {
				out = append(out, name)
			}
		}
	}
	return out, nil
}

func (s *server) probePoso(ctx context.Context, title string, num int, models []string) (found bool, raw any, err error) {
	type result struct {
		ok  bool
		val any
		err error
	}

	sem := make(chan struct{}, s.cfg.ModelProbeConcurrency)
	ch := make(chan result, len(models))

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	for _, model := range models {
		model := model
		sem <- struct{}{}
		go func() {
			defer func() { <-sem }()

			val, err := s.fetchPosoGift(ctx, title, model, num)
			if err != nil {
				ch <- result{ok: false, err: err}
				return
			}
			if val == nil {
				ch <- result{ok: false, val: nil}
				return
			}
			ch <- result{ok: true, val: val}
		}()
	}

	var lastErr error
	for i := 0; i < len(models); i++ {
		res := <-ch
		if res.ok {
			cancel()
			return true, res.val, nil
		}
		if res.err != nil {
			lastErr = res.err
		}
	}

	return false, nil, lastErr
}

func (s *server) fetchPosoGift(ctx context.Context, title, modelName string, num int) (any, error) {
	base := strings.TrimRight(s.cfg.PosoAPIBase, "/") + "/api/gifts"

	q := url.Values{}
	if strings.TrimSpace(s.cfg.PosoTGAuth) != "" {
		q.Set("tgauth", s.cfg.PosoTGAuth)
	}
	q.Set("title", title)
	q.Set("model_name", modelName)
	q.Set("num", strconv.Itoa(num))
	q.Set("sort_by", "num")
	q.Set("order", "asc")
	q.Set("offset", "0")
	q.Set("limit", "1")

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, base+"?"+q.Encode(), nil)
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// poso может отвечать 4xx, если не найдено — считаем "нет"
	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusBadRequest {
		return nil, nil
	}
	if resp.StatusCode/100 != 2 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		return nil, fmt.Errorf("poso status %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}

	var data map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}

	gifts, _ := data["gifts"].([]any)
	if len(gifts) == 0 {
		return nil, nil
	}
	return data, nil
}

func (s *server) getCache(ctx context.Context, slug string) (any, bool) {
	var b []byte
	var fetchedAt time.Time
	err := s.db.QueryRowContext(ctx, `SELECT data, fetched_at FROM nft_resolve_cache WHERE slug=$1`, slug).Scan(&b, &fetchedAt)
	if err != nil {
		return nil, false
	}
	if time.Since(fetchedAt) > s.cfg.CacheTTL {
		return nil, false
	}
	var v any
	if err := json.Unmarshal(b, &v); err != nil {
		return nil, false
	}
	return v, true
}

func (s *server) putCache(ctx context.Context, slug string, data any) error {
	b, err := json.Marshal(data)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO nft_resolve_cache (slug, data, fetched_at)
		VALUES ($1, $2, now())
		ON CONFLICT (slug) DO UPDATE SET data=excluded.data, fetched_at=excluded.fetched_at
	`, slug, b)
	return err
}

func (s *server) getGiftSupplyCache(ctx context.Context, period string) (any, bool) {
	var b []byte
	var fetchedAt time.Time
	err := s.db.QueryRowContext(ctx, `SELECT data, fetched_at FROM gift_supply_cache WHERE period=$1`, period).Scan(&b, &fetchedAt)
	if err != nil {
		return nil, false
	}
	if time.Since(fetchedAt) > s.cfg.CacheTTL {
		return nil, false
	}
	var v any
	if err := json.Unmarshal(b, &v); err != nil {
		return nil, false
	}
	return v, true
}

func (s *server) putGiftSupplyCache(ctx context.Context, period string, data any) error {
	b, err := json.Marshal(data)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO gift_supply_cache (period, data, fetched_at)
		VALUES ($1, $2, now())
		ON CONFLICT (period) DO UPDATE SET data=excluded.data, fetched_at=excluded.fetched_at
	`, period, b)
	return err
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func getenv(key, fallback string) string {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return fallback
	}
	return v
}


