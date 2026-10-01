import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waapSignTypedData } from './waapProvider';
import type { ITypedData } from '../types/wallet.types';

/**
 * The EIP-712 `types` map an adapter sends must contain an entry for
 * `primaryType`. `signMigrationPayload` in @pushchain/core signs a UEA upgrade
 * with `primaryType: 'MigrationPayload'` and no `UniversalPayload` entry at all,
 * so a types rewrite that hardcodes `UniversalPayload` sends a payload whose
 * primaryType has no schema and the wallet's WaaP host rejects it.
 */

interface Eip712TypeField {
	name: string;
	type: string;
}

type SentPayload = ITypedData & { types: Record<string, Eip712TypeField[]> };

const ACCOUNTS = ['0x1111111111111111111111111111111111111111'];
const SIGNATURE = `0x${'ab'.repeat(65)}1c${'cd'.repeat(32)}`;

interface RequestArgs {
	method: string;
	params?: unknown[];
}

function mockWaap() {
	const sent: SentPayload[] = [];
	const request = vi.fn(async ({ method, params }: RequestArgs) => {
		if (method === 'eth_accounts') return ACCOUNTS;
		if (method === 'eth_signTypedData_v4') {
			sent.push(JSON.parse(String(params?.[1])));
			return SIGNATURE;
		}
		throw new Error(`unexpected method ${method}`);
	});
	(window as unknown as { waap: { request: typeof request } }).waap = { request };
	return sent;
}

const domain = {
	version: '0.2.0',
	chainId: 42101,
	verifyingContract: '0x2222222222222222222222222222222222222222',
};

// Exactly what `signMigrationPayload` (core/src/lib/orchestrator/internals/signing.ts)
// builds for an EVM UEA upgrade.
const migrationPayload = () =>
	({
		domain,
		types: {
			MigrationPayload: [
				{ name: 'migration', type: 'address' },
				{ name: 'nonce', type: 'uint256' },
				{ name: 'deadline', type: 'uint256' },
			],
		},
		primaryType: 'MigrationPayload',
		message: {
			migration: '0x3333333333333333333333333333333333333333',
			nonce: '7',
			deadline: '9999999999',
		},
	}) as ITypedData;

// The everyday case: a universal transaction signed through the SDK.
const universalPayload = () =>
	({
		domain,
		types: {
			UniversalPayload: [
				{ name: 'fromChain', type: 'string' },
				{ name: 'nonce', type: 'uint256' },
			],
		},
		primaryType: 'UniversalPayload',
		message: { fromChain: 'eip155:11155111', nonce: '3' },
	}) as ITypedData;

const PINNED_DOMAIN = [
	{ name: 'version', type: 'string' },
	{ name: 'chainId', type: 'uint256' },
	{ name: 'verifyingContract', type: 'address' },
];

describe('waapSignTypedData', () => {
	let sent: SentPayload[];

	beforeEach(() => {
		sent = mockWaap();
	});

	afterEach(() => {
		delete (window as unknown as { waap?: unknown }).waap;
		vi.restoreAllMocks();
	});

	it('keeps the schema for a MigrationPayload request', async () => {
		await waapSignTypedData(migrationPayload());

		expect(sent).toHaveLength(1);
		const payload = sent[0];
		// primaryType must resolve, or eth_signTypedData_v4 rejects the request.
		expect(payload.primaryType).toBe('MigrationPayload');
		expect(payload.types.MigrationPayload).toEqual([
			{ name: 'migration', type: 'address' },
			{ name: 'nonce', type: 'uint256' },
			{ name: 'deadline', type: 'uint256' },
		]);
		expect(payload.types).not.toHaveProperty('UniversalPayload');
	});

	it('still pins the domain the SDK asked for', async () => {
		await waapSignTypedData(migrationPayload());

		expect(sent[0].types.EIP712Domain).toEqual(PINNED_DOMAIN);
	});

	it('keeps resolving UniversalPayload for a universal transaction', async () => {
		await waapSignTypedData(universalPayload());

		expect(sent[0].primaryType).toBe('UniversalPayload');
		expect(sent[0].types.UniversalPayload).toEqual([
			{ name: 'fromChain', type: 'string' },
			{ name: 'nonce', type: 'uint256' },
		]);
		expect(sent[0].types).not.toHaveProperty('MigrationPayload');
	});
});