import { FC, ReactNode, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { getAddress } from 'viem';
import { Add, OptOut } from 'blocks';
import { CHAIN_LOGO, TOKEN_LOGO } from 'common';
import { usePushChain } from '../../../../../context/PushChainContext';
import { AGENTIC_NETWORKS, MAX_TOKENS_PER_RULE } from '../agenticWallet.constants';
import { defaultToken, getNetworkTokens } from '../agenticWallet.sdk';
import { registry, useAgenticRegistry } from '../agenticWallet.storage';
import { AgenticRule, RuleApp, RuleToken } from '../agenticWallet.types';
import {
  getApp,
  findDuplicateToken,
  getAppsForNetwork,
  getNetwork,
  getRuleAppFunctionCount,
  hasRuleAppTarget,
  isRuleStepOneValid,
  isRuleStepThreeValid,
  isRuleStepTwoValid,
  formatAppFunction,
  formatCustomFunction,
  isEvmAddress,
  isSolanaNetwork,
  maskAddress,
  sanitizeAmountInput,
} from '../agenticWallet.utils';
import { AText, Card, ErrorText, Footer, PrimaryButton, ScrollBody, SecondaryButton } from '../AgenticWallet.styles';
import {
  CardLabel,
  Field,
  FunctionTagItem,
  FunctionTags,
  MultiSelectField,
  SectionHeading,
  SelectField,
  StepOverline,
  TextField,
} from './FormControls';
import { CustomContractSheet, CustomFunctionsSheet, CustomTokenSheet } from './CustomSheets';

export type RuleStep = 1 | 2 | 3;

type RuleEditorProps = {
  rule: AgenticRule;
  ruleIndex: number;
  step: RuleStep;
  onChange: (rule: AgenticRule) => void;
  onNext: () => void;
  /* Step 1 opens with a title block ("Set up Rules for the Wallet" / "Edit Rule 1") */
  title: ReactNode;
};

const ChainLogo: FC<{ chainId: string | number; size?: number }> = ({ chainId, size = 24 }) => {
  const Logo = CHAIN_LOGO[chainId];
  return Logo ? <Logo width={size} height={size} /> : null;
};

/* Same logo source as Swap's token list (TOKEN_LOGO), without the chain badge; a letter when unknown. */
const TokenIcon: FC<{ symbol: string | undefined; size?: number }> = ({ symbol, size = 24 }) => {
  if (!symbol) return null;
  const Logo = TOKEN_LOGO[symbol as keyof typeof TOKEN_LOGO];
  if (Logo) return <Logo width={size} height={size} />;
  return (
    <LetterIcon $size={size}>
      <AText variant="caption-small-medium" color="var(--pw-int-text-secondary-color)">
        {symbol.charAt(0).toUpperCase()}
      </AText>
    </LetterIcon>
  );
};

const emptyTokenRow = (networkId: string, used: RuleToken[]): RuleToken => {
  const next = getNetworkTokens(networkId).find(
    (t) => !used.some((row) => row.token?.address.toLowerCase() === t.address.toLowerCase()),
  );
  return { token: next ?? null, totalLimit: '', perTxLimit: '' };
};

const RuleEditor: FC<RuleEditorProps> = ({ rule, ruleIndex, step, onChange, onNext, title }) => {
  const { executorAddress } = usePushChain();
  // The agent is any Push address (an EOA, or the UEA of an external key) except the owner's own account.
  const agentIsOwner =
    !!executorAddress && isEvmAddress(rule.agentAddress) && rule.agentAddress.toLowerCase() === executorAddress.toLowerCase();
  const ruleNumber = ruleIndex + 1;

  if (step === 1) {
    return (
      <>
        <ScrollBody>
          {title}
          <Section gap="var(--spacing-xxs)">
            <StepOverline>{`Rule ${ruleNumber} - Step 1`}</StepOverline>
            <StepOneFields rule={rule} onChange={onChange} />
            <SecondaryButton
              size="sm"
              type="button"
              onClick={() => onChange({ ...rule, apps: [...rule.apps, { appId: null, functionIds: [] }] })}
            >
              <Add size={16} />
              Add new app
            </SecondaryButton>
          </Section>
        </ScrollBody>
        <Footer>
          <PrimaryButton type="button" disabled={!isRuleStepOneValid(rule)} onClick={onNext}>
            Continue
          </PrimaryButton>
        </Footer>
      </>
    );
  }

  if (step === 2) {
    return <StepTwo rule={rule} ruleNumber={ruleNumber} onChange={onChange} onNext={onNext} />;
  }

  return (
    <>
      <ScrollBody>
        <Section gap="var(--spacing-xxs)">
          <StepOverline>{`Rule ${ruleNumber} - Step 3`}</StepOverline>
          <Section gap="var(--spacing-md)">
            <Field label="Max gas per call">
              <TextField
                value={rule.maxGasPerCall}
                placeholder={getNetwork(rule.networkId).defaultGasPerCall}
                inputMode="decimal"
                onChange={(value) => onChange({ ...rule, maxGasPerCall: sanitizeAmountInput(value) })}
                trailingIcon={<TokenIcon symbol="PC" />}
              />
            </Field>
            <Field label="Delegated Agents Wallet" hint="Add the address of the agent that will control this wallet.">
              <TextField
                value={rule.agentAddress}
                placeholder="Agent Wallet Address"
                onChange={(value) => onChange({ ...rule, agentAddress: value.trim() })}
              />
              {agentIsOwner && <ErrorTextLeft>This is your own account. Use the agent's Push address.</ErrorTextLeft>}
            </Field>
            <Field label="Active Duration in Days" hint="Leave blank for unlimited ∞">
              <TextField
                value={rule.durationDays}
                placeholder="∞"
                inputMode="numeric"
                onChange={(value) => onChange({ ...rule, durationDays: value.replace(/[^0-9]/g, '') })}
              />
            </Field>
          </Section>
        </Section>
      </ScrollBody>
      <Footer>
        <PrimaryButton type="button" disabled={!isRuleStepThreeValid(rule) || agentIsOwner} onClick={onNext}>
          Next
        </PrimaryButton>
      </Footer>
    </>
  );
};

export { RuleEditor, TokenIcon };

const StepTwo: FC<{
  rule: AgenticRule;
  ruleNumber: number;
  onChange: (rule: AgenticRule) => void;
  onNext: () => void;
}> = ({ rule, ruleNumber, onChange, onNext }) => {
  const [tokenSheetFor, setTokenSheetFor] = useState<number | null>(null);
  useAgenticRegistry(); // re-render when a custom token is saved
  useScrollToNewCard('token', rule.tokens.length);

  const duplicateToken = findDuplicateToken(rule.tokens);
  // The contracts allow 8 tokens per rule; there is also nothing left to add once every listed token is used.
  const canAddToken =
    rule.tokens.length < MAX_TOKENS_PER_RULE && getNetworkTokens(rule.networkId).length > rule.tokens.length;

  const setRow = (index: number, next: RuleToken) =>
    onChange({ ...rule, tokens: rule.tokens.map((t, i) => (i === index ? next : t)) });

  return (
    <>
      <ScrollBody>
        <Section gap="var(--spacing-xxs)">
          <StepOverline>{`Rule ${ruleNumber} - Step 2`}</StepOverline>
          <Section gap="var(--spacing-sm)">
            <SectionHeading
              title="Allowed Tokens"
              tag="Optional"
              description="Add tokens that agents are allowed to interact with."
            />
            {rule.tokens.map((row, index) => (
              <TokenCard
                key={index}
                index={index}
                row={row}
                usedElsewhere={rule.tokens
                  .filter((other, i) => i !== index && other.token)
                  .map((other) => other.token!.address.toLowerCase())}
                networkId={rule.networkId}
                onChange={(next) => setRow(index, next)}
                // Solana offers the SDK's moveable tokens only (no address lookup there yet).
                onAddCustom={isSolanaNetwork(rule.networkId) ? undefined : () => setTokenSheetFor(index)}
                // Tokens are optional: deleting the last one leaves just "Add new token".
                onRemove={() => onChange({ ...rule, tokens: rule.tokens.filter((_, i) => i !== index) })}
              />
            ))}
          </Section>
          <SecondaryButton
            size="sm"
            type="button"
            disabled={!canAddToken}
            onClick={() => onChange({ ...rule, tokens: [...rule.tokens, emptyTokenRow(rule.networkId, rule.tokens)] })}
          >
            <Add size={16} />
            Add new token
          </SecondaryButton>
        </Section>
      </ScrollBody>
      <Footer>
        {duplicateToken && (
          <ErrorText>{`${duplicateToken} is added more than once. Each token can have one set of limits per rule.`}</ErrorText>
        )}
        <PrimaryButton type="button" disabled={!isRuleStepTwoValid(rule)} onClick={onNext}>
          Next
        </PrimaryButton>
      </Footer>

      {tokenSheetFor !== null && (
        <CustomTokenSheet
          network={getNetwork(rule.networkId)}
          onClose={() => setTokenSheetFor(null)}
          onSubmit={(token) => {
            registry.saveToken(rule.networkId, token);
            setRow(tokenSheetFor, { ...rule.tokens[tokenSheetFor], token });
            setTokenSheetFor(null);
          }}
        />
      )}
    </>
  );
};

type SheetState =
  | { kind: 'contract'; appIndex: number }
  | { kind: 'functions'; appIndex: number; editSignature?: string };

/*
 * "Add new app" / "Add new token" append a card below the fold; bring it into view. Only a
 * growing count scrolls, so deleting a card or opening a saved rule leaves the position alone.
 */
const useScrollToNewCard = (kind: 'app' | 'token', count: number) => {
  const previous = useRef(count);
  useEffect(() => {
    const grew = count > previous.current;
    previous.current = count;
    if (!grew) return;
    requestAnimationFrame(() => {
      const cards = document.querySelectorAll<HTMLElement>(`[data-rule-card="${kind}"]`);
      cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [kind, count]);
};

const CUSTOM_APP_PREFIX = 'custom:';

const StepOneFields: FC<{ rule: AgenticRule; onChange: (rule: AgenticRule) => void }> = ({ rule, onChange }) => {
  const network = getNetwork(rule.networkId);
  const solana = isSolanaNetwork(rule.networkId);
  useScrollToNewCard('app', rule.apps.length);
  const registrySnapshot = useAgenticRegistry();
  const catalogApps = getAppsForNetwork(rule.networkId);
  // A saved custom contract that the catalog now covers (e.g. from the SDK) shows once, as the catalog app.
  // Also hidden: contracts a preset named after a listed app (its token approvals, e.g. USDC as "Uniswap V3").
  const customApps = (registrySnapshot.apps[rule.networkId] ?? []).filter(
    (custom) =>
      !catalogApps.some(
        (a) => a.contracts?.[rule.networkId]?.toLowerCase() === custom.address.toLowerCase() || a.name === custom.name,
      ),
  );
  const [sheet, setSheet] = useState<SheetState | null>(null);

  const changeNetwork = (networkId: string) => {
    // Apps and tokens are per chain, so a network change starts them over. The gas
    // default follows the network unless the owner had typed their own value.
    const gasUntouched = rule.maxGasPerCall === network.defaultGasPerCall;
    onChange({
      ...rule,
      networkId,
      apps: [{ appId: null, functionIds: [] }],
      tokens: [{ token: defaultToken(networkId), totalLimit: '', perTxLimit: '' }],
      maxGasPerCall: gasUntouched ? getNetwork(networkId).defaultGasPerCall : rule.maxGasPerCall,
    });
  };

  const updateApp = (index: number, next: RuleApp) =>
    onChange({ ...rule, apps: rule.apps.map((a, i) => (i === index ? next : a)) });

  /* Registry key for an app's custom functions: catalog id, or the custom contract address. */
  const appKey = (ruleApp: RuleApp) => ruleApp.appId ?? ruleApp.customContract ?? '';

  const sheetApp = sheet ? rule.apps[sheet.appIndex] : undefined;

  return (
    <Section gap="var(--spacing-md)">
      <Field label="Network">
        <SelectField
          value={rule.networkId}
          placeholder="Select Network"
          leadingIcon={<ChainLogo chainId={network.chainId} />}
          options={AGENTIC_NETWORKS.map((n) => ({
            value: n.id,
            label: n.name,
            icon: <ChainLogo chainId={n.chainId} size={20} />,
          }))}
          onChange={(networkId) => networkId !== rule.networkId && changeNetwork(networkId)}
        />
      </Field>

      <Section gap="var(--spacing-sm)">
        <SectionHeading
          title="Allowed Apps"
          // On EVM networks a rule may hold only tokens: the agent can then send them back to the owner.
          tag={solana ? undefined : 'Optional'}
          description="Add apps and functions that agents are allowed to interact with."
        />
        {rule.apps.map((ruleApp, index) => {
          const app = getApp(ruleApp.appId);
          const key = appKey(ruleApp);
          const savedFunctions = key ? registry.getFunctions(rule.networkId, key) : [];
          const selectedCustom = ruleApp.customFunctions ?? [];

          const deselect = (signature: string) =>
            updateApp(index, { ...ruleApp, customFunctions: selectedCustom.filter((s) => s !== signature) });

          // Only functions the owner added can be edited; ones from the catalog, a preset or a granted rule cannot.
          const tags: FunctionTagItem[] = [
            ...(app?.functions ?? [])
              .filter((fn) => ruleApp.functionIds.includes(fn.id))
              .map((fn) => ({
                label: formatAppFunction(fn),
                onRemove: () =>
                  updateApp(index, { ...ruleApp, functionIds: ruleApp.functionIds.filter((id) => id !== fn.id) }),
              })),
            ...selectedCustom.map((signature) => ({
              label: formatCustomFunction(rule.networkId, ruleApp, signature),
              ...(savedFunctions.includes(signature)
                ? { onEdit: () => setSheet({ kind: 'functions', appIndex: index, editSignature: signature }) }
                : {}),
              onRemove: () => deselect(signature),
            })),
          ];

          const selectValue = ruleApp.customContract
            ? `${CUSTOM_APP_PREFIX}${ruleApp.customContract.toLowerCase()}`
            : ruleApp.appId;

          return (
            <Card key={index} gap="var(--spacing-xxs)" data-rule-card="app">
              <CardLabel
                label={`App ${index + 1}`}
                // An empty only card has nothing to delete (deleting would leave the same empty card).
                // Solana needs an app, so its only (empty) card has nothing to delete.
                menuDisabled={
                  solana && rule.apps.length === 1 && !hasRuleAppTarget(ruleApp) && getRuleAppFunctionCount(ruleApp) === 0
                }
                menuItems={[
                  {
                    key: 'delete',
                    label: 'Delete App',
                    icon: <OptOut size={24} />,
                    // Apps are optional on EVM, like tokens: deleting the last one leaves just "Add new app".
                    // On Solana the rule keeps an (empty) app card to fill in.
                    onSelect: () => {
                      const apps = rule.apps.filter((_, i) => i !== index);
                      onChange({ ...rule, apps: apps.length || !solana ? apps : [{ appId: null, functionIds: [] }] });
                    },
                  },
                ]}
              />
              <Section gap="var(--spacing-sm)">
                <Field label="Allowed App">
                  <SelectField
                    value={selectValue}
                    placeholder="Select Trusted App"
                    displayValue={
                      ruleApp.customContract
                        ? registry.getApp(rule.networkId, ruleApp.customContract)?.name ||
                          maskAddress(ruleApp.customContract)
                        : undefined
                    }
                    options={[
                      // Each app shows its contract on this network under its name, when known.
                      ...catalogApps.map((a) => {
                        const contract = a.contracts?.[rule.networkId];
                        return {
                          value: a.id,
                          label: a.name,
                          ...(contract ? { description: maskAddress(contract), copyValue: contract } : {}),
                        };
                      }),
                      // Contracts the owner added live in this browser's storage; the bin removes them there.
                      ...customApps.map((a) => ({
                        value: `${CUSTOM_APP_PREFIX}${a.address}`,
                        label: a.name,
                        description: maskAddress(a.address),
                        copyValue: getAddress(a.address),
                        deleteLabel: 'Delete custom contract',
                        onDelete: () => {
                          registry.removeApp(rule.networkId, a.address);
                          // App cards in this rule that used it start over.
                          onChange({
                            ...rule,
                            apps: rule.apps.map((ruleApp) =>
                              ruleApp.customContract?.toLowerCase() === a.address.toLowerCase()
                                ? { appId: null, functionIds: [] }
                                : ruleApp,
                            ),
                          });
                        },
                      })),
                    ]}
                    onChange={(value) =>
                      updateApp(
                        index,
                        value.startsWith(CUSTOM_APP_PREFIX)
                          ? { appId: null, functionIds: [], customContract: value.slice(CUSTOM_APP_PREFIX.length) }
                          : { appId: value, functionIds: [] },
                      )
                    }
                    // Solana takes listed programs only: each instruction needs the wallet's account position.
                    action={
                      solana
                        ? undefined
                        : { label: 'Add Custom Contract', onSelect: () => setSheet({ kind: 'contract', appIndex: index }) }
                    }
                  />
                </Field>
                <Section gap="var(--spacing-xxs)">
                  <Field label="Allowed Functions for App">
                    <MultiSelectField
                      placeholder="Select Functions"
                      disabled={!hasRuleAppTarget(ruleApp)}
                      values={[...ruleApp.functionIds, ...selectedCustom]}
                      options={[
                        ...(app?.functions ?? []).map((fn) => ({ value: fn.id, label: formatAppFunction(fn) })),
                        // Owner-added functions live in this browser's storage; the bin removes them there too.
                        ...savedFunctions.map((signature) => ({
                          value: signature,
                          label: formatCustomFunction(rule.networkId, ruleApp, signature),
                          deleteLabel: 'Delete custom function',
                          onDelete: () => {
                            registry.removeFunction(rule.networkId, key, signature);
                            deselect(signature);
                          },
                        })),
                        // Functions from a preset or a granted rule stay selectable, without a bin.
                        ...selectedCustom
                          .filter((signature) => !savedFunctions.includes(signature))
                          .map((signature) => ({
                            value: signature,
                            label: formatCustomFunction(rule.networkId, ruleApp, signature),
                          })),
                      ]}
                      onChange={(values) =>
                        updateApp(index, {
                          ...ruleApp,
                          functionIds: values.filter((v) => app?.functions.some((fn) => fn.id === v)),
                          customFunctions: values.filter((v) => savedFunctions.includes(v) || selectedCustom.includes(v)),
                        })
                      }
                      action={
                        solana
                          ? undefined
                          : { label: 'Add Custom Functions', onSelect: () => setSheet({ kind: 'functions', appIndex: index }) }
                      }
                    />
                  </Field>
                  {tags.length > 0 && (
                    <TagsBlock>
                      <FunctionTags labels={tags} />
                    </TagsBlock>
                  )}
                </Section>
              </Section>
            </Card>
          );
        })}
      </Section>

      {sheet?.kind === 'contract' && sheetApp && (
        <CustomContractSheet
          network={network}
          onClose={() => setSheet(null)}
          onSubmit={({ address, name, functions }) => {
            registry.saveApp(rule.networkId, { address, name });
            if (functions.length) registry.saveFunctions(rule.networkId, address, functions);
            updateApp(sheet.appIndex, { appId: null, functionIds: [], customContract: address, customFunctions: [] });
            setSheet(null);
          }}
        />
      )}

      {sheet?.kind === 'functions' && sheetApp && (
        <CustomFunctionsSheet
          network={network}
          contractAddress={sheetApp.customContract ?? getApp(sheetApp.appId)?.contracts?.[rule.networkId]}
          initialFunctions={sheet.editSignature ? [formatCustomFunction(rule.networkId, sheetApp, sheet.editSignature)] : ['']}
          editing={!!sheet.editSignature}
          onClose={() => setSheet(null)}
          onSubmit={(signatures) => {
            const key = appKey(sheetApp);
            const selected = sheetApp.customFunctions ?? [];
            let customFunctions: string[];
            if (sheet.editSignature) {
              const [replacement, ...extra] = signatures;
              registry.replaceFunction(rule.networkId, key, sheet.editSignature, replacement);
              registry.saveFunctions(rule.networkId, key, extra);
              customFunctions = Array.from(
                new Set([...selected.map((s) => (s === sheet.editSignature ? replacement : s)), ...extra]),
              );
            } else {
              registry.saveFunctions(rule.networkId, key, signatures);
              customFunctions = Array.from(new Set([...selected, ...signatures]));
            }
            updateApp(sheet.appIndex, { ...sheetApp, customFunctions });
            setSheet(null);
          }}
        />
      )}
    </Section>
  );
};

type TokenCardProps = {
  index: number;
  row: RuleToken;
  /* Tokens picked in the rule's other rows; a token can appear once per rule */
  usedElsewhere: string[];
  networkId: string;
  onChange: (row: RuleToken) => void;
  onAddCustom?: () => void;
  onRemove: () => void;
};

const TokenCard: FC<TokenCardProps> = ({ index, row, usedElsewhere, networkId, onChange, onAddCustom, onRemove }) => {
  const tokens = getNetworkTokens(networkId).filter((t) => !usedElsewhere.includes(t.address.toLowerCase()));
  return (
    <Card gap="var(--spacing-xxs)" data-rule-card="token">
      <CardLabel
        label={`Token ${index + 1}`}
        menuItems={[{ key: 'delete', label: 'Delete Token', icon: <OptOut size={24} />, onSelect: onRemove }]}
      />
      <Section gap="var(--spacing-sm)">
        <Field label="Token">
          <SelectField
            value={row.token?.address.toLowerCase() ?? null}
            placeholder="Select Token"
            displayValue={row.token?.symbol}
            leadingIcon={<TokenIcon symbol={row.token?.symbol} />}
            options={tokens.map((token) => ({
              value: token.address.toLowerCase(),
              label: token.symbol,
              icon: <TokenIcon symbol={token.symbol} size={20} />,
            }))}
            onChange={(address) => onChange({ ...row, token: tokens.find((t) => t.address.toLowerCase() === address) ?? null })}
            action={onAddCustom && { label: 'Add Custom Token', onSelect: onAddCustom }}
          />
        </Field>
        <LimitsRow>
          <Field label="Total spend limit">
            <TextField
              value={row.totalLimit}
              placeholder="∞"
              inputMode="decimal"
              onChange={(value) => onChange({ ...row, totalLimit: sanitizeAmountInput(value) })}
              trailingIcon={<TokenIcon symbol={row.token?.symbol} />}
            />
          </Field>
          <Field label="Per transaction limit">
            <TextField
              value={row.perTxLimit}
              placeholder="∞"
              inputMode="decimal"
              onChange={(value) => onChange({ ...row, perTxLimit: sanitizeAmountInput(value) })}
              trailingIcon={<TokenIcon symbol={row.token?.symbol} />}
            />
          </Field>
        </LimitsRow>
      </Section>
      <AText variant="caption-regular" color="var(--aw-input-placeholder)">
        Leave blank for unlimited ∞
      </AText>
    </Card>
  );
};

const Section = styled.div<{ gap?: string }>`
  display: flex;
  flex-direction: column;
  gap: ${({ gap }) => gap ?? 'var(--spacing-md)'};
  width: 100%;
  flex-shrink: 0;
`;

const TagsBlock = styled.div`
  padding-top: var(--spacing-xxxs);
`;

const LimitsRow = styled.div`
  display: flex;
  gap: var(--spacing-xs);
  width: 100%;
`;

const LetterIcon = styled.span<{ $size: number }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: var(--radius-round);
  background: var(--pw-int-bg-tertiary-color);
`;

const ErrorTextLeft = styled(ErrorText)`
  text-align: left;
`;
