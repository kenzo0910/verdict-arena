// One-time setup: fund the 0G Compute ledger so the broker can pay for inference.
//
//   1) Get test 0G:  https://faucet.0g.ai
//   2) Put the wallet key in .env.local as ZG_PRIVATE_KEY
//   3) Run:  npm run setup:ledger 0.5
//
// Then list the available TEE inference providers so you can pin one (ZG_PROVIDER).

import { ethers } from "ethers";

const RPC = process.env.ZG_RPC_URL || "https://evmrpc-testnet.0g.ai";
const pk = process.env.ZG_PRIVATE_KEY;
const amount = Number(process.argv[2] || 0.5);

if (!pk) {
  console.error("Set ZG_PRIVATE_KEY in your environment first.");
  process.exit(1);
}

const { createZGComputeNetworkBroker } = await import("@0gfoundation/0g-compute-ts-sdk");

const provider = new ethers.JsonRpcProvider(RPC);
const wallet = new ethers.Wallet(pk, provider);
console.log("Wallet:", wallet.address);
console.log("Balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "0G");

const broker = await createZGComputeNetworkBroker(wallet);

try {
  const ledger = await broker.ledger.getLedger();
  console.log("Existing ledger:", ledger);
} catch {
  console.log("No ledger yet — creating one.");
}

console.log(`Funding ledger with ${amount} 0G …`);
try {
  await broker.ledger.addLedger(amount);
} catch (e) {
  console.log("addLedger failed, trying depositFund …", e?.message);
  await broker.ledger.depositFund(amount);
}
console.log("Ledger funded.");

console.log("\nAvailable inference providers:");
const services = await broker.inference.listService();
for (const s of services) {
  console.log(" -", {
    provider: s.provider ?? s.providerAddress,
    type: s.serviceType,
    model: s.model,
  });
}
console.log("\nPin one with ZG_PROVIDER=<provider address> for stable demos.");
