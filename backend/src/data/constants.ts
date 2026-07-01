/**
 * Canonical addresses for tokens not yet in mantle-core quick-ref (e.g. SPCXx).
 * Always validated on-chain via mantle_validateAddress before use.
 * @see https://mantlescan.xyz/address/0x68fa48b1c2fe52b3d776e1953e0e782b5044ce28
 */
export const SPCXX_TOKEN = {
  identifier: 'SPCXx',
  address: '0x68fa48B1C2FE52b3D776E1953e0E782b5044Ce28',
  source_url: 'https://mantlescan.xyz/address/0x68fa48b1c2fe52b3d776e1953e0e782b5044ce28',
} as const;

/** Fluxion V3 contracts on Mantle mainnet (from @mantleio/mantle-core protocols config). */
export const FLUXION_MAINNET = {
  swap_router: '0x5628a59df0ecac3f3171f877a94beb26ba6dfaa0',
  factory: '0xF883162Ed9c7E8EF604214c964c678E40c9B737C',
} as const;

/** LayerZero USDT0 on Mantle mainnet (SPCXx LB pair quote token). */
export const USDT0_TOKEN = {
  identifier: 'USDT0',
  address: '0x779Ded0c9e1022225f8E0630b35a9b54bE713736',
} as const;

/** Known SPCXx/USDT0 Merchant Moe LB pair (bin_step=100). */
export const SPCXX_MOE_POOL = {
  address: '0xd14B0DcD319551AE4D7B12787c00EE1C1f9E1d2E',
  bin_step: 100,
} as const;

export const STABLECOIN_ASSETS = ['USDC', 'USDT0', 'USDe'] as const;
