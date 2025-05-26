import { mainnet } from 'viem/chains';
import { type Address } from 'viem';

export const availableChains = [mainnet];

export type AvailableChainIds = (typeof availableChains)[number]['id'];

export const addresses: Record<
  AvailableChainIds,
  {
    USDC: Address;
    AUSDC: Address;
    POOL: Address;
  }
> = {
  [mainnet.id]: {
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
    AUSDC: '0xbcca60bb61934080951369a648fb03df4f96263c' as Address,
    POOL: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9' as Address,
  },
};
