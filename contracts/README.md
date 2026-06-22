# On-chain registry (optional — Round of 32 upgrade)

`VerdictRegistry.sol` makes every verdict a public, queryable on-chain record on
0G Chain, binding the 0G Storage root hash to the TEE provider that signed it.

The MVP (group-stage / 23 June) does **not** require this — 0G Compute (the
verifiable judge) is already the load-bearing primitive. Ship the registry as the
Round-of-32 headline upgrade to deepen the on-chain story.

## Deploy (Foundry)

```bash
forge create contracts/VerdictRegistry.sol:VerdictRegistry \
  --rpc-url https://evmrpc-testnet.0g.ai \
  --private-key $ZG_PRIVATE_KEY \
  --legacy
```

## Deploy (Hardhat)

Add the network to `hardhat.config.ts`:

```ts
networks: {
  galileo: {
    url: "https://evmrpc-testnet.0g.ai",
    chainId: 16602,
    accounts: [process.env.ZG_PRIVATE_KEY!],
  },
}
```

Then `npx hardhat run scripts/deploy.ts --network galileo`.

After deploy, have `app/api/verdict/route.ts` call `record(rootHash, teeProvider, chatId)`
right after `storeJSON`, and surface the contract address + 0G Explorer link in the UI.

> Get test 0G from https://faucet.0g.ai · Explorer: https://chainscan-galileo.0g.ai
> Verify the chainId (16602) in your wallet before deploying — some community
> sources list a stale value.
