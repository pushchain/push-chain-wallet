import { Box, Text, Button, Cross } from "../../../blocks";
import React, { FC, useEffect, useRef, useState } from "react";
import { DrawerWrapper, ErrorContent, LoadingContent, PoweredByPush } from "../../../common/components";
import styled, { css } from "styled-components";
import { verifyOTPEmailAuth } from "../../Authentication/Authentication.utils";
import { AuthParams } from "./Reconnect";
import { useGlobalState } from "../../../context/GlobalContext";
import { fetchJwtUsingState } from "../../../helpers/AuthHelper";

type OTPReverificationProps = {
    params: AuthParams;
    onClose: () => void;
    onCancel: () => void;
}

const OTPReverification: FC<OTPReverificationProps> = ({ params, onClose, onCancel }) => {
    const email = localStorage.getItem("pw_user_email");
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const { dispatch } = useGlobalState();

    useEffect(() => {
        inputRefs.current[0]?.focus();
      }, []);

    const handleClose = () => {
        onCancel();
        onClose();
    }

    const handleChange = (index: number, value: string) => {
        if (value.length > 1) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').trim();

        if (/^\d{6}$/.test(pastedData)) {
            const newOtp = pastedData.split('');
            setOtp(newOtp);

            inputRefs.current[5]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
        if (e.key === 'Enter' && otp.every(digit => digit) && !isLoading) {
            e.preventDefault();
            void handleSubmit(); 
        }
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        setError('');
        try {
            const state = params.state;
            const challengeId = params.challengeId;
            const email = params.email;
            const otpString = otp.join('');
            const response = await verifyOTPEmailAuth(otpString, state, challengeId, email);

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Verification failed');
            }

            if (response.ok && data.success) {
                const jwtToken = await fetchJwtUsingState({
                    stateParam: data.state,
                });
                dispatch({ type: "SET_JWT", payload: jwtToken });
                dispatch({ type: "SET_WALLET_LOAD_STATE", payload: "success" });
                dispatch({ type: "SET_READ_ONLY", payload: false });
                onClose();
            }
        } catch (err) {
            setError(err.message || 'Failed to verify OTP');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            padding="spacing-xs"
            width="100%"
            borderRadius="radius-md"
            backgroundColor="pw-int-bg-primary-color"
            css={css`
                border-top: var(--border-xmd) solid var(--pw-int-border-secondary-color);
            `}
        >
            <Box position="absolute" alignSelf="flex-end" cursor="pointer" height="16px" onClick={handleClose}>
                <Cross size={16} color="pw-int-icon-primary-color" />
            </Box>
            <Box flexDirection="column" display="flex" gap="spacing-lg" padding="spacing-xs spacing-xs spacing-lg spacing-xs">
                <Box flexDirection="column" display="flex" gap='spacing-xxxs' justifyContent="center" alignItems="center">
                    <Text
                        color="pw-int-text-primary-color"
                        variant="h4-semibold"
                    >
                        Confirm Verification Code
                    </Text>
                    <Text
                        color="pw-int-text-secondary-color"
                        variant="bs-regular"
                        textAlign="center"
                    >
                        We've sent a 6 digit code to {email ?? "your Email Address"}.
                        Enter the code to proceed.
                    </Text>
                </Box>

                <Box display="flex" gap="spacing-xxs" justifyContent="space-between" alignItems="center">
                    {otp.map((digit, index) => (
                        <StyledOTPInput
                            key={index}
                            type="text"
                            value={digit}
                            onChange={(e) => handleChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            onPaste={handlePaste}
                            ref={(el) => {inputRefs.current[index] = el}}
                            maxLength={1}
                        />
                    ))}
                </Box>

                <Button
                    onClick={handleSubmit}
                    disabled={!otp.every(digit => digit) || isLoading}
                    loading={isLoading}
                    variant="primary"
                    css={css`
                        width: 100%;
                        max-width: 200px;
                        margin: 0 auto;
                    `}
                >
                    Verify
                </Button>
            </Box>

            <PoweredByPush />

            {isLoading && (
                <DrawerWrapper>
                    <LoadingContent
                        title="Verifying Code"
                        subTitle="Please wait while we verify your code"
                    />
                </DrawerWrapper>
            )}
            {error && (
                <DrawerWrapper>
                    <ErrorContent
                        title="Verification Failed"
                        subTitle={error}
                        onClose={() => setError('')}
                    />
                </DrawerWrapper>
            )}
        </Box>
    );
};

const StyledOTPInput = styled.input`
  width: 50px;
  padding: var(--spacing-xs, 12px);
  font-size: 18px;
  text-align: center;
  border: var(--border-sm) solid var(--pw-int-border-tertiary-color);
  border-radius: 8px;
  background: var(--pw-int-bg-secondary-color);
  // border: 1.5px solid var(--pw-int-bg-disabled-color);
  // border-radius: 8px;
  // background: var(--pw-int-bg-disabled-color);
  color: var(--pw-int-text-primary-color);
  font-family: var(--pw-int-font-family);
  
  &:focus {
    border-color: var(--pw-int-brand-primary-color);
    outline: none;
  }
  
  &::placeholder {
    color: var(--pw-int-text-tertiary-color);
  }
`;

export { OTPReverification };
