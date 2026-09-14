import { useState } from 'react';
import { Modal } from '@/components/ui/Modal.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Field, Input, Checkbox, Textarea } from '@/components/ui/Field.jsx';

export const CHECKS = [
  { key: 'morning_check', label: 'সকালে চেক' },
  { key: 'ad_monitoring_done', label: 'অ্যাড মনিটরিং' },
  { key: 'report_updated', label: 'রিপোর্ট আপডেট' },
  { key: 'client_update_sent', label: 'ক্লায়েন্ট আপডেট' },
];

export const TaskForm = ({ open, onClose, onSubmit, initial, saving, cycle }) => {
  const [form, setForm] = useState({
    task_date: initial?.task_date || cycle.month_start,
    task_name: initial?.task_name || 'Facebook Ads Media Buyer',
    owner_label: initial?.owner_label || 'মিডিয়া বায়ার',
    morning_check: initial?.morning_check ?? false,
    ad_monitoring_done: initial?.ad_monitoring_done ?? false,
    report_updated: initial?.report_updated ?? false,
    client_update_sent: initial?.client_update_sent ?? false,
    comment: initial?.comment || '',
  });

  const submit = () =>
    onSubmit({ ...form, comment: form.comment || null, owner_label: form.owner_label || null });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? 'টাস্ক সম্পাদনা' : 'নতুন ডেইলি টাস্ক'}
      subtitle="টিম প্রতিদিন নির্ধারিত কাজ করছে কিনা যাচাই"
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
          <Input type="date" value={form.task_date} onChange={(e) => setForm({ ...form, task_date: e.target.value })} />
        </Field>
        <Field label="নির্ধারিত ডেইলি টাস্ক *" className="sm:col-span-2">
          <Input value={form.task_name} onChange={(e) => setForm({ ...form, task_name: e.target.value })} />
        </Field>
        <Field label="দায়িত্বে" className="sm:col-span-3">
          <Input value={form.owner_label} onChange={(e) => setForm({ ...form, owner_label: e.target.value })} />
        </Field>
        <div className="sm:col-span-3 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
          {CHECKS.map((check) => (
            <Checkbox
              key={check.key}
              label={check.label}
              checked={!!form[check.key]}
              onChange={(e) => setForm({ ...form, [check.key]: e.target.checked })}
            />
          ))}
        </div>
        <Field label="কমেন্ট" className="sm:col-span-3">
          <Textarea rows={2} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
};
