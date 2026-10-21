import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { playSfx, type SfxName } from '../../audio/sfx';
import { Icon, type IconName } from '../icons/Icon';
import './ui.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'blue' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  icon?: IconName;
  sfx?: SfxName | null;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

/** Chunky plate button: press-in on pointer down, spring release, tick sound. Never delays the click. */
export function Button({ variant = 'secondary', size = 'md', block, icon, sfx = 'tap', className = '', onClick, children, type = 'button', ...rest }: ButtonProps) {
  const classes = ['btn', variant !== 'secondary' && `btn--${variant}`, size !== 'md' && `btn--${size}`, block && 'btn--block', className]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type={type}
      className={classes}
      onClick={(e) => {
        if (sfx) playSfx(sfx);
        onClick?.(e);
      }}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 24 : 20} />}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  sfx?: SfxName | null;
}

export function IconButton({ icon, label, sfx = 'tap', className = '', onClick, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={`icon-btn ${className}`}
      aria-label={label}
      title={label}
      onClick={(e) => {
        if (sfx) playSfx(sfx);
        onClick?.(e);
      }}
      {...rest}
    >
      <Icon name={icon} size={22} />
    </button>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        playSfx(checked ? 'thud' : 'pop');
        onChange(!checked);
      }}
    />
  );
}
