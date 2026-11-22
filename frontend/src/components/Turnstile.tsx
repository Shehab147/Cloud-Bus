import { useEffect, useId, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: { render: (container: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void; reset: (id: string) => void };
  }
}

const sitekey = '0x4AAAAAAGNU58BaJSJdAa7P';
let scriptPromise: Promise<void> | undefined;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load verification.'));
    document.head.append(script);
  });
  return scriptPromise;
}

export function Turnstile({ action, onToken }: { action: 'login' | 'register'; onToken: (token: string | null) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const [error, setError] = useState<string>();
  const labelId = useId();

  useEffect(() => {
    let active = true;
    void loadTurnstile().then(() => {
      if (!active || !container.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(container.current, {
        sitekey, action, callback: (token: string) => { setError(undefined); onToken(token); },
        'expired-callback': () => onToken(null),
        'error-callback': () => { onToken(null); setError('Verification could not load. Please refresh and try again.'); }
      });
    }).catch(() => setError('Verification could not load. Please refresh and try again.'));
    return () => { active = false; if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current); };
  }, [action, onToken]);

  return <div><div ref={container} aria-describedby={error ? labelId : undefined}/>{error && <p id={labelId} className="mt-2 text-sm text-destructive" role="alert">{error}</p>}</div>;
}
