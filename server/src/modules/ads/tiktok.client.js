import { config } from '../../config/index.js';

/**
 * TikTok Business API — synchronous integrated report, one row per day per advertiser / campaign / ad group.
 * https://business-api.tiktok.com/portal/docs?id=1740302848100353
 */

const BASE = 'https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/';
const PAGE_SIZE = 1000;

const LEVELS = {
  account: { dataLevel: 'AUCTION_ADVERTISER', idKey: 'advertiser_id', extra: [] },
  campaign: { dataLevel: 'AUCTION_CAMPAIGN', idKey: 'campaign_id', extra: ['campaign_name'] },
  adset: { dataLevel: 'AUCTION_ADGROUP', idKey: 'adgroup_id', extra: ['adgroup_name', 'campaign_id'] },
};
const METRICS = ['spend', 'impressions', 'clicks', 'conversion', 'total_complete_payment_rate'];

export const normaliseAdvertiserId = (id) => String(id).replace(/\D/g, '');

export const fetchInsights = async ({ externalId, token, level, since, until }) => {
  const accessToken = token || config.tiktok.accessToken;
  if (!accessToken) throw new Error('TikTok: no access token — add one to the account or set TIKTOK_ACCESS_TOKEN');

  const advertiserId = normaliseAdvertiserId(externalId);
  const { dataLevel, idKey, extra } = LEVELS[level];
  const rows = [];

  for (let page = 1; ; page += 1) {
    const params = new URLSearchParams({
      advertiser_id: advertiserId,
      report_type: 'BASIC',
      data_level: dataLevel,
      dimensions: JSON.stringify([idKey, 'stat_time_day']),
      metrics: JSON.stringify([...METRICS, ...extra]),
      start_date: since,
      end_date: until,
      page: String(page),
      page_size: String(PAGE_SIZE),
    });
    const res = await fetch(`${BASE}?${params}`, { headers: { 'Access-Token': accessToken }, signal: AbortSignal.timeout(60_000) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.code !== 0) throw new Error(`TikTok API: ${body.message || res.statusText}`);

    for (const r of body.data?.list || []) {
      const m = r.metrics || {};
      rows.push({
        level,
        object_id: level === 'account' ? advertiserId : String(r.dimensions[idKey]),
        object_name: m.campaign_name || m.adgroup_name || null,
        parent_id: level === 'adset' ? String(m.campaign_id || '') || null : null,
        stat_date: String(r.dimensions.stat_time_day).slice(0, 10),
        spend: Number(m.spend || 0),
        impressions: Number(m.impressions || 0),
        clicks: Number(m.clicks || 0),
        results: Math.round(Number(m.conversion || 0)),
        purchase_value: Number(m.total_complete_payment_rate || 0),
      });
    }
    const info = body.data?.page_info;
    if (!info || page >= info.total_page) break;
  }
  return rows;
};
