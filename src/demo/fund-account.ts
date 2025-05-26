import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  parseEther,
  formatUnits,
  type Address,
  formatEther,
} from 'viem';
import { mainnet } from 'viem/chains';
import { envConfig } from '../utils/env-config';
import { logger } from '../utils/logger';

const USDC_WHALE = '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503' as const;
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const;
const ETH_OWNER_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' as const;

const erc20Abi = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export const fundAccountWithUSDC = async (
  recipient: `0x${string}`,
  amount: bigint
) => {
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(envConfig.RPC_URL),
  });

  const walletClient = createWalletClient({
    chain: mainnet,
    transport: http(envConfig.RPC_URL),
  });

  logger.info(`Funding ${recipient} with ${formatUnits(amount, 6)} USDC`);

  // Impersonate whale for USDC transfer
  await (publicClient.request as any)({
    method: 'anvil_impersonateAccount',
    params: [USDC_WHALE],
  });

  // Send USDC
  await walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipient, amount],
    account: USDC_WHALE,
  });

  await (publicClient.request as any)({
    method: 'anvil_stopImpersonatingAccount',
    params: [USDC_WHALE],
  });

  // Check USDC balance
  const usdcBalance = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [recipient],
  });

  logger.info(`USDC Balance: ${formatUnits(usdcBalance, 6)} USDC`);
};

export const fundAccountWithEth = async (
  recipient: `0x${string}`,
  amount: bigint = parseEther('5')
) => {
  const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(envConfig.RPC_URL),
  });

  const walletClient = createWalletClient({
    chain: mainnet,
    transport: http(envConfig.RPC_URL),
  });

  logger.info(`Funding ${recipient} with ${formatEther(amount)} ETH`);

  // Impersonate ETH owner for ETH transfer
  await (publicClient.request as any)({
    method: 'anvil_impersonateAccount',
    params: [ETH_OWNER_ADDRESS],
  });

  // Send ETH
  await walletClient.sendTransaction({
    to: recipient,
    value: amount,
    account: ETH_OWNER_ADDRESS,
  });

  await (publicClient.request as any)({
    method: 'anvil_stopImpersonatingAccount',
    params: [ETH_OWNER_ADDRESS],
  });

  // Check ETH balance
  const ethBalance = await publicClient.getBalance({ address: recipient });

  logger.info(`ETH Balance: ${formatEther(ethBalance)} ETH`);
};
