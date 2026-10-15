import { AGENTIC_APPS, AGENTIC_NETWORKS, MAX_TOKENS_PER_RULE, NO_EXPIRY } from './agenticWallet.constants';
import { formatFunctionSignature, functionSelector } from './agenticWallet.functions';
import { registry } from './agenticWallet.storage';
import { AgenticRule, AgenticSortOption, AgenticWallet, RuleApp, RuleToken } from './agenticWallet.types';

export const maskAddress = (address: string) =>
  address && address.length > 10 ? `${address.slice(0, 5)}...${address.slice(-5)}` : address;

export const isEvmAddress = (value: string) => /^0x[0-9a-fA-F]{40}$/.test(value.trim());

export const getNetwork = (networkId: string) =>
  AGENTIC_NETWORKS.find((network) => network.id === networkId) ?? AGENTIC_NETWORKS[0];

export const getApp = (appId: string | null) => AGENTIC_APPS.find((app) => app.id === appId);

export const getAppsForNetwork = (networkId: string) =>
  AGENTIC_APPS.filter((app) => app.networks.includes(networkId));

/* Catalog name, the name saved with a custom contract, or its masked address. */
export const getRuleAppName = (ruleApp: RuleApp, networkId: string) =>
  getApp(ruleApp.appId)?.name ??
  (ruleApp.customContract
    ? registry.getApp(networkId, ruleApp.customContract)?.name || maskAddress(ruleApp.customContract)
    : undefined);

export const hasRuleAppTarget = (ruleApp: RuleApp) => !!ruleApp.appId || !!ruleApp.customContract;

export const getRuleAppFunctionCount = (ruleApp: RuleApp) =>
  ruleApp.functionIds.length + (ruleApp.customFunctions?.length ?? 0);

const formatAmount = (value: string) => {
  const cleaned = value.replace(/,/g, '').trim();
  const parsed = Number(cleaned);
  if (!cleaned || Number.isNaN(parsed)) return null;
  return parsed.toLocaleString('en-US', { maximumFractionDigits: 6 });
};

export const UNLIMITED = '∞';

/* "1,000 USDC · 1 ETH", as in the design; a blank limit is unlimited, shown as "∞ USDC". */
export const formatTokenLimits = (tokens: RuleToken[], key: 'totalLimit' | 'perTxLimit') => {
  const parts = tokens
    .filter((row) => row.token)
    .map((row) => {
      const amount = formatAmount(row[key]);
      return amount ? `${amount} ${row.token!.symbol}` : `${UNLIMITED} ${row.token!.symbol}`;
    });
  // A rule without tokens (e.g. a preset before tokens are chosen) can move none.
  return parts.length ? parts.join(' · ') : '—';
};

/* Symbol of the first token picked twice in a rule, or null. */
export const findDuplicateToken = (tokens: RuleToken[]) => {
  const seen = new Set<string>();
  for (const row of tokens) {
    if (!row.token) continue;
    const key = row.token.address.toLowerCase();
    if (seen.has(key)) return row.token.symbol;
    seen.add(key);
  }
  return null;
};

export const formatAllowedApps = (rule: AgenticRule) =>
  rule.apps
    .map((ruleApp) => getRuleAppName(ruleApp, rule.networkId))
    .filter(Boolean)
    .join(' · ') || '—';

/* A function's 4-byte selector, whether stored as a signature or already as the selector. */
const selectorOf = (signature: string) =>
  /^0x[0-9a-fA-F]{8}$/.test(signature) ? signature : functionSelector(signature) ?? signature;

/* Catalog labels, preset labels, and other custom functions in their "name type, type" form. */
export const getRuleFunctionLabels = (rule: AgenticRule) => {
  const labels: string[] = [];
  const add = (label?: string) => {
    if (label && !labels.includes(label)) labels.push(label);
  };
  rule.apps.forEach((ruleApp) => {
    const app = getApp(ruleApp.appId);
    ruleApp.functionIds.forEach((id) => add(app?.functions.find((fn) => fn.id === id)?.label));
    const contract = ruleApp.customContract ?? app?.contracts?.[rule.networkId];
    ruleApp.customFunctions?.forEach((sig) =>
      add(
        (contract && registry.getFunctionLabel(rule.networkId, contract, selectorOf(sig))) ||
          formatFunctionSignature(sig),
      ),
    );
  });
  return labels;
};

export const formatGas = (value: string) => {
  const amount = formatAmount(value);
  return amount ? `${amount} PC` : '—';
};

const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`;

/* "Expires in": time left on a granted rule, or the chosen duration on a draft; ∞ when it never expires. */
export const formatExpiresIn = (rule: AgenticRule) => {
  if (rule.validUntil !== undefined) {
    if (rule.validUntil >= NO_EXPIRY) return UNLIMITED;
    const seconds = rule.validUntil - Math.floor(Date.now() / 1000);
    if (seconds <= 0) return 'Expired';
    // Rounded up, so a rule granted for 30 days reads "30 days" rather than "29 days" a moment later.
    if (seconds < 3600) return plural(Math.ceil(seconds / 60), 'minute');
    if (seconds < 86_400) return plural(Math.ceil(seconds / 3600), 'hour');
    return plural(Math.ceil(seconds / 86_400), 'day');
  }
  const days = Number(rule.durationDays);
  if (!rule.durationDays.trim() || !(days > 0)) return UNLIMITED;
  return plural(days, 'day');
};

export const isRuleStepOneValid = (rule: AgenticRule) =>
  !!rule.networkId &&
  rule.apps.length > 0 &&
  rule.apps.every((ruleApp) => hasRuleAppTarget(ruleApp) && getRuleAppFunctionCount(ruleApp) > 0);

const isValidLimit = (value: string) => !value.trim() || Number(value.replace(/,/g, '')) > 0;

/* A rule may have no tokens (a preset's call-only rule moves nothing); every row present must be complete. */
export const isRuleStepTwoValid = (rule: AgenticRule) =>
  rule.tokens.length <= MAX_TOKENS_PER_RULE &&
  !findDuplicateToken(rule.tokens) &&
  rule.tokens.every((row) => !!row.token && isValidLimit(row.totalLimit) && isValidLimit(row.perTxLimit));

export const isRuleStepThreeValid = (rule: AgenticRule) =>
  Number(rule.maxGasPerCall.replace(/,/g, '')) > 0 &&
  isEvmAddress(rule.agentAddress) &&
  (!rule.durationDays.trim() || Number(rule.durationDays) > 0);

/*
 * The SDK picks the rule for an agent send by (agent, network); two enabled rules for the
 * same pair make every send from that agent fail with AMBIGUOUS_RULE. Returns a message
 * naming the clash, or null.
 */
export const findAmbiguousRules = (rules: AgenticRule[]) => {
  const seen = new Map<string, number>();
  for (let i = 0; i < rules.length; i += 1) {
    const key = `${rules[i].agentAddress.toLowerCase()}:${rules[i].networkId}`;
    if (seen.has(key)) {
      const network = getNetwork(rules[i].networkId).name;
      return `Rule ${seen.get(key)! + 1} and Rule ${i + 1} give the same agent access on ${network}. Use one rule per agent and network.`;
    }
    seen.set(key, i);
  }
  return null;
};

/* Rules grouped by network, keeping the order in which each network first appears. */
export const groupRulesByNetwork = (rules: AgenticRule[]) => {
  const groups: { networkId: string; rules: { rule: AgenticRule; index: number }[] }[] = [];
  rules.forEach((rule, index) => {
    let group = groups.find((g) => g.networkId === rule.networkId);
    if (!group) {
      group = { networkId: rule.networkId, rules: [] };
      groups.push(group);
    }
    group.rules.push({ rule, index });
  });
  return groups;
};

export const sortWallets = (wallets: AgenticWallet[], sort: AgenticSortOption) => {
  const sorted = [...wallets].sort((a, b) =>
    sort === 'alphabetical' ? a.name.localeCompare(b.name) : b.index - a.index,
  );
  // Pinned wallets stay on top, the most recently pinned first; the chosen sort applies below them.
  const pinned = sorted.filter((w) => w.pinned).sort((a, b) => b.pinOrder - a.pinOrder);
  return [...pinned, ...sorted.filter((w) => !w.pinned)];
};

/* Numeric inputs keep digits, one decimal point and thousands separators. */
export const sanitizeAmountInput = (value: string) => {
  const cleaned = value.replace(/[^0-9.,]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  return rest.length ? `${whole}.${rest.join('')}` : whole;
};
