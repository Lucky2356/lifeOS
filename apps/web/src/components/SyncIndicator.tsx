import { useEffect, useReducer, useState } from 'react';
import { isOnline, offlineLedger, pendingCount, subscribeSync } from '../lib/offline-ledger';

export function SyncIndicator() {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    const unsub = subscribeSync(bump);
    const on = () => {
      setOnline(true);
      bump();
      void offlineLedger.sync();
    };
    const off = () => {
      setOnline(false);
      bump();
    };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      unsub();
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const pending = pendingCount();
  if (online && pending === 0) return null;

  return (
    <div className={`sync-indicator ${online ? 'sync-online' : 'sync-offline'}`}>
      <i className={`ti ${online ? 'ti-cloud-up' : 'ti-cloud-off'}`} aria-hidden="true" />
      {online
        ? `Синхронизация${pending > 0 ? ` · ${pending}` : ''}`
        : `Офлайн${pending > 0 ? ` · ${pending} в очереди` : ''}`}
    </div>
  );
}
