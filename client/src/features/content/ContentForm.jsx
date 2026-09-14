import { useState } from 'react';
import { Modal } from '@/components/ui/Modal.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Field, Input, Select, Textarea } from '@/components/ui/Field.jsx';

export const PLATFORMS = ['Facebook', 'Instagram', 'Google', 'TikTok', 'YouTube', 'LinkedIn', 'Other'];
export const CONTENT_TYPES = ['পোস্ট', 'রিল/ভিডিও', 'স্টোরি', 'কারোসেল', 'ব্লগ', 'অ্যাড ক্রিয়েটিভ'];
export const CONTENT_STATUS = ['আইডিয়া', 'ড্রাফট', 'ডিজাইন', 'রিভিউ', 'অ্যাপ্রুভড', 'পাবলিশড'];

export const ContentForm = ({ open, onClose, onSubmit, initial, saving, cycle }) => {
  const [form, setForm] = useState({
    plan_date: initial?.plan_date || cycle.month_start,
    platform: initial?.platform || 'Facebook',
    content_type: initial?.content_type || 'পোস্ট',
    topic: initial?.topic || '',
    status: initial?.status || 'আইডিয়া',
    designer_name: initial?.designer_name || '',
    publish_date: initial?.publish_date || '',
    note: initial?.note || '',
  });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = () =>
    onSubmit({
      ...form,
      designer_name: form.designer_name || null,
      publish_date: form.publish_date || null,
      note: form.note || null,
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? 'কন্টেন্ট সম্পাদনা' : 'নতুন কন্টেন্ট'}
      subtitle="মাসিক কন্টেন্ট ক্যালেন্ডার — ক্লায়েন্টকে দেখানোর জন্য"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button loading={saving} onClick={submit}>
            সংরক্ষণ
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="তারিখ *">
          <Input type="date" value={form.plan_date} onChange={set('plan_date')} />
        </Field>
        <Field label="প্ল্যাটফর্ম">
          <Select value={form.platform} onChange={set('platform')} options={PLATFORMS} />
        </Field>
        <Field label="কন্টেন্ট টাইপ">
          <Select value={form.content_type} onChange={set('content_type')} options={CONTENT_TYPES} />
        </Field>
        <Field label="টপিক / ক্যাপশন আইডিয়া *" className="sm:col-span-3">
          <Input value={form.topic} onChange={set('topic')} placeholder="প্রোডাক্ট লঞ্চ অ্যানাউন্সমেন্ট" />
        </Field>
        <Field label="স্ট্যাটাস">
          <Select value={form.status} onChange={set('status')} options={CONTENT_STATUS} />
        </Field>
        <Field label="ডিজাইনার">
          <Input value={form.designer_name} onChange={set('designer_name')} />
        </Field>
        <Field label="পাবলিশ তারিখ">
          <Input type="date" value={form.publish_date} onChange={set('publish_date')} />
        </Field>
        <Field label="নোট" className="sm:col-span-3">
          <Textarea rows={2} value={form.note} onChange={set('note')} />
        </Field>
      </div>
    </Modal>
  );
};
