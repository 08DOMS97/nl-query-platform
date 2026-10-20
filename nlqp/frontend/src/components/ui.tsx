'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ENGINE_LABELS, type Connection } from '@/lib/types';

/* --- Formato --- */

const LOCALE = 'es-GT';

export function formatNumber(n: number): string {
  return n.toLocaleString(LOCALE);
}

/** "8 min", "1 min 30 s", "45 s". */
export function formatDuration(totalSec: number): string {
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (!min) return `${sec} s`;
  return sec ? `${min} min ${sec} s` : `${min} min`;
}

export function formatUsd(n: number): string {
  // Las llamadas cuestan centavos: con 2 decimales todo se vería como $0.01.
  return `$${n.toLocaleString(LOCALE, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
}

/** «10 oct 2026, 15:33»: compacto y en 24 h para que entre en una línea de tabla. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
  const time = d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${date}, ${time}`;
}

/* --- Botones --- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border-accent-200 bg-accent-100 text-accent-800 hover:bg-accent-200/70 hover:border-accent-500/40',
  secondary: 'border-line-strong bg-canvas text-ink hover:bg-surface',
  ghost: 'border-transparent bg-transparent text-ink-2 hover:bg-sunken hover:text-ink',
  danger: 'border-transparent bg-transparent text-bad hover:bg-bad-bg',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' }) {
  const sizing = size === 'sm' ? 'h-7 px-2.5 text-[13px]' : 'h-8 px-3.5 text-[13px]';
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${sizing} ${BUTTON_VARIANTS[variant]} ${className}`}
    />
  );
}

/* --- Estructura de página --- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-6 border-b border-line pb-4">
      <div>
        <h1 className="text-[18px] font-semibold tracking-[-0.01em]">{title}</h1>
        {description && <p className="mt-0.5 max-w-[70ch] text-[13px] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Bloque con borde y una barra de título opcional. */
export function Panel({
  title,
  meta,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded border border-line bg-canvas ${className}`}>
      {(title || actions) && (
        <div className="flex min-h-10 items-center justify-between gap-4 border-b border-line px-4 py-2">
          <div className="flex items-baseline gap-3">
            {title && <h2 className="text-[13px] font-semibold">{title}</h2>}
            {meta && <span className="text-[12px] text-ink-3">{meta}</span>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/* --- Indicadores --- */

type Tone = 'ok' | 'bad' | 'warn' | 'neutral' | 'accent';

const TONES: Record<Tone, string> = {
  ok: 'bg-ok-bg text-ok',
  bad: 'bg-bad-bg text-bad',
  warn: 'bg-warn-bg text-warn',
  neutral: 'bg-sunken text-ink-2',
  accent: 'bg-accent-50 text-accent-700',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex h-5 items-center rounded-sm px-1.5 text-[11.5px] font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

/** Mensaje en línea (error, aviso, confirmación), con barra lateral de color. */
export function Notice({ tone = 'neutral', children }: { tone?: Exclude<Tone, 'accent'>; children: ReactNode }) {
  const bar = { ok: 'border-l-ok', bad: 'border-l-bad', warn: 'border-l-warn', neutral: 'border-l-line-strong' }[tone];
  return (
    <div className={`rounded-sm border border-line border-l-2 ${bar} bg-canvas px-3 py-2 text-[13px] text-ink-2`}>
      {children}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-[13px] font-medium text-ink-2">{title}</p>
      {children && <p className="mt-1 text-[13px] text-ink-3">{children}</p>}
    </div>
  );
}

/* --- Selector de conexión --- */

/** Control segmentado: todas las conexiones a la vista, una activa, con su motor debajo del nombre. */
export function ConnectionSelector({
  connections,
  value,
  onChange,
  disabled,
}: {
  connections: Connection[];
  value: string;
  onChange: (connection: Connection) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Conexión" className="inline-flex flex-wrap rounded border border-line-strong bg-canvas p-0.5">
      {connections.map((c) => {
        const active = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(c)}
            className={`flex flex-col items-start rounded-sm px-3 py-1 text-left transition-colors disabled:cursor-not-allowed ${
              active ? 'bg-accent-100 text-accent-800' : 'text-ink-2 hover:text-ink'
            }`}
          >
            <span className={`text-[13px] leading-tight ${active ? 'font-medium' : ''}`}>{c.name}</span>
            <span className={`text-[11.5px] leading-tight ${active ? 'text-accent-700' : 'text-ink-3'}`}>{ENGINE_LABELS[c.engine]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Etiqueta de campo de formulario. */
export function FieldLabel({ htmlFor, children, hint }: { htmlFor?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-4">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {children}
      </label>
      {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
    </div>
  );
}
