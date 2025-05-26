# MEE Super‑Transaction Demo

A demonstration of Biconomy's MEE (Modular Execution Environment) super-transaction capabilities using Aave deposits as an example. This project showcases automated fund management and smart account operations in a local development environment.

## 🎯 What This Demonstrates

This repository demonstrates a **super-transaction** that:
- Automatically deposits USDC into Aave to earn yield (aUSDC)
- Uses Biconomy's MEE infrastructure for execution
- Operates on a local mainnet fork for safe testing
- Handles gas abstraction and complex multi-step operations seamlessly

## 📋 Prerequisites

Before running this demo, ensure you have the following installed:

### Required Software
- **[Bun](https://bun.sh/)** ≥ 1.1 - JavaScript runtime and package manager
- **[Docker](https://docs.docker.com/get-docker/)** - For running MEE node and Redis
- **[Foundry](https://getfoundry.sh/)** - For Anvil (local Ethereum node)
- **Git** - For cloning repositories

### Quick Installation Commands

```bash
# Install Bun (macOS/Linux)
curl -fsSL https://bun.sh/install | bash

# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install Docker
# Visit: https://docs.docker.com/get-docker/
```

### Required Accounts
- **Mainnet RPC URL** (Alchemy, Infura, QuickNode, etc.)
- **Private Key** for testing (will be funded automatically on local fork)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repository-url>
cd biconomy-mee-demo
bun install
```

### 2. Environment Configuration

Create a `.env` file with your configuration:

```bash
# Copy the template and edit with your values
cp .env.example .env
```

Edit the `.env` file with the following required variables:

```bash
# Required: Private key for the account (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# Required: Mainnet RPC URL for forking
ETH_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your-api-key

# Optional configurations (with defaults)
CHAIN_ID=1
LOG_LEVEL=info
RPC_URL=http://127.0.0.1:8545
MEE_URL=http://localhost:3000
```

### 3. Setup Infrastructure

**In Terminal 1**, run the setup script to initialize the development environment:

```bash
bun run setup
```

This command will:
- Clone and configure the MEE node
- Start Docker containers (MEE node + Redis)
- Launch Anvil with mainnet fork
- Fund your account with ETH
- Wait for all services to be healthy

**Keep this terminal running** as it maintains the local infrastructure.

### 4. Run the Demo

**In a new Terminal 2**, execute the super-transaction demo:

```bash
bun run demo
```

This will:
- Generate a fresh test account
- Fund it with USDC and ETH
- Create a super-transaction to deposit USDC into Aave
- Execute the transaction through MEE
- Display before/after balances

## 📁 Project Structure

```
├── src/
│   ├── config/         # Configuration files and addresses
│   ├── core/           # SDK initialization and types
│   ├── demo/           # Demo scripts and utilities
│   ├── instructions/   # Transaction instruction builders
│   └── utils/          # Environment config and logging
├── setup-mee.ts       # Infrastructure setup script
├── approach.md         # Technical implementation details
├── package.json        # Dependencies and scripts
└── README.md          # This file
```

## 🔧 Available Scripts

```bash
# Setup development environment
bun run setup

# Run the super-transaction demo
bun run demo

# Run tests
bun test

# Run tests with coverage
bun test:coverage

# Type check TypeScript without emitting files
bun run check-types
```

## 🔍 What Happens During Execution

### Setup Phase
The setup script handles all the complex infrastructure:
- Clones and configures Biconomy's MEE node
- Starts Docker containers for MEE and Redis
- Launches a local Anvil fork of mainnet
- Funds your specified account with ETH
- Waits for all services to be healthy and ready

### Demo Execution
The demo script demonstrates the super-transaction:
1. **Account Generation**: Creates a fresh test account for clean state
2. **Funding**: Provides the account with USDC and ETH via fork impersonation
3. **Smart Account Setup**: Initializes a Nexus smart account via AbstractJS
4. **Instruction Building**: Creates Aave deposit instructions (approve + deposit)
5. **MEE Execution**: Gets fusion quote and executes the super-transaction
6. **Verification**: Checks transaction status and displays balance changes

## 🔍 Verification

After running the demo, you should see:

1. **Setup Completion**: All services running and healthy
2. **Account Funding**: ETH and USDC balances credited
3. **Super-transaction Execution**: MEE processing and confirmation
4. **Balance Changes**: USDC converted to aUSDC (Aave deposit)
5. **Transaction Hash**: Successful execution hash displayed

## 🛠️ Technology Stack

- **Runtime**: Bun for fast JavaScript execution
- **Language**: TypeScript with strict typing
- **Blockchain**: Viem for type-safe Ethereum interactions
- **Testing**: Vitest for unit tests
- **Logging**: Pino for structured logging
- **Validation**: Zod for runtime-safe parsing
- **Infrastructure**: Docker for service management

## 🐛 Troubleshooting

### Common Issues

1. **Docker not running**: Ensure Docker Desktop is started
2. **Port conflicts**: Check if ports 3000, 6379, or 8545 are in use
3. **RPC issues**: Verify your mainnet RPC URL is valid and has sufficient quota
4. **Private key format**: Ensure private key is without `0x` prefix

### Cleanup

To reset the environment:

```bash
# Stop all services
docker compose down --remove-orphans
pkill -f anvil

# Remove MEE node directory (will be re-cloned)
rm -rf mee-node
```

## 📚 Documentation

- **[approach.md](./approach.md)** - Technical implementation details, challenges faced, and development methodology
- [Biconomy Documentation](https://docs.biconomy.io/)
- [MEE Node Repository](https://github.com/bcnmy/mee-node-deployment)
- [Aave V3 Documentation](https://docs.aave.com/developers/)
- [Viem Documentation](https://viem.sh/)


**Note**: This is a development demonstration. Do not use private keys with real funds in production environments.
