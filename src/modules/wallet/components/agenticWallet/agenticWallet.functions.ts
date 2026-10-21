import { parseAbiItem, toFunctionSelector, toFunctionSignature, type Abi, type AbiFunction } from 'viem';

/*
 * Custom functions are stored as canonical Solidity signatures, e.g.
 * 'execute(bytes,bytes[],uint256)' — the form the AGW SDK takes as a selector — and
 * shown as 'execute (bytes, bytes[], uint256)': the name, then its parameters.
 */

/** Splits a parameter list on top-level commas, keeping tuple types intact. */
const splitTopLevel = (params: string) => {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of params) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
};

/**
 * Accepts a canonical signature, a Solidity declaration ('function swap(address to, uint256 x)'),
 * a JSON ABI fragment, or the display form ('swap address, uint256'). Returns the canonical
 * signature, or null when the input is not a function.
 */
export const parseFunctionSignature = (input: string): string | null => {
  const text = input.trim();
  if (!text) return null;

  try {
    if (text.startsWith('{')) {
      const item = JSON.parse(text) as AbiFunction;
      return item?.type === 'function' ? toFunctionSignature(item) : null;
    }

    // Shown form: 'name (type, type)' — the name, a space, then the parameter list.
    let candidate = text.replace(/;$/, '').replace(/^([A-Za-z_$][\w$]*)\s+\(/, '$1(');
    // Display form: 'name type, type' or 'name (tuple), type' — a name, then a space, then the
    // parameters. A bare name ('increment') takes no parameters.
    const display = candidate.match(/^([A-Za-z_$][\w$]*)(?:\s+(.*))?$/s);
    if (display && display[1] !== 'function' && !/^[A-Za-z_$][\w$]*\(/.test(candidate)) {
      candidate = `${display[1]}(${display[2] ?? ''})`;
    }
    if (!candidate.startsWith('function ')) candidate = `function ${candidate}`;
    const item = parseAbiItem(candidate);
    return item.type === 'function' ? toFunctionSignature(item) : null;
  } catch {
    return null;
  }
};

/**
 * 'execute(bytes,bytes[],uint256)' → 'execute (bytes, bytes[], uint256)'. A readable label
 * (e.g. the SDK's "Supply") replaces the name; the parameters always follow. A bare
 * 4-byte selector has no parameters to show and stays as it is.
 */
export const formatFunctionSignature = (signature: string, label?: string) => {
  const open = signature.indexOf('(');
  if (open < 0 || !signature.endsWith(')')) return label ?? signature;
  const name = label ?? signature.slice(0, open);
  const params = splitTopLevel(signature.slice(open + 1, -1));
  // Space out tuple members too, so a long struct parameter wraps at its commas.
  const spaced = params.map((param) => param.replace(/,\s*/g, ', '));
  return `${name} (${spaced.join(', ')})`;
};

export const functionSelector = (signature: string): `0x${string}` | null => {
  try {
    return toFunctionSelector(signature);
  } catch {
    return null;
  }
};

/** State-changing functions of an ABI as canonical signatures — what an agent can be allowed to call. */
export const writableFunctionsFromAbi = (abi: Abi): string[] => {
  const signatures = abi
    .filter(
      (item): item is AbiFunction =>
        item.type === 'function' && item.stateMutability !== 'view' && item.stateMutability !== 'pure',
    )
    .map((item) => toFunctionSignature(item));
  return Array.from(new Set(signatures));
};

/** Reads an ABI from an uploaded file: a bare ABI array or a Hardhat/Foundry artifact with an `abi` field. */
export const parseAbiFile = (text: string): Abi | null => {
  try {
    const json = JSON.parse(text);
    const abi = Array.isArray(json) ? json : json?.abi;
    return Array.isArray(abi) ? (abi as Abi) : null;
  } catch {
    return null;
  }
};
