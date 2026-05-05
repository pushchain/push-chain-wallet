import { FC } from "react";
import { IllustrationWrapper } from "../IllustrationWrapper";
import { IllustrationProps } from "../Illustrations.types";

const StETH: FC<IllustrationProps> = (allProps) => {
  const { svgProps: props, ...restProps } = allProps;
  return (
    <IllustrationWrapper
      componentName="stETH"
      illustration={
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={restProps?.width ?? "24"}
          height={restProps?.height ?? "24"}
          viewBox="0 0 24 24"
          fill="none"
          {...props}
        >
          <path
            d="M12.1133 20.0988C15.4896 20.0988 18.2266 17.3779 18.2266 14.0214C18.2266 12.7334 17.8236 11.5389 17.136 10.5559L12.0724 13.5863L7.00878 10.676C6.37117 11.6355 6 12.7853 6 14.0214C6 17.3779 8.73705 20.0988 12.1133 20.0988Z"
            fill="url(#paint0_radial_steth)"
          />
          <path
            d="M12.1133 20.0988C15.4896 20.0988 18.2266 17.3779 18.2266 14.0214C18.2266 12.7334 17.8236 11.5389 17.136 10.5559L12.0724 13.5863L7.00878 10.676C6.37117 11.6355 6 12.7853 6 14.0214C6 17.3779 8.73705 20.0988 12.1133 20.0988Z"
            fill="url(#paint1_radial_steth)"
            fillOpacity={0.5}
          />
          <path
            d="M12.1133 20.0988C15.4896 20.0988 18.2266 17.3779 18.2266 14.0214C18.2266 12.7334 17.8236 11.5389 17.136 10.5559L12.0724 13.5863L7.00878 10.676C6.37117 11.6355 6 12.7853 6 14.0214C6 17.3779 8.73705 20.0988 12.1133 20.0988Z"
            fill="url(#paint2_radial_steth)"
          />
          <path
            d="M12.1133 20.0988C15.4896 20.0988 18.2266 17.3779 18.2266 14.0214C18.2266 12.7334 17.8236 11.5389 17.136 10.5559L12.0724 13.5863L7.00878 10.676C6.37117 11.6355 6 12.7853 6 14.0214C6 17.3779 8.73705 20.0988 12.1133 20.0988Z"
            fill="url(#paint3_radial_steth)"
          />
          <path
            d="M7.80823 9.58388L12.1134 12.0448V3L7.80823 9.58388Z"
            fill="url(#paint4_radial_steth)"
          />
          <path
            d="M7.80823 9.58388L12.1134 12.0448V3L7.80823 9.58388Z"
            fill="url(#paint5_radial_steth)"
          />
          <path
            d="M16.4113 9.58388L12.1133 12.0448V3L16.4113 9.58388Z"
            fill="url(#paint6_radial_steth)"
          />
          <path
            d="M16.4113 9.58388L12.1133 12.0448V3L16.4113 9.58388Z"
            fill="url(#paint7_radial_steth)"
          />
          <path
            d="M16.4113 9.58388L12.1133 12.0448V3L16.4113 9.58388Z"
            fill="url(#paint8_linear_steth)"
            fillOpacity={0.6}
          />
          <path
            d="M17.136 10.5547L12.1133 13.5791V20.0703L17.136 10.5547Z"
            fill="url(#paint9_radial_steth)"
          />
          <path
            d="M17.136 10.5547L12.1133 13.5791V20.0703L17.136 10.5547Z"
            fill="url(#paint10_radial_steth)"
          />
          <path
            d="M17.136 10.5547L12.1133 13.5791V20.0703L17.136 10.5547Z"
            fill="url(#paint11_radial_steth)"
          />
          <path
            d="M7.00458 10.6688L12.1133 13.5792V20.0703L7.00458 10.6688Z"
            fill="url(#paint12_radial_steth)"
          />
          <path
            d="M7.00458 10.6688L12.1133 13.5792V20.0703L7.00458 10.6688Z"
            fill="url(#paint13_radial_steth)"
          />
          <path
            d="M7.00458 10.6688L12.1133 13.5792V20.0703L7.00458 10.6688Z"
            fill="url(#paint14_radial_steth)"
          />
          <defs>
            <radialGradient
              id="paint0_radial_steth"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(16.652 18.304) rotate(-145.131) scale(11.1222 14.8749)"
            >
              <stop stopColor="#8AFBED" stopOpacity={0} />
              <stop
                offset="0.671495"
                stopColor="#00A3FF"
                stopOpacity="0.45726"
              />
              <stop offset="1" stopColor="#198CF6" />
            </radialGradient>
            <radialGradient
              id="paint1_radial_steth"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(10.6052 9.82193) rotate(52.8106) scale(10.7077 8.71134)"
            >
              <stop stopColor="#35C2FF" />
              <stop offset="1" stopColor="#00A3FF" stopOpacity={0} />
            </radialGradient>
            <radialGradient
              id="paint2_radial_steth"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(6.32177 10.2854) rotate(59.2776) scale(4.67852 5.99421)"
            >
              <stop stopColor="#3B52FC" />
              <stop offset="1" stopColor="#3B52FC" stopOpacity={0} />
            </radialGradient>
            <radialGradient
              id="paint3_radial_steth"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(17.4452 9.15926) rotate(90.1891) scale(6.96366 8.92198)"
            >
              <stop stopColor="#2A6BFF" />
              <stop offset="1" stopColor="#2A6BFF" stopOpacity={0} />
            </radialGradient>
            <radialGradient
              id="paint4_radial_steth"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(12.1036 7.50979) rotate(157.682) scale(5.29014 13.2775)"
            >
              <stop stopColor="#00A3FF" />
              <stop offset="0.943718" stopColor="#00A3FF" stopOpacity="0.29" />
            </radialGradient>
            <radialGradient
              id="paint5_radial_steth"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(10.2058 4.0342) rotate(78.8158) scale(6.16138 11.3981)"
            >
              <stop stopColor="#FF7272" />
              <stop offset="0.179674" stopColor="#FF72A7" />
              <stop offset="1" stopColor="#7A51FF" stopOpacity={0} />
            </radialGradient>
            <radialGradient
              id="paint6_radial_steth"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(11.6307 3.32175) rotate(84.1933) scale(14.9925 6.17453)"
            >
              <stop stopColor="#FFBFAB" />
              <stop offset="0.364808" stopColor="#FF67A8" stopOpacity="0.87" />
              <stop offset="0.723967" stopColor="#6BAFFF" stopOpacity={0} />
            </radialGradient>
            <radialGradient
              id="paint7_radial_steth"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(12.1133 10.6302) rotate(-50.3051) scale(4.56984 6.93073)"
            >
              <stop stopColor="#2238FF" />
              <stop offset="1" stopColor="#0047FF" stopOpacity={0} />
            </radialGradient>
            <linearGradient
              id="paint8_linear_steth"
              x1="16.434"
              y1="10.9519"
              x2="13.6072"
              y2="9.66489"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#29EDFE" />
              <stop offset="1" stopColor="#29EDFE" stopOpacity={0} />
            </linearGradient>
            <radialGradient
              id="paint9_radial_steth"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(12.123 18.882) rotate(-65.2378) scale(6.00162 13.5119)"
            >
              <stop stopColor="#4DEAFF" />
              <stop offset="0.943718" stopColor="#00A3FF" stopOpacity="0.1" />
            </radialGradient>
            <radialGradient
              id="paint10_radial_steth"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(11.375 14.6597) rotate(9.61547) scale(5.45744 5.22275)"
            >
              <stop stopColor="#35AAFF" />
              <stop offset="0.0001" stopColor="#0057FF" />
              <stop offset="1" stopColor="#00A3FF" stopOpacity={0} />
            </radialGradient>
            <radialGradient
              id="paint11_radial_steth"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(17.1235 10.2854) rotate(125.701) scale(5.63183 2.97268)"
            >
              <stop stopColor="#2241FF" />
              <stop offset="1" stopColor="#1EA0FF" stopOpacity={0} />
            </radialGradient>
            <radialGradient
              id="paint12_radial_steth"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(12.1036 18.8962) rotate(-115.402) scale(5.96068 13.6719)"
            >
              <stop stopColor="#64E3FF" />
              <stop offset="1" stopColor="#00A3FF" stopOpacity="0.29" />
            </radialGradient>
            <radialGradient
              id="paint13_radial_steth"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(7.47093 12.4458) rotate(50.7041) scale(5.79848 5.62143)"
            >
              <stop stopColor="#3687FF" />
              <stop offset="1" stopColor="#354BFF" stopOpacity={0} />
            </radialGradient>
            <radialGradient
              id="paint14_radial_steth"
              cx="0"
              cy="0"
              r="1"
              gradientUnits="userSpaceOnUse"
              gradientTransform="translate(7.01125 10.9519) rotate(46.273) scale(3.65737 1.98742)"
            >
              <stop stopColor="#1858FF" />
              <stop offset="1" stopColor="#3A70FF" stopOpacity={0} />
            </radialGradient>
          </defs>
        </svg>
      }
      {...restProps}
    />
  );
};

export default StETH;
