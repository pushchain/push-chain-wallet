import { FC } from 'react';
import { IconWrapper } from '../IconWrapper';
import { IconProps } from '../Icons.types';

/* Outline bin on the 32px grid with a 2px stroke, the same style as Sun and Settings. */
const Trash: FC<IconProps> = (allProps) => {
  const { svgProps: props, ...restProps } = allProps;
  return (
    <IconWrapper
      componentName="Trash"
      icon={
        <svg
          width="inherit"
          height="inherit"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          {...props}
        >
          <path
            d="M5 8H27M13 8V5.5C13 5.22 13.22 5 13.5 5H18.5C18.78 5 19 5.22 19 5.5V8M8 8L9.4 26.2C9.46 26.65 9.84 27 10.3 27H21.7C22.16 27 22.54 26.65 22.6 26.2L24 8M13.5 13V21.5M18.5 13V21.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      }
      {...restProps}
    />
  );
};

export default Trash;
