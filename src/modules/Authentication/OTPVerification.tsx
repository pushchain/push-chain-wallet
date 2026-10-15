import { FC, useState, useRef, useEffect } from 'react';
import { Box, Text, Button, Back } from '../../blocks';
import { DrawerWrapper, LoadingContent, ErrorContent, WALLET_TO_WALLET_ACTION, ContentLayout, BoxLayout, PoweredByPush } from '../../common';
import { verifyOTPEmailAuth } from './Authentication.utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styled, { css } from 'styled-components';
import { Footer } from '../../common/components/Footer';
import { APP_ROUTES } from '../../constants';



type OTPVerificationProps = {
  userId: string;
  onVerificationComplete: () => void;
};

export const OTPVerification: FC<OTPVerificationProps> = ({
  onVerificationComplete
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const appURL = sessionStorage.getItem('App_Connections');
    const version = sessionStorage.getItem('UI_kit_version');
    if (appURL) url.searchParams.set('app', appURL);
    if (version) url.searchParams.set('version', version);
    window.history.replaceState({}, "", url.toString());
  }, []);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return;
    if (value === "") {
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
      return;
    }
    if (!/^[0-9]$/.test(value)) return;

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
      const state = searchParams.get('state') || '';
      const challengeId = searchParams.get('challengeId') || '';
      const email = searchParams.get('email') || '';
      const otpString = otp.join('');
      const response = await verifyOTPEmailAuth(otpString, state, challengeId, email);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Verification failed');
      }

      if (response.ok && data.success) {
        onVerificationComplete();

        if (window.opener) {
          window.opener?.postMessage(
            { type: WALLET_TO_WALLET_ACTION.AUTH_STATE_PARAM, state: data.state },
            window.location.origin
          );
          window.close();
        } else {
          const dAppURL = sessionStorage.getItem("App_Connections");
          const version = sessionStorage.getItem("UI_kit_version");
          sessionStorage.removeItem("App_Connections");
          sessionStorage.removeItem("UI_kit_version");

          const queryParams: string[] = [];
          if (dAppURL) queryParams.push(`app=${dAppURL}`);
          if (version) queryParams.push(`version=${version}`);
          queryParams.push(`state=${data.state}`);
          
          // this one is to handle the iframe request in email flow.
          window.location.href = `${window.location.origin}${APP_ROUTES.WALLET}?${queryParams.join("&")}`;
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ContentLayout footer={<Footer />}>
      <BoxLayout>
        <Box
          flexDirection="column"
          display="flex"
          gap="spacing-lg"
          width="100%"
          maxWidth="400px"
          padding="spacing-lg"
        >
          <Box onClick={() => navigate(APP_ROUTES.AUTH)}>
            <Back color='pw-int-text-tertiary-color' size={24} />
          </Box>

          <Box flexDirection="column" display="flex" gap="spacing-xxl">
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
                We've sent a 6 digit code to your Email Address. Enter the code to proceed.
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
                  ref={(el) => (inputRefs.current[index] = el)}
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
      </BoxLayout>
    </ContentLayout>
  );
};

export default OTPVerification;

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