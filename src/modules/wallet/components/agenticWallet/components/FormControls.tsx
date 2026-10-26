import { FC, ReactElement, ReactNode, useLayoutEffect, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import * as RadixDropdown from '@radix-ui/react-dropdown-menu';
import { Add, CaretDown, CaretUp, CopyFilled, Cross, Dropdown, DropdownProps, KebabMenuVertical, Pencil, TickCircleFilled, Tooltip, Trash } from 'blocks';
import { handleCopy } from 'common';
import { AText, agenticTokens } from '../AgenticWallet.styles';
import { AgenticMenu, AgenticMenuItem } from './AgenticMenu';

/* Figma "Base Component/Header large": centred title and subtitle. */
export const ScreenTitle: FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <TitleBlock>
    <AText variant="heading-4" align="center">
      {title}
    </AText>
    <SubtitleRow>
      <AText variant="body-small-regular" color="var(--pw-int-text-secondary-color)" align="center">
        {subtitle}
      </AText>
    </SubtitleRow>
  </TitleBlock>
);

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxxs);
  width: 100%;
`;

const SubtitleRow = styled.div`
  display: flex;
  justify-content: center;
  padding: 0 var(--spacing-md);
  white-space: pre-line;

  > * {
    flex: 1;
  }
`;

export const SectionHeading: FC<{ title: string; description: string; tag?: string }> = ({ title, description, tag }) => (
  <Column>
    <TitleRow>
      <AText variant="heading-5">{title}</AText>
      {tag && <HeadingTag>{tag}</HeadingTag>}
    </TitleRow>
    <AText variant="caption-regular" color="var(--pw-int-text-tertiary-color)">
      {description}
    </AText>
  </Column>
);

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
`;

/* "Optional" beside a section title: small tag on surface/tertiary, as the function tags */
const HeadingTag = styled.span`
  padding: 2px var(--spacing-xxs);
  border-radius: var(--radius-xxxs);
  background: var(--pw-int-bg-tertiary-color);
  color: var(--pw-int-text-tertiary-color);
  font-family: var(--pw-int-font-family);
  font-size: 10px;
  line-height: 14px;
  font-weight: 500;
`;

/* "RULE 1 - STEP 1" */
export const StepOverline: FC<{ children: ReactNode }> = ({ children }) => (
  <OverlineRow>
    <AText variant="overline-large-bold" color="var(--pw-int-text-secondary-color)" uppercase>
      {children}
    </AText>
  </OverlineRow>
);

const OverlineRow = styled.div`
  padding: 1px 0;
`;

const Column = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

/* Figma "Base Component/Channel Tab": labelled segments with a 4px progress line. */
export const StepTabs: FC<{ steps: string[]; activeIndex: number }> = ({ steps, activeIndex }) => (
  <StepTabsRow>
    {steps.map((step, index) => (
      <StepSegment key={step}>
        <AText
          variant="heading-6"
          align="center"
          color={index === activeIndex ? 'var(--pw-int-text-primary-color)' : 'var(--pw-int-text-tertiary-color)'}
        >
          {step}
        </AText>
        <StepLine $active={index === activeIndex} />
      </StepSegment>
    ))}
  </StepTabsRow>
);

const StepTabsRow = styled.div`
  display: flex;
  gap: var(--spacing-xs);
  width: 100%;
  flex-shrink: 0;
`;

const StepSegment = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  flex: 1;
  padding: 0 2px;
`;

/* A zero-height line with a centred 4px stroke in Figma, so it takes no layout space. */
const StepLine = styled.div<{ $active: boolean }>`
  height: 4px;
  margin: -2px 0;
  border-radius: var(--radius-round);
  background: ${({ $active }) => ($active ? 'var(--pw-int-border-brand-medium)' : 'var(--pw-int-border-tertiary-color)')};
`;

/* Figma "Base Component/Tab Line": 8px side padding, 12px gap, 2px selected underline. */
export const LineTabs: FC<{
  tabs: { key: string; label: string }[];
  activeKey: string;
  onChange: (key: string) => void;
}> = ({ tabs, activeKey, onChange }) => (
  <TabList role="tablist">
    {tabs.map((tab) => (
      <TabButton
        key={tab.key}
        role="tab"
        type="button"
        aria-selected={tab.key === activeKey}
        $active={tab.key === activeKey}
        onClick={() => onChange(tab.key)}
      >
        {tab.label}
      </TabButton>
    ))}
  </TabList>
);

const TabList = styled.div`
  display: flex;
  gap: var(--spacing-xs);
  height: 39px;
  box-shadow: inset 0 -1px 0 var(--pw-int-border-secondary-color);
  flex-shrink: 0;
`;

const TabButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 var(--spacing-xxs);
  border: none;
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  font-family: var(--pw-int-font-family);
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  color: ${({ $active }) => ($active ? 'var(--pw-int-text-primary-color)' : 'var(--pw-int-text-secondary-color)')};
  box-shadow: ${({ $active }) => ($active ? 'inset 0 -2px 0 var(--pw-int-border-brand-medium)' : 'none')};

  &:hover {
    color: var(--pw-int-text-primary-color);
  }
`;

/* Card header row: "APP 1" / "TOKEN 1" / "RULE 1" with an optional kebab menu. */
export const CardLabel: FC<{ label: string; menuItems?: AgenticMenuItem[]; menuDisabled?: boolean }> = ({
  label,
  menuItems,
  menuDisabled,
}) => (
  <CardLabelRow>
    <AText variant="overline-small-bold" color="var(--pw-int-text-secondary-color)" uppercase>
      {label}
    </AText>
    {menuItems && menuItems.length > 0 && menuDisabled && (
      /* Nothing to act on yet (e.g. an empty app card) */
      <KebabButton aria-label={`${label} options`} disabled>
        <KebabMenuVertical size={16} color="pw-int-icon-tertiary-color" />
      </KebabButton>
    )}
    {menuItems && menuItems.length > 0 && !menuDisabled && (
      /* The rule menu opens over its own trigger, as drawn in the design */
      <AgenticMenu items={menuItems} sideOffset={-14} alignOffset={-2}>
        <KebabButton aria-label={`${label} options`}>
          <KebabMenuVertical size={16} color="pw-int-icon-primary-color" />
        </KebabButton>
      </AgenticMenu>
    )}
  </CardLabelRow>
);

const CardLabelRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xxxs);
  padding: 1px 0;
  min-height: 18px;
`;

const KebabButton = styled.button`
  display: flex;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
  }
`;

/* Figma "Base Component/Input Field" */
type FieldProps = {
  label: string;
  counter?: string;
  hint?: string;
  children: ReactNode;
};

export const Field: FC<FieldProps> = ({ label, counter, hint, children }) => (
  <FieldColumn>
    <FieldLabelRow>
      <AText variant="heading-6" nowrap>
        {label}
      </AText>
      {counter && (
        <Counter variant="caption-regular" color="var(--aw-text-tertiary-inverse)" align="center" nowrap>
          {counter}
        </Counter>
      )}
    </FieldLabelRow>
    {children}
    {hint && (
      <AText variant="caption-regular" color="var(--aw-input-placeholder)">
        {hint}
      </AText>
    )}
  </FieldColumn>
);

const FieldColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  width: 100%;
  min-width: 0;
`;

const FieldLabelRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  height: 16px;
`;

const Counter = styled(AText)`
  min-width: 42px;
`;

const inputBox = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  width: 100%;
  box-sizing: border-box;
  padding: var(--spacing-xs);
  border: none;
  border-radius: var(--radius-xs);
  box-shadow: inset 0 0 0 1.5px var(--pw-int-border-secondary-color);
  background: var(--aw-input-bg);
  font-family: var(--pw-int-font-family);
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: var(--pw-int-text-primary-color);
  transition: box-shadow 0.15s ease;

  &:hover {
    box-shadow: inset 0 0 0 1.5px var(--pw-int-border-tertiary-color);
  }
  &:focus-within {
    box-shadow: inset 0 0 0 1.5px var(--pw-int-brand-primary-subtle-color);
  }
`;

const InputBox = styled.label<{ $withIcon: boolean }>`
  ${inputBox}
  min-height: ${({ $withIcon }) => ($withIcon ? 48 : 45)}px;
  cursor: text;

  input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    padding: 0;
    font: inherit;
    color: inherit;

    &::placeholder {
      color: var(--aw-input-placeholder);
    }
  }
`;

type TextFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  inputMode?: 'text' | 'decimal' | 'numeric';
  trailingIcon?: ReactNode;
  ariaLabel?: string;
};

export const TextField: FC<TextFieldProps> = ({
  value,
  onChange,
  placeholder,
  maxLength,
  inputMode = 'text',
  trailingIcon,
  ariaLabel,
}) => (
  <InputBox $withIcon={!!trailingIcon}>
    <input
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      inputMode={inputMode}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    />
    {trailingIcon && <IconSlot>{trailingIcon}</IconSlot>}
  </InputBox>
);

const IconSlot = styled.span`
  display: flex;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
`;

export type SelectOption = {
  value: string;
  label: string;
  icon?: ReactNode;
  /* Contract under the app name, e.g. "0x9cf...4ebdc"; copyValue is the full address the copy icon copies */
  description?: string;
  copyValue?: string;
  /* Removes an owner-added option from the saved list; shown as a bin on hover */
  onDelete?: () => void;
  deleteLabel?: string;
};

/* First row of a picker that opens a "custom" flow, e.g. "Add Custom Contract". */
export type SelectAction = {
  label: string;
  onSelect: () => void;
};

type SelectFieldProps = {
  options: SelectOption[];
  value: string | null;
  placeholder: string;
  onChange: (value: string) => void;
  /* Shown before the value, e.g. the chain or token logo */
  leadingIcon?: ReactNode;
  /* Overrides the trigger text, e.g. a custom contract that is not in the options */
  displayValue?: string;
  action?: SelectAction;
};

/*
 * Figma "Rules Step 1 - App Selection": a single-select list attached to the bottom
 * of the trigger, 44px rows, the chosen row on surface/tertiary.
 */
export const SelectField: FC<SelectFieldProps> = ({
  options,
  value,
  placeholder,
  onChange,
  leadingIcon,
  displayValue,
  action,
}) => {
  const selected = options.find((option) => option.value === value);
  const label = displayValue ?? selected?.label;
  return (
    <Dropdown
      side="bottom"
      align="start"
      sideOffset={0}
      alignOffset={1}
      css={pickerContentCss}
      overlay={(setIsOpen) => (
        <OptionsList>
          {action && (
            <OptionItem
              onSelect={() => {
                setIsOpen(false);
                action.onSelect();
              }}
            >
              <Add size={18} color="pw-int-text-primary-color" />
              <OptionLabel>{action.label}</OptionLabel>
            </OptionItem>
          )}
          {options.map((option) => (
            <OptionItem
              key={option.value}
              $selected={option.value === value}
              onSelect={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.icon}
              {option.description ? (
                <OptionText>
                  <OptionLabel>{option.label}</OptionLabel>
                  <OptionMeta>
                    <span>{option.description}</span>
                    {option.copyValue && <OptionCopy value={option.copyValue} />}
                  </OptionMeta>
                </OptionText>
              ) : (
                <OptionLabel>{option.label}</OptionLabel>
              )}
              {option.onDelete && (
                <OptionDelete label={option.deleteLabel ?? `Delete ${option.label}`} onDelete={option.onDelete} />
              )}
            </OptionItem>
          ))}
        </OptionsList>
      )}
    >
      {renderTrigger(({ isOpen }) => (
        <SelectTrigger type="button">
          {label && leadingIcon && <IconSlot>{leadingIcon}</IconSlot>}
          <SelectValue>{label ?? placeholder}</SelectValue>
          <IconSlot>
            {isOpen ? (
              <CaretUp size={24} color="pw-int-icon-primary-color" />
            ) : (
              <CaretDown size={24} color="pw-int-icon-primary-color" />
            )}
          </IconSlot>
        </SelectTrigger>
      ))}
    </Dropdown>
  );
};

type MultiSelectFieldProps = {
  options: SelectOption[];
  values: string[];
  placeholder: string;
  disabled?: boolean;
  onChange: (values: string[]) => void;
  action?: SelectAction;
};

/*
 * Figma "Rules Step 1 - Function Selection": a multi-select with radio markers. The
 * trigger keeps its placeholder; the chosen functions are listed as tags under it.
 */
export const MultiSelectField: FC<MultiSelectFieldProps> = ({
  options,
  values,
  placeholder,
  disabled,
  onChange,
  action,
}) => (
  <Dropdown
    side="bottom"
    align="start"
    sideOffset={0}
    alignOffset={1}
    css={pickerContentCss}
    overlay={(setIsOpen) => (
      <OptionsList>
        {action && (
          <OptionItem
            onSelect={() => {
              setIsOpen(false);
              action.onSelect();
            }}
          >
            <Add size={18} color="pw-int-text-primary-color" />
            <OptionLabel>{action.label}</OptionLabel>
          </OptionItem>
        )}
        {options.map((option) => {
          const checked = values.includes(option.value);
          return (
            <OptionItem
              key={option.value}
              $selected={checked}
              onSelect={(event) => {
                // Keep the list open so several functions can be picked in one go.
                event.preventDefault();
                onChange(checked ? values.filter((v) => v !== option.value) : [...values, option.value]);
              }}
            >
              <Radio $checked={checked} aria-hidden="true" />
              <OptionLabel>{option.label}</OptionLabel>
              {option.onDelete && (
                <OptionDelete label={option.deleteLabel ?? `Delete ${option.label}`} onDelete={option.onDelete} />
              )}
            </OptionItem>
          );
        })}
      </OptionsList>
    )}
  >
    {renderTrigger(({ isOpen }) => (
      <SelectTrigger type="button" disabled={disabled}>
        <SelectValue>{placeholder}</SelectValue>
        <IconSlot>
          {isOpen ? (
            <CaretUp size={24} color="pw-int-icon-primary-color" />
          ) : (
            <CaretDown size={24} color="pw-int-icon-primary-color" />
          )}
        </IconSlot>
      </SelectTrigger>
    ))}
  </Dropdown>
);

/* blocks' DropdownProps intersects children with ReactNode, which rejects the render-prop form it supports */
const renderTrigger = (render: (props: { isOpen: boolean }) => ReactElement) =>
  render as unknown as DropdownProps['children'];

const pickerContentCss = css`
  z-index: 10;
  width: var(--radix-dropdown-menu-trigger-width);
`;

const SelectTrigger = styled.button`
  ${inputBox}
  min-height: 48px;
  cursor: pointer;
  text-align: left;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const SelectValue = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--pw-int-text-primary-color);
`;

/* List Item dropdown: stroke drawn inside, rows run edge to edge. */
const OptionsList = styled.div`
  ${agenticTokens}
  display: flex;
  flex-direction: column;
  max-height: 308px;
  overflow-x: hidden;
  overflow-y: auto;
  border-radius: var(--radius-xs);
  box-shadow: inset 0 0 0 1px var(--pw-int-border-secondary-color);
  background: var(--pw-int-bg-secondary-color);
  box-sizing: border-box;
`;

const OptionItem = styled(RadixDropdown.Item)<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-height: 44px;
  /* Long signatures wrap to several lines; rows must grow rather than squeeze in the scrolling list */
  flex-shrink: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  box-sizing: border-box;
  cursor: pointer;
  outline: none;
  font-family: var(--pw-int-font-family);
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  color: var(--pw-int-text-primary-color);
  background: ${({ $selected }) => ($selected ? 'var(--pw-int-bg-tertiary-color)' : 'transparent')};

  [role='img'] {
    flex-shrink: 0;
  }

  &:hover,
  &[data-highlighted] {
    background: var(--pw-int-bg-tertiary-color);
  }

  &:hover .option-copy,
  &[data-highlighted] .option-copy,
  &:hover .option-delete,
  &[data-highlighted] .option-delete {
    visibility: visible;
  }
`;

/* Deletes an owner-added option without toggling it; like the copy icon, only on the highlighted row. */
const OptionDelete: FC<{ label: string; onDelete: () => void }> = ({ label, onDelete }) => (
  <DeleteButton
    role="button"
    aria-label={label}
    className="option-delete"
    onPointerDown={(event) => event.stopPropagation()}
    onPointerUp={(event) => event.stopPropagation()}
    onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onDelete();
    }}
  >
    <Trash size={18} />
  </DeleteButton>
);

/*
 * Copies an option's contract without choosing the option. Figma shows it on the
 * highlighted row only.
 */
const OptionCopy: FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = useState(false);
  return (
    <CopyButton
      role="button"
      aria-label="Copy contract address"
      className="option-copy"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        handleCopy(value, setCopied);
      }}
    >
      {copied ? <TickCircleFilled size={12} color="pw-int-icon-success-bold-color" /> : <CopyFilled size={12} />}
    </CopyButton>
  );
};

const OptionText = styled.span`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
`;

/* Figma: Body Extra Small/Semibold, text/secondary */
const OptionMeta = styled.span`
  display: flex;
  align-items: center;
  gap: var(--spacing-xxxs);
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
  color: var(--pw-int-text-secondary-color);
`;

const CopyButton = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  cursor: pointer;
  color: var(--pw-int-icon-tertiary-color);
  visibility: hidden;

  &:hover {
    color: var(--pw-int-icon-brand-color);
  }
`;

const DeleteButton = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  cursor: pointer;
  /* Same grey as the header's link and back icons, so it reads on the highlighted row */
  color: var(--pw-int-text-tertiary-color);
  visibility: hidden;

  &:hover {
    color: var(--pw-int-icon-danger-bold-color);
  }

  /* Devices without hover can't reveal it, so it stays visible there */
  @media (hover: none) {
    visibility: visible;
  }
`;

/* Tuple signatures ("exactInput (bytes,address,uint256,uint256)") have no spaces to wrap at. */
const OptionLabel = styled.span`
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
`;

/* Figma "Radio Buttons": a 10.5px disc centred in an 18px box. */
const Radio = styled.span<{ $checked: boolean }>`
  position: relative;
  width: 18px;
  height: 18px;
  flex-shrink: 0;

  &::before {
    content: '';
    position: absolute;
    top: 3.75px;
    left: 3.75px;
    width: 10.5px;
    height: 10.5px;
    box-sizing: border-box;
    border-radius: 50%;
    ${({ $checked }) =>
      $checked
        ? css`
            background: var(--aw-radio-selected);
          `
        : css`
            border: 1.125px solid var(--aw-radio-stroke);
          `}
  }

  &::after {
    content: '';
    display: ${({ $checked }) => ($checked ? 'block' : 'none')};
    position: absolute;
    top: 6.375px;
    left: 6.375px;
    width: 5.25px;
    height: 5.25px;
    border-radius: 50%;
    background: var(--aw-surface-brand-subtle);
  }
`;

type TextAreaFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
};

/* Figma "Text Area": the input box at 100px tall, text from the top. */
export const TextAreaField: FC<TextAreaFieldProps> = ({ value, onChange, placeholder, ariaLabel }) => (
  <TextAreaBox>
    <textarea
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    />
  </TextAreaBox>
);

const TextAreaBox = styled.label`
  ${inputBox}
  align-items: flex-start;
  height: 100px;
  cursor: text;

  textarea {
    flex: 1;
    height: 100%;
    min-width: 0;
    resize: none;
    border: none;
    outline: none;
    background: transparent;
    padding: 0;
    font: inherit;
    color: inherit;

    &::placeholder {
      color: var(--aw-input-placeholder);
    }
  }
`;

/*
 * Figma "Tag" (State=Active, Size=SM) list for allowed functions. The rule editor
 * spaces the title 8px from the tags; the rule summary card uses 4px. In the editor every
 * selected function can be removed; only the owner's custom ones can be edited.
 */
export type FunctionTagItem = {
  label: string;
  onEdit?: () => void;
  onRemove?: () => void;
};

export const FunctionTags: FC<{ labels: (string | FunctionTagItem)[]; title?: string; gap?: number }> = ({
  labels,
  title = 'Allowed Functions',
  gap = 8,
}) => (
  <TagsColumn $gap={gap}>
    <AText variant="caption-small-medium" color="var(--aw-text-tertiary-inverse)">
      {title}
    </AText>
    <TagsWrap>
      {labels.map((entry, index) => {
        const item = typeof entry === 'string' ? { label: entry } : entry;
        const editable = !!(item.onEdit || item.onRemove);
        return (
          <FunctionTag key={`${item.label}-${index}`} $editable={editable}>
            <TagLabel label={item.label} />
            {item.onEdit && (
              <TagEditButton type="button" aria-label={`Edit ${item.label}`} onClick={item.onEdit}>
                <Pencil size={12} />
              </TagEditButton>
            )}
            {item.onRemove && (
              <TagIconButton type="button" aria-label={`Remove ${item.label}`} onClick={item.onRemove}>
                <Cross size={12} />
              </TagIconButton>
            )}
          </FunctionTag>
        );
      })}
    </TagsWrap>
  </TagsColumn>
);

/* A tag's text; when it is cut off, the design system tooltip shows the full name. */
const TagLabel: FC<{ label: string }> = ({ label }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let active = true;
    const measure = () => active && setTruncated(el.scrollWidth > el.clientWidth);
    // Measure now, after layout settles, once the web font has loaded (it changes the text
    // width), and whenever the tag's box resizes.
    measure();
    const frame = requestAnimationFrame(measure);
    document.fonts?.ready.then(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
    // Wrapping in the tooltip swaps the text element, so measuring restarts on the new one.
  }, [label, truncated]);

  const text = <TagText ref={ref}>{label}</TagText>;
  return truncated ? (
    // A compact single-line tooltip, sized for the small function tags
    <Tooltip overlay={<TagTooltipText>{label}</TagTooltipText>} css={tagTooltipCss} tooltipPosition="bottom-right">
      {text}
    </Tooltip>
  ) : (
    text
  );
};

const tagTooltipCss = css`
  padding: var(--spacing-xxxs) 6px;
`;

const TagTooltipText = styled.span`
  color: var(--pw-int-text-secondary-color);
  font-family: var(--pw-int-font-family);
  font-size: 9px;
  font-weight: 500;
  line-height: 12px;
`;

const TagText = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
`;

const TagIconButton = styled.button`
  display: flex;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--pw-int-text-secondary-color);
`;

const TagsColumn = styled.div<{ $gap: number }>`
  display: flex;
  flex-direction: column;
  gap: ${({ $gap }) => $gap}px;
  width: 100%;
`;

const TagsWrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xxxs);
  padding: 1px 0;
`;

/* Edit shows on hover (or keyboard focus); devices without hover always show it. Fading keeps the tag's width steady. */
const TagEditButton = styled(TagIconButton)`
  @media (hover: hover) {
    opacity: 0;
    transition: opacity 0.15s ease;
  }
`;

const FunctionTag = styled.span<{ $editable?: boolean }>`
  display: inline-flex;
  align-items: center;
  padding: ${({ $editable }) => ($editable ? '2px 4px 2px 8px' : '2px var(--spacing-xxs)')};
  border-radius: var(--radius-xxxs);
  background: var(--pw-int-bg-primary-color);
  color: var(--pw-int-text-secondary-color);
  font-family: var(--pw-int-font-family);
  font-size: 8px;
  line-height: 14px;
  font-weight: 500;
  white-space: nowrap;

  &:hover ${TagEditButton}, &:focus-within ${TagEditButton} {
    opacity: 1;
  }
`;
