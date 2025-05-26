import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type Address } from 'viem';
import { buildAaveDeposit, type DepositParams } from './aave-deposit';
import type { MeeSdk } from '../core/sdk';

// Mock the @biconomy/abstractjs module
vi.mock('@biconomy/abstractjs', () => ({
  runtimeERC20BalanceOf: vi.fn((params) => ({
    type: 'runtime-balance',
    targetAddress: params.targetAddress,
    tokenAddress: params.tokenAddress,
  })),
}));

// Mock viem
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...(actual as object),
    parseAbi: vi.fn().mockReturnValue([
      {
        name: 'deposit',
        type: 'function',
        inputs: [
          { name: 'asset', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'onBehalfOf', type: 'address' },
          { name: 'referralCode', type: 'uint16' },
        ],
      },
    ]),
  };
});

describe('buildAaveDeposit', () => {
  let mockSdk: MeeSdk;
  const RECIPIENT_ADDRESS =
    '0xRecipientAddress123456789012345678901234567890' as Address;
  const NEXUS_ADDRESS =
    '0xNexusAddress1234567890123456789012345678901234' as Address;
  const mockInstruction = {
    chainId: 1,
    calls: [
      {
        to: '0xTestAddress' as Address,
        data: '0xabcdef',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a comprehensive mock SDK
    mockSdk = {
      pc: {} as any,
      mee: {} as any,
      nexus: {
        addressOn: vi.fn().mockReturnValue(NEXUS_ADDRESS),
        buildComposable: vi.fn().mockResolvedValue([mockInstruction]),
      } as any,
      chain: {
        id: 1,
        name: 'Ethereum',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: ['https://eth.llamarpc.com'] } },
      } as any,
      addresses: {
        USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address,
        AUSDC: '0xBcca60bB61934080951369a648Fb03DF4F96263C' as Address,
        POOL: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9' as Address,
      },
    };
  });

  describe('successful execution', () => {
    it('should return array of two instructions (approve and deposit)', async () => {
      const params: DepositParams = {
        sdk: mockSdk,
        recipient: RECIPIENT_ADDRESS,
      };

      const result = await buildAaveDeposit(params);

      expect(result).toBeInstanceOf(Array);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual([mockInstruction]); // approve instruction
      expect(result[1]).toEqual([mockInstruction]); // deposit instruction
    });

    it('should call nexus.addressOn with correct chain ID', async () => {
      const params: DepositParams = {
        sdk: mockSdk,
        recipient: RECIPIENT_ADDRESS,
      };

      await buildAaveDeposit(params);

      expect(mockSdk.nexus.addressOn).toHaveBeenCalledWith(mockSdk.chain.id);
    });

    it('should build approve instruction with correct parameters', async () => {
      const { runtimeERC20BalanceOf } = await import('@biconomy/abstractjs');
      const { erc20Abi } = await import('viem');

      const params: DepositParams = {
        sdk: mockSdk,
        recipient: RECIPIENT_ADDRESS,
      };

      await buildAaveDeposit(params);

      // Check that buildComposable was called for approve
      expect(mockSdk.nexus.buildComposable).toHaveBeenCalledWith({
        type: 'default',
        data: {
          abi: erc20Abi,
          chainId: mockSdk.chain.id,
          functionName: 'approve',
          args: [
            mockSdk.addresses.POOL,
            {
              type: 'runtime-balance',
              targetAddress: NEXUS_ADDRESS,
              tokenAddress: mockSdk.addresses.USDC,
            },
          ],
          to: mockSdk.addresses.USDC,
        },
      });
    });

    it('should build deposit instruction with correct parameters', async () => {
      const { parseAbi } = await import('viem');

      const params: DepositParams = {
        sdk: mockSdk,
        recipient: RECIPIENT_ADDRESS,
      };

      await buildAaveDeposit(params);

      // Check that parseAbi was called with deposit function
      expect(parseAbi).toHaveBeenCalledWith([
        'function deposit(address asset,uint256 amount,address onBehalfOf,uint16 referralCode)',
      ]);

      // Check that buildComposable was called for deposit (second call)
      expect(mockSdk.nexus.buildComposable).toHaveBeenNthCalledWith(2, {
        type: 'default',
        data: {
          abi: expect.any(Array), // mocked parseAbi result
          chainId: mockSdk.chain.id,
          functionName: 'deposit',
          args: [
            mockSdk.addresses.USDC,
            {
              type: 'runtime-balance',
              targetAddress: NEXUS_ADDRESS,
              tokenAddress: mockSdk.addresses.USDC,
            },
            RECIPIENT_ADDRESS,
            0,
          ],
          to: mockSdk.addresses.POOL,
        },
      });
    });

    it('should use runtime balance of for both approve and deposit amounts', async () => {
      const { runtimeERC20BalanceOf } = await import('@biconomy/abstractjs');

      const params: DepositParams = {
        sdk: mockSdk,
        recipient: RECIPIENT_ADDRESS,
      };

      await buildAaveDeposit(params);

      // Check that runtimeERC20BalanceOf was called twice with same parameters
      expect(runtimeERC20BalanceOf).toHaveBeenCalledTimes(2);
      expect(runtimeERC20BalanceOf).toHaveBeenCalledWith({
        targetAddress: NEXUS_ADDRESS,
        tokenAddress: mockSdk.addresses.USDC,
      });
    });

    it('should work with different chain IDs', async () => {
      // Update SDK for different chain
      mockSdk.chain.id = 42161; // Arbitrum
      mockSdk.addresses.USDC =
        '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address;

      const params: DepositParams = {
        sdk: mockSdk,
        recipient: RECIPIENT_ADDRESS,
      };

      await buildAaveDeposit(params);

      expect(mockSdk.nexus.buildComposable).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            chainId: 42161,
            to: mockSdk.addresses.USDC,
          }),
        })
      );
    });

    it('should work with different recipient addresses', async () => {
      const differentRecipient =
        '0xDifferentRecipient1234567890123456789012345678901234' as Address;

      const params: DepositParams = {
        sdk: mockSdk,
        recipient: differentRecipient,
      };

      await buildAaveDeposit(params);

      // Check that the deposit instruction uses the correct recipient
      expect(mockSdk.nexus.buildComposable).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({
            args: expect.arrayContaining([differentRecipient]),
          }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should throw error when nexus address is not available', async () => {
      // Mock nexus.addressOn to return undefined
      mockSdk.nexus.addressOn = vi.fn().mockReturnValue(undefined);

      const params: DepositParams = {
        sdk: mockSdk,
        recipient: RECIPIENT_ADDRESS,
      };

      await expect(buildAaveDeposit(params)).rejects.toThrow(
        'Nexus address not available'
      );

      // Verify that buildComposable was never called
      expect(mockSdk.nexus.buildComposable).not.toHaveBeenCalled();
    });

    it('should throw error when nexus address is null', async () => {
      // Mock nexus.addressOn to return null
      mockSdk.nexus.addressOn = vi.fn().mockReturnValue(null);

      const params: DepositParams = {
        sdk: mockSdk,
        recipient: RECIPIENT_ADDRESS,
      };

      await expect(buildAaveDeposit(params)).rejects.toThrow(
        'Nexus address not available'
      );
    });

    it('should propagate errors from buildComposable', async () => {
      const buildError = new Error('Failed to build composable');
      mockSdk.nexus.buildComposable = vi.fn().mockRejectedValue(buildError);

      const params: DepositParams = {
        sdk: mockSdk,
        recipient: RECIPIENT_ADDRESS,
      };

      await expect(buildAaveDeposit(params)).rejects.toThrow(
        'Failed to build composable'
      );
    });

    it('should handle buildComposable failure for approve instruction', async () => {
      // Mock first call (approve) to fail, second call (deposit) to succeed
      mockSdk.nexus.buildComposable = vi
        .fn()
        .mockRejectedValueOnce(new Error('Approve failed'))
        .mockResolvedValueOnce([mockInstruction]);

      const params: DepositParams = {
        sdk: mockSdk,
        recipient: RECIPIENT_ADDRESS,
      };

      await expect(buildAaveDeposit(params)).rejects.toThrow('Approve failed');
    });

    it('should handle buildComposable failure for deposit instruction', async () => {
      // Mock first call (approve) to succeed, second call (deposit) to fail
      mockSdk.nexus.buildComposable = vi
        .fn()
        .mockResolvedValueOnce([mockInstruction])
        .mockRejectedValueOnce(new Error('Deposit failed'));

      const params: DepositParams = {
        sdk: mockSdk,
        recipient: RECIPIENT_ADDRESS,
      };

      await expect(buildAaveDeposit(params)).rejects.toThrow('Deposit failed');
    });
  });

  describe('parameter validation', () => {
    it('should handle zero address recipient', async () => {
      const zeroAddress =
        '0x0000000000000000000000000000000000000000' as Address;

      const params: DepositParams = {
        sdk: mockSdk,
        recipient: zeroAddress,
      };

      // Should not throw an error - the function doesn't validate addresses
      const result = await buildAaveDeposit(params);
      expect(result).toHaveLength(2);

      // Verify the zero address is passed through
      expect(mockSdk.nexus.buildComposable).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({
            args: expect.arrayContaining([zeroAddress]),
          }),
        })
      );
    });

    it('should work with valid ethereum addresses', async () => {
      const validAddress =
        '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as Address;

      const params: DepositParams = {
        sdk: mockSdk,
        recipient: validAddress,
      };

      const result = await buildAaveDeposit(params);
      expect(result).toHaveLength(2);
    });
  });

  describe('integration behavior', () => {
    it('should maintain correct order of instructions', async () => {
      const approveInstruction = { ...mockInstruction, data: '0xapprove' };
      const depositInstruction = { ...mockInstruction, data: '0xdeposit' };

      mockSdk.nexus.buildComposable = vi
        .fn()
        .mockResolvedValueOnce([approveInstruction])
        .mockResolvedValueOnce([depositInstruction]);

      const params: DepositParams = {
        sdk: mockSdk,
        recipient: RECIPIENT_ADDRESS,
      };

      const [approve, deposit] = await buildAaveDeposit(params);

      expect(approve).toEqual([approveInstruction]);
      expect(deposit).toEqual([depositInstruction]);
    });

    it('should call buildComposable exactly twice', async () => {
      const params: DepositParams = {
        sdk: mockSdk,
        recipient: RECIPIENT_ADDRESS,
      };

      await buildAaveDeposit(params);

      expect(mockSdk.nexus.buildComposable).toHaveBeenCalledTimes(2);
    });

    it('should use the same runtime balance parameters for both instructions', async () => {
      const { runtimeERC20BalanceOf } = await import('@biconomy/abstractjs');

      const params: DepositParams = {
        sdk: mockSdk,
        recipient: RECIPIENT_ADDRESS,
      };

      await buildAaveDeposit(params);

      const calls = vi.mocked(runtimeERC20BalanceOf).mock.calls;
      expect(calls[0]).toEqual(calls[1]); // Both calls should be identical
    });
  });
});
