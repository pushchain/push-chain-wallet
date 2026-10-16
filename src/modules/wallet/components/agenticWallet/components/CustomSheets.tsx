import { FC, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { getAddress } from 'viem';
import { Add, Download } from 'blocks';
import { AText, ErrorText, OutlineButton, PrimaryButton, SecondaryButton } from '../AgenticWallet.styles';
import { fetchContractInfo, fetchTokenInfo } from '../agenticWallet.explorer';
import {
  formatFunctionSignature,
  parseAbiFile,
  parseFunctionSignature,
  writableFunctionsFromAbi,
} from '../agenticWallet.functions';
import { WALLET_NAME_MAX_LENGTH } from '../agenticWallet.constants';
import { describeAgenticError } from '../agenticWallet.sdk';
import { AgenticNetwork, CustomToken } from '../agenticWallet.types';
import { isEvmAddress } from '../agenticWallet.utils';
import { BottomSheet, SheetBody } from './BottomSheet';
import { Field, TextAreaField, TextField } from './FormControls';

type Lookup<T> = { state: 'idle' } | { state: 'loading' } | { state: 'found'; value: T } | { state: 'missing' };

/* Runs `load` for a valid address (debounced), ignoring results for an address the owner has since changed. */
const useAddressLookup = <T,>(address: string, load: (address: string) => Promise<T | null>) => {
  const [lookup, setLookup] = useState<Lookup<T>>({ state: 'idle' });
  useEffect(() => {
    if (!isEvmAddress(address)) {
      setLookup({ state: 'idle' });
      return;
    }
    let cancelled = false;
    setLookup({ state: 'loading' });
    const timer = setTimeout(async () => {
      const value = await load(address);
      if (!cancelled) setLookup(value ? { state: 'found', value } : { state: 'missing' });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `load` is recreated per render; the address is what should trigger a lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);
  return lookup;
};

type CustomContractSheetProps = {
  network: AgenticNetwork;
  onClose: () => void;
  onSubmit: (contract: { address: string; name: string; functions: string[] }) => void;
};

/*
 * Figma "Rules Step 1 - Add Custom App". The app name comes from the explorer when the
 * contract is verified; otherwise the owner names it. A verified ABI also seeds the app's
 * selectable functions.
 */
export const CustomContractSheet: FC<CustomContractSheetProps> = ({ network, onClose, onSubmit }) => {
  const [address, setAddress] = useState('');
  const [typedName, setTypedName] = useState('');
  const lookup = useAddressLookup(address, async (value) => {
    const info = await fetchContractInfo(network, value);
    return info.name ? info : null;
  });

  const resolvedName = lookup.state === 'found' ? lookup.value.name ?? '' : '';
  const needsName = lookup.state === 'missing';
  const name = resolvedName || typedName.trim();
  const valid = isEvmAddress(address) && lookup.state !== 'loading' && !!name;

  let hint = 'Add the contract address of the app you want to add.';
  if (lookup.state === 'loading') hint = 'Looking up the contract…';
  if (lookup.state === 'found') hint = `Verified contract: ${resolvedName}`;
  if (needsName) hint = 'This contract is not verified on the explorer. Give it a name below.';

  return (
    <BottomSheet title="Add a custom contract" subtitle="Add the contract of the trusted app for your agent to use." onClose={onClose}>
      <SheetBody>
        <FieldsColumn $compact={!needsName}>
          <Field label="App Contract Address" hint={hint}>
            <TextField
              value={address}
              placeholder="0x..."
              ariaLabel="App Contract Address"
              onChange={(value) => setAddress(value.trim())}
            />
          </Field>
          {needsName && (
            <Field label="App Name">
              <TextField value={typedName} placeholder="e.g. My Vault" ariaLabel="App Name" onChange={setTypedName} />
            </Field>
          )}
        </FieldsColumn>
        <PrimaryButton
          type="button"
          disabled={!valid}
          onClick={() =>
            onSubmit({
              address: getAddress(address),
              name,
              functions:
                lookup.state === 'found' && lookup.value.abi ? writableFunctionsFromAbi(lookup.value.abi) : [],
            })
          }
        >
          Add custom contract
        </PrimaryButton>
      </SheetBody>
    </BottomSheet>
  );
};

type CustomFunctionsSheetProps = {
  network: AgenticNetwork;
  /* App contract, used to import functions from its verified ABI */
  contractAddress?: string;
  initialFunctions: string[];
  editing: boolean;
  onClose: () => void;
  onSubmit: (signatures: string[]) => void;
};

/*
 * Figma "Rules Step 1 - Add custom functions". Accepts 'swap(address,uint256)',
 * 'function swap(address to, uint256 x)', a JSON ABI fragment, or 'swap address, uint256'.
 */
export const CustomFunctionsSheet: FC<CustomFunctionsSheetProps> = ({
  network,
  contractAddress,
  initialFunctions,
  editing,
  onClose,
  onSubmit,
}) => {
  const [entries, setEntries] = useState<string[]>(initialFunctions.length ? initialFunctions : ['']);
  const [importState, setImportState] = useState<{ busy: boolean; message?: string; error?: boolean }>({ busy: false });
  const fileInput = useRef<HTMLInputElement>(null);

  const parsed = entries.map((entry) => (entry.trim() ? parseFunctionSignature(entry) : undefined));
  const hasInvalid = parsed.some((sig) => sig === null);
  const signatures = Array.from(new Set(parsed.filter((sig): sig is string => !!sig)));

  const addImported = (imported: string[], source: string) => {
    if (!imported.length) {
      setImportState({ busy: false, message: `No callable functions found in ${source}.`, error: true });
      return;
    }
    const existing = new Set(signatures);
    const fresh = imported.filter((sig) => !existing.has(sig)).map(formatFunctionSignature);
    setEntries((prev) => [...prev.filter((entry) => entry.trim()), ...fresh]);
    setImportState({ busy: false, message: `Imported ${fresh.length} functions from ${source}. Clear any the agent should not call.` });
  };

  const importFunctions = async () => {
    if (contractAddress && isEvmAddress(contractAddress)) {
      setImportState({ busy: true });
      const { abi } = await fetchContractInfo(network, contractAddress);
      if (abi?.length) {
        addImported(writableFunctionsFromAbi(abi), 'the verified contract');
        return;
      }
      setImportState({ busy: false, message: 'No verified ABI found for this contract. Choose an ABI file instead.' });
    }
    fileInput.current?.click();
  };

  const importFile = async (file: File) => {
    const abi = parseAbiFile(await file.text());
    if (!abi) {
      setImportState({ busy: false, message: `${file.name} is not an ABI JSON file.`, error: true });
      return;
    }
    addImported(writableFunctionsFromAbi(abi), file.name);
  };

  return (
    <BottomSheet
      title="Add custom functions"
      subtitle="Add functions the agent can use with your trusted app."
      onClose={onClose}
      minHeight={516}
    >
      <SheetBody minFormHeight={270}>
        <FormColumn>
          <Field label="Allowed App Functions">
            <Entries>
              {entries.map((entry, index) => (
                <EntryColumn key={index}>
                  <TextAreaField
                    value={entry}
                    placeholder="Paste function here"
                    ariaLabel={`Function ${index + 1}`}
                    onChange={(value) => setEntries(entries.map((e, i) => (i === index ? value : e)))}
                  />
                  {parsed[index] === null && (
                    <ErrorTextLeft>Not a function signature, e.g. execute(bytes,bytes[],uint256)</ErrorTextLeft>
                  )}
                </EntryColumn>
              ))}
            </Entries>
          </Field>
          <SecondaryButton size="sm" type="button" onClick={() => setEntries([...entries, ''])}>
            <Add size={16} />
            Add new function
          </SecondaryButton>
          <ImportLink type="button" disabled={importState.busy} onClick={importFunctions}>
            <Download size={16} />
            {importState.busy ? 'Importing…' : 'Import Functions'}
          </ImportLink>
          {importState.message &&
            (importState.error ? (
              <ErrorText>{importState.message}</ErrorText>
            ) : (
              <AText variant="caption-regular" color="var(--pw-int-text-tertiary-color)" align="center">
                {importState.message}
              </AText>
            ))}
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void importFile(file);
            }}
          />
        </FormColumn>
        <PrimaryButton type="button" disabled={!signatures.length || hasInvalid} onClick={() => onSubmit(signatures)}>
          {editing ? 'Update custom function' : 'Add custom functions'}
        </PrimaryButton>
      </SheetBody>
    </BottomSheet>
  );
};

type CustomTokenSheetProps = {
  network: AgenticNetwork;
  onClose: () => void;
  onSubmit: (token: CustomToken) => void;
};

/* Figma "Create Agentic Wallet (Add Custom Token)" */
export const CustomTokenSheet: FC<CustomTokenSheetProps> = ({ network, onClose, onSubmit }) => {
  const [address, setAddress] = useState('');
  const lookup = useAddressLookup(address, (value) => fetchTokenInfo(network, value));

  let hint = 'Add the contract address of the token you want to add.';
  if (lookup.state === 'loading') hint = 'Looking up the token…';
  if (lookup.state === 'found') hint = `${lookup.value.symbol} · ${lookup.value.decimals} decimals`;
  if (lookup.state === 'missing') hint = `Couldn't read a token at this address on ${network.name}.`;

  return (
    <BottomSheet title="Add a custom token" subtitle="Add the contract of the trusted token for your agent to use." onClose={onClose}>
      <SheetBody>
        <FieldsColumn $compact>
          <Field label="Token Contract Address" hint={hint}>
            <TextField
              value={address}
              placeholder="0x..."
              ariaLabel="Token Contract Address"
              onChange={(value) => setAddress(value.trim())}
            />
          </Field>
        </FieldsColumn>
        <PrimaryButton
          type="button"
          disabled={lookup.state !== 'found'}
          onClick={() => lookup.state === 'found' && onSubmit(lookup.value)}
        >
          Add custom token
        </PrimaryButton>
      </SheetBody>
    </BottomSheet>
  );
};

type RenameWalletSheetProps = {
  currentName: string;
  onClose: () => void;
  /* Writes the new label on chain; the sheet shows progress and any error */
  onRename: (name: string) => Promise<void>;
};

/* Figma "Agentic Wallet Dashboard (Rename Wallet)" */
export const RenameWalletSheet: FC<RenameWalletSheetProps> = ({ currentName, onClose, onRename }) => {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();
  const valid = !!trimmed && trimmed !== currentName;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onRename(trimmed);
      onClose();
    } catch (err) {
      setError(describeAgenticError(err));
      setBusy(false);
    }
  };

  return (
    <BottomSheet title="Rename Wallet" subtitle="Rename your agentic wallet" onClose={busy ? () => undefined : onClose}>
      <SheetBody>
        <FieldsColumn $compact>
          <Field label="Wallet Name" counter={`${name.length} / ${WALLET_NAME_MAX_LENGTH}`}>
            <TextField
              value={name}
              placeholder={currentName || 'My Agent Wallet'}
              maxLength={WALLET_NAME_MAX_LENGTH}
              ariaLabel="Wallet Name"
              onChange={(value) => {
                setName(value);
                setError(null);
              }}
            />
          </Field>
        </FieldsColumn>
        <SubmitColumn>
          {error && <ErrorText>{error}</ErrorText>}
          <PrimaryButton type="button" disabled={!valid || busy} onClick={submit}>
            {busy ? 'Renaming… confirm in your wallet' : 'Rename Wallet'}
          </PrimaryButton>
        </SubmitColumn>
      </SheetBody>
    </BottomSheet>
  );
};

type DeleteRuleSheetProps = {
  ruleNumber: number;
  onClose: () => void;
  /* Revokes on chain; the sheet shows progress and any error */
  onDelete: () => Promise<void>;
};

/* Figma "Delete Rule Confirmation" */
export const DeleteRuleSheet: FC<DeleteRuleSheetProps> = ({ ruleNumber, onClose, onDelete }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setError(describeAgenticError(err));
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      title={`Delete Rule ${ruleNumber}`}
      subtitle={`Are you sure you want to delete Rule ${ruleNumber}.\nThis action will delete the rule.`}
      onClose={busy ? () => undefined : onClose}
    >
      <ConfirmBody>
        {error && <ErrorText>{error}</ErrorText>}
        <ButtonRow>
          <OutlineButton type="button" disabled={busy} onClick={onClose}>
            Cancel
          </OutlineButton>
          <PrimaryButton type="button" disabled={busy} onClick={confirm}>
            {busy ? 'Deleting…' : 'Delete Rule'}
          </PrimaryButton>
        </ButtonRow>
      </ConfirmBody>
    </BottomSheet>
  );
};

/* The design leaves ~43px under the text before the buttons (24px sheet gap + 19px here). */
const ConfirmBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding-top: 19px;
`;

/* Cancel and Delete Rule split the row equally, as in the design */
const ButtonRow = styled.div`
  display: flex;
  gap: var(--spacing-xs);

  > button {
    flex: 1 1 0;
    min-width: 0;
  }
`;

const SubmitColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
`;

/* The design's single-field frame is 82px, letting the hint run into the 48px gap above the button. */
const FieldsColumn = styled.div<{ $compact: boolean }>`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  ${({ $compact }) => ($compact ? 'height: 82px;' : '')}
`;

const FormColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--spacing-xs);
`;

const Entries = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  width: 100%;
`;

const EntryColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxxs);
`;

const ErrorTextLeft = styled(ErrorText)`
  text-align: left;
`;

const ImportLink = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  gap: var(--spacing-xxxs);
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: var(--pw-int-font-family);
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  color: var(--aw-text-brand-medium);

  &:disabled {
    cursor: progress;
    opacity: 0.7;
  }
`;
