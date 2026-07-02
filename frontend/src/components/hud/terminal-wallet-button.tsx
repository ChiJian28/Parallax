'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export const TerminalWalletButton = () => {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== 'loading';
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === 'authenticated');

        return (
          <div
            className="flex items-center gap-3"
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className="rounded-sm border border-[#E5E7EB] bg-[#fbf1e1] px-4 py-1.5 font-sans text-sm font-medium text-[#111827] shadow-sm transition-colors hover:bg-white"
                  >
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    type="button"
                    onClick={openChainModal}
                    className="rounded-sm border border-red-200 bg-red-50 px-3 py-1.5 font-mono text-sm text-[#D95B43]"
                  >
                    Wrong network
                  </button>
                );
              }

              return (
                <>
                  <button
                    type="button"
                    onClick={openChainModal}
                    className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-[#E5E7EB] bg-[#fbf1e1] px-2 py-1.5 font-mono text-xs text-gray-600 hover:bg-white"
                  >
                    {chain.hasIcon && (
                      <div
                        className="size-3 shrink-0 overflow-hidden rounded-full"
                        style={{ background: chain.iconBackground }}
                      >
                        {chain.iconUrl && (
                          <img
                            alt={chain.name ?? 'Chain icon'}
                            src={chain.iconUrl}
                            className="size-3"
                          />
                        )}
                      </div>
                    )}
                    {chain.name}
                  </button>
                  <button
                    type="button"
                    onClick={openAccountModal}
                    className="cursor-pointer rounded-sm border border-[#E5E7EB] bg-[#fbf1e1] px-3 py-1.5 font-mono text-xs text-gray-800 transition-colors hover:border-[#D95B43] hover:bg-white hover:text-[#D95B43]"
                  >
                    {account.displayName}
                  </button>
                </>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};
