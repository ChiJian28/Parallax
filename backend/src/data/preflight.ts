import type { MantleMcpClient } from '../mcp/mantle-client.js';
import type { MantleNetwork } from '../mcp/mantle-client.js';
import { FLUXION_MAINNET, SPCXX_TOKEN } from './constants.js';
import type { PreflightResult, ResolvedAddress } from './types.js';

interface RegistryResolve {
  identifier: string;
  address: string;
  label: string;
  category: string;
  status: string;
  confidence: string;
  source_url: string;
  warnings?: string[];
}

interface ValidateResult {
  address: string;
  valid_format: boolean;
  registry_match: string | null;
  warnings?: string[];
}

interface TokenInfo {
  token: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
}

async function toResolved(
  mcp: MantleMcpClient,
  network: MantleNetwork,
  identifier: string,
  resolved: RegistryResolve | { address: string; label: string; category: string; status: string; confidence: string; source_url: string },
): Promise<ResolvedAddress> {
  const validation = (await mcp.validateAddress(resolved.address, network)) as ValidateResult;
  if (!validation.valid_format) {
    throw new Error(`Invalid address format for ${identifier}: ${resolved.address}`);
  }

  return {
    identifier,
    address: validation.address,
    label: resolved.label,
    category: resolved.category,
    status: resolved.status,
    confidence: resolved.confidence,
    source_url: resolved.source_url,
    validated: true,
    warnings: [...(resolved.warnings ?? []), ...(validation.warnings ?? [])],
  };
}

/**
 * Pre-flight address resolution per mantle-address-registry-navigator skill.
 * Resolves USDC + DEX routers from registry, SPCXx via canonical address + on-chain validation.
 */
export async function runPreflight(
  mcp: MantleMcpClient,
  network: MantleNetwork = 'mainnet',
): Promise<PreflightResult> {
  const usdc = (await mcp.resolveAddress('USDC', network, 'token')) as RegistryResolve;
  const moeRouter = (await mcp.resolveAddress('MERCHANT_MOE_ROUTER', network, 'defi')) as RegistryResolve;
  const moeLbRouter = (await mcp.resolveAddress('MERCHANT_MOE_LB_ROUTER', network, 'defi')) as RegistryResolve;

  const spcxxValidation = (await mcp.validateAddress(SPCXX_TOKEN.address, network)) as ValidateResult;
  if (!spcxxValidation.valid_format) {
    throw new Error(`SPCXx canonical address failed validation: ${SPCXX_TOKEN.address}`);
  }

  const spcxxInfo = (await mcp.getTokenInfo(SPCXX_TOKEN.address, network)) as TokenInfo;
  const fluxionValidation = (await mcp.validateAddress(FLUXION_MAINNET.swap_router, network)) as ValidateResult;
  if (!fluxionValidation.valid_format) {
    throw new Error(`Fluxion router failed validation: ${FLUXION_MAINNET.swap_router}`);
  }

  return {
    network,
    resolved_at_utc: new Date().toISOString(),
    addresses: {
      usdc: await toResolved(mcp, network, 'USDC', usdc),
      spcxx: {
        identifier: SPCXX_TOKEN.identifier,
        address: spcxxValidation.address,
        label: spcxxInfo.name ?? 'xStocks: SPCXx Token',
        category: 'token',
        status: 'active',
        confidence: 'high',
        source_url: SPCXX_TOKEN.source_url,
        validated: true,
        warnings: [
          ...(spcxxValidation.warnings ?? []),
          spcxxInfo.symbol ? `on-chain symbol=${spcxxInfo.symbol}` : 'symbol read from chain',
        ],
      },
      fluxion_router: {
        identifier: 'FLUXION_SWAP_ROUTER',
        address: fluxionValidation.address,
        label: 'Fluxion Swap Router',
        category: 'defi',
        status: 'active',
        confidence: 'high',
        source_url: 'https://app.fluxion.network',
        validated: true,
        warnings: fluxionValidation.warnings ?? [],
      },
      merchant_moe_router: await toResolved(mcp, network, 'MERCHANT_MOE_ROUTER', moeRouter),
      merchant_moe_lb_router: await toResolved(mcp, network, 'MERCHANT_MOE_LB_ROUTER', moeLbRouter),
    },
  };
}
