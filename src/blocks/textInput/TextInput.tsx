import { Asterisk } from '../icons';
import { TextVariants, textVariants } from '../text';
import React, { ReactNode, forwardRef } from 'react';
import styled, { FlattenSimpleInterpolation, css } from 'styled-components';

export type TextInputProps = {
  css?: FlattenSimpleInterpolation;
  description?: string;
  disabled?: boolean;
  icon?: ReactNode;
  error?: boolean;
  type?: 'text' | 'password' | 'number';
  errorMessage?: string;
  label?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  trailingIcon?: ReactNode;
  placeholder?: string;
  required?: boolean;
  success?: boolean;
  totalCount?: number;
  value: string | number;
};

const Container = styled.div<{ css?: FlattenSimpleInterpolation; label: TextInputProps['label'] }>`
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  flex: 1 0 0;
  gap: var(--spacing-${({ label }) => (label ? 'xxs' : 'none')});

  /* Custom CSS applied via styled component css prop */
  ${(props) => props.css || ''};
`;

const StyledTextInput = styled.div<{
  error?: boolean;
  success?: boolean;
  disabled?: boolean;
}>`
  ${({ error }) => {
    return css`
      align-self: stretch;
      justify-content: space-between;
      align-items: center;
      border-radius: var(--radius-xs, 12px);
      border: 1.5px solid var(--pw-int-${error ? 'error-primary-color' : 'border-secondary-color'});
      background: var(--pw-int-bg-tertiary-color);

      display: flex;

      gap: var(--spacing-xxs, 8px);

      padding: var(--spacing-xs, 12px);
      [role='img'] {
        width: 24px;
        height: 24px;

        color: var(--pw-int-${error ? 'error-primary-color' : 'icon-primary-color'});
      }
      & input {
        color: var(--pw-int-${error ? 'error-primary-color' : 'text-primary-color'});

        font-family: var(--pw-int-font-family);
        font-size: ${textVariants['bs-regular'].fontSize};
        font-style: ${textVariants['bs-regular'].fontStyle};
        font-weight: ${textVariants['bs-regular'].fontWeight};
        line-height: ${textVariants['bs-regular'].lineHeight};
        width: 100%;
        ::placeholder {
          color: var(--pw-int-text-disabled-color);
        }
        border: none;
        background: transparent;
        &:focus,
        :disabled {
          outline: none;
        }
      }

      &:hover {
        border: 1.5px solid var(--pw-int-border-tertiary-color);
      }

      &:focus-within {
        border: 1.5px solid var(--pw-int-brand-primary-subtle-color);
        outline: none;
      }

      &:disabled {
        border: 1.5px solid var(--pw-int-border-tertiary-color);
        background: var(--pw-int-bg-disabled-color);
        cursor: not-allowed;
        color: var(--pw-int-text-disabled-color);
      }
    `;
  }}
`;

const LabelContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const InputText = styled.span<{ color: string; variant: TextVariants }>`
  color: var(--pw-int-${({ color }) => color});
  font-family: var(--pw-int-font-family);
  ${({ variant }) =>
    `
  font-size: ${textVariants[variant].fontSize};
  font-style: ${textVariants[variant].fontStyle};
  font-weight: ${textVariants[variant].fontWeight};
  line-height: ${textVariants[variant].lineHeight};
  `}
`;

const LabelTextContainer = styled.div`
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-xxxs, 4px);
`;

const InputContainer = styled.div`
  display: flex;
  gap: var(--spacing-xxs);
  width: 100%;
`;

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      css,
      description,
      disabled,
      error,
      errorMessage,
      label,
      onChange,
      trailingIcon,
      placeholder,
      required,
      type = 'text',
      icon,
      success,
      totalCount,
      value,
    },
    ref
  ) => {
    return (
      <Container
        css={css}
        label={label}
      >
        {label && (
          <LabelContainer>
            <InputText
              color={disabled ? 'text-disabled-color' : 'text-primary-color'}
              variant="h6-bold"
            >
              <LabelTextContainer>
                {label}
                {required && <Asterisk size={4.6} />}
              </LabelTextContainer>
            </InputText>
            {totalCount && (
              <InputText
                color={disabled ? 'text-disabled-color' : 'text-secondary-color'}
                variant="c-regular"
              >
                {`${(typeof value === 'string' && value?.length) || 0} / ${totalCount}`}
              </InputText>
            )}
          </LabelContainer>
        )}
        <StyledTextInput
          disabled={disabled}
          error={error}
          onChange={onChange}
          ref={ref}
          success={success}
        >
          <InputContainer>
            {icon}
            <input
              type={type}
              disabled={!!disabled}
              {...(disabled ? { 'aria-disabled': true } : {})}
              placeholder={placeholder}
              onChange={onChange}
              value={value}
            />
          </InputContainer>
          {trailingIcon}
        </StyledTextInput>
        {description && (
          <InputText
            color={
              success || error
                ? 'text-primary-color'
                : disabled
                  ? 'text-disabled-color'
                  : 'text-primary-color'
            }
            variant="c-regular"
          >
            {description}
          </InputText>
        )}
        {errorMessage && (
          <InputText
            color="error-primary-color"
            variant="c-regular"
          >
            {errorMessage}
          </InputText>
        )}
      </Container>
    );
  }
);
