import React, { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { cn, focusRing } from './cn';
import { Tooltip } from './Tooltip';

const VARIANTS = {
  primary: 'bg-accent text-white shadow-xs hover:bg-accent-hover',
  secondary: 'bg-surface text-ink border border-line shadow-xs hover:bg-subtle hover:border-line-strong',
  ghost: 'text-ink-secondary hover:bg-sunken hover:text-ink',
  danger: 'bg-danger text-white shadow-xs hover:bg-danger-hover',
  'danger-soft': 'bg-danger-soft text-danger-fg border border-danger-line hover:bg-danger-muted',
  success: 'bg-success text-white shadow-xs hover:bg-success-hover',
  'accent-soft': 'bg-accent-soft text-accent-fg hover:bg-accent-muted',
  link: 'h-auto px-0 text-accent hover:text-accent-hover hover:underline underline-offset-4',
};
// Older names still used around the app
VARIANTS.outline = VARIANTS.secondary;

const SIZES = {
  sm: 'h-8 px-3 text-caption gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
  xl: 'h-14 px-6 text-base gap-2',
};
const ICON_SIZES = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-4 h-4', xl: 'w-5 h-5' };

const BASE =
  'relative inline-flex items-center justify-center rounded-lg font-medium whitespace-nowrap select-none ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-fast ease-out active:scale-[0.98] ' +
  'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';

export function Spinner({ className }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin', className)}
    />
  );
}

/**
 * The app's button. Renders a <Link> with `to`, an <a> with `href`, otherwise a <button type="button">.
 *   <Button icon={Plus}>Add product</Button>
 *   <Button variant="secondary" loading={saving} type="submit">Save</Button>
 */
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', icon: Icon, iconRight: IconRight, loading = false, fullWidth = false,
    to, href, type = 'button', disabled, className, children, ...props },
  ref
) {
  const cls = cn(BASE, focusRing, SIZES[size] || SIZES.md, VARIANTS[variant] || VARIANTS.primary, fullWidth && 'w-full', className);
  const iconCls = ICON_SIZES[size] || ICON_SIZES.md;
  const content = (
    <>
      {loading ? <Spinner className={iconCls} /> : Icon && <Icon className={cn(iconCls, 'flex-shrink-0')} aria-hidden="true" />}
      {children}
      {IconRight && !loading && <IconRight className={cn(iconCls, 'flex-shrink-0')} aria-hidden="true" />}
    </>
  );

  if (to) {
    return (
      <Link ref={ref} to={to} className={cls} aria-disabled={disabled || undefined} {...props}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a ref={ref} href={href} className={cls} {...props}>
        {content}
      </a>
    );
  }
  return (
    <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={cls} {...props}>
      {content}
    </button>
  );
});

export default Button;
export { Button };

const ICON_BUTTON_SIZES = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-11 w-11', xl: 'h-14 w-14' };

/**
 * Square button with just an icon. `label` is required: it becomes the accessible name and the tooltip.
 *   <IconButton icon={Pencil} label="Edit product" onClick={...} />
 */
export const IconButton = forwardRef(function IconButton(
  { icon: Icon, label, variant = 'ghost', size = 'sm', tooltip = true, tooltipSide = 'top', className, loading, ...props },
  ref
) {
  const button = (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      aria-label={label}
      loading={loading}
      className={cn(ICON_BUTTON_SIZES[size] || ICON_BUTTON_SIZES.sm, 'px-0', className)}
      {...props}
    >
      {!loading && Icon && <Icon className={ICON_SIZES[size] || ICON_SIZES.sm} aria-hidden="true" />}
    </Button>
  );
  return tooltip && label ? <Tooltip content={label} side={tooltipSide}>{button}</Tooltip> : button;
});

/**
 * An unstyled clickable surface with the shared focus ring and transitions.
 * Use for custom tiles, list rows and chips; use <Button> for everything that looks like a button.
 */
export const ButtonBase = forwardRef(function ButtonBase({ type = 'button', className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn('transition-[background-color,border-color,color,box-shadow,transform] duration-fast ease-out disabled:cursor-not-allowed', focusRing, className)}
      {...props}
    />
  );
});
