/**
 * `eth_signTypedData_v4` takes a JSON string, but EIP-712 payloads are
 * normally built with viem, which types `uint256`/`int*` fields as `bigint`.
 * `JSON.stringify` throws `TypeError: Do not know how to serialize a BigInt`
 * on those, so the signature request never leaves the wallet.
 *
 * EIP-712 encodes integers as decimal strings anyway, so rendering the bigint
 * as a string is the same value the wallet would have received.
 */
export const serializeTypedData = (typedData: unknown): string =>
  JSON.stringify(typedData, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );