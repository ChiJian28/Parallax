import 'dotenv/config';
import { SDK } from 'agent0-sdk';
import {
  MANTLE_SEPOLIA_CHAIN_ID,
  MANTLE_SEPOLIA_ERC8004_REGISTRIES,
  MANTLE_SEPOLIA_RPC_URL,
} from './config/mantle-sepolia.js';

async function main(): Promise<void> {
  const agentId = process.env.PARALLAX_AGENT_ID ?? '5003:308';
  const message =
    process.argv[2] ?? 'Fetch macro correlation report for SPCXx IPO eventId: spacex-ipo-q1';

  const privateKey = process.env.CLIENT_PRIVATE_KEY ?? process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('Set CLIENT_PRIVATE_KEY or PRIVATE_KEY for A2A x402 demo.');
  }

  console.log('Parallax A2A client demo (Agent0 SDK)');
  console.log(`  Agent: ${agentId}`);
  console.log(`  Message: ${message}\n`);

  const sdk = new SDK({
    chainId: MANTLE_SEPOLIA_CHAIN_ID,
    rpcUrl: process.env.RPC_URL ?? MANTLE_SEPOLIA_RPC_URL,
    privateKey,
    registryOverrides: {
      [MANTLE_SEPOLIA_CHAIN_ID]: { ...MANTLE_SEPOLIA_ERC8004_REGISTRIES },
    },
  });

  const agent = await sdk.loadAgent(agentId);
  const result = await agent.messageA2A(message);

  if (result.x402Required) {
    console.log('A2A returned 402 — paying via x402...');
    const paid = await result.x402Payment.pay();
    console.log('\nPaid response:');
    console.log(JSON.stringify(paid, null, 2));
    return;
  }

  console.log('A2A response:');
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error('A2A client demo failed:', error);
  process.exit(1);
});
