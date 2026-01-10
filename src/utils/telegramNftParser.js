// Парсер публичной страницы Telegram collectible: https://t.me/nft/<GiftSlug>-<num>

const htmlDecode = (s) =>
  String(s ?? '')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&#160;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');

const stripTags = (s) => String(s ?? '').replace(/<[^>]+>/g, '');

const extractMetaContent = (html, metaName) => {
  const re = new RegExp(`<meta[^>]+name="${metaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]+content="([^"]*)"`);
  const m = String(html ?? '').match(re);
  return m?.[1] ? htmlDecode(m[1]) : '';
};

const extractOgTitle = (html) => {
  const m = String(html ?? '').match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/);
  if (!m?.[1]) return '';
  const v = htmlDecode(m[1]);
  // "Kissed Frog #3639" -> "Kissed Frog"
  return v.includes('#') ? v.split('#')[0].trim() : v.trim();
};

const extractTHValue = (html, th) => {
  const re = new RegExp(`<tr><th>${th.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</th><td>([\\s\\S]*?)</td></tr>`);
  const m = String(html ?? '').match(re);
  if (!m?.[1]) return '';
  return htmlDecode(stripTags(m[1])).trim();
};

const stripRarity = (s) => String(s ?? '').trim().replace(/\s+\d+(\.\d+)?%$/, '').trim();

const digitsOnly = (s) => String(s ?? '').replace(/[^\d]/g, '');

export function parseTelegramNftHtml(html, slug) {
  const out = {
    slug,
    gift: '',
    number: null,
    model: '',
    backdrop: '',
    pattern: '',
    owner: '',
    availability_issued: null,
    availability_total: null,
  };

  // slug -> gift/number
  if (slug && slug.includes('-')) {
    const lastDash = slug.lastIndexOf('-');
    out.gift = slug.slice(0, lastDash);
    const n = Number(slug.slice(lastDash + 1));
    out.number = Number.isFinite(n) ? n : null;
  }

  // Prefer table fields
  out.owner = extractTHValue(html, 'Owner');
  out.model = stripRarity(extractTHValue(html, 'Model'));
  out.backdrop = stripRarity(extractTHValue(html, 'Backdrop'));
  out.pattern = stripRarity(extractTHValue(html, 'Symbol'));

  const qty = extractTHValue(html, 'Quantity'); // "14 046/14 278 issued"
  if (qty && qty.includes('/')) {
    const [left, right] = qty.split('/');
    const issued = Number(digitsOnly(left));
    const total = Number(digitsOnly(right));
    out.availability_issued = Number.isFinite(issued) ? issued : null;
    out.availability_total = Number.isFinite(total) ? total : null;
  }

  // Gift title from og:title if present (better than slug)
  const ogTitle = extractOgTitle(html);
  if (ogTitle) out.gift = ogTitle;

  // Fallback: twitter:description
  if (!out.model || !out.backdrop || !out.pattern) {
    const desc = extractMetaContent(html, 'twitter:description');
    if (desc) {
      for (const line of desc.split('\n')) {
        const ln = line.trim();
        if (!ln) continue;
        if (!out.model && ln.startsWith('Model:')) out.model = ln.replace('Model:', '').trim();
        if (!out.backdrop && ln.startsWith('Backdrop:')) out.backdrop = ln.replace('Backdrop:', '').trim();
        if (!out.pattern && ln.startsWith('Symbol:')) out.pattern = ln.replace('Symbol:', '').trim();
      }
    }
  }

  return out;
}


