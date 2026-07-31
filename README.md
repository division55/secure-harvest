# SecureHarvest

A trustless parametric crop insurance protocol combining multi-source oracle verification, an AI-driven climate risk pricing model, and blockchain-based fractional capital pooling — built to make climate risk protection viable for smallholder farmers who are priced out of traditional crop insurance.

## Problem

Smallholder farmers in drought- and flood-prone regions have almost no access to crop insurance, because traditional claims verification requires a physical inspection that costs more than the payout itself for small-scale policies. SecureHarvest replaces manual claims with automatic, trigger-based payouts — verified against real climate data rather than a human adjuster's judgment.

## How it works

1. A farmer purchases a policy against a specific plot, with a defined rainfall/vegetation trigger threshold.
2. An oracle service continuously ingests data from at least two independent sources (e.g. meteorological rainfall data and satellite NDVI).
3. If both sources agree the trigger condition is met, the smart contract automatically executes payout from a pooled capital reserve — no claim form, no adjuster, no discretionary denial.
4. If sources disagree beyond a set tolerance, the system flags the policy for manual resolution instead of guessing.
5. Every trigger decision is hashed and logged on-chain, independently verifiable by anyone.

## Core features

- **Multi-source oracle verification with dispute fallback** — no single data feed can unilaterally trigger a payout.
- **Fractional, yield-bearing capital pool** — multiple investors fund policies in shares and earn yield from unclaimed premiums.
- **On-chain solvency enforcement** — the pool tracks whether it can cover all active policy exposure.
- **AI-driven, plot-specific premium pricing** — dynamic pricing based on historical climate risk, not flat regional rates.
- **Explicit basis risk quantification** — the system surfaces where its own triggers may diverge from real farmer loss, rather than hiding that limitation.
- **Independently reconstructable audit trail** — every payout decision can be re-verified against the on-chain data used to make it.

## Tech stack

| Layer | Tech |
|---|---|
| Smart contracts | Solidity, Hardhat, Polygon Amoy testnet |
| Backend | Node.js / Express (or FastAPI) |
| Frontend | React |
| AI/ML | Python, scikit-learn / XGBoost, Pandas |
| Data sources | Public rainfall data (e.g. NOAA), satellite NDVI |
| Database | PostgreSQL |
| Wallet integration | MetaMask, Ethers.js |

## Project structure

```
secureharvest/
├── contracts/       # Solidity smart contracts (policy, pool, oracle bridge)
├── backend/         # API, oracle aggregator service, AI pricing service
├── frontend/        # React app — farmer and investor portals
├── docs/             # architecture diagrams, report assets
└── README.md
```

## Getting started

### Prerequisites
- Node.js 18+
- npm or yarn
- Python 3.10+ (for the AI pricing service)
- MetaMask browser extension

### Smart contracts
```bash
cd contracts
npm install
npx hardhat compile
npx hardhat test
```

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm start
```

## Status

This project is under active development as part of a software engineering coursework build, following an Agile process model with iterative construction across the oracle, contract, pricing, and pool components.

## License

MIT
