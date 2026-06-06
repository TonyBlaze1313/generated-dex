import { useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';

export function useFaucet(faucetAddress: string, faucetAbi: any) {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [txStatus, setTxStatus] = useState<string | null>(null);

  async function request(token: string) {
    if (!walletClient || !address) {
      setTxStatus('Wallet not connected');
      return;
    }
    try {
      const faucet = new ethers.Contract(faucetAddress, faucetAbi, walletClient as any);
      const tx = await faucet.requestFaucet(token);
      setTxStatus('Transaction sent: ' + tx.hash);
      await tx.wait();
      setTxStatus('Request successful');
    } catch (err: any) {
      setTxStatus('Error: ' + (err.message || err));
    }
  }

  async function requestBoth() {
    if (!walletClient || !address) {
      setTxStatus('Wallet not connected');
      return;
    }
    try {
      const faucet = new ethers.Contract(faucetAddress, faucetAbi, walletClient as any);
      const tx = await faucet.requestBothTokens();
      setTxStatus('Transaction sent: ' + tx.hash);
      await tx.wait();
      setTxStatus('Request successful');
    } catch (err: any) {
      setTxStatus('Error: ' + (err.message || err));
    }
  }

  return { request, requestBoth, txStatus };
}
