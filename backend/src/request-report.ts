import 'dotenv/config';
import { SDK } from 'agent0-sdk';
import {
  MANTLE_SEPOLIA_CHAIN_ID,
  MANTLE_SEPOLIA_ERC8004_REGISTRIES,
  MANTLE_SEPOLIA_RPC_URL,
} from './config/mantle-sepolia.js';

async function main(): Promise<void> {
  const baseUrl = process.env.PARALLAX_PUBLIC_URL ?? 'http://localhost:8787';
  const eventId = process.argv[2] ?? 'spacex-ipo-q1';
  const url = `${baseUrl}/api/report/${eventId}`;

  const privateKey = process.env.CLIENT_PRIVATE_KEY ?? process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('Set CLIENT_PRIVATE_KEY or PRIVATE_KEY for x402 payment demo.');
  }

  console.log('Parallax x402 client demo (Agent0 SDK)');
  console.log(`  URL: ${url}\n`);

  const sdk = new SDK({
    chainId: MANTLE_SEPOLIA_CHAIN_ID,
    rpcUrl: process.env.RPC_URL ?? MANTLE_SEPOLIA_RPC_URL,
    privateKey,
    registryOverrides: {
      [MANTLE_SEPOLIA_CHAIN_ID]: { ...MANTLE_SEPOLIA_ERC8004_REGISTRIES },
    },
    overrideRpcUrls: {
      [MANTLE_SEPOLIA_CHAIN_ID]: process.env.RPC_URL ?? MANTLE_SEPOLIA_RPC_URL,
    },
  });

  const result = await sdk.request({ url, method: 'GET' });

  if (result.x402Required) {
    console.log('402 Payment Required — teaser received:');
    const teaser = result as { teaser?: string; eventId?: string };
    console.log(`  ${teaser.teaser ?? JSON.stringify(result).slice(0, 200)}`);
    console.log('\nPaying via x402...');

    const paid = await result.x402Payment.pay(0);
    console.log('\nPayment successful. Full report:');
    console.log(JSON.stringify(paid, null, 2));
    return;
  }

  console.log('Report (no payment required):');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error('x402 client demo failed:', error);
  process.exit(1);
});
