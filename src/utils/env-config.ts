import { mainnet } from 'viem/chains';
import { z } from 'zod';
import { type AvailableChainIds, availableChains } from '../config/addresses';

export const EnvSchema = z.object({
  RPC_URL: z.string().url().default('http://127.0.0.1:8545'),
  MEE_URL: z.string().url().default('http://localhost:3000'),
  CHAIN_ID: z.coerce
    .number()
    .int()
    .positive()
    .default(mainnet.id)
    .refine(
      (val): val is AvailableChainIds =>
        availableChains.some((chain) => chain.id === val),
      {
        message: `Chain ID must be one of the available chains: ${availableChains
          .map((chain) => chain.id)
          .join(', ')}`,
      }
    ) as z.ZodType<AvailableChainIds>,
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
});

export const envConfig = EnvSchema.parse(process.env);
