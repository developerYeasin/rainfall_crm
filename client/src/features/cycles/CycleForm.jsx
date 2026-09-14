import { useState } from 'react';
import { Modal } from '@/components/ui/Modal.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Field, Input, Select } from '@/components/ui/Field.jsx';
import { CYCLE_STATUS_LABEL } from '@/lib/status.js';
import { currency, number } from '@/lib/format.js';

const STATUS_OPTIONS = Object.entries(CYCLE_STATUS_LABEL).map(([value, label]) => ({ value, label }));

const EMPTY = {
  name: 'মাস ১',
  month_start: new Date().toISOString().slice(0, 8) + '01',
  weeks_count: 4,
  status: 'running',
  monthly_budget: 60000,
  expected_ctr: 2,
  expected_cpc: 3.5,
  expected_conversion_rate: 2,
  aov: 900,
};

/** CTR and conversion rate are entered as percentages here, stored as fractions. */
export const CycleForm = ({ open, onClose, onSubmit, initial, saving }) => {
  const [form, setForm] = useState(
    initial
      ? {
          ...initial,
          expected_ctr: Number(initial.expected_ctr) * 100,
          expected_conversion_rate: Number(initial.expected_conversion_rate) * 100,
        }
      : EMPTY,
  );
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const preview = (() => {
    const budget = Number(form.monthly_budget) || 0;
    const cpc = Number(form.expected_cpc) || 0;
    const ctr = Number(form.expected_ctr) / 100;
    const cvr = Number(form.expected_conversion_rate) / 100;
    const aov = Number(form.aov) || 0;
    const clicks = cpc ? budget / cpc : 0;
    const impressions = ctr ? clicks / ctr : 0;
    const conversions = clicks * cvr;
    const revenue = conversions * aov;
    return { clicks, impressions, conversions, revenue, roas: budget ? revenue / budget : 0 };
  })();

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      name: form.name,
      month_start: form.month_start,
      weeks_count: Number(form.weeks_count),
      status: form.status,
      monthly_budget: Number(form.monthly_budget),
      expected_ctr: Number(form.expected_ctr) / 100,
      expected_cpc: Number(form.expected_cpc),
      expected_conversion_rate: Number(form.expected_conversion_rate) / 100,
      aov: Number(form.aov),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? 'সাইকেল সম্পাদনা' : 'নতুন মাস / সাইকেল'}
      subtitle="অ্যাসাম্পশন বসালে সাপ্তাহিক টার্গেট অটো ক্যালকুলেট হবে"
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
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="সাইকেলের নাম">
          <Input value={form.name} onChange={set('name')} placeholder="মাস ১" />
        </Field>
        <Field label="মাস শুরুর তারিখ *">
          <Input type="date" required value={form.month_start} onChange={set('month_start')} />
        </Field>
        <Field label="সপ্তাহ সংখ্যা">
          <Input type="number" min="1" max="6" value={form.weeks_count} onChange={set('weeks_count')} />
        </Field>
        <Field label="স্ট্যাটাস">
          <Select value={form.status} onChange={set('status')} options={STATUS_OPTIONS} />
        </Field>

        <div className="sm:col-span-2 mt-1 border-t border-slate-100 pt-3">
          <p className="text-sm font-semibold text-slate-800">ধাপ ১: অ্যাসাম্পশন / ইনপুট</p>
        </div>

        <Field label="মোট মাসিক অ্যাড বাজেট (৳)">
          <Input type="number" min="0" value={form.monthly_budget} onChange={set('monthly_budget')} />
        </Field>
        <Field label="প্রত্যাশিত CTR (%)">
          <Input type="number" step="0.01" min="0" value={form.expected_ctr} onChange={set('expected_ctr')} />
        </Field>
        <Field label="প্রত্যাশিত CPC (৳)">
          <Input type="number" step="0.01" min="0" value={form.expected_cpc} onChange={set('expected_cpc')} />
        </Field>
        <Field label="কনভার্সন রেট (ক্লিক থেকে %)">
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.expected_conversion_rate}
            onChange={set('expected_conversion_rate')}
          />
        </Field>
        <Field label="গড় অর্ডার ভ্যালু / AOV (৳)">
          <Input type="number" min="0" value={form.aov} onChange={set('aov')} />
        </Field>

        <div className="sm:col-span-2 rounded-lg bg-slate-50 p-4 text-sm">
          <p className="mb-2 font-medium text-slate-700">মাসিক প্রজেকশন প্রিভিউ</p>
          <div className="grid grid-cols-2 gap-2 text-slate-600 sm:grid-cols-5">
            <div>
              ক্লিক
              <p className="font-semibold text-slate-900">{number(preview.clicks)}</p>
            </div>
            <div>
              ইমপ্রেশন
              <p className="font-semibold text-slate-900">{number(preview.impressions)}</p>
            </div>
            <div>
              কনভার্সন
              <p className="font-semibold text-slate-900">{number(preview.conversions)}</p>
            </div>
            <div>
              রেভিনিউ
              <p className="font-semibold text-slate-900">{currency(preview.revenue)}</p>
            </div>
            <div>
              ROAS
              <p className="font-semibold text-slate-900">{preview.roas.toFixed(2)}x</p>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
