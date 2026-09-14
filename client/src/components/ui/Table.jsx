import { t, tData } from '@/i18n/index.jsx';

export const Table = ({
  columns,
  rows,
  footer,
  empty = 'কোনো রেকর্ড নেই',
  rowKey = (r, i) => r.id ?? i,
  // Narrow tables (few columns, sidebar cards) should not force a 720px scroll.
  minWidth = columns.length > 4 ? 720 : 0,
}) => (
  <div className="table-wrap">
    <table className="table" style={{ minWidth: minWidth ? `${minWidth}px` : undefined }}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} className={col.align === 'right' ? 'text-right' : undefined}>
              {t(col.header)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="py-12 text-center text-slate-500">
              {t(empty)}
            </td>
          </tr>
        ) : (
          rows.map((row, index) => (
            <tr key={rowKey(row, index)}>
              {columns.map((col) => (
                <td key={col.key} className={col.align === 'right' ? 'text-right' : undefined}>
                  {/* `label` cells hold server-built names like "সপ্তাহ ১". */}
                  {col.render ? col.render(row, index) : col.key === 'label' ? tData(row[col.key]) : row[col.key]}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
      {footer && (
        <tfoot>
          <tr>
            {columns.map((col) => (
              <td key={col.key} className={col.align === 'right' ? 'text-right' : undefined}>
                {tData(t(footer[col.key] ?? ''))}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  </div>
);
