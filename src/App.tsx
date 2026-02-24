import { BrowserRouter as Router } from "react-router-dom";
import { createGlobalStyle, ThemeProvider } from "styled-components";

import { GlobalProvider } from "./context/GlobalContext";
import { blocksTheme, getBlocksCSSVariables } from "./blocks";
import { getAppBasePath } from "../basePath";
import { useDarkMode, RouterContainer, isUIKitVersion, getAppParamValue } from "./common";
import { EventEmitterProvider } from "./context/EventEmitterContext";
import { ExternalWalletContextProvider } from "./context/ExternalWalletContext";
import { useAppState } from "./context/AppContext";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { startEIP6963Listener } from './providers/utils/eip6963';
import { useEffect } from "react";
import { ensureWaapInit } from "./waap/initWaap";

const GlobalStyle = createGlobalStyle`
  :root{
    /* Font Family */
      --pw-int-font-family: 'FK Grotesk Neu';
    /* New blocks theme css variables*/
    ${(props) => {
    // @ts-expect-error: The getBlocksCSSVariables function is not typed, so we need to suppress the error here.
    return getBlocksCSSVariables(props.theme.blocksTheme, props.theme.scheme, props.theme.themeOverrides);
  }}
  }
`;

const themeConfig = {
  dark: {
    blocksTheme: blocksTheme.dark,
    scheme: "dark",
  },
  light: { blocksTheme: blocksTheme.light, scheme: "light" },
};

export default function App() {
  const { isDarkMode } = useDarkMode();

  const { state } = useAppState();
  startEIP6963Listener();

  const queryClient = new QueryClient();

  const isOpenedInIframe = !!getAppParamValue();

  useEffect(() => {
    if ((isUIKitVersion('5') && state.walletConfig) || !isOpenedInIframe) ensureWaapInit(isDarkMode, state.walletConfig);
  }, [state.walletConfig, isDarkMode]);

  return (
    <ThemeProvider theme={{ ...(isDarkMode ? themeConfig.dark : themeConfig.light), themeOverrides: state.themeOverrides }}>
      <GlobalStyle />
      <QueryClientProvider client={queryClient}>
        <Router basename={getAppBasePath()}>
          <ExternalWalletContextProvider>
            <GlobalProvider>
              <EventEmitterProvider>
                <RouterContainer />
              </EventEmitterProvider>
            </GlobalProvider>
          </ExternalWalletContextProvider>
        </Router>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
