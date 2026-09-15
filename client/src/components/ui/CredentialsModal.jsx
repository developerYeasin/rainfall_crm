import toast from 'react-hot-toast';
import { Modal } from './Modal.jsx';
import { Button } from './Button.jsx';
import { t } from '@/i18n/index.jsx';

const copy = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(t('কপি হয়েছে'));
  } catch {
    toast.error(t('কপি করা যায়নি — হাতে কপি করুন'));
  }
};

const Row = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{t(label)}</p>
      <p className="break-all font-mono text-sm font-medium text-slate-900">{value}</p>
    </div>
    <Button size="sm" variant="secondary" onClick={() => copy(value)}>
      কপি
    </Button>
  </div>
);

/** Shows a generated login once. The password is not stored in plain text anywhere, so it can't be shown again. */
export const CredentialsModal = ({ credentials, name, onClose }) => {
  if (!credentials) return null;
  const loginUrl = `${window.location.origin}/login`;
  const all = `${t('লগইন')}: ${loginUrl}\n${t('ইমেইল')}: ${credentials.email}\n${t('পাসওয়ার্ড')}: ${credentials.password}`;
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title="লগইন তৈরি হয়েছে"
      subtitle={name}
      footer={
        <>
          <Button variant="secondary" onClick={() => copy(all)}>
            সব কপি করুন
          </Button>
          <Button onClick={onClose}>ঠিক আছে</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Row label="লগইন লিংক" value={loginUrl} />
        <Row label="ইমেইল" value={credentials.email} />
        <Row label="পাসওয়ার্ড" value={credentials.password} />
        <p className="text-xs text-amber-700">
          {t('এই পাসওয়ার্ড আর দেখানো হবে না। ইমেইলেও পাঠানো হয়েছে — প্রয়োজনে রিসেট করুন।')}
        </p>
      </div>
    </Modal>
  );
};
