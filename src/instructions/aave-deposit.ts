import { erc20Abi, parseAbi } from 'viem';
import type { Address } from 'viem';
import type { MeeSdk } from '../core/sdk';
import { runtimeERC20BalanceOf, type Instruction } from '@biconomy/abstractjs';

export interface DepositParams {
  sdk: MeeSdk;
  recipient: Address;
}

export const buildAaveDeposit = async ({
  sdk,
  recipient,
}: DepositParams): Promise<Instruction[][]> => {
  const nexusAddress = sdk.nexus.addressOn(sdk.chain.id);

  if (!nexusAddress) {
    throw new Error('Nexus address not available');
  }

  const approveUSDC = await sdk.nexus.buildComposable({
    type: 'default',
    data: {
      abi: erc20Abi,
      chainId: sdk.chain.id,
      functionName: 'approve',
      args: [
        sdk.addresses.POOL,
        runtimeERC20BalanceOf({
          targetAddress: nexusAddress,
          tokenAddress: sdk.addresses.USDC,
        }),
      ],
      to: sdk.addresses.USDC,
    },
  });

  const aaveDeposit = await sdk.nexus.buildComposable({
    type: 'default',
    data: {
      abi: parseAbi([
        'function deposit(address asset,uint256 amount,address onBehalfOf,uint16 referralCode)',
      ]),
      chainId: sdk.chain.id,
      functionName: 'deposit',
      args: [
        sdk.addresses.USDC,
        runtimeERC20BalanceOf({
          targetAddress: nexusAddress,
          tokenAddress: sdk.addresses.USDC,
        }),
        recipient,
        0,
      ],
      to: sdk.addresses.POOL,
    },
  });

  return [approveUSDC, aaveDeposit];
};
