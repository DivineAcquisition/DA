'use client';

import { Field as FieldPrimitive } from '@base-ui/react/field';
import type React from 'react';
import { cn } from '@/lib/utils';

export function Field({
  className,
  ...props
}: FieldPrimitive.Root.Props): React.ReactElement {
  return (
    <FieldPrimitive.Root
      className={cn('flex w-full flex-col items-stretch gap-0', className)}
      data-slot="field"
      {...props}
    />
  );
}

export function FieldLabel({
  className,
  ...props
}: FieldPrimitive.Label.Props): React.ReactElement {
  return (
    <FieldPrimitive.Label
      className={cn(
        'mb-1.5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 data-disabled:opacity-50',
        className,
      )}
      data-slot="field-label"
      {...props}
    />
  );
}

export function FieldItem({
  className,
  ...props
}: FieldPrimitive.Item.Props): React.ReactElement {
  return <FieldPrimitive.Item className={cn('flex', className)} data-slot="field-item" {...props} />;
}

export function FieldDescription({
  className,
  ...props
}: FieldPrimitive.Description.Props): React.ReactElement {
  return (
    <FieldPrimitive.Description
      className={cn('mt-1 block text-xs text-neutral-500', className)}
      data-slot="field-description"
      {...props}
    />
  );
}

export function FieldError({
  className,
  ...props
}: FieldPrimitive.Error.Props): React.ReactElement {
  return (
    <FieldPrimitive.Error
      className={cn('mt-1 block text-xs text-flag-critical', className)}
      data-slot="field-error"
      {...props}
    />
  );
}

export const FieldControl: typeof FieldPrimitive.Control = FieldPrimitive.Control;
export const FieldValidity: typeof FieldPrimitive.Validity = FieldPrimitive.Validity;

export { FieldPrimitive };
