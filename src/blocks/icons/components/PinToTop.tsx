import { FC } from 'react';
import { IconWrapper } from '../IconWrapper';
import { IconProps } from '../Icons.types';

const PinToTop: FC<IconProps> = (allProps) => {
  const { svgProps: props, ...restProps } = allProps;
  return (
    <IconWrapper
      componentName="PinToTop"
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
            d="M21.5306 9.21937C21.6712 9.07874 21.7501 8.88805 21.7501 8.68922C21.7501 8.49039 21.6712 8.2997 21.5306 8.15906L15.8438 2.46937C15.7031 2.32883 15.5124 2.24988 15.3136 2.24988C15.1148 2.24988 14.9241 2.32883 14.7834 2.46937L9.41156 7.85625C9.41156 7.85625 6.81 6.55594 4.03125 8.79844C3.94885 8.86439 3.8813 8.947 3.83301 9.04086C3.78473 9.13471 3.7568 9.2377 3.75105 9.34309C3.74529 9.44848 3.76185 9.5539 3.79964 9.65245C3.83742 9.751 3.89558 9.84047 3.97031 9.915L14.0859 20.0297C14.1617 20.1049 14.2526 20.1631 14.3527 20.2003C14.4527 20.2375 14.5596 20.253 14.6661 20.2456C14.7726 20.2383 14.8763 20.2082 14.9702 20.1576C15.0642 20.1069 15.1463 20.0368 15.2109 19.9519C15.9975 18.9056 17.2331 16.7559 16.1588 14.6081L21.5306 9.21937Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M9.02719 14.9728L4.5 19.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      }
      {...restProps}
    />
  );
};

export default PinToTop;
