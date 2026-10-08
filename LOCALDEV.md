# Acerv Local Development (Setup A — everyone runs their own stack)

Each developer runs the full stack on their own machine: local chain (Anvil),
local DB (MongoDB), backend API, and frontend. No shared infrastructure, no
faucets, no testnet. All local-only secrets stay in gitignored `.env` files.

## 0. Prerequisites

- **Node.js 20+** (`node --version`)
- **Foundry** (provides `anvil`, `forge`, `cast`):
  ```bash
  curl -L https://foundry.paradigm.xyz | bash
  foundryup
  ```
- **MongoDB 7+** — pick one:
  - Docker (easiest): `docker run -d --name acerv-mongo -p 27017:27017 mongo:7`
  - Native install: [mongodb.com/docs/manual/installation](https://www.mongodb.com/docs/manual/installation/)
- A browser wallet (MetaMask / Rainbow / Rabby)

## 1. Clone and install

```bash
git clone --recurse-submodules https://github.com/richardtise/acerv.git
cd acerv
npm install --prefix backend
npm install --prefix frontend
```

## 2. Start the local chain

```bash
anvil
```

Leave it running. Note from its output:

- **Account 0 address + private key** (deployer — has all admin roles after deploy)
- **Account 1 address** (use as treasury)

> Use the keys **your** Anvil prints. Do not copy keys from the internet or
> from someone else's terminal — they differ between Foundry versions.

## 3. Deploy the contracts locally

In a second terminal:

```bash
cd acerv/contracts
cp .env.example .env   # optional; or export inline as below
PRIVATE_KEY=<account-0-private-key> \
TREASURY_ADDRESS=<account-1-address> \
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 --broadcast
```

Save the three addresses from the output: **MockUSDG**, **AcervPoints**,
**AcervVault**. (`USDG_ADDRESS` unset ⇒ MockUSDG auto-deploys.)

## 4. Configure the backend

```bash
cd acerv/backend
cp .env.example .env
```

Set in `backend/.env` (all gitignored — never commit):

```env
MONGODB_URI=mongodb://localhost:27017/acerv
FRONTEND_URL=http://localhost:5173
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=<account-0-private-key>   # has VERIFIER_ROLE from the deploy
ACERV_ADDRESS=<your-local-AcervVault>
POINTS_ADDRESS=<your-local-AcervPoints>
USDG_ADDRESS=<your-local-MockUSDG>
ADMIN_WALLET=<account-0-address>
JWT_SECRET=<output of: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

## 5. Configure the frontend

In `frontend/.env` (gitignored — never commit):

```env
VITE_ACERV_ADDRESS=<your-local-AcervVault>
VITE_USDG_ADDRESS=<your-local-MockUSDG>
VITE_USE_ANVIL=true
# VITE_ANVIL_RPC defaults to http://127.0.0.1:8545 — only override it when
# pointing at someone else's machine (see "Shared testing" below).
```

> Vite inlines `VITE_*` at build/start time. Restart `npm run dev` after
> changing them.

## 6. Seed and start everything

```bash
# Terminal A: backend (needs MongoDB running)
cd acerv/backend
npm run seed   # one-time: creates tasks in local Mongo
npm run dev    # API on http://localhost:3001

# Terminal B: frontend
cd acerv/frontend
npm run dev    # UI on http://localhost:5173
```

Health check: `curl http://localhost:3001/health` should report
`"db":"connected","chain":"configured"`.

## 7. Connect your wallet

1. Add a network manually: name `Anvil Local`, RPC `http://127.0.0.1:8545`,
   chain ID `31337`, currency `ETH`.
2. Import Anvil account 1 (or 2–9) private key as a test account. Every Anvil
   account starts with 10,000 ETH — no faucet needed.
3. Open `http://localhost:5173`, connect, and you should see **"Anvil Local"**
   as the network (not Robinhood testnet). Register, then get test USDG:
   ```bash
   cast send <your-local-MockUSDG> "faucet()" \
     --private-key <your-test-account-key> \
     --rpc-url http://127.0.0.1:8545
   ```
   (1,000 mUSDG per call.)

## Troubleshooting

| Symptom | Fix |
|---|---|
| UI shows "Wrong network / Robinhood testnet" | `VITE_USE_ANVIL=true` missing or dev server not restarted after adding it |
| `CONFIG_ERROR` / on-chain actions disabled | `VITE_ACERV_ADDRESS` / `VITE_USDG_ADDRESS` not set to your deploy output |
| Backend exits: Mongo connect refused | MongoDB isn't running (`docker start acerv-mongo`) |
| Backend warns "Chain configuration incomplete" | `RPC_URL` / `ACERV_ADDRESS` / `PRIVATE_KEY` missing in `backend/.env` |
| `forge script` fails: insufficient funds | Wrong `PRIVATE_KEY` — use the key your Anvil printed |
| Contracts "disappear" after reboot | Anvil is in-memory: restart Anvil → redeploy (§3) → update the two `.env` files |

## Shared testing (show-and-tell against one machine)

For a demo where everyone hits the host's stack instead of their own, the host
runs everything bound to `0.0.0.0` (Anvil `--host 0.0.0.0`, Vite `npm run dev
-- --host`) over a private network (Tailscale recommended), and guests set:

```env
VITE_ANVIL_RPC=http://<host-tailscale-ip>:8545
```

in their `frontend/.env`, then restart the dev server. Note: shared state —
fine for demos, not for parallel dev work.
