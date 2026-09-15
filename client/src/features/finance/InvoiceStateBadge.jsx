import { Badge } from '@/components/ui/Badge.jsx';
import { t } from '@/i18n/index.jsx';

const STATES = {
  paid: { label: 'পরিশোধিত', tone: 'success' },
  partial: { label: 'আংশিক', tone: 'warning' },
  due: { label: 'বাকি', tone: 'info' },
  overdue: { label: 'মেয়াদোত্তীর্ণ', tone: 'danger' },
  cancelled: { label: 'বাতিলকৃত', tone: 'muted' },
};

export const INVOICE_STATE_OPTIONS = Object.entries(STATES).map(([value, s]) => ({ value, label: s.label }));

export const InvoiceStateBadge = ({ state }) => <Badge tone={STATES[state]?.tone}>{t(STATES[state]?.label || state)}</Badge>;
