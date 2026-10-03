import { Clock, Zap } from 'lucide-react'
import { lessons, categories, type Category, type Difficulty } from '../data/lessons'
import type { Route } from '../App'
import styles from './HomePage.module.css'

const categoryOrder: Category[] = ['overview', 'domain', 'engine', 'server', 'client', 'ds', 'data', 'architecture']

interface Props { navigate: (r: Route) => void }

export default function HomePage({ navigate }: Props) {
  return (
    <div className={`${styles.page} fade-up`}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroEmoji}>⚓</div>
        <h1 className={styles.heroTitle}>Rycorn System Guide</h1>
        <p className={styles.heroSubtitle}>
          Learn every layer of this maritime simulation — from domain model to
          deployment, routing to architecture principles.
        </p>
        <div className={styles.heroMeta}>
          <span className="badge badge-blue"><Zap size={10} /> {lessons.length} Lessons</span>
          <span className="badge badge-green">Beginner → Advanced</span>
          <span className="badge badge-amber">TypeScript · Node.js · React</span>
        </div>
      </div>

      {/* System boundary quick-ref */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>System at a Glance</h2>
        <div className={styles.systemCards}>
          {[
            { icon: '📦', name: 'DS_System', color: '#14b8a6', desc: 'Demand & Supply contracts, cargo lifecycle, vessel supply' },
            { icon: '⚙️', name: 'packages/engine', color: '#6366f1', desc: 'Network, routing, movement, discrete-event simulation' },
            { icon: '🖥️', name: 'packages/server', color: '#f59e0b', desc: 'Fastify API, WebSocket streaming, operational reports' },
            { icon: '🗃️', name: 'packages/client', color: '#ec4899', desc: 'React maritime operations UI, fleet map, DS console' },
          ].map(item => (
            <div
              key={item.name}
              className={styles.systemCard}
              style={{ '--card-color': item.color } as React.CSSProperties}
            >
              <div className={styles.systemCardIcon}>{item.icon}</div>
              <code className={styles.systemCardName}>{item.name}</code>
              <p className={styles.systemCardDesc}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Lessons by category */}
      {categoryOrder.map(cat => {
        const catLessons = lessons.filter(l => l.category === cat)
        if (catLessons.length === 0) return null
        const meta = categories[cat]
        return (
          <div key={cat} className={styles.section}>
            <div className={styles.catHeader}>
              <span className={styles.catDot} style={{ background: meta.color }} />
              <h2 className={styles.sectionTitle} style={{ color: meta.color, marginBottom: 0 }}>{meta.label}</h2>
              <span className={styles.catDesc}>{meta.description}</span>
            </div>
            <div className={styles.lessonGrid}>
              {catLessons.map(lesson => (
                <button
                  key={lesson.id}
                  className={styles.lessonCard}
                  onClick={() => navigate({ page: 'lesson', id: lesson.id })}
                >
                  <div className={styles.cardTop}>
                    <span className={styles.cardEmoji}>{lesson.emoji}</span>
                    <span className={`badge badge-${diffColor(lesson.difficulty)}`}>
                      {lesson.difficulty}
                    </span>
                  </div>
                  <h3 className={styles.cardTitle}>{lesson.title}</h3>
                  <p className={styles.cardSubtitle}>{lesson.subtitle}</p>
                  <div className={styles.cardMeta}>
                    <Clock size={11} />
                    <span>{lesson.readTime} min read</span>
                    {lesson.quiz && <span className={styles.quizBadge}>Quiz</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function diffColor(d: Difficulty) {
  if (d === 'beginner') return 'green'
  if (d === 'intermediate') return 'amber'
  return 'pink'
}
