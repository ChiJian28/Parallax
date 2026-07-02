import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mantleSepoliaTestnet } from 'viem/chains';

export const walletConfig = getDefaultConfig({
  appName: 'Parallax',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'b4c8e2f1a9d7436e8f0c1b2a3d4e5f60',
  chains: [mantleSepoliaTestnet],
  ssr: true,
});
