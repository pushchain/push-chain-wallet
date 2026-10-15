import { FC } from 'react';
import { IconWrapper } from '../IconWrapper';
import { IconProps } from '../Icons.types';

const AgenticWallet: FC<IconProps> = (allProps) => {
  const { svgProps: props, ...restProps } = allProps;
  return (
    <IconWrapper
      componentName="AgenticWallet"
      icon={
        <svg
          width="inherit"
          height="inherit"
          viewBox="-1.08875 -4.3487 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          {...props}
        >
          <path
            d="M13.861 7.65129C14.6344 7.65129 15.2614 7.02433 15.2614 6.25094C15.2614 5.47755 14.6344 4.8506 13.861 4.8506C13.0876 4.8506 12.4607 5.47755 12.4607 6.25094C12.4607 7.02433 13.0876 7.65129 13.861 7.65129Z"
            fill="currentColor"
          />
          <path
            d="M7.94377 7.65129C8.71716 7.65129 9.34412 7.02433 9.34412 6.25094C9.34412 5.47755 8.71716 4.8506 7.94377 4.8506C7.17039 4.8506 6.54343 5.47755 6.54343 6.25094C6.54343 7.02433 7.17039 7.65129 7.94377 7.65129Z"
            fill="currentColor"
          />
          <rect
            x="3.45591"
            y="0.75"
            width="14.8931"
            height="13.8026"
            rx="4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8.75956 9.80283C9.16994 10.497 9.9164 10.9229 10.7228 10.9229H11.146C11.9444 10.9229 12.6817 10.4956 13.0786 9.80289"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M2.87697 10.3628L2.25 10.3628C1.42157 10.3628 0.75 9.69124 0.75 8.86281L0.75 6.63175C0.75 5.80332 1.42157 5.13175 2.25 5.13175L2.87697 5.13175"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M18.9456 5.13176H19.5725C20.401 5.13176 21.0725 5.80333 21.0725 6.63176V8.86282C21.0725 9.69125 20.401 10.3628 19.5725 10.3628H18.9456"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      }
      {...restProps}
    />
  );
};

export default AgenticWallet;
