import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { Button } from './Button.jsx';
import { getLang, t } from '@/i18n/index.jsx';

const fmt = (d) => format(d, 'yyyy-MM-dd');
const WEEKDAYS = ['শনি', 'রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র'];
const WEEKDAYS_EN = ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr'];

/** "18 Sep 2026" — short enough for a button. */
const pretty = (iso) => (iso ? format(parseISO(iso), 'd MMM yyyy') : '');

const Month = ({ month, from, to, hover, onPick, onHover }) => {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 6 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 6 }),
  });
  const today = fmt(new Date());
  // While only the start is picked, the hovered day previews the range.
  const end = to || (from && hover && hover >= from ? hover : null);

  return (
    <div className="w-[252px]">
      <p className="mb-2 text-center text-sm font-semibold text-slate-800">{format(month, 'MMMM yyyy')}</p>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-slate-400">
        {(getLang() === 'en' ? WEEKDAYS_EN : WEEKDAYS).map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const iso = fmt(day);
          const outside = !isSameMonth(day, month);
          const edge = iso === from || iso === end;
          const inside = from && end && iso > from && iso < end;
          return (
            <button
              key={iso}
              type="button"
              disabled={outside}
              onClick={() => onPick(iso)}
              onMouseEnter={() => onHover(iso)}
              className={clsx(
                'h-9 text-sm transition',
                outside && 'invisible',
                edge && 'rounded-lg bg-brand-600 font-semibold text-white',
                inside && 'bg-brand-50 text-brand-800',
                !edge && !inside && 'rounded-lg text-slate-700 hover:bg-slate-100',
                !edge && iso === today && 'font-bold text-brand-700 underline underline-offset-4',
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Preset ranges plus a two-month calendar. `value` is { key, from, to };
 * presets resolve their own dates through `resolve(key)`.
 */
export const DateRangePicker = ({ value, presets, resolve, onChange, className }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ from: value.from || '', to: value.to || '' });
  const [hover, setHover] = useState(null);
  const [month, setMonth] = useState(() => startOfMonth(value.from ? parseISO(value.from) : subMonths(new Date(), 1)));
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const resolved = value.key === 'custom' ? value : { ...value, ...resolve(value.key) };
  const presetLabel = presets.find((p) => p.value === value.key)?.label;
  const label =
    value.key === 'custom' && value.from
      ? value.from === value.to
        ? pretty(value.from)
        : `${pretty(value.from)} – ${pretty(value.to)}`
      : t(presetLabel || 'তারিখ বেছে নিন');

  const openPicker = () => {
    setDraft({ from: resolved.from || '', to: resolved.to || '' });
    if (resolved.from) setMonth(startOfMonth(parseISO(resolved.from)));
    setOpen((o) => !o);
  };

  const pick = (iso) => {
    if (!draft.from || draft.to || iso < draft.from) setDraft({ from: iso, to: '' });
    else setDraft({ from: draft.from, to: iso });
  };

  const apply = () => {
    if (!draft.from) return;
    onChange({ key: 'custom', from: draft.from, to: draft.to || draft.from });
    setOpen(false);
  };

  return (
    <div ref={ref} className={clsx('relative', className)}>
      <button
        type="button"
        onClick={openPicker}
        className="input flex w-full items-center gap-2 text-left sm:w-auto sm:min-w-[240px]"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true">
          <path d="M6 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm10 7H4v7h12V9Z" />
        </svg>
        <span className="flex-1 truncate text-sm text-slate-800">{label}</span>
        <span className="text-xs text-slate-400">▾</span>
      </button>

      {open && (
        <div
          role="dialog"
          className="absolute right-0 z-40 mt-2 flex max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:flex-row"
        >
          <ul className="flex gap-1 overflow-x-auto border-b border-slate-100 p-2 sm:w-44 sm:flex-col sm:border-b-0 sm:border-r">
            {presets
              .filter((p) => p.value !== 'custom')
              .map((p) => (
                <li key={p.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ key: p.value, from: '', to: '' });
                      setOpen(false);
                    }}
                    className={clsx(
                      'w-full whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm',
                      value.key === p.value ? 'bg-brand-50 font-medium text-brand-700' : 'text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    {t(p.label)}
                  </button>
                </li>
              ))}
          </ul>
          <div className="p-3">
            <div className="mb-1 flex items-center justify-between">
              <button type="button" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={() => setMonth(subMonths(month, 1))} aria-label={t('আগের মাস')}>
                ‹
              </button>
              <button type="button" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" onClick={() => setMonth(addMonths(month, 1))} aria-label={t('পরের মাস')}>
                ›
              </button>
            </div>
            <div className="flex gap-4" onMouseLeave={() => setHover(null)}>
              <Month month={month} from={draft.from} to={draft.to} hover={hover} onPick={pick} onHover={setHover} />
              <div className="hidden md:block">
                <Month month={addMonths(month, 1)} from={draft.from} to={draft.to} hover={hover} onPick={pick} onHover={setHover} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-500">
                {draft.from
                  ? `${pretty(draft.from)} – ${draft.to ? pretty(draft.to) : t('শেষ তারিখ বেছে নিন')}`
                  : t('শুরুর তারিখে ক্লিক করুন')}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
                  বাতিল
                </Button>
                <Button size="sm" disabled={!draft.from} onClick={apply}>
                  দেখুন
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
