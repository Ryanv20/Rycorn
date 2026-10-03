import { useState, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import HomePage from './pages/HomePage'
import LessonPage from './pages/LessonPage'
import GlossaryPage from './pages/GlossaryPage'
import DiagramPage from './pages/DiagramPage'
import styles from './App.module.css'

export type Route =
  | { page: 'home' }
  | { page: 'lesson'; id: string }
  | { page: 'glossary' }
  | { page: 'diagram' }

export default function App() {
  const [route, setRoute] = useState<Route>({ page: 'home' })

  const navigate = useCallback((r: Route) => {
    setRoute(r)
    // Scroll main content to top
    const el = document.getElementById('main-content')
    if (el) el.scrollTop = 0
  }, [])

  return (
    <div className={styles.layout}>
      <Sidebar route={route} navigate={navigate} />
      <main id="main-content" className={styles.content}>
        {route.page === 'home'    && <HomePage    navigate={navigate} />}
        {route.page === 'lesson'  && <LessonPage  id={route.id} navigate={navigate} />}
        {route.page === 'glossary'&& <GlossaryPage navigate={navigate} />}
        {route.page === 'diagram' && <DiagramPage />}
      </main>
    </div>
  )
}
