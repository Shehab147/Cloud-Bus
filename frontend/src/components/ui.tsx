import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, useEffect, useRef } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, LoaderCircle, Search, X } from 'lucide-react';
import type { Pagination as PaginationData } from '../lib/types';

const cx = (...values: (string | false | null | undefined)[]) => values.filter(Boolean).join(' ');

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'secondary'|'outline'|'ghost'|'danger'; size?: 'sm'|'md'|'icon'; busy?: boolean; busyLabel?: string }>(
  ({ className, variant='primary', size='md', busy, busyLabel='Saving…', children, disabled, ...props }, ref) => {
    const variants = { primary:'bg-primary text-primary-foreground hover:opacity-90', secondary:'bg-secondary text-secondary-foreground hover:bg-muted', outline:'border border-border bg-background hover:bg-muted', ghost:'hover:bg-muted text-muted-foreground hover:text-foreground', danger:'bg-destructive text-destructive-foreground hover:opacity-90' };
    const sizes = { sm:'h-9 px-3 text-sm', md:'h-10 px-4 text-sm', icon:'h-10 w-10' };
    return <button ref={ref} disabled={disabled || busy} className={cx('inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',variants[variant],sizes[size],className)} {...props}>
      {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true"/>}{busy ? busyLabel : children}
    </button>;
  }
);
Button.displayName='Button';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cx('overflow-hidden rounded-lg border border-border/60 bg-card shadow-sm',className)} {...props}/>; }
export function CardHeader({ icon, title, description, action }: {icon?:ReactNode;title:ReactNode;description?:ReactNode;action?:ReactNode}) { return <div className="flex items-start justify-between gap-4 px-5 py-5 sm:px-6"><div className="flex min-w-0 gap-3">{icon && <div className="rounded-lg bg-muted p-2.5 text-primary">{icon}</div>}<div><h2 className="text-base font-semibold">{title}</h2>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div></div>{action}</div>; }
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div className={cx('space-y-4 p-5 pt-0 sm:p-6 sm:pt-0',className)} {...props}/>; }

export function PageHeader({ title, subtitle, actions }: {title:string;subtitle:string;actions?:ReactNode}) { return <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-1 text-base text-muted-foreground">{subtitle}</p></div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>; }

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({className,...props},ref)=><input ref={ref} className={cx('h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',className)} {...props}/>);
Input.displayName='Input';
export function Field({ label, name, error, hint, children }: {label:string;name:string;error?:string;hint?:string;children:ReactNode}) { const id=`${name}-feedback`; return <div className="space-y-1.5"><label htmlFor={name} className="text-sm font-medium text-muted-foreground">{label}</label><div>{children}</div>{error ? <p id={id} className="text-xs font-medium text-destructive" role="alert">{error}</p> : hint ? <p id={id} className="text-xs text-muted-foreground/80">{hint}</p>:null}</div>; }
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({className,...props},ref)=><select ref={ref} className={cx('h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',className)} {...props}/>); Select.displayName='Select';
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({className,...props},ref)=><textarea ref={ref} className={cx('min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',className)} {...props}/>); Textarea.displayName='Textarea';

export function SearchBox({ value, onChange, placeholder='Search…' }: {value:string;onChange:(value:string)=>void;placeholder?:string}) { return <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true"/><Input type="search" aria-label={placeholder} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="pl-9"/></div>; }

export function Loading({ label='Loading…' }: {label?:string}) { return <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground" role="status"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true"/>{label}</div>; }
export function Empty({ title, description, action }: {title:string;description:string;action?:ReactNode}) { return <div className="flex min-h-40 flex-col items-center justify-center px-6 text-center"><div className="mb-3 rounded-full bg-muted p-3 text-muted-foreground"><Search className="h-5 w-5" aria-hidden="true"/></div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>{action && <div className="mt-4">{action}</div>}</div>; }
export function ErrorState({ message, onRetry }: {message:string;onRetry?:()=>void}) { return <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4" role="alert"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true"/><div><p className="text-sm font-semibold text-destructive">Unable to load this information</p><p className="mt-1 text-sm text-muted-foreground">{message}</p>{onRetry&&<Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Try again</Button>}</div></div></div>; }
export function SuccessState({ message }: {message:string}) { return <div className="rounded-lg border border-success/20 bg-success/5 p-3 text-sm font-medium text-success" role="status">{message}</div>; }

export function StatusBadge({ status }: {status:string}) { const tone = status==='active'||status==='info'?'bg-info/10 text-info':status==='delay'?'bg-warning/10 text-warning':status==='cancellation'||status==='inactive'?'bg-destructive/10 text-destructive':'bg-muted text-muted-foreground'; return <span className={cx('inline-flex rounded-full px-2.5 py-1 text-xs font-medium',tone)}>{status}</span>; }

export function Pagination({ value, onPage }: {value:PaginationData;onPage:(page:number)=>void}) { return <div className="flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-4 sm:flex-row"><p className="text-sm text-muted-foreground">{value.total===0?'No results':`${(value.page-1)*value.limit+1}–${Math.min(value.page*value.limit,value.total)} of ${value.total}`}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={value.page<=1} onClick={()=>onPage(value.page-1)}><ChevronLeft className="h-4 w-4"/>Previous</Button><Button variant="outline" size="sm" disabled={value.page>=value.totalPages} onClick={()=>onPage(value.page+1)}>Next<ChevronRight className="h-4 w-4"/></Button></div></div>; }

export function ConfirmDialog({ open, title, description, confirmLabel='Confirm', busy, onCancel, onConfirm }: {open:boolean;title:string;description:string;confirmLabel?:string;busy?:boolean;onCancel:()=>void;onConfirm:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const el=ref.current;if(!el)return;if(open&&!el.open)el.showModal();if(!open&&el.open)el.close();},[open]);
  return <dialog ref={ref} className="native-dialog" onCancel={(e)=>{e.preventDefault();onCancel();}} onClose={onCancel}><div className="rounded-lg border border-border bg-card p-5 shadow-xl"><div className="flex items-start justify-between"><h2 className="text-lg font-semibold">{title}</h2><Button variant="ghost" size="icon" aria-label="Close dialog" onClick={onCancel}><X className="h-4 w-4"/></Button></div><p className="mt-2 text-sm text-muted-foreground">{description}</p><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button variant="danger" busy={busy} busyLabel="Updating…" onClick={onConfirm}>{confirmLabel}</Button></div></div></dialog>;
}
