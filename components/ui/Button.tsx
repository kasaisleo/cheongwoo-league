import { clsx } from "clsx";
import type { ButtonHTMLAttributes, CSSProperties } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--action-primary-bg)] text-[color:var(--action-primary-text)] hover:bg-[color:var(--action-primary-hover)] active:bg-[color:color-mix(in_srgb,var(--action-primary-bg)_85%,black)]",
  secondary:
    "bg-[color:var(--action-secondary-bg)] text-[color:var(--action-secondary-text)] border border-[color:var(--action-secondary-border)] hover:bg-[color:color-mix(in_srgb,var(--action-secondary-bg)_90%,white)] active:bg-[color:var(--action-secondary-bg)]",
  ghost:
    "bg-transparent text-[color:var(--action-ghost-text)] hover:bg-[color:var(--action-secondary-bg)] active:bg-[color:color-mix(in_srgb,var(--action-secondary-bg)_85%,white)]",
  danger:
    "bg-[color:var(--action-danger-bg)] text-[color:var(--action-danger-text)] hover:bg-[color:color-mix(in_srgb,var(--action-danger-bg)_85%,black)]",
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
        "inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--action-focus-ring)]",
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
