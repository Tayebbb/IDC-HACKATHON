/**
 * SectionHeader — eyebrow + title + subtitle + optional trailing actions.
 *
 *   <SectionHeader
 *     eyebrow="Insights"
 *     title="Your skill gap"
 *     subtitle="Where to focus this week"
 *     actions={<Button>Refresh</Button>}
 *   />
 */
export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  actions,
  align = 'left',
  className = '',
}) {
  const isCenter = align === 'center';
  return (
    <div
      className={[
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6',
        isCenter ? 'sm:flex-col sm:items-center text-center' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={isCenter ? 'mx-auto max-w-2xl' : 'max-w-3xl'}>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <div className="flex items-center gap-3">
          {Icon && (
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15 text-primary-light ring-1 ring-primary/30">
              <Icon size={20} />
            </span>
          )}
          {title && <h2 className="section-title">{title}</h2>}
        </div>
        {subtitle && <p className="section-subtitle mt-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
