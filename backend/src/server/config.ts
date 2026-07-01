import { ViemChainClient } from 'agent0-sdk';
import { MANTLE_SEPOLIA_CHAIN_ID, MANTLE_SEPOLIA_RPC_URL } from '../config/mantle-sepolia.js';

export interface X402ServerConfig {
  network: string;
  chainId: number;
  payTo: string;
  tokenAddress: string;
  priceAtomic: string;
  priceMNT: number;
  facilitatorUrl: string;
  facilitatorApiKey?: string;
  devBypass: boolean;
  publicBaseUrl: string;
}

function requireEnv(name: string): string | undefined {
  const value = process.env[name];
  return value?.trim() || undefined;
}

async function resolvePayToAddress(): Promise<string> {
  const explicit = requireEnv('PARALLAX_PAY_TO');
  if (explicit) return explicit;

  const privateKey = requireEnv('PRIVATE_KEY');
  if (!privateKey) {
    throw new Error('Set PARALLAX_PAY_TO or PRIVATE_KEY for x402 pay-to address.');
  }

  const client = new ViemChainClient({
    chainId: MANTLE_SEPOLIA_CHAIN_ID,
    rpcUrl: process.env.RPC_URL ?? MANTLE_SEPOLIA_RPC_URL,
    privateKey,
  });
  const address = await client.ensureAddress();
  if (!address) {
    throw new Error('Could not derive pay-to address from PRIVATE_KEY.');
  }
  return address;
}

/**
 * Mantle Sepolia USDC (EIP-3009) — required for QuestFlow gasless x402 settlement.
 * Override via X402_TOKEN_ADDRESS if your deployment differs.
 */
const DEFAULT_MANTLE_SEPOLIA_USDC = '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9';

export async function loadX402Config(): Promise<X402ServerConfig> {
  const chainId = Number(process.env.X402_CHAIN_ID ?? MANTLE_SEPOLIA_CHAIN_ID);
  const priceMNT = Number(process.env.REPORT_PRICE_MNT ?? 2);
  const payTo = await resolvePayToAddress();

  // Display price in MNT; x402 settlement uses USDC atomic units (6 decimals).
  // Default ~0.01 USDC for hackathon demo — override with X402_PRICE_ATOMIC.
  const priceAtomic = process.env.X402_PRICE_ATOMIC ?? '10000';

  return {
    network: process.env.X402_NETWORK ?? `eip155:${chainId}`,
    chainId,
    payTo,
    tokenAddress: process.env.X402_TOKEN_ADDRESS ?? DEFAULT_MANTLE_SEPOLIA_USDC,
    priceAtomic,
    priceMNT,
    facilitatorUrl: process.env.FACILITATOR_URL ?? 'https://facilitator.questflow.ai',
    facilitatorApiKey: requireEnv('FACILITATOR_API_KEY'),
    devBypass: process.env.X402_DEV_BYPASS === 'true',
    publicBaseUrl: process.env.PARALLAX_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 8787}`,
  };
}
