import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search } from 'lucide-react'
import { lessons } from '../data/lessons'
import styles from './GlossaryPage.module.css'

interface TermEntry {
  term: string
  definition: string
  lessonTitle: string
  lessonId: string
  emoji: string
}

export default function GlossaryPage() {
  const [query, setQuery] = useState('')

  const allTerms = useMemo((): TermEntry[] => {
    const terms: TermEntry[] = []
    for (const lesson of lessons) {
      if (lesson.keyTerms) {
        for (const kt of lesson.keyTerms) {
          terms.push({
            term: kt.term,
            definition: kt.definition,
            lessonTitle: lesson.title,
            lessonId: lesson.id,
            emoji: lesson.emoji,
          })
        }
      }
    }
    return terms.sort((a, b) => a.term.localeCompare(b.term))
  }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return allTerms
    const q = query.toLowerCase()
    return allTerms.filter(
      t => t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)
    )
  }, [allTerms, query])

  // Group by first letter
  const grouped = useMemo(() => {
    const map: Record<string, TermEntry[]> = {}
    for (const entry of filtered) {
      const letter = entry.term[0].toUpperCase()
      if (!map[letter]) map[letter] = []
      map[letter].push(entry)
    }
    return map
  }, [filtered])

  const letters = Object.keys(grouped).sort()

  return (
    <div className={styles.page}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className={styles.title}>📖 Glossary</h1>
        <p className={styles.subtitle}>
          Every key term used across all {lessons.length} Rycorn lessons — searchable, alphabetically sorted.
        </p>

        <div className={styles.searchBar}>
          <Search size={16} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search terms or definitions…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <span className={styles.resultCount}>{filtered.length} results</span>
          )}
        </div>

        {letters.length === 0 && (
          <div className={styles.empty}>No terms found for "{query}"</div>
        )}

        {letters.map(letter => (
          <motion.div
            key={letter}
            className={styles.group}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className={styles.letterHeading}>{letter}</div>
            <div className={styles.termList}>
              {grouped[letter].map(entry => (
                <div key={`${entry.term}-${entry.lessonId}`} className={styles.termCard}>
                  <div className={styles.termHeader}>
                    <code className={styles.term}>{entry.term}</code>
                    <a href={`/lesson/${entry.lessonId}`} className={styles.source}>
                      {entry.emoji} {entry.lessonTitle}
                    </a>
                  </div>
                  <p className={styles.definition}>{entry.definition}</p>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}
