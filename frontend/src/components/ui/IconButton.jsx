import { forwardRef } from 'react';
import { motion } from 'framer-motion';

/**
 * IconButton — square/round icon-only button. Accessible label required.
 */
const IconButton = forwardRef(function IconButton(
  {
    icon: Icon,
    label,
    onClick,
    disabled = false,
    active = false,
    size = 'md',
    className = '',
    type = 'button',
    ...rest
  },
  ref,
) {
  const sizeClass = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-10 h-10';
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 22 : 18;
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={{ scale: disabled ? 1 : 0.92 }}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={[
        'btn-icon',
        sizeClass,
        active ? '!text-primary-light !border-primary/50 !bg-primary/15' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {Icon && <Icon size={iconSize} />}
    </motion.button>
  );
});

export default IconButton;
