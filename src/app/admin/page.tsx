"use client";

import React, { useEffect, useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWalletClient } from 'wagmi';
import { ethers } from 'ethers';
import { hydraConfig } from '../../lib/dexConfig';

const LOGO_CANDIDATES = ['/logo.png', '/logo.webp', '/logo.jpg', '/logo.jpeg', '/logo.svg'];

function useAdminTx() {
  const { data: walletClient } = useWalletClient();
  const [status, setStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  async function execute(contractAddress: string, abi: string[], method: string, args: unknown[] = []) {
    if (!walletClient) { setStatus('Wallet not connected'); return false; }
    if (!contractAddress) { setStatus('Contract address not configured'); return false; }
    try {
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, abi, signer);
      setStatus('Sending transaction...');
      const tx = await contract[method](...args);
      setTxHash(tx.hash);
      setStatus('Confirming...');
      await tx.wait();
      setStatus('Success');
      return true;
    } catch (err: any) {
      const msg = err?.reason || err?.data?.message || err?.message || String(err);
      if (msg.includes('user rejected')) setStatus('Rejected by user');
      else setStatus('Error: ' + msg);
      return false;
    }
  }

  return { execute, status, txHash, setStatus, setTxHash };
}

function useAdminRead(
  contractAddress: string,
  abi: string[],
  method: string,
  args: unknown[] = []
) {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    if (!contractAddress) return;
    let active = true;

    (async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum as any);
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const result = await contract[method](...args);
        if (active) {
          setValue(result?.toString() ?? null);
        }
      } catch {
        if (active) {
          setValue(null);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [contractAddress, method, ...args, value]);

  return [value, setValue] as const;
}

const ROUTER_PAUSE_ABI = [
  'function pause() external',
  'function unpause() external',
  'function paused() external view returns (bool)',
];

const FACTORY_FEE_ABI = [
  'function setFee(uint256 newFee) external',
  'function fee() external view returns (uint256)',
];

const ROUTER_MAX_SLIPPAGE_ABI = [
  'function setMaxSlippagePercent(uint256) external',
  'function maxSlippagePercent() external view returns (uint256)',
];

const STAKING_FLUSH_ABI = [
  'function flushPenaltiesToRewards() external',
  'function penaltyReserve() external view returns (uint256)',
  'function rewardToken() external view returns (address)',
  'function fundRewards(uint256 amount) external',
];

const ERC20_ABI = [
  'function allowance(address,address) external view returns (uint256)',
  'function approve(address,uint256) external returns (bool)',
];

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const deployer = (process.env.NEXT_PUBLIC_DEPLOYER_ADDRESS || '').toLowerCase();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [pauseConfirmation, setPauseConfirmation] = useState('');
  const [feeInput, setFeeInput] = useState('');
  const [slippageInput, setSlippageInput] = useState('');
  const [fundAmount, setFundAmount] = useState('');

  const contracts = hydraConfig.contracts || {};
  const routerAddress = contracts.router || '';
  const factoryAddress = contracts.factory || '';
  const stakingAddress = contracts.stakeRewards || '';
  const rewardTokenAddress = hydraConfig.tokens?.[1]?.address || '';
  const rewardTokenSymbol = hydraConfig.tokens?.[1]?.symbol || 'Reward';
  const hasWalletProvider = typeof window !== 'undefined' && typeof (window as Window & { ethereum?: unknown }).ethereum !== 'undefined';

  const [routerPaused, setRouterPaused] = useAdminRead(routerAddress, ROUTER_PAUSE_ABI, 'paused');
  const [currentFee, setCurrentFee] = useAdminRead(factoryAddress, FACTORY_FEE_ABI, 'fee');
  const [currentSlippage, setCurrentSlippage] = useAdminRead(routerAddress, ROUTER_MAX_SLIPPAGE_ABI, 'maxSlippagePercent');
  const [penaltyReserve, setPenaltyReserve] = useAdminRead(stakingAddress, STAKING_FLUSH_ABI, 'penaltyReserve');
  const [rewardTokenAddressOnChain] = useAdminRead(stakingAddress, STAKING_FLUSH_ABI, 'rewardToken');

  const pauseTx = useAdminTx();
  const feeTx = useAdminTx();
  const slippageTx = useAdminTx();
  const flushTx = useAdminTx();
  const fundTx = useAdminTx();

  useEffect(() => {
    let active = true;

    async function detectLogo() {
      for (const candidate of LOGO_CANDIDATES) {
        try {
          const response = await fetch(candidate, { method: 'HEAD' });
          if (response.ok && active) {
            setLogoUrl(candidate);
            return;
          }
        } catch {
          // ignore
        }
      }

      if (active) {
        setLogoUrl(null);
      }
    }

    detectLogo();
    return () => {
      active = false;
    };
  }, []);

  const handlePauseRouter = async () => {
    if (pauseTx.status === 'Sending transaction...' || pauseTx.status === 'Confirming...') return;
    if (pauseConfirmation.trim().toUpperCase() !== 'PAUSE') {
      pauseTx.setStatus('Enter PAUSE to confirm');
      return;
    }

    const success = await pauseTx.execute(routerAddress, ROUTER_PAUSE_ABI, 'pause');
    if (success) {
      setRouterPaused(null);
      setPauseConfirmation('');
    }
  };

  const handleUnpauseRouter = async () => {
    if (pauseTx.status === 'Sending transaction...' || pauseTx.status === 'Confirming...') return;
    const success = await pauseTx.execute(routerAddress, ROUTER_PAUSE_ABI, 'unpause');
    if (success) {
      setRouterPaused(null);
    }
  };

  const handleSetFee = async () => {
    if (feeTx.status === 'Sending transaction...' || feeTx.status === 'Confirming...') return;
    const feeValue = Number(feeInput);
    if (Number.isNaN(feeValue) || !Number.isFinite(feeValue)) {
      feeTx.setStatus('Enter a valid fee in basis points');
      return;
    }
    if (feeValue < 0 || feeValue > 10000) {
      feeTx.setStatus('Fee must be between 0 and 10000');
      return;
    }

    const success = await feeTx.execute(factoryAddress, FACTORY_FEE_ABI, 'setFee', [BigInt(feeValue)]);
    if (success) {
      setCurrentFee(null);
      setFeeInput('');
    }
  };

  const handleSetMaxSlippage = async () => {
    if (slippageTx.status === 'Sending transaction...' || slippageTx.status === 'Confirming...') return;
    const slippageValue = Number(slippageInput);
    if (Number.isNaN(slippageValue) || !Number.isFinite(slippageValue)) {
      slippageTx.setStatus('Enter a valid slippage percent');
      return;
    }
    if (slippageValue < 0 || slippageValue > 10000) {
      slippageTx.setStatus('Slippage must be between 0 and 10000');
      return;
    }

    const success = await slippageTx.execute(routerAddress, ROUTER_MAX_SLIPPAGE_ABI, 'setMaxSlippagePercent', [BigInt(slippageValue)]);
    if (success) {
      setCurrentSlippage(null);
      setSlippageInput('');
    }
  };

  const handleFlushPenalties = async () => {
    if (flushTx.status === 'Sending transaction...' || flushTx.status === 'Confirming...') return;
    const success = await flushTx.execute(stakingAddress, STAKING_FLUSH_ABI, 'flushPenaltiesToRewards');
    if (success) {
      setPenaltyReserve(null);
      flushTx.setStatus('Success');
    }
  };

  const handleFundRewards = async () => {
    if (fundTx.status === 'Sending transaction...' || fundTx.status === 'Confirming...') return;
    if (!fundAmount) {
      fundTx.setStatus('Enter an amount to fund');
      return;
    }
    if (!walletClient) {
      fundTx.setStatus('Wallet not connected');
      return;
    }
    const tokenAddress = rewardTokenAddressOnChain || rewardTokenAddress;
    if (!tokenAddress || !stakingAddress) {
      fundTx.setStatus('Reward token or staking contract address missing');
      return;
    }

    try {
      const amount = ethers.parseEther(fundAmount);
      const provider = new ethers.BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

      const allowance = await tokenContract.allowance(signerAddress, stakingAddress);
      if (allowance < amount) {
        fundTx.setStatus('Approving token spend...');
        const approveTx = await tokenContract.approve(stakingAddress, amount);
        await approveTx.wait();
      }

      fundTx.setStatus('Funding reward reserve...');
      const stakingContract = new ethers.Contract(stakingAddress, STAKING_FLUSH_ABI, signer);
      const tx = await stakingContract.fundRewards(amount);
      fundTx.setTxHash(tx.hash);
      await tx.wait();
      fundTx.setStatus('Success');
      setFundAmount('');
    } catch (err: any) {
      const msg = err?.reason || err?.data?.message || err?.message || String(err);
      if (msg.includes('user rejected')) fundTx.setStatus('Rejected by user');
      else fundTx.setStatus('Error: ' + msg);
    }
  };

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setUploadMessage('Please upload a valid image file.');
      return;
    }

    setIsUploading(true);
    setUploadMessage('');

    try {
      const formData = new FormData();
      formData.append('logo', file);

      const response = await fetch('/api/upload-logo', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed.');
      }

      const uploadedUrl = `${data.url}?t=${Date.now()}`;
      setPreviewUrl(uploadedUrl);
      setLogoUrl(uploadedUrl);
      setUploadMessage('Logo uploaded successfully.');
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  }

  if (!hasWalletProvider) {
    return (
      <div className="min-h-screen bg-[#050816] text-white flex items-center justify-center">
        <div className="max-w-xl w-full p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4">Wallet provider unavailable</h2>
          <p className="text-sm text-slate-300">Please install or enable a wallet provider to use admin controls.</p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#050816] text-white flex items-center justify-center">
        <div className="max-w-xl w-full p-8">
          <h2 className="text-2xl font-semibold mb-4">Admin Access Required</h2>
          <p className="mb-4 text-sm text-slate-300">Please connect the deployer wallet to access admin controls.</p>
          <ConnectButton />
        </div>
      </div>
    );
  }

  if (!address || address.toLowerCase() !== deployer) {
    return (
      <div className="min-h-screen bg-[#050816] text-white flex items-center justify-center">
        <div className="max-w-xl w-full p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4">Access Denied</h2>
          <p className="text-sm text-slate-300">Your connected wallet does not match the configured deployer address.</p>
        </div>
      </div>
    );
  }

  const isPausePending = pauseTx.status === 'Sending transaction...' || pauseTx.status === 'Confirming...';
  const isFeePending = feeTx.status === 'Sending transaction...' || feeTx.status === 'Confirming...';
  const isSlippagePending = slippageTx.status === 'Sending transaction...' || slippageTx.status === 'Confirming...';
  const isFlushPending = flushTx.status === 'Sending transaction...' || flushTx.status === 'Confirming...';
  const isFundPending = fundTx.status === 'Sending transaction...' || fundTx.status === 'Confirming...';

  return (
    <div className="min-h-screen bg-[#050816] text-white p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Hydra Admin</h1>
        <p className="text-sm text-slate-400 mt-1">Deployer: {address}</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
        <div className="grid gap-6">
          <div className="grid gap-6">
            <div className="rounded-[2rem] border border-slate-800 bg-slate-900/90 p-6">
              <h2 className="text-xl font-semibold text-white">Emergency Pause / Unpause</h2>
              <p className="mt-2 text-sm text-slate-400">Pause or unpause the router contract to stop swaps immediately.</p>

              <div className="mt-4 space-y-4">
                <div className="text-sm">
                  Current status:{' '}
                  {routerPaused === null ? (
                    <span className="text-slate-300">Loading...</span>
                  ) : routerPaused === 'true' ? (
                    <span className="text-red-400">● PAUSED</span>
                  ) : (
                    <span className="text-emerald-400">● LIVE</span>
                  )}
                </div>
                <label className="block text-sm text-slate-300">
                  Confirm pause by typing <span className="font-semibold">PAUSE</span> below.
                </label>
                <input
                  value={pauseConfirmation}
                  onChange={(event) => {
                    pauseTx.setStatus(null);
                    setPauseConfirmation(event.target.value);
                  }}
                  className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-slate-500"
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handlePauseRouter}
                    disabled={!routerAddress || routerPaused === 'true' || isPausePending}
                    className="rounded-3xl bg-red-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {isPausePending ? 'Pausing...' : 'Pause Router'}
                  </button>
                  <button
                    type="button"
                    onClick={handleUnpauseRouter}
                    disabled={!routerAddress || routerPaused === 'false' || isPausePending}
                    className="rounded-3xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"
                  >
                    {isPausePending ? 'Unpausing...' : 'Unpause Router'}
                  </button>
                </div>
                {pauseTx.status && <p className="text-sm text-slate-300">{pauseTx.status}</p>}
                {pauseTx.txHash && (
                  <a href={`https://explorer.testnet.arc.network/tx/${pauseTx.txHash}`} target="_blank" rel="noreferrer" className="text-sm text-sky-300 underline">
                    View transaction
                  </a>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-800 bg-slate-900/90 p-6">
              <h2 className="text-xl font-semibold text-white">Swap Fee</h2>
              <p className="mt-2 text-sm text-slate-400">Update the factory swap fee in basis points.</p>

              <div className="mt-4 space-y-4">
                <div className="text-sm text-slate-300">Current fee: {currentFee === null ? 'Loading...' : `${currentFee} bps (${(Number(currentFee) / 100).toFixed(2)}%)`}</div>
                <label className="block text-sm text-slate-300">New fee (0-10000)</label>
                <input
                  value={feeInput}
                  onChange={(event) => {
                    feeTx.setStatus(null);
                    setFeeInput(event.target.value);
                  }}
                  type="number"
                  min={0}
                  max={10000}
                  className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-slate-500"
                />
                <button
                  type="button"
                  onClick={handleSetFee}
                  disabled={!factoryAddress || isFeePending}
                  className="w-full rounded-3xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"
                >
                  {isFeePending ? 'Updating fee...' : 'Set Swap Fee'}
                </button>
                {feeTx.status && <p className="text-sm text-slate-300">{feeTx.status}</p>}
                {feeTx.txHash && (
                  <a href={`https://explorer.testnet.arc.network/tx/${feeTx.txHash}`} target="_blank" rel="noreferrer" className="text-sm text-sky-300 underline">
                    View transaction
                  </a>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-800 bg-slate-900/90 p-6">
              <h2 className="text-xl font-semibold text-white">Max Slippage</h2>
              <p className="mt-2 text-sm text-slate-400">Set the router maximum permitted slippage percentage.</p>

              <div className="mt-4 space-y-4">
                <div className="text-sm text-slate-300">Current max slippage: {currentSlippage === null ? 'Loading...' : `${currentSlippage} bps`}</div>
                <label className="block text-sm text-slate-300">Slippage (0-10000 bps)</label>
                <input
                  value={slippageInput}
                  onChange={(event) => {
                    slippageTx.setStatus(null);
                    setSlippageInput(event.target.value);
                  }}
                  type="number"
                  min={0}
                  max={10000}
                  className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-slate-500"
                />
                <button
                  type="button"
                  onClick={handleSetMaxSlippage}
                  disabled={!routerAddress || isSlippagePending}
                  className="w-full rounded-3xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"
                >
                  {isSlippagePending ? 'Updating slippage...' : 'Set Max Slippage'}
                </button>
                {slippageTx.status && <p className="text-sm text-slate-300">{slippageTx.status}</p>}
                {slippageTx.txHash && (
                  <a href={`https://explorer.testnet.arc.network/tx/${slippageTx.txHash}`} target="_blank" rel="noreferrer" className="text-sm text-sky-300 underline">
                    View transaction
                  </a>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-800 bg-slate-900/90 p-6">
              <h2 className="text-xl font-semibold text-white">Flush Staking Penalties</h2>
              <p className="mt-2 text-sm text-slate-400">Move accumulated early-exit penalties back into the staking reward pool.</p>

              <div className="mt-4 space-y-4">
                <div className="text-sm text-slate-300">Penalty reserve: {penaltyReserve === null ? 'Loading...' : `${ethers.formatEther(penaltyReserve)} tokens available`}</div>
                <button
                  type="button"
                  onClick={handleFlushPenalties}
                  disabled={!stakingAddress || penaltyReserve === '0' || penaltyReserve === null || isFlushPending}
                  className="w-full rounded-3xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"
                >
                  {isFlushPending ? 'Flushing...' : 'Flush Penalties to Rewards'}
                </button>
                {flushTx.status && <p className="text-sm text-slate-300">{flushTx.status}</p>}
                {flushTx.txHash && (
                  <a href={`https://explorer.testnet.arc.network/tx/${flushTx.txHash}`} target="_blank" rel="noreferrer" className="text-sm text-sky-300 underline">
                    View transaction
                  </a>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-800 bg-slate-900/90 p-6">
              <h2 className="text-xl font-semibold text-white">Fund Reward Reserve</h2>
              <p className="mt-2 text-sm text-slate-400">Approve and deposit reward token funds into staking reserve.</p>

              <div className="mt-4 space-y-4">
                <div className="text-sm text-slate-300">Reward token: {rewardTokenSymbol}</div>
                <label className="block text-sm text-slate-300">Amount to fund</label>
                <input
                  value={fundAmount}
                  onChange={(event) => {
                    fundTx.setStatus(null);
                    setFundAmount(event.target.value);
                  }}
                  type="text"
                  placeholder="0.0"
                  className="w-full rounded-3xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none focus:border-slate-500"
                />
                <button
                  type="button"
                  onClick={handleFundRewards}
                  disabled={!stakingAddress || !(rewardTokenAddressOnChain || rewardTokenAddress) || isFundPending}
                  className="w-full rounded-3xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"
                >
                  {isFundPending ? 'Funding...' : 'Fund Reward Reserve'}
                </button>
                {fundTx.status && <p className="text-sm text-slate-300">{fundTx.status}</p>}
                {fundTx.txHash && (
                  <a href={`https://explorer.testnet.arc.network/tx/${fundTx.txHash}`} target="_blank" rel="noreferrer" className="text-sm text-sky-300 underline">
                    View transaction
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/90 p-6">
            <h2 className="text-xl font-semibold text-white">Logo Upload</h2>
            <p className="mt-2 text-sm text-slate-400">Upload a custom brand logo for this deployment. Supported formats: PNG, JPG, WEBP, SVG.</p>

            <div className="mt-6 flex flex-col gap-4">
              {logoUrl ? (
                <img src={logoUrl} alt="Current logo" className="max-h-40 w-full rounded-3xl object-contain border border-slate-800 bg-slate-950 p-4" />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-950/80 text-slate-500">
                  No logo uploaded yet.
                </div>
              )}

              <label className="block rounded-3xl border border-slate-700 bg-slate-950/90 p-4 text-sm text-slate-200">
                <span className="font-semibold">Choose logo file</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="mt-3 w-full text-sm text-slate-100 file:mr-4 file:rounded-full file:border-0 file:bg-slate-700 file:px-4 file:py-2 file:text-sm file:text-white"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
              </label>

              <div className="space-y-2 text-sm text-slate-300">
                <p>Upload result: {uploadMessage || 'No changes yet.'}</p>
                {isUploading && <p>Uploading logo…</p>}
              </div>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-slate-800 bg-slate-900/90 p-6">
            <h3 className="text-lg font-semibold text-white">Deployment tools</h3>
            <p className="mt-3 text-sm text-slate-400">This admin page is reserved for the configured deployer address. Uploaded logo files are saved to the deployment public assets folder.</p>
            <p className="mt-4 text-sm text-slate-400">Once uploaded, refresh the homepage to see the logo rendered in the app header.</p>
          </aside>
        </div>
      </section>
    </div>
  );
}
