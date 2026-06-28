import { Children, createContext, useContext, useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const TabsCtx = createContext(null);

/**
 * Tabs — headless-ish tabs with shared state.
 *
 *   <Tabs value={tab} onChange={setTab}>
 *     <TabList>
 *       <Tab value="a" icon={X}>Setup</Tab>
 *       <Tab value="b">Interview</Tab>
 *     </TabList>
 *     <TabPanel value="a">…</TabPanel>
 *     <TabPanel value="b">…</TabPanel>
 *   </Tabs>
 */
export default function Tabs({ value, onChange, defaultValue, children, className = '' }) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue);
  const current = isControlled ? value : internal;
  const setCurrent = (v) => {
    if (!isControlled) setInternal(v);
    onChange?.(v);
  };

  // Default to first available tab value if nothing chosen
  useEffect(() => {
    if (current !== undefined) return;
    let firstValue;
    Children.forEach(children, (node) => {
      if (firstValue !== undefined) return;
      if (node?.type?.displayName === 'TabList') {
        Children.forEach(node.props.children, (t) => {
          if (firstValue === undefined && t?.props?.value !== undefined) {
            firstValue = t.props.value;
          }
        });
      }
    });
    if (firstValue !== undefined) setCurrent(firstValue);
  }, []);

  const ctx = useMemo(() => ({ value: current, setValue: setCurrent }), [current]);

  return (
    <TabsCtx.Provider value={ctx}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  );
}

export function TabList({ children, className = '', fullWidth = false }) {
  return (
    <div
      role="tablist"
      className={[
        'inline-flex p-1 rounded-2xl gap-1 glass-surface',
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
TabList.displayName = 'TabList';

export function Tab({ value, children, icon: Icon, disabled = false }) {
  const ctx = useContext(TabsCtx);
  if (!ctx) return null;
  const active = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={() => ctx.setValue(value)}
      className="tab-trigger flex-1 sm:flex-none justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      data-active={active}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}
Tab.displayName = 'Tab';

export function TabPanel({ value, children, className = '' }) {
  const ctx = useContext(TabsCtx);
  if (!ctx || ctx.value !== value) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      role="tabpanel"
      className={className}
    >
      {children}
    </motion.div>
  );
}
TabPanel.displayName = 'TabPanel';
