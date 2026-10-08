import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'

export const robinhoodChain = {
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_ROBINHOOD_RPC || 'https://rpc.mainnet.chain.robinhood.com']
    },
    public: {
      http: [import.meta.env.VITE_ROBINHOOD_RPC || 'https://rpc.mainnet.chain.robinhood.com']
    },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: 'https://robinhoodchain.blockscout.com'
    },
  },
}

export const robinhoodTestnet = {
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: {
    name: 'Test Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_ROBINHOOD_TESTNET_RPC || 'https://rpc.testnet.chain.robinhood.com']
    },
    public: {
      http: [import.meta.env.VITE_ROBINHOOD_TESTNET_RPC || 'https://rpc.testnet.chain.robinhood.com']
    },
  },
  blockExplorers: {
    default: {
      name: 'Testnet Explorer',
      url: 'https://explorer.testnet.chain.robinhood.com'
    },
  },
  testnet: true,
}

// Local Anvil chain for dev/testing. Enabled with VITE_USE_ANVIL=true.
// VITE_ANVIL_RPC lets remote testers (e.g. friends over Tailscale) point at
// the host's Anvil instance instead of their own localhost.
export const anvilLocal = {
  id: 31337,
  name: 'Anvil Local',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_ANVIL_RPC || 'http://127.0.0.1:8545']
    },
    public: {
      http: [import.meta.env.VITE_ANVIL_RPC || 'http://127.0.0.1:8545']
    },
  },
  testnet: true,
}

// The chain the app targets. Defaults to Robinhood testnet; flips to Anvil
// for local dev. Components read this — never robinhoodTestnet directly.
export const activeChain =
  import.meta.env.VITE_USE_ANVIL === 'true' ? anvilLocal : robinhoodTestnet

export const config = createConfig({
  chains: activeChain === anvilLocal ? [anvilLocal] : [robinhoodTestnet, robinhoodChain],
  connectors: [injected()],
  transports: {
    [robinhoodChain.id]: http(),
    [robinhoodTestnet.id]: http(),
    [anvilLocal.id]: http(),
  },
})
