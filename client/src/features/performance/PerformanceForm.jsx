import { useState } from 'react';
import { Modal } from '@/components/ui/Modal.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Field, Input, Select, Textarea } from '@/components/ui/Field.jsx';
import { currency, roas } from '@/lib/format.js';
import { t } from '@/i18n/index.jsx';

const PLATFORMS = ['Facebook', 'Instagram', 'Google', 'TikTok', 'YouTube', 'LinkedIn', 'Other'];

export const PerformanceForm = ({ open, onClose, onSubmit, initial, saving, cycle }) => {
  const [form, setForm] = useState({
    entry_date: initial?.entry_date || cycle.month_start,
    week_no: initial?.week_no || '',
    platform: initial?.platform || 'Facebook',
    spend: initial?.spend ?? '',
    impressions: initial?.impressions ?? '',
    clicks: initial?.clicks ?? '',
    conversions: initial?.conversions ?? '',
    revenue: initial?.revenue ?? '',
    note: initial?.note || '',
  });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const ctr = Number(form.impressions) ? Number(form.clicks) / Number(form.impressions) : null;
  const cpc = Number(form.clicks) ? Number(form.spend) / Number(form.clicks) : null;
  const returnOnSpend = Number(form.spend) ? Number(form.revenue) / Number(form.spend) : null;

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      entry_date: form.entry_date,
      week_no: form.week_no ? Number(form.week_no) : undefined,
      platform: form.platform,
      spend: Number(form.spend) || 0,
      impressions: Number(form.impressions) || 0,
      clicks: Number(form.clicks) || 0,
      conversions: Number(form.conversions) || 0,
      revenue: Number(form.revenue) || 0,
      note: form.note || null,
    });
  };

  const weekOptions = Array.from({ length: cycle.weeks_count }, (_, i) => ({
    value: String(i + 1),
    label: t('সপ্তাহ {n}', { n: i + 1 }),
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? 'এন্ট্রি সম্পাদনা' : 'নতুন পারফরম্যান্স এন্ট্রি'}
      subtitle="প্রতিদিনের প্রকৃত অ্যাড পারফরম্যান্স"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button onClick={submit} loading={saving}>
            সংরক্ষণ
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3">
        <Field label="তারিখ *">
          <Input type="date" required value={form.entry_date} onChange={set('entry_date')} />
        </Field>
        <Field label="সপ্তাহ" hint="খালি রাখলে তারিখ থেকে হিসাব হবে">
          <Select value={String(form.week_no)} onChange={set('week_no')} options={weekOptions} placeholder="অটো" />
        </Field>
        <Field label="প্ল্যাটফর্ম">
          <Select value={form.platform} onChange={set('platform')} options={PLATFORMS} />
        </Field>
        <Field label="স্পেন্ড (৳)">
          <Input type="number" step="0.01" min="0" value={form.spend} onChange={set('spend')} />
        </Field>
        <Field label="ইমপ্রেশন">
          <Input type="number" min="0" value={form.impressions} onChange={set('impressions')} />
        </Field>
        <Field label="ক্লিক">
          <Input type="number" min="0" value={form.clicks} onChange={set('clicks')} />
        </Field>
        <Field label="কনভার্সন">
          <Input type="number" min="0" value={form.conversions} onChange={set('conversions')} />
        </Field>
        <Field label="রেভিনিউ (৳)">
          <Input type="number" step="0.01" min="0" value={form.revenue} onChange={set('revenue')} />
        </Field>
        <Field label="নোট" className="sm:col-span-3">
          <Textarea rows={2} value={form.note} onChange={set('note')} />
        </Field>

        <div className="sm:col-span-3 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
          <div>
            CTR
            <p className="font-semibold text-slate-900">{ctr === null ? '—' : `${(ctr * 100).toFixed(2)}%`}</p>
          </div>
          <div>
            CPC
            <p className="font-semibold text-slate-900">{cpc === null ? '—' : currency(cpc)}</p>
          </div>
          <div>
            ROAS
            <p className="font-semibold text-slate-900">{roas(returnOnSpend)}</p>
          </div>
        </div>
      </form>
    </Modal>
  );
};
