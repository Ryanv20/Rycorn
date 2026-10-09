import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { CodeExample } from '../data/lessons'
import styles from './CodeBlock.module.css'

interface Props {
  example: CodeExample
}

export default function CodeBlock({ example }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(example.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  // Simple syntax highlighting via CSS classes
  const highlighted = highlight(example.code, example.language)

  return (
    <div className={styles.block}>
      <div className={styles.header}>
        <div className={styles.dots}>
          <span className={styles.dot} style={{ background: '#ff5f57' }} />
          <span className={styles.dot} style={{ background: '#ffbd2e' }} />
          <span className={styles.dot} style={{ background: '#28ca41' }} />
        </div>
        <span className={styles.filename}>{example.filename}</span>
        <button className={styles.copyBtn} onClick={handleCopy} title="Copy code">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        className={styles.code}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
      {example.note && (
        <div className={styles.note}>💡 {example.note}</div>
      )}
    </div>
  )
}

// ── Basic syntax highlighter ──────────────────────────────────
// (lightweight — avoids a heavy dep for simple TypeScript highlighting)
function highlight(code: string, _lang: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  let result = esc(code)

  // Comments
  result = result.replace(/(\/\/[^\n]*)/g, '<span class="hl-comment">$1</span>')
  // Strings
  result = result.replace(/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g, '<span class="hl-string">$1</span>')
  // Numbers
  result = result.replace(/\b(\d+\.?\d*)\b/g, '<span class="hl-number">$1</span>')
  // Keywords
  const kw = ['const', 'let', 'var', 'function', 'class', 'interface', 'type', 'export', 'import',
    'from', 'return', 'if', 'else', 'for', 'while', 'new', 'extends', 'implements', 'readonly',
    'async', 'await', 'void', 'boolean', 'string', 'number', 'null', 'undefined', 'true', 'false',
    'static', 'private', 'public', 'protected', 'abstract', 'enum', 'namespace', 'declare',
    'break', 'continue', 'switch', 'case', 'default', 'throw', 'try', 'catch', 'finally',
    'of', 'in', 'instanceof', 'typeof']
  kw.forEach(k => {
    result = result.replace(
      new RegExp(`(?<![\\w])${k}(?![\\w])`, 'g'),
      `<span class="hl-keyword">${k}</span>`
    )
  })
  // Type names (PascalCase)
  result = result.replace(/\b([A-Z][A-Za-z0-9]+)\b/g, '<span class="hl-type">$1</span>')

  return result
}
