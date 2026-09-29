import { FC } from 'react';
import { IconWrapper } from '../IconWrapper';
import { IconProps } from '../Icons.types';

const SwapDashboard: FC<IconProps> = (allProps) => {
  const { svgProps: props, ...restProps } = allProps;

  return (
    <IconWrapper
      componentName="SwapDashboard"
      icon={
        <svg
          width="inherit"
          height="inherit"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          {...props}
        >
          <path
            d="M5.25 12V10.8C5.25 8.72893 6.92893 7.05 9 7.05H18.75M15.25 10.35L18.75 7.05L15.25 3.75"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M18.75 12V13.2C18.75 15.2711 17.0711 16.95 15 16.95H5.25M8.75 13.65L5.25 16.95L8.75 20.25"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      }
      {...restProps}
    />
  );
};

export default SwapDashboard;
