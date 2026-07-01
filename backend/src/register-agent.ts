import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createParallaxSdk } from './lib/create-sdk.js';
import { MANTLE_SEPOLIA_EXPLORER } from './config/mantle-sepolia.js';

const PARALLAX_NAME = 'Parallax';
const PARALLAX_DESCRIPTION =
  'ERC-8004 research agent that measures macro-to-onchain correlation across Mantle xStocks, Fluxion volume, and InsightX prediction markets. Delivers verifiable pre/post-event correlation reports with x402-gated premium access and on-chain reputation feedback.';
const PARALLAX_IMAGE =
  'https://raw.githubusercontent.com/mantle-xyz/mantle-brand-kit/main/logo/mantle-logo.png';

async function main(): Promise<void> {
  const mcpUrl = process.env.PARALLAX_MCP_URL ?? 'https://your-domain.com/mcp';
  const a2aUrl = process.env.PARALLAX_A2A_URL ?? 'https://your-domain.com/a2a';

  console.log('Initializing Agent0 SDK for Mantle Sepolia (chainId: 5003)...');
  const sdk = createParallaxSdk();

  console.log('Creating Parallax agent profile...');
  const agent = sdk.createAgent(PARALLAX_NAME, PARALLAX_DESCRIPTION, PARALLAX_IMAGE);

  // Endpoints are placeholders until Module 2 MCP/A2A servers are deployed.
  await agent.setMCP(mcpUrl, undefined, false);
  await agent.setA2A(a2aUrl, undefined, false);

  agent.setTrust(true);
  agent.setX402Support(true);
  agent.addDomain('finance_and_business/investment_services');
  agent.addSkill('data_engineering/data_analysis');
  agent.setActive(true);
  agent.setMetadata({
    project: 'parallax',
    hackathon: 'mantle-research-challenge-2026',
    track: 'research-agent',
  });

  console.log('Uploading registration file to IPFS and registering on-chain...');
  const tx = await agent.registerIPFS();
  console.log(`Transaction submitted: ${tx.hash}`);

  const { result: registration } = await tx.waitConfirmed({ timeoutMs: 180_000 });

  const output = {
    agentId: registration.agentId,
    agentURI: registration.agentURI,
    txHash: tx.hash,
    chainId: 5003,
    explorer: `${MANTLE_SEPOLIA_EXPLORER}/tx/${tx.hash}`,
    mcpUrl,
    a2aUrl,
    registeredAt: new Date().toISOString(),
  };

  const outputPath = resolve(process.cwd(), 'registration.json');
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

  console.log('\nParallax registered successfully.');
  console.log(`  agentId:  ${registration.agentId}`);
  console.log(`  agentURI: ${registration.agentURI}`);
  console.log(`  tx:       ${output.explorer}`);
  console.log(`  saved:    ${outputPath}`);
}

main().catch((error: unknown) => {
  console.error('Registration failed:', error);
  process.exit(1);
});
