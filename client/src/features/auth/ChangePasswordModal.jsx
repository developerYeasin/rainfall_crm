import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { authApi } from '@/api/endpoints.js';
import { Modal } from '@/components/ui/Modal.jsx';
import { Button } from '@/components/ui/Button.jsx';
import { Field, Input } from '@/components/ui/Field.jsx';
import { t } from '@/i18n/index.jsx';

/** Every login can replace a generated password. The server revokes all sessions, so the user signs in again. */
export const ChangePasswordModal = ({ onClose, onChanged }) => {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const mismatch = form.confirm && form.newPassword !== form.confirm;
  const tooShort = form.newPassword && form.newPassword.length < 6;
  const valid = form.currentPassword && form.newPassword.length >= 6 && form.newPassword === form.confirm;

  const save = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
    onSuccess: () => {
      toast.success(t('পাসওয়ার্ড পরিবর্তন হয়েছে — নতুন পাসওয়ার্ড দিয়ে লগইন করুন'));
      onChanged();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="পাসওয়ার্ড পরিবর্তন"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            বাতিল
          </Button>
          <Button loading={save.isPending} disabled={!valid} onClick={() => save.mutate()}>
            সংরক্ষণ
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save.mutate();
        }}
      >
        <Field label="বর্তমান পাসওয়ার্ড">
          <Input type="password" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} />
        </Field>
        <Field label="নতুন পাসওয়ার্ড" error={tooShort ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর' : null}>
          <Input type="password" autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} />
        </Field>
        <Field label="নতুন পাসওয়ার্ড আবার দিন" error={mismatch ? 'দুটি পাসওয়ার্ড মেলেনি' : null}>
          <Input type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
};
