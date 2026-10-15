import { FC } from "react";
import styled from "styled-components";
import { Moon, Sun } from "../../blocks";
import { useDarkMode } from "../hooks";

/*
 * Light / dark switch for standalone wallet.push.org, pinned to the page's top right
 * outside the wallet card. Inside the UI kit's iframe the host app sets the theme, so
 * ContentLayout does not render it there.
 */
const ThemeToggle: FC = () => {
  const { isDarkMode, enable, disable } = useDarkMode();

  return (
    <ToggleButton
      type="button"
      aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => (isDarkMode ? disable() : enable())}
    >
      {isDarkMode ? (
        <Sun size={24} color="pw-int-icon-primary-color" />
      ) : (
        <Moon size={24} color="pw-int-icon-primary-color" />
      )}
    </ToggleButton>
  );
};

export { ThemeToggle };

/* The wallet card's surface and stroke, as a round button */
const ToggleButton = styled.button`
  position: fixed;
  top: var(--spacing-md);
  right: var(--spacing-md);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: var(--radius-round);
  border: 1.5px solid var(--pw-int-border-secondary-color);
  background: var(--pw-int-bg-secondary-color);
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: var(--pw-int-bg-tertiary-color);
  }
`;
