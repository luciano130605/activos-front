import { useEffect, useState } from 'react';
import Page from './Page';
import Login from './Login';
import { ApiError, request, type Account } from './account';

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    request<Account>('session').then(data => { if (active) setAccount(data); }).catch(error => {
      if (active && !(error instanceof ApiError && error.status === 401)) setError(error.message);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  if (loading) return <main className="grid min-h-dvh place-items-center bg-[#0a0a0a] font-mono text-[12px] text-[#999]" role="status">Abriendo tu cuenta…</main>;
  if (!account) return <Login onLogin={setAccount} initialError={error} />;
  return <Page key={account.user.id} account={account} onLogout={() => { setAccount(null); setError(''); }} />;
}
