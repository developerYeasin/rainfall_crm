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
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="py-10 text-center text-slate-500">
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((row, index) => (
            <tr key={rowKey(row, index)}>
              {columns.map((col) => (
                <td key={col.key} className={col.align === 'right' ? 'text-right' : undefined}>
                  {col.render ? col.render(row, index) : row[col.key]}
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
                {footer[col.key] ?? ''}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  </div>
);
