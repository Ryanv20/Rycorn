import { useState } from 'react'
import { BookOpen, Home, Map, FileText, ChevronDown, ChevronRight } from 'lucide-react'
import { lessons, categories, type Category } from '../data/lessons'
import type { Route } from '../App'
import styles from './Sidebar.module.css'

const categoryOrder: Category[] = ['overview', 'domain', 'engine', 'server', 'client', 'ds', 'data', 'architecture']

interface Props {
  route: Route
  navigate: (r: Route) => void
}

export default function Sidebar({ route, navigate }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggle = (cat: string) =>
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }))

  const isActive = (r: Route): boolean => {
    if (r.page === 'lesson' && route.page === 'lesson') return r.id === route.id
    return r.page === route.page
  }

  return (
    <nav className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <span className={styles.logoIcon}>⚓</span>
        <div>
          <div className={styles.logoTitle}>LearnersD</div>
          <div className={styles.logoSub}>Rycorn System Guide</div>
        </div>
      </div>

      {/* Top nav */}
      <div className={styles.topNav}>
        <NavBtn active={isActive({ page: 'home' })} onClick={() => navigate({ page: 'home' })}>
          <Home size={15} /> Home
        </NavBtn>
        <NavBtn active={isActive({ page: 'diagram' })} onClick={() => navigate({ page: 'diagram' })}>
          <Map size={15} /> System Diagram
        </NavBtn>
        <NavBtn active={isActive({ page: 'glossary' })} onClick={() => navigate({ page: 'glossary' })}>
          <FileText size={15} /> Glossary
        </NavBtn>
      </div>

      <div className={styles.divider} />
      <div className={styles.sectionLabel}>Lessons</div>

      <div className={styles.lessonList}>
        {categoryOrder.map(cat => {
          const catLessons = lessons.filter(l => l.category === cat)
          if (catLessons.length === 0) return null
          const meta = categories[cat]
          const isOpen = collapsed[cat] !== true

          return (
            <div key={cat}>
              <button
                className={styles.categoryHeader}
                onClick={() => toggle(cat)}
              >
                <span className={styles.catDot} style={{ background: meta.color }} />
                <span className={styles.catLabel}>{meta.label}</span>
                <span className={styles.catChevron}>
                  {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
              </button>

              {isOpen && (
                <div className={styles.catItems}>
                  {catLessons.map(lesson => {
                    const active = isActive({ page: 'lesson', id: lesson.id })
                    return (
                      <button
                        key={lesson.id}
                        className={`${styles.lessonLink} ${active ? styles.lessonActive : ''}`}
                        onClick={() => navigate({ page: 'lesson', id: lesson.id })}
                      >
                        <span className={styles.lessonEmoji}>{lesson.emoji}</span>
                        <span className={styles.lessonTitle}>{lesson.title}</span>
                        <span className={`badge badge-${diffBadge(lesson.difficulty)} ${styles.diffBadge}`}>
                          {lesson.difficulty[0].toUpperCase()}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className={styles.footer}>
        <BookOpen size={12} />
        <span>{lessons.length} lessons · Rycorn v1</span>
      </div>
    </nav>
  )
}

function NavBtn({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      className={`${styles.navItem} ${active ? styles.navActive : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function diffBadge(d: string) {
  if (d === 'beginner') return 'green'
  if (d === 'intermediate') return 'amber'
  return 'pink'
}
