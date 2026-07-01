/** Mantle Sepolia (hackathon testnet). Mainnet is chainId 5000. */
export const MANTLE_SEPOLIA_CHAIN_ID = 5003;

export const MANTLE_SEPOLIA_RPC_URL = 'https://rpc.sepolia.mantle.xyz';

export const MANTLE_SEPOLIA_EXPLORER = 'https://sepolia.mantlescan.xyz';

/**
 * ERC-8004 CREATE2-deterministic addresses on Mantle Sepolia.
 * @see https://github.com/erc-8004/erc-8004-contracts
 */
export const MANTLE_SEPOLIA_ERC8004_REGISTRIES = {
  IDENTITY: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  REPUTATION: '0x8004B663056A597Dffe9eCcC1965A193B7388713',
} as const;
