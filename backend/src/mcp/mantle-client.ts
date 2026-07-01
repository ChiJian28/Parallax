import { allTools } from '@mantleio/mantle-core/tools/index.js';

export type MantleNetwork = 'mainnet' | 'sepolia';

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

/**
 * In-process Mantle MCP client.
 * Calls the same handlers exposed by @mantleio/mantle-mcp over stdio.
 */
export class MantleMcpClient {
  async call<T>(toolName: string, args: Record<string, unknown> = {}): Promise<T> {
    const tool = allTools[toolName] as { handler: ToolHandler } | undefined;
    if (!tool) {
      throw new Error(`Unknown Mantle MCP tool: ${toolName}`);
    }
    return tool.handler(args) as Promise<T>;
  }

  resolveAddress(identifier: string, network: MantleNetwork, category = 'any') {
    return this.call('mantle_resolveAddress', { identifier, network, category });
  }

  validateAddress(address: string, network: MantleNetwork, checkCode = true) {
    return this.call('mantle_validateAddress', { address, network, check_code: checkCode });
  }

  resolveToken(symbol: string, network: MantleNetwork) {
    return this.call('mantle_resolveToken', { symbol, network });
  }

  getTokenInfo(token: string, network: MantleNetwork) {
    return this.call('mantle_getTokenInfo', { token, network });
  }

  getPoolOpportunities(
    tokenA: string,
    tokenB: string,
    network: MantleNetwork,
    provider: 'fluxion' | 'merchant_moe' | 'agni' | 'all' = 'fluxion',
  ) {
    return this.call('mantle_getPoolOpportunities', {
      token_a: tokenA,
      token_b: tokenB,
      provider,
      network,
      max_results: 5,
    });
  }

  getPoolLiquidity(poolAddress: string, provider: 'fluxion' | 'merchant_moe' | 'agni', network: MantleNetwork) {
    return this.call('mantle_getPoolLiquidity', {
      pool_address: poolAddress,
      provider,
      network,
    });
  }

  queryIndexerSql(endpoint: string, query: string, params: Record<string, unknown>) {
    return this.call('mantle_queryIndexerSql', { endpoint, query, params });
  }

  querySubgraph(endpoint: string, query: string, variables: Record<string, unknown>) {
    return this.call('mantle_querySubgraph', { endpoint, query, variables });
  }

  getLendingMarkets(network: MantleNetwork, assets?: string[]) {
    return this.call('mantle_getLendingMarkets', {
      protocol: 'aave_v3',
      network,
      ...(assets ? { assets } : {}),
    });
  }

  findPools(tokenA: string, tokenB: string, network: MantleNetwork, maxResults = 5) {
    return this.call('mantle_findPools', {
      token_a: tokenA,
      token_b: tokenB,
      network,
      max_results: maxResults,
    });
  }

  getSwapQuote(params: {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    provider: 'merchant_moe' | 'fluxion' | 'agni' | 'best';
    network: MantleNetwork;
  }) {
    return this.call('mantle_getSwapQuote', {
      token_in: params.tokenIn,
      token_out: params.tokenOut,
      amount_in: params.amountIn,
      provider: params.provider,
      network: params.network,
    });
  }

  getLBPairState(tokenA: string, tokenB: string, binStep: number, network: MantleNetwork) {
    return this.call('mantle_getLBPairState', {
      token_a: tokenA,
      token_b: tokenB,
      bin_step: binStep,
      network,
    });
  }
}

export const mantleMcp = new MantleMcpClient();
