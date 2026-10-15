import { FC } from 'react';
import { IconWrapper } from '../IconWrapper';
import { IconProps } from '../Icons.types';

const Sparkle: FC<IconProps> = (allProps) => {
  const { svgProps: props, ...restProps } = allProps;
  return (
    <IconWrapper
      componentName="Sparkle"
      icon={
        <svg
          width="inherit"
          height="inherit"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          {...props}
        >
          <path
            d="M8 3C8.06119 3 8.11133 3.05014 8.11133 3.11133C8.11145 5.74863 10.2514 7.88855 12.8887 7.88867C12.9499 7.88867 13 7.93881 13 8C13 8.06119 12.9499 8.11133 12.8887 8.11133C10.2514 8.11145 8.11145 10.2514 8.11133 12.8887C8.11133 12.9499 8.06119 13 8 13C7.93881 13 7.88867 12.9499 7.88867 12.8887C7.88855 10.2514 5.74863 8.11145 3.11133 8.11133C3.05014 8.11133 3 8.06119 3 8C3 7.93881 3.05014 7.88867 3.11133 7.88867C5.74863 7.88855 7.88855 5.74863 7.88867 3.11133C7.88867 3.05014 7.93881 3 8 3Z"
            stroke="currentColor"
          />
        </svg>
      }
      {...restProps}
    />
  );
};

export default Sparkle;
