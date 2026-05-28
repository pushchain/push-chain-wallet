import { FC } from 'react';
import { IllustrationWrapper } from '../IllustrationWrapper';
import { IllustrationProps } from '../Illustrations.types';

const PUSD: FC<IllustrationProps> = (allProps) => {
  const { svgProps: props, ...restProps } = allProps;
  return (
    <IllustrationWrapper
      componentName="PUSD"
      illustration={
        <svg
          width={restProps?.width ?? '24'}
          height={restProps?.height ?? '24'}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          {...props}
        >
          <g clip-path="url(#clip0_47285_2950)">
          <circle cx="12" cy="12" r="12" fill="url(#paint0_radial_47285_2950)"/>
          <path d="M11.28 19.4V18.4H10.26C9.5 18.4 9 17.9 9 17.12C9 16.7 8.7 16.4 8.28 16.4H7.86C7.34 16.4 7 16.06 7 15.54V14.86C7 14.58 7.18 14.4 7.46 14.4H8.4C8.76 14.4 9 14.64 9 15V16.4H11.28V12.76H10.32C9.54 12.76 9 12.22 9 11.42C9 11.02 8.74 10.76 8.34 10.76H7.96C7.38 10.76 7 10.38 7 9.8V8.84C7 8.1 7.5 7.6 8.34 7.6C8.74 7.6 9 7.34 9 6.94V6.58C9 5.98 9.4 5.6 10 5.6H11.28V4.6C11.28 4.24 11.52 4 11.88 4H12.08C12.44 4 12.68 4.24 12.68 4.6V5.6H13.74C14.5 5.6 15 6.1 15 6.88C15 7.3 15.3 7.6 15.72 7.6H16.14C16.66 7.6 17 7.94 17 8.46V9.14C17 9.42 16.82 9.6 16.54 9.6H15.6C15.24 9.6 15 9.36 15 9V7.6H12.68V10.76H13.68C14.48 10.76 15 11.28 15 12.1C15 12.5 15.26 12.76 15.66 12.76H16.02C16.62 12.76 17 13.14 17 13.74V15.08C17 15.88 16.48 16.4 15.66 16.4C15.26 16.4 15 16.66 15 17.06V17.42C15 18.02 14.6 18.4 14 18.4H12.68V19.4C12.68 19.76 12.44 20 12.08 20H11.88C11.52 20 11.28 19.76 11.28 19.4ZM9 10.76H11.28V7.6H9V10.76ZM12.68 16.4H15V12.76H12.68V16.4Z" fill="white"/>
          </g>
          <defs>
          <radialGradient id="paint0_radial_47285_2950" cx="0" cy="0" r="1" gradientTransform="matrix(25.125 -25.5 23.3178 26.4168 5.25 19.875)" gradientUnits="userSpaceOnUse">
          <stop offset="0.302885" stop-color="#CE3BEB"/>
          <stop offset="1" stop-color="#215FFF"/>
          </radialGradient>
          <clipPath id="clip0_47285_2950">
          <rect width="24" height="24" fill="white"/>
          </clipPath>
          </defs>
        </svg>
      }
      {...restProps}
    />
  );
};

export default PUSD;
