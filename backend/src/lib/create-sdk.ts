import { SDK } from 'agent0-sdk';
import {
  MANTLE_SEPOLIA_CHAIN_ID,
  MANTLE_SEPOLIA_ERC8004_REGISTRIES,
  MANTLE_SEPOLIA_RPC_URL,
} from '../config/mantle-sepolia.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function createParallaxSdk(): SDK {
  return new SDK({
    chainId: MANTLE_SEPOLIA_CHAIN_ID,
    rpcUrl: process.env.RPC_URL ?? MANTLE_SEPOLIA_RPC_URL,
    privateKey: requireEnv('PRIVATE_KEY'),
    ipfs: 'pinata',
    pinataJwt: requireEnv('PINATA_JWT'),
    registryOverrides: {
      [MANTLE_SEPOLIA_CHAIN_ID]: { ...MANTLE_SEPOLIA_ERC8004_REGISTRIES },
    },
  });
}
