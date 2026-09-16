/**
 * A vertical system diagram. The connecting line fills as the section
 * scrolls past (data-hm-fill → --fill) and the stage nearest the viewport
 * centre lights up (data-hm-focus); hovering or focusing a stage does the same.
 */
export type FlowItem = { name: string; detail: string; tools?: string[] };

export default function ArchitectureFlow({
  items,
  label,
}: {
  items: FlowItem[];
  label: string;
}) {
  return (
    <div className="af" data-hm-fill>
      <span className="af-rail" aria-hidden>
        <span />
      </span>
      <ol className="af-list" aria-label={label} data-hm-stagger>
        {items.map((item, i) => (
          <li key={item.name} className="af-stage" data-hm="up" data-hm-focus tabIndex={0}>
            <span className="af-node" aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="af-card">
              <h3>{item.name}</h3>
              <p>{item.detail}</p>
              {item.tools && item.tools.length > 0 && (
                <ul className="ip-chips">
                  {item.tools.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
