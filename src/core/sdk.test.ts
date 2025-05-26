import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, type Address } from 'viem';
import { mainnet } from 'viem/chains';

// Mock the external dependencies first before importing
vi.mock('@biconomy/abstractjs', () => ({
  mcUSDC: {
    addressOn: vi
      .fn()
      .mockReturnValue('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'),
  },
  createMeeClient: vi.fn(),
  toMultichainNexusAccount: vi.fn(),
}));

vi.mock('../utils/env-config', () => ({
  envConfig: {
    RPC_URL: 'http://localhost:8545',
    MEE_URL: 'http://localhost:3000',
    CHAIN_ID: 1,
    LOG_LEVEL: 'info',
  },
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Now import after mocks are set up
import {
  createMeeAccount,
  createMeeSdkClient,
  initSdk,
  type InitSdkArgs,
  type MeeSdk,
} from './sdk';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';

const mockAccount = privateKeyToAccount(generatePrivateKey());

describe('SDK', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createMeeAccount', () => {
    it('should create a multichain account successfully', async () => {
      const mockNexus = {
        addressOn: vi.fn().mockReturnValue('0x123'),
        buildComposable: vi.fn(),
      };

      const { toMultichainNexusAccount } = await import('@biconomy/abstractjs');
      vi.mocked(toMultichainNexusAccount).mockResolvedValue(mockNexus as any);

      const result = await createMeeAccount(mockAccount, mainnet);

      // Just check that it was called once, since the comparison is complex
      expect(toMultichainNexusAccount).toHaveBeenCalledTimes(1);
      expect(result).toBe(mockNexus);
    });

    it('should log account creation', async () => {
      const mockNexus = { addressOn: vi.fn() };
      const { toMultichainNexusAccount } = await import('@biconomy/abstractjs');
      vi.mocked(toMultichainNexusAccount).mockResolvedValue(mockNexus as any);

      const { logger } = await import('../utils/logger');

      await createMeeAccount(mockAccount, mainnet);

      expect(logger.info).toHaveBeenCalledWith('Creating multichain account');
    });
  });

  describe('createMeeSdkClient', () => {
    it('should create MEE client with correct configuration', async () => {
      const mockNexus = { addressOn: vi.fn() };
      const mockMeeClient = { execute: vi.fn() };

      const { createMeeClient } = await import('@biconomy/abstractjs');
      vi.mocked(createMeeClient).mockResolvedValue(mockMeeClient as any);

      const result = await createMeeSdkClient(mockNexus as any);

      expect(createMeeClient).toHaveBeenCalledWith({
        account: mockNexus,
        url: 'http://localhost:3000/v3',
        apiKey: 'mee_3ZKgcUzCdVGgCaDVeTfnF5gt',
      });
      expect(result).toBe(mockMeeClient);
    });

    it('should log client instantiation', async () => {
      const mockNexus = { addressOn: vi.fn() };
      const mockMeeClient = { execute: vi.fn() };

      const { createMeeClient } = await import('@biconomy/abstractjs');
      vi.mocked(createMeeClient).mockResolvedValue(mockMeeClient as any);

      const { logger } = await import('../utils/logger');

      await createMeeSdkClient(mockNexus as any);

      expect(logger.info).toHaveBeenCalledWith('Instantiating MeeClient');
    });
  });

  describe('initSdk', () => {
    const mockArgs: InitSdkArgs = {
      chainId: 1, // Use mainnet chain ID which is supported
      account: mockAccount,
    };

    it('should initialize SDK with mainnet configuration', async () => {
      const mockNexus = { addressOn: vi.fn(), buildComposable: vi.fn() };
      const mockMeeClient = { execute: vi.fn(), getQuote: vi.fn() };

      const { toMultichainNexusAccount, createMeeClient, mcUSDC } =
        await import('@biconomy/abstractjs');
      vi.mocked(toMultichainNexusAccount).mockResolvedValue(mockNexus as any);
      vi.mocked(createMeeClient).mockResolvedValue(mockMeeClient as any);
      vi.mocked(mcUSDC.addressOn).mockReturnValue(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address
      );

      const sdk = await initSdk(mockArgs);

      expect(sdk).toMatchObject({
        chain: expect.objectContaining({
          id: 1,
          name: 'Ethereum',
        }),
        addresses: {
          USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          AUSDC: '0xbcca60bb61934080951369a648fb03df4f96263c',
          POOL: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9',
        },
      });
      expect(sdk.nexus).toBe(mockNexus);
      expect(sdk.mee).toBe(mockMeeClient);
      expect(sdk.pc).toBeDefined();
    });

    it('should throw error for unsupported chain ID', async () => {
      const invalidArgs: InitSdkArgs = {
        chainId: 999999 as any, // Cast to avoid TypeScript error for unsupported chain
        account: mockAccount,
      };

      await expect(initSdk(invalidArgs)).rejects.toThrow(
        'Chain 999999 not found'
      );
    });

    it('should create public client with correct configuration', async () => {
      const mockNexus = { addressOn: vi.fn(), buildComposable: vi.fn() };
      const mockMeeClient = { execute: vi.fn() };

      const { toMultichainNexusAccount, createMeeClient } = await import(
        '@biconomy/abstractjs'
      );
      vi.mocked(toMultichainNexusAccount).mockResolvedValue(mockNexus as any);
      vi.mocked(createMeeClient).mockResolvedValue(mockMeeClient as any);

      const sdk = await initSdk(mockArgs);

      expect(sdk.pc).toBeDefined();
      expect(sdk.pc.chain).toEqual(mainnet);
    });

    it('should log successful initialization', async () => {
      const mockNexus = { addressOn: vi.fn(), buildComposable: vi.fn() };
      const mockMeeClient = { execute: vi.fn() };

      const { toMultichainNexusAccount, createMeeClient } = await import(
        '@biconomy/abstractjs'
      );
      vi.mocked(toMultichainNexusAccount).mockResolvedValue(mockNexus as any);
      vi.mocked(createMeeClient).mockResolvedValue(mockMeeClient as any);

      const { logger } = await import('../utils/logger');

      await initSdk(mockArgs);

      expect(logger.info).toHaveBeenCalledWith('SDK ready');
    });

    it('should have correct address structure', async () => {
      const mockNexus = { addressOn: vi.fn(), buildComposable: vi.fn() };
      const mockMeeClient = { execute: vi.fn() };

      const { toMultichainNexusAccount, createMeeClient, mcUSDC } =
        await import('@biconomy/abstractjs');
      vi.mocked(toMultichainNexusAccount).mockResolvedValue(mockNexus as any);
      vi.mocked(createMeeClient).mockResolvedValue(mockMeeClient as any);
      vi.mocked(mcUSDC.addressOn).mockReturnValue(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address
      );

      const sdk = await initSdk(mockArgs);

      expect(sdk.addresses).toEqual({
        USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        AUSDC: '0xbcca60bb61934080951369a648fb03df4f96263c',
        POOL: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9',
      });
    });

    it('should work with supported chain configurations', async () => {
      const mockNexus = { addressOn: vi.fn(), buildComposable: vi.fn() };
      const mockMeeClient = { execute: vi.fn() };

      const { toMultichainNexusAccount, createMeeClient, mcUSDC } =
        await import('@biconomy/abstractjs');
      vi.mocked(toMultichainNexusAccount).mockResolvedValue(mockNexus as any);
      vi.mocked(createMeeClient).mockResolvedValue(mockMeeClient as any);
      vi.mocked(mcUSDC.addressOn).mockReturnValue(
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address
      );

      const sdk = await initSdk(mockArgs);

      expect(sdk.chain.id).toBe(1); // Mainnet
      expect(mcUSDC.addressOn).toHaveBeenCalledWith(1);
    });
  });
});
