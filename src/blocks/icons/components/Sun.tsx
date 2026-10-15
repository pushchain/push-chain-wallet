import { FC } from 'react';
import { IconWrapper } from '../IconWrapper';
import { IconProps } from '../Icons.types';

/* Outline sun on the 32px grid with a 2px stroke, the pair of Moon and the same style as Settings. */
const Sun: FC<IconProps> = (allProps) => {
  const { svgProps: props, ...restProps } = allProps;
  return (
    <IconWrapper
      componentName="Sun"
      icon={
        <svg
          width="inherit"
          height="inherit"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          {...props}
        >
          <circle
            cx="16"
            cy="16"
            r="6"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M16 3V5M16 27V29M3 16H5M27 16H29M6.81 6.81L8.22 8.22M23.78 23.78L25.19 25.19M6.81 25.19L8.22 23.78M23.78 8.22L25.19 6.81"
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

export default Sun;
