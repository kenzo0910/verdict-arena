// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title VerdictRegistry
/// @notice Public, append-only registry of AI verdicts rendered by VerdictArena.
///         Each record binds a 0G Storage root hash (the immutable verdict bundle)
///         to the TEE provider that signed the inference and the chatId the TEE
///         signature is keyed to. Anyone can index duels on-chain and re-verify
///         the bundle off-chain via the SDK's processResponse().
/// @dev    Deploy on 0G Galileo testnet (chainId 16602, RPC https://evmrpc-testnet.0g.ai).
contract VerdictRegistry {
    struct Verdict {
        bytes32 rootHash; // 0G Storage content address of the verdict bundle
        address teeProvider; // TEE inference provider / signer
        string chatId; // response id the TEE signature is bound to
        uint64 timestamp;
        address submitter;
    }

    Verdict[] public verdicts;

    event VerdictRecorded(
        uint256 indexed id,
        bytes32 rootHash,
        address indexed teeProvider,
        string chatId,
        address indexed submitter
    );

    /// @notice Record a verdict. Returns its registry id.
    function record(
        bytes32 rootHash,
        address teeProvider,
        string calldata chatId
    ) external returns (uint256 id) {
        id = verdicts.length;
        verdicts.push(
            Verdict({
                rootHash: rootHash,
                teeProvider: teeProvider,
                chatId: chatId,
                timestamp: uint64(block.timestamp),
                submitter: msg.sender
            })
        );
        emit VerdictRecorded(id, rootHash, teeProvider, chatId, msg.sender);
    }

    function count() external view returns (uint256) {
        return verdicts.length;
    }
}
