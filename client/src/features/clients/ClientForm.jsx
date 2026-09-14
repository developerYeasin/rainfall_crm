import { useState } from 'react';
import { Field, Input, Select, Textarea } from '@/components/ui/Field.jsx';
import { Modal } from '@/components/ui/Modal.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { CLIENT_STATUS_LABEL } from '@/lib/status.js';

const STATUS_OPTIONS = Object.entries(CLIENT_STATUS_LABEL).map(([value, label]) => ({ value, label }));

const EMPTY = {
  name: '',
  company: '',
  contact_person: '',
  email: '',
  phone: '',
  industry: '',
  status: 'onboarding',
  onboarded_at: '',
  monthly_retainer: '',
  notes: '',
};

export const ClientForm = ({ open, onClose, onSubmit, initial, saving }) => {
  const [form, setForm] = useState({ ...EMPTY, ...(initial || {}) });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      monthly_retainer: form.monthly_retainer === '' ? null : Number(form.monthly_retainer),
      onboarded_at: form.onboarded_at || null,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? 'ক্লায়েন্ট সম্পাদনা' : 'নতুন ক্লায়েন্ট'}
      subtitle="ক্লায়েন্টের প্রোফাইল ও অনবোর্ডিং তথ্য"
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
        <Field label="ক্লায়েন্টের নাম *">
          <Input required value={form.name} onChange={set('name')} placeholder="যেমন: ডেমো ফ্যাশন" />
        </Field>
        <Field label="কোম্পানি">
          <Input value={form.company || ''} onChange={set('company')} />
        </Field>
        <Field label="যোগাযোগকারী">
          <Input value={form.contact_person || ''} onChange={set('contact_person')} />
        </Field>
        <Field label="ইমেইল">
          <Input type="email" value={form.email || ''} onChange={set('email')} />
        </Field>
        <Field label="ফোন">
          <Input value={form.phone || ''} onChange={set('phone')} />
        </Field>
        <Field label="ইন্ডাস্ট্রি">
          <Input value={form.industry || ''} onChange={set('industry')} placeholder="ই-কমার্স / ফ্যাশন" />
        </Field>
        <Field label="স্ট্যাটাস">
          <Select value={form.status} onChange={set('status')} options={STATUS_OPTIONS} />
        </Field>
        <Field label="অনবোর্ডিং তারিখ">
          <Input type="date" value={form.onboarded_at || ''} onChange={set('onboarded_at')} />
        </Field>
        <Field label="মাসিক রিটেইনার (৳)">
          <Input type="number" min="0" value={form.monthly_retainer ?? ''} onChange={set('monthly_retainer')} />
        </Field>
        <Field label="নোট" className="sm:col-span-2">
          <Textarea value={form.notes || ''} onChange={set('notes')} />
        </Field>
      </form>
    </Modal>
  );
};
