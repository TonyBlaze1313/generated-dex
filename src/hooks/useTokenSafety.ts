import { useState } from 'react';

type TokenCheckResponse = {
  safe: boolean;
  score: number;
  verdict: string;
  blocked: boolean;
  warnings: { code: string; severity: string; message: string }[];
  timestamp: string;
  cached: boolean;
};

export function useTokenSafety() {
  const [result, setResult] = useState<TokenCheckResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkToken(tokenAddress: string, chainId: number, pairWith?: string) {
    setLoading(true);
    try {
      const res = await fetch('/api/token-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenAddress, chainId, pairWith })
      });

      if (!res.ok) {
        setResult(null);
        return null;
      }

      const data = await res.json();

      if (!data || typeof data !== 'object' || typeof data.blocked !== 'boolean') {
        setResult(null);
        return null;
      }

      setResult(data as TokenCheckResponse);
      return data as TokenCheckResponse;
    } catch {
      setResult(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { result, loading, checkToken } as const;
}
