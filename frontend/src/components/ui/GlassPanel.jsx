import { forwardRef } from 'react';

/**
 * GlassPanel — larger surface with no built-in padding, for compositions
 * that hold their own internal sections (e.g. dialogs, sidebars, hero blocks).
 */
const GlassPanel = forwardRef(function GlassPanel(
  { children, className = '', as: As = 'section', ...rest },
  ref,
) {
  return (
    <As ref={ref} className={`glass-panel ${className}`} {...rest}>
      {children}
    </As>
  );
});

export default GlassPanel;
