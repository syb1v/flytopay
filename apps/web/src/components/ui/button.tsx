import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import type { ComponentProps } from "react";

const variants = cva("ui-button", {
  variants: { variant: { default: "ui-button-primary", secondary: "ui-button-secondary", ghost: "ui-button-ghost" } },
  defaultVariants: { variant: "default" },
});

export function Button({
  asChild = false,
  variant,
  className,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof variants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "button";
  return <Component className={clsx(variants({ variant }), className)} {...props} />;
}
