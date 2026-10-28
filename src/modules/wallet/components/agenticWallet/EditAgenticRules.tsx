import { FC, useState } from 'react';
import styled from 'styled-components';
import { Add } from 'blocks';
import { ErrorText, Footer, PrimaryButton, Screen, ScrollBody, SecondaryButton } from './AgenticWallet.styles';
import { createEmptyRule } from './agenticWallet.rules';
import { describeAgenticError } from './agenticWallet.sdk';
import { AgenticRule, AgenticWallet } from './agenticWallet.types';
import { findAmbiguousRules } from './agenticWallet.utils';
import { AgenticHeader } from './components/AgenticHeader';
import { ScreenTitle, StepTabs } from './components/FormControls';
import { RuleEditor, RuleStep } from './components/RuleEditor';
import { RulesByNetwork } from './components/RuleSummary';
import { useAgenticWallets } from './AgenticWalletContext';
import { ProgressLabel } from './components/ProgressLabel';

export type EditRulesEntry = { mode: 'list' } | { mode: 'add' } | { mode: 'edit'; index: number };

type EditAgenticRulesProps = {
  wallet: AgenticWallet;
  entry: EditRulesEntry;
  onExit: () => void;
  onClose: () => void;
  onSaved: () => void;
};

/*
 * "Edit Rules" (the rule list) and "Edit Single Rule" (the three rule steps). Changes
 * stay in a draft until "Update agentic wallet rules", which revokes, updates and adds on
 * chain. An updated rule gets a new id and its spend counters restart.
 */
const EditAgenticRules: FC<EditAgenticRulesProps> = ({ wallet, entry, onExit, onClose, onSaved }) => {
  const { applyRuleChanges } = useAgenticWallets();
  const [rules, setRules] = useState<AgenticRule[]>(wallet.rules);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const initialDraft = () => {
    if (entry.mode === 'edit') return { rule: wallet.rules[entry.index], index: entry.index };
    if (entry.mode === 'add') return { rule: createEmptyRule(), index: wallet.rules.length };
    return null;
  };
  const [draft, setDraft] = useState<{ rule: AgenticRule; index: number } | null>(initialDraft);
  const [ruleStep, setRuleStep] = useState<RuleStep>(1);

  const startRule = (rule: AgenticRule, index: number) => {
    setDraft({ rule, index });
    setRuleStep(1);
  };

  const commitDraft = () => {
    if (!draft) return;
    setRules((prev) => {
      const next = [...prev];
      next[draft.index] = draft.rule;
      return next;
    });
    setDraft(null);
    setSubmitError(null);
  };

  const handleBack = () => {
    if (submitting) return;
    if (draft && ruleStep > 1) {
      setRuleStep((ruleStep - 1) as RuleStep);
      return;
    }
    // Leaving the first step of a rule opened from the wallet returns there; otherwise to the list.
    if (draft && entry.mode !== 'list' && rules === wallet.rules) {
      onExit();
      return;
    }
    if (draft) {
      setDraft(null);
      return;
    }
    onExit();
  };

  const handleSave = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await applyRuleChanges(wallet, rules);
      onSaved();
    } catch (error) {
      setSubmitError(describeAgenticError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const isExisting = !!draft && draft.index < rules.length;
  const ambiguity = findAmbiguousRules(rules);
  const unchanged = rules === wallet.rules;

  return (
    <Screen>
      <AgenticHeader
        variant="agenticWallet"
        title={wallet.name}
        address={wallet.address}
        onBack={handleBack}
        onClose={onClose}
      />

      {draft ? (
        <>
          <StepTabs steps={['Rules', 'Review']} activeIndex={0} />
          <RuleEditor
            rule={draft.rule}
            ruleIndex={draft.index}
            step={ruleStep}
            onChange={(rule) => setDraft({ ...draft, rule })}
            onNext={() => (ruleStep < 3 ? setRuleStep((ruleStep + 1) as RuleStep) : commitDraft())}
            title={
              isExisting ? (
                <ScreenTitle title={`Edit Rule ${draft.index + 1}`} subtitle="Edit and update this rule for the agentic wallet." />
              ) : (
                <ScreenTitle title="Set up Rules for the Wallet" subtitle="Choose where your agent can act and how much it can spend." />
              )
            }
          />
        </>
      ) : (
        <>
          <ScrollBody>
            <ScreenTitle title="Edit Rules for the Wallet" subtitle="Edit agentic rules or add more rules." />
            <RulesList>
              <RulesByNetwork
                rules={rules}
                onEditRule={(index) => startRule(rules[index], index)}
                onDeleteRule={(index) => setRules((prev) => prev.filter((_, i) => i !== index))}
              />
              <SecondaryButton size="sm" type="button" onClick={() => startRule(createEmptyRule(), rules.length)}>
                <Add size={16} />
                Add new rule
              </SecondaryButton>
            </RulesList>
          </ScrollBody>
          <Footer>
            {(ambiguity || submitError) && <ErrorText>{ambiguity ?? submitError}</ErrorText>}
            <PrimaryButton type="button" disabled={unchanged || !!ambiguity || submitting} onClick={handleSave}>
              {submitting ? <ProgressLabel fallback="Updating rules…" /> : 'Update agentic wallet rules'}
            </PrimaryButton>
          </Footer>
        </>
      )}
    </Screen>
  );
};

export { EditAgenticRules };

const RulesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  flex-shrink: 0;
`;
