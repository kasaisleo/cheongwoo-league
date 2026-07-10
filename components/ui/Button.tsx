import { clsx } from "clsx";
import type { ButtonHTMLAttributes, CSSProperties } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-clay-400 text-line-25 hover:bg-clay-300 active:bg-clay-500",
  secondary: "bg-line-200 text-line-800 hover:bg-line-300 active:bg-line-200 border border-line-300",
  ghost: "bg-transparent text-line-800 hover:bg-line-200 active:bg-line-300",
  danger: "bg-fault-400 text-line-25 hover:bg-fault-500",
};

const sizeClasses: Record<ButtonSize, string> = {
  md: "h-11 px-4 text-sm",
  lg: "h-14 px-6 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  disabled,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      style={{
        borderRadius: "var(--admin-button-radius, var(--club-button-radius, 8px))",
        ...(style as CSSProperties),
      }}
      disabled={disabled}
      {...props}
    />
  );
}
