"use client";

import type { ButtonHTMLAttributes } from "react";

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50";
  const variants = {
    primary: "bg-[var(--accent)] text-white hover:opacity-90",
    secondary:
      "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button
      type="button"
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
