import { useState } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, BookOpen } from 'lucide-react'
import { lessons, categories, type Lesson, type QuizQuestion } from '../data/lessons'
import CodeBlock from '../components/CodeBlock'
import type { Route } from '../App'
import styles from './LessonPage.module.css'

interface Props { id: string; navigate: (r: Route) => void }

export default function LessonPage({ id, navigate }: Props) {
  const lesson = lessons.find(l => l.id === id)

  if (!lesson) {
    return (
      <div className={styles.notFound}>
        <p>Lesson not found.</p>
        <button className={styles.backBtn} onClick={() => navigate({ page: 'home' })}>← Back to home</button>
      </div>
    )
  }

  const idx = lessons.findIndex(l => l.id === id)
  const prev = idx > 0 ? lessons[idx - 1] : null
  const next = idx < lessons.length - 1 ? lessons[idx + 1] : null
  const cat = categories[lesson.category]

  return (
    <div className={`${styles.page} fade-up`} key={id}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backLink} onClick={() => navigate({ page: 'home' })}>
          <ChevronLeft size={15} /> All lessons
        </button>
        <div className={styles.headerMeta}>
          <span className="badge" style={{ borderColor: `${cat.color}44`, color: cat.color, background: `${cat.color}18` }}>
            {cat.label}
          </span>
          <span className={`badge badge-${diffBadge(lesson.difficulty)}`}>{lesson.difficulty}</span>
          <span className={styles.readTime}><Clock size={12} /> {lesson.readTime} min</span>
        </div>
      </div>

      {/* Title */}
      <div className={styles.titleBlock}>
        <span className={styles.emoji}>{lesson.emoji}</span>
        <div>
          <h1 className={styles.title}>{lesson.title}</h1>
          <p className={styles.subtitle}>{lesson.subtitle}</p>
        </div>
      </div>

      {/* Key terms bar */}
      {lesson.keyTerms && lesson.keyTerms.length > 0 && (
        <div className={styles.keyTermsBar}>
          <BookOpen size={13} />
          <span className={styles.keyTermsLabel}>Key terms:</span>
          {lesson.keyTerms.map(kt => (
            <span key={kt.term} className={styles.termPill} title={kt.definition}>
              {kt.term}
            </span>
          ))}
        </div>
      )}

      {/* Sections */}
      <div className={styles.sections}>
        {lesson.sections.map((section, si) => (
          <div key={section.id} className={styles.section} style={{ animationDelay: `${si * 0.05}s` }}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionNum}>{si + 1}</span>
              {section.title}
            </h2>
            <ContentRenderer content={section.content} />
            {(section as { content2?: string }).content2 && (
              <ContentRenderer content={(section as { content2?: string }).content2!} />
            )}
            {section.diagram && (
              <pre className={styles.diagram}>{section.diagram}</pre>
            )}
            {section.code?.map(ex => (
              <CodeBlock key={ex.filename} example={ex} />
            ))}
          </div>
        ))}
      </div>

      {/* Key Terms Glossary */}
      {lesson.keyTerms && lesson.keyTerms.length > 0 && (
        <div className={styles.glossaryBox}>
          <h3 className={styles.glossaryTitle}>📖 Key Terms</h3>
          <div className={styles.glossaryGrid}>
            {lesson.keyTerms.map(kt => (
              <div key={kt.term} className={styles.glossaryEntry}>
                <div className={styles.glossaryTerm}>{kt.term}</div>
                <div className={styles.glossaryDef}>{kt.definition}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quiz */}
      {lesson.quiz && lesson.quiz.length > 0 && (
        <Quiz questions={lesson.quiz} />
      )}

      {/* Navigation */}
      <div className={styles.nav}>
        {prev ? (
          <button className={styles.navBtn} onClick={() => navigate({ page: 'lesson', id: prev.id })}>
            <ChevronLeft size={16} />
            <div>
              <div className={styles.navBtnLabel}>Previous</div>
              <div className={styles.navBtnTitle}>{prev.emoji} {prev.title}</div>
            </div>
          </button>
        ) : <div />}
        {next ? (
          <button className={`${styles.navBtn} ${styles.navBtnNext}`} onClick={() => navigate({ page: 'lesson', id: next.id })}>
            <div>
              <div className={styles.navBtnLabel}>Next</div>
              <div className={styles.navBtnTitle}>{next.emoji} {next.title}</div>
            </div>
            <ChevronRight size={16} />
          </button>
        ) : <div />}
      </div>
    </div>
  )
}

// ── Content Renderer ──────────────────────────────────────────
function ContentRenderer({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={i} className={styles.blockquote}>
          <InlineText text={line.slice(2)} />
        </blockquote>
      )
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className={styles.h3}><InlineText text={line.slice(3)} /></h3>)
    } else if (line.startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <ul key={`ul-${i}`} className={styles.ul}>
          {items.map((item, j) => <li key={j}><InlineText text={item} /></li>)}
        </ul>
      )
      continue
    } else if (line.trim() === '') {
      // skip blank
    } else {
      elements.push(<p key={i} className={styles.para}><InlineText text={line} /></p>)
    }
    i++
  }
  return <>{elements}</>
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
        if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

// ── Quiz ──────────────────────────────────────────────────────
function Quiz({ questions }: { questions: QuizQuestion[] }) {
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  const q = questions[current]

  const handleCheck = () => {
    if (selected === null) return
    setRevealed(true)
    if (selected === q.answer) setScore(s => s + 1)
  }

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1); setSelected(null); setRevealed(false)
    } else { setDone(true) }
  }

  const handleRestart = () => {
    setCurrent(0); setSelected(null); setRevealed(false); setScore(0); setDone(false)
  }

  return (
    <div className={styles.quiz}>
      <div className={styles.quizHeader}>
        <span className={styles.quizTitle}>🧠 Knowledge Check</span>
        <span className={styles.quizProgress}>{current + 1} / {questions.length}</span>
      </div>

      {!done ? (
        <div key={current} className="fade-in">
          <p className={styles.quizQuestion}>{q.question}</p>
          <div className={styles.options}>
            {q.options.map((opt, i) => {
              let cls = styles.option
              if (selected === i) cls += ` ${styles.optionSelected}`
              if (revealed && i === q.answer) cls += ` ${styles.optionCorrect}`
              if (revealed && selected === i && i !== q.answer) cls += ` ${styles.optionWrong}`
              return (
                <button key={i} className={cls} onClick={() => !revealed && setSelected(i)}>
                  <span className={styles.optionLetter}>{String.fromCharCode(65 + i)}</span>
                  <span>{opt}</span>
                  {revealed && i === q.answer && <CheckCircle size={15} className={styles.iconOk} />}
                  {revealed && selected === i && i !== q.answer && <XCircle size={15} className={styles.iconBad} />}
                </button>
              )
            })}
          </div>
          {revealed && (
            <div className={styles.explanation}>
              <strong>{selected === q.answer ? '✓ Correct!' : '✗ Incorrect.'}</strong> {q.explanation}
            </div>
          )}
          <div className={styles.quizActions}>
            {!revealed
              ? <button className={styles.checkBtn} onClick={handleCheck} disabled={selected === null}>Check Answer</button>
              : <button className={styles.nextBtn} onClick={handleNext}>{current < questions.length - 1 ? 'Next →' : 'See Results →'}</button>
            }
          </div>
        </div>
      ) : (
        <div className={`${styles.quizDone} fade-in`}>
          <div className={styles.scoreEmoji}>{score === questions.length ? '🏆' : score >= questions.length / 2 ? '👍' : '📚'}</div>
          <div className={styles.scoreText}>{score} / {questions.length} correct</div>
          <div className={styles.scoreMsg}>
            {score === questions.length ? 'Perfect! You nailed it.' : score >= questions.length / 2 ? 'Good work!' : 'Re-read the lesson and try again.'}
          </div>
          <button className={styles.restartBtn} onClick={handleRestart}>Try Again</button>
        </div>
      )}
    </div>
  )
}

function diffBadge(d: string) {
  if (d === 'beginner') return 'green'
  if (d === 'intermediate') return 'amber'
  return 'pink'
}
