import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  erc20Abi,
  formatUnits,
  type Address,
  parseUnits,
  parseEther,
  parseAbi,
} from 'viem';
import { fundAccountWithUSDC, fundAccountWithEth } from './fund-account';
import { initSdk, type MeeSdk } from '../core/sdk';
import { envConfig } from '../utils/env-config';
import { buildAaveDeposit } from '../instructions/aave-deposit';
import { logger } from '../utils/logger';
import gradient from 'gradient-string';

const fmt = (x: bigint, decimals = 6) =>
  Number(formatUnits(x, decimals)).toLocaleString();

async function logBalances(sdk: MeeSdk, eoaAddress: Address, tag: string = '') {
  const nexusAddress = sdk.nexus.addressOn(sdk.chain.id);

  if (!nexusAddress) {
    logger.info('Nexus address not available');
    return;
  }

  // Get balances using the public client directly
  const [eoaUsdc, nexusUsdc, eoaAusdc, nexusAusdc] = await Promise.all([
    sdk.pc.readContract({
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [eoaAddress],
      address: sdk.addresses.USDC,
    }),
    sdk.pc.readContract({
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [nexusAddress],
      address: sdk.addresses.USDC,
    }),
    sdk.pc.readContract({
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [eoaAddress],
      address: sdk.addresses.AUSDC,
    }),
    sdk.pc.readContract({
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [nexusAddress],
      address: sdk.addresses.AUSDC,
    }),
  ]);

  logger.info(
    `\n=== balances${tag ? ` (${tag})` : ''} =================================`
  );
  logger.info('EOA    :', fmt(eoaUsdc), 'USDC |', fmt(eoaAusdc), 'aUSDC');
  logger.info('NEXUS  :', fmt(nexusUsdc), 'USDC |', fmt(nexusAusdc), 'aUSDC');
  logger.info('--------------------------------------------------------\n');
}

async function main(USDC_AMOUNT: number = 1000) {
  const account = privateKeyToAccount(generatePrivateKey());

  const sdk = await initSdk({ chainId: envConfig.CHAIN_ID, account });
  const amountToFund = parseUnits(USDC_AMOUNT.toString(), 6);

  await fundAccountWithEth(account.address, parseEther('1'));
  await fundAccountWithUSDC(account.address, amountToFund);

  const triggerAmount = amountToFund;
  const nexusAddress = sdk.nexus.addressOn(sdk.chain.id);

  if (!nexusAddress) {
    throw new Error('Nexus address not available');
  }

  const instructions = await buildAaveDeposit({
    sdk,
    recipient: account.address,
  });

  await logBalances(sdk, account.address, 'before quote');

  const fusionQuote = await sdk.mee.getFusionQuote({
    trigger: {
      chainId: sdk.chain.id,
      tokenAddress: sdk.addresses.USDC,
      amount: triggerAmount,
      includeFee: true,
    },
    instructions,
    feeToken: { address: sdk.addresses.USDC, chainId: sdk.chain.id },
  });

  logger.info('≈ fee in USDC:', fusionQuote.quote.paymentInfo.tokenAmount);

  const { hash } = await sdk.mee.executeFusionQuote({ fusionQuote });
  logger.info('⛓  Fusion hash:', gradient.rainbow(hash));

  const status = await sdk.mee.waitForSupertransactionReceipt({
    hash,
    confirmations: 1,
  });
  if (status.transactionStatus !== 'MINED_SUCCESS') {
    logger.error(status);
    throw new Error('Transaction failed');
  }

  logger.info('Transaction complete 🚀, status:', status.transactionStatus);

  await logBalances(sdk, account.address, 'after execution');
}

main();
