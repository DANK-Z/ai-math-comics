// Printable sheets (a chapter, a drill, a parent-meeting report) opened in a new window and
// sent to the browser's print dialog, where the teacher can also «Save as PDF».
// Everything is built with DOM calls and textContent: student names and teacher text are data.

export type PrintBlock =
  | { kind: 'h1' | 'h2' | 'p' | 'small'; text: string }
  | { kind: 'ol'; items: string[]; lines?: boolean }
  | { kind: 'panels'; items: { image?: string; caption: string }[] }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'break' }

const STYLE = `
body{font-family:system-ui,'Segoe UI',sans-serif;color:#1d2766;margin:0;padding:24px;font-size:14px}
h1{font-size:22px;margin:0 0 6px}h2{font-size:16px;margin:18px 0 6px}
p{margin:4px 0;line-height:1.45}.small{font-size:12px;color:#555}
ol{padding-left:22px}li{margin:8px 0;line-height:1.4}li.line::after{content:'';display:block;border-bottom:1px solid #999;height:22px}
.panels{display:grid;grid-template-columns:1fr 1fr;gap:10px}.panel{border:2px solid #1d2766;border-radius:10px;overflow:hidden;break-inside:avoid}
.panel img{width:100%;display:block}.panel p{padding:6px 8px;font-size:13px}
table{border-collapse:collapse;width:100%;margin-top:6px}th,td{border:1px solid #999;padding:5px 7px;text-align:left;font-size:13px}th{background:#eef4ff}
.break{break-after:page}
@media print{body{padding:0}}`

export function printSheet(title: string, blocks: PrintBlock[]) {
  const win = window.open('', '_blank', 'width=860,height=960')
  if (!win) return false
  const doc = win.document
  doc.title = title
  const style = doc.createElement('style')
  style.textContent = STYLE
  doc.head.append(style)
  const el = (tag: string, text?: string, cls?: string) => {
    const node = doc.createElement(tag)
    if (text != null) node.textContent = text
    if (cls) node.className = cls
    return node
  }
  for (const b of blocks) {
    if (b.kind === 'h1' || b.kind === 'h2' || b.kind === 'p') doc.body.append(el(b.kind, b.text))
    else if (b.kind === 'small') doc.body.append(el('p', b.text, 'small'))
    else if (b.kind === 'break') doc.body.append(el('div', undefined, 'break'))
    else if (b.kind === 'ol') {
      const ol = el('ol')
      for (const item of b.items) ol.append(el('li', item, b.lines ? 'line' : undefined))
      doc.body.append(ol)
    } else if (b.kind === 'panels') {
      const grid = el('div', undefined, 'panels')
      for (const item of b.items) {
        const cell = el('div', undefined, 'panel')
        if (item.image) {
          const img = doc.createElement('img')
          img.src = new URL(item.image, window.location.href).href
          img.alt = ''
          cell.append(img)
        }
        cell.append(el('p', item.caption))
        grid.append(cell)
      }
      doc.body.append(grid)
    } else if (b.kind === 'table') {
      const table = el('table')
      const head = el('tr')
      for (const h of b.head) head.append(el('th', h))
      table.append(head)
      for (const row of b.rows) {
        const tr = el('tr')
        for (const cell of row) tr.append(el('td', cell))
        table.append(tr)
      }
      doc.body.append(table)
    }
  }
  // Wait for the panel pictures before opening the print dialog.
  const images = [...doc.images]
  Promise.all(images.map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r })))).then(() => win.print())
  return true
}
