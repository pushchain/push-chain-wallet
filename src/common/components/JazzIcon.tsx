import { useEffect, useRef } from "react";
import jazzicon from "@metamask/jazzicon";

type Props = {
  address: string;
  size?: number;
};

function getSeed(address: string) {
  if (!address) return 0;

  if (address.startsWith("0x")) {
    return parseInt(address.slice(2, 10), 16);
  }

  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }

  return Math.abs(hash);
}

export const Jazzicon = ({ address, size = 44 }: Props) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    ref.current.innerHTML = "";

    const icon = jazzicon(size, getSeed(address));
    ref.current.appendChild(icon);
  }, [address, size]);

  return (
    <div
      ref={ref}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        overflow: "hidden",
      }}
    />
  );
};