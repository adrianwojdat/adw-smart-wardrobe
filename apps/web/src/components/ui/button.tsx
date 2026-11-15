import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const variants = cva('button btn h-11 min-h-11 px-[18px] text-[13px] font-[550]', {
  variants: {
    variant: {
      default: 'btn-primary button-primary',
      outline:
        'btn-outline button-outline border-[#dce0d7] bg-white text-[#37463a] hover:bg-[#f2f4ee]',
      ghost: 'btn-ghost button-ghost text-[#6d756c] hover:bg-[#ecede7]',
      destructive: 'btn-error button-danger',
    },
    size: {
      default: '',
      sm: 'btn-sm button-sm h-9 min-h-9 px-3 text-xs',
      icon: 'btn-sm btn-square button-icon h-10 min-h-10 w-10 p-2',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof variants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';

  return <Comp className={twMerge(clsx(variants({ variant, size }), className))} {...props} />;
}
