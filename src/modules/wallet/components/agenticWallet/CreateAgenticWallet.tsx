import { FC, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Add, CaretRight } from 'blocks';
import { AText, Card, ErrorText, Footer, PrimaryButton, Screen, ScrollBody, SecondaryButton } from './AgenticWallet.styles';
import { WALLET_NAME_MAX_LENGTH } from './agenticWallet.constants';
import { AgenticPreset, createEmptyRule, getAgenticPresets } from './agenticWallet.rules';
import { describeAgenticError } from './agenticWallet.sdk';
import { AgenticRule } from './agenticWallet.types';
import { findAmbiguousRules, isEvmAddress } from './agenticWallet.utils';
import { AgenticHeader } from './components/AgenticHeader';
import { Field, ScreenTitle, StepOverline, StepTabs, TextField } from './components/FormControls';
import { RuleEditor, RuleStep, TokenIcon } from './components/RuleEditor';
import { RulesByNetwork } from './components/RuleSummary';
import { useAgenticWallets } from './AgenticWalletContext';
import { usePushChain } from '../../../../context/PushChainContext';

type CreateAgenticWalletProps = {
  pushWalletAddress: string;
  onExit: () => void;
  onClose: () => void;
  onCreated: (walletAddress: string) => void;
};

/* 'preset' is Figma "Preset - Delegated Agents Wallet": a preset only asks for the agent. */
type Phase = 'info' | 'rule' | 'preset' | 'review';

const STEPS = ['Wallet Info', 'Rules', 'Review'];

const CreateAgenticWallet: FC<CreateAgenticWalletProps> = ({ pushWalletAddress, onExit, onClose, onCreated }) => {
  const { wallets, createWallet } = useAgenticWallets();
  const { executorAddress } = usePushChain();
  const presets = useMemo(getAgenticPresets, []);

  const [phase, setPhase] = useState<Phase>('info');
  const [name, setName] = useState('');
  const [rules, setRules] = useState<AgenticRule[]>([]);
  const [draft, setDraft] = useState<AgenticRule | null>(null);
  const [draftIndex, setDraftIndex] = useState(0);
  const [ruleStep, setRuleStep] = useState<RuleStep>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [preset, setPreset] = useState<AgenticPreset | null>(null);
  const [presetAgent, setPresetAgent] = useState('');
  const [presetError, setPresetError] = useState<string | null>(null);

  const startRule = (rule: AgenticRule, index: number) => {
    setDraft(rule);
    setDraftIndex(index);
    setRuleStep(1);
    setPhase('rule');
  };

  const chooseStart = (rule: AgenticRule) => {
    // Choosing a strategy again restarts the rules from it.
    setRules([]);
    startRule(rule, 0);
  };

  const choosePreset = (choice: AgenticPreset) => {
    setRules([]);
    setPreset(choice);
    setPresetAgent('');
    setPresetError(null);
    setPhase('preset');
  };

  const presetAgentIsOwner =
    !!executorAddress && isEvmAddress(presetAgent) && presetAgent.toLowerCase() === executorAddress.toLowerCase();

  const applyPreset = () => {
    if (!preset) return;
    try {
      const built = preset.buildRules(presetAgent);
      if (!built.length) throw new Error(`${preset.title} has no rules for the supported networks yet.`);
      setRules(built);
      setSubmitError(null);
      setPhase('review');
    } catch (error) {
      setPresetError(describeAgenticError(error));
    }
  };

  const commitDraft = () => {
    if (!draft) return;
    setRules((prev) => {
      const next = [...prev];
      next[draftIndex] = draft;
      return next;
    });
    setDraft(null);
    setSubmitError(null);
    setPhase('review');
  };

  const handleBack = () => {
    if (submitting) return;
    if (phase === 'rule' && ruleStep > 1) {
      setRuleStep((ruleStep - 1) as RuleStep);
      return;
    }
    if (phase === 'rule') {
      setDraft(null);
      setPhase(rules.length ? 'review' : 'info');
      return;
    }
    if (phase === 'preset') {
      setPhase('info');
      return;
    }
    if (phase === 'review') {
      setPhase(preset ? 'preset' : 'info');
      return;
    }
    onExit();
  };

  const ambiguity = findAmbiguousRules(rules);

  const handleCreate = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const walletName = name.trim() || `My Agentic Wallet ${wallets.length + 1}`;
      const address = await createWallet(walletName, rules);
      onCreated(address);
    } catch (error) {
      setSubmitError(describeAgenticError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const activeIndex = phase === 'info' ? 0 : phase === 'review' ? 2 : 1;

  return (
    <Screen>
      <AgenticHeader
        variant="pushWallet"
        title="Push Wallet"
        address={pushWalletAddress}
        onBack={handleBack}
        onClose={onClose}
      />
      <StepTabs steps={STEPS} activeIndex={activeIndex} />

      {phase === 'info' && (
        <ScrollBody>
          <ScreenTitle title="Set up your Agentic Wallet" subtitle="Set a label for your agentic wallet" />
          <Field label="Wallet Name" counter={`${name.length} / ${WALLET_NAME_MAX_LENGTH}`}>
            <TextField
              value={name}
              placeholder="My Agent Wallet"
              maxLength={WALLET_NAME_MAX_LENGTH}
              onChange={setName}
              ariaLabel="Wallet Name"
            />
          </Field>
          <StrategySection>
            <SectionText>
              <AText variant="heading-5">Select a Strategy</AText>
              <AText variant="caption-regular" color="var(--pw-int-text-tertiary-color)">
                Create your own or choose a strategy to prefill the wallet’s automatic rules. You can review and edit
                everything.
              </AText>
            </SectionText>
            <Options>
              <StrategyOption
                emphasis
                title="Build my own strategy"
                description="Build your own ruleset, limits and allowed apps"
                onClick={() => {
                  setPreset(null);
                  chooseStart(createEmptyRule());
                }}
              />
              {presets.length > 0 && (
                <PresetDivider>
                  <AText variant="overline-small-bold" color="var(--pw-int-text-secondary-color)" align="center" uppercase>
                    Or choose a preset
                  </AText>
                </PresetDivider>
              )}
              {presets.map((option) => (
                <StrategyOption
                  key={option.key}
                  title={option.title}
                  description={option.description}
                  onClick={() => choosePreset(option)}
                />
              ))}
            </Options>
          </StrategySection>
        </ScrollBody>
      )}

      {phase === 'rule' && draft && (
        <RuleEditor
          rule={draft}
          ruleIndex={draftIndex}
          step={ruleStep}
          onChange={setDraft}
          onNext={() => (ruleStep < 3 ? setRuleStep((ruleStep + 1) as RuleStep) : commitDraft())}
          title={
            <ScreenTitle title="Set up Rules for the Wallet" subtitle="Choose where your agent can act and how much it can spend." />
          }
        />
      )}

      {phase === 'preset' && preset && (
        <>
          <ScrollBody>
            <PresetSection>
              <StepOverline>{`Preset - ${preset.title}`}</StepOverline>
              <Field label="Delegated Agents Wallet" hint="Add the push chain address of the agent that will control your agentic wallet.">
                <TextField
                  value={presetAgent}
                  placeholder="Agents Push Chain Wallet Address"
                  ariaLabel="Delegated Agents Wallet"
                  onChange={(value) => {
                    setPresetAgent(value.trim());
                    setPresetError(null);
                  }}
                  trailingIcon={<TokenIcon symbol="PC" />}
                />
              </Field>
            </PresetSection>
          </ScrollBody>
          <Footer>
            {(presetAgentIsOwner || presetError) && (
              <ErrorText>
                {presetAgentIsOwner ? "This is your own account. Use the agent's Push address." : presetError}
              </ErrorText>
            )}
            <PrimaryButton
              type="button"
              disabled={!isEvmAddress(presetAgent) || presetAgentIsOwner}
              onClick={applyPreset}
            >
              Next
            </PrimaryButton>
          </Footer>
        </>
      )}

      {phase === 'review' && (
        <>
          <ScrollBody>
            <ScreenTitle title="Review Rules for the Wallet" subtitle={'Review all rules or add more rules.\nRules can be edited later.'} />
            <ReviewList>
              <RulesByNetwork
                rules={rules}
                onEditRule={(index) => startRule(rules[index], index)}
                onDeleteRule={(index) => setRules((prev) => prev.filter((_, i) => i !== index))}
              />
              <SecondaryButton size="sm" type="button" onClick={() => startRule(createEmptyRule(), rules.length)}>
                <Add size={16} />
                Add new rule
              </SecondaryButton>
            </ReviewList>
          </ScrollBody>
          <Footer>
            {(ambiguity || submitError) && <ErrorText>{ambiguity ?? submitError}</ErrorText>}
            <PrimaryButton type="button" disabled={!rules.length || !!ambiguity || submitting} onClick={handleCreate}>
              {submitting ? 'Creating agentic wallet…' : 'Create agentic wallet'}
            </PrimaryButton>
          </Footer>
        </>
      )}
    </Screen>
  );
};

export { CreateAgenticWallet };

const StrategyOption: FC<{ title: string; description: string; emphasis?: boolean; onClick: () => void }> = ({
  title,
  description,
  emphasis,
  onClick,
}) => (
  <Card emphasis={emphasis} strokeInside clickable onClick={onClick} role="button">
    <OptionRow>
      <SectionText>
        <AText variant="body-small-medium">{title}</AText>
        <AText variant="body-xs-medium" color="var(--pw-int-text-secondary-color)">
          {description}
        </AText>
      </SectionText>
      <CaretRight size={16} color="pw-int-icon-primary-color" />
    </OptionRow>
  </Card>
);

const StrategySection = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex-shrink: 0;
`;

const SectionText = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;

const Options = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
`;

const OptionRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
`;

const PresetDivider = styled.div`
  padding: 1px 0;
`;

/* Overline, then the field 8px below, as in the design */
const PresetSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  flex-shrink: 0;
`;

const ReviewList = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  flex-shrink: 0;
`;
