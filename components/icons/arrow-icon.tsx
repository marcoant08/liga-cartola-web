import type { SVGProps } from "react";

export type ArrowIconDirection = "left" | "right" | "up" | "down";

const ROTATION_CLASS: Record<ArrowIconDirection, string> = {
  right: "rotate-0",
  down: "rotate-90",
  left: "rotate-180",
  up: "-rotate-90",
};

type Props = Omit<SVGProps<SVGSVGElement>, "viewBox" | "xmlns"> & {
  direction?: ArrowIconDirection;
};

/** Seta base apontando para a direita; use `direction` para orientar. */
export function ArrowIcon({
  direction = "right",
  className = "",
  width = 32,
  height = 32,
  fill = "currentColor",
  ...rest
}: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      fill={fill}
      viewBox="0 0 256 256"
      className={`shrink-0 ${ROTATION_CLASS[direction]} ${className}`.trim()}
      aria-hidden
      {...rest}
    >
      <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" />
    </svg>
  );
}
