import type { Address } from 'viem';
import { createPublicClient, http } from 'viem';
import {
  mcUSDC,
  createMeeClient,
  toMultichainNexusAccount,
  type MeeClient,
  type Url,
  type MultichainSmartAccount,
} from '@biconomy/abstractjs';
import { envConfig } from '../utils/env-config';
import { logger } from '../utils/logger';
import * as chains from 'viem/chains';
import { availableChains, type AvailableChainIds } from '../config/addresses';

export interface MeeSdk {
  /** low‑level viem client against the fork RPC */
  pc: ReturnType<typeof createPublicClient>;
  /** high‑level MEE client */
  mee: MeeClient;
  /** multichain nexus account (signer wrapper) */
  nexus: MultichainSmartAccount;
  /** common addresses */
  addresses: {
    USDC: Address;
    AUSDC: Address;
    POOL: Address;
  };
  /** chain meta */
  chain: chains.Chain;
}

export interface InitSdkArgs {
  chainId: AvailableChainIds;
  account: Parameters<typeof toMultichainNexusAccount>[0]['signer'];
}

export const createMeeAccount = async (
  account: InitSdkArgs['account'],
  chain: chains.Chain
): Promise<MultichainSmartAccount> => {
  logger.info('Creating multichain account');
  return toMultichainNexusAccount({
    signer: account,
    chains: [chain],
    transports: [http(envConfig.RPC_URL)],
  });
};

export const createMeeSdkClient = async (
  nexus: MultichainSmartAccount
): Promise<MeeClient> => {
  logger.info('Instantiating MeeClient');
  return createMeeClient({
    account: nexus,
    url: `${envConfig.MEE_URL}/v3` as Url,
    apiKey: 'mee_3ZKgcUzCdVGgCaDVeTfnF5gt',
  });
};

export const initSdk = async ({
  chainId,
  account,
}: InitSdkArgs): Promise<MeeSdk> => {
  const wantedChain = availableChains.find((c) => c.id === chainId);

  if (!wantedChain) {
    throw new Error(`Chain ${chainId} not found`);
  }

  const nexus = await createMeeAccount(account, wantedChain);
  const mee = await createMeeSdkClient(nexus);

  const pc = createPublicClient({
    chain: wantedChain,
    transport: http(envConfig.RPC_URL),
  });

  const sdk: MeeSdk = {
    pc,
    mee,
    nexus,
    chain: wantedChain,
    addresses: {
      USDC: mcUSDC.addressOn(chainId),
      AUSDC: '0xbcca60bb61934080951369a648fb03df4f96263c' as Address,
      POOL: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9' as Address,
    },
  } as const;

  logger.info('SDK ready');
  return sdk;
};
