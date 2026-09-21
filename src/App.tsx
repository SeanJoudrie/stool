import { useEffect } from 'react'
import { useRoute, navigate, type Route } from './router'
import { useStore } from './store'
import { takeFoodDraft, takeStoolDraft } from './lib/draft'
import { Today } from './screens/Today'
import { History } from './screens/History'
import { Insights } from './screens/Insights'
import { Report } from './screens/Report'
import { Settings } from './screens/Settings'
import { LogStool } from './screens/LogStool'
import { LogFood } from './screens/LogFood'
import { LogDaily } from './screens/LogDaily'
import { Voice } from './screens/Voice'
import { Alert } from './components/ui'
import { IconHome, IconInsights, IconSettings, IconToday } from './components/icons'

// Four tabs, and Report deliberately is not one of them — it is reachable from
// Patterns and from Today, and most people will never need it. The bar is for
// the places you go repeatedly.
const TABS: { route: Route; label: string; Icon: typeof IconToday }[] = [
  { route: { name: 'today' }, label: 'Home', Icon: IconHome },
  { route: { name: 'history' }, label: 'History', Icon: IconToday },
  { route: { name: 'insights' }, label: 'Patterns', Icon: IconInsights },
  { route: { name: 'settings' }, label: 'Settings', Icon: IconSettings },
]

/** The entry forms are full-screen tasks; the tab bar would only offer a way
    to lose an unsaved entry. */
const FULL_SCREEN: Route['name'][] = ['log-stool', 'log-food', 'log-daily', 'voice']

export function App() {
  const route = useRoute()
  const { ready, error, toastMessage } = useStore()
  const showTabs = !FULL_SCREEN.includes(route.name)

  // A hash-routed app opened at a bare URL should land somewhere real.
  useEffect(() => {
    if (!window.location.hash) navigate({ name: 'today' })
  }, [])

  if (error) {
    return (
      <div className="app">
        <main className="main">
          <Alert tone="critical" title="The journal could not be opened">
            {error} If you are browsing privately, storage is usually blocked — this app needs it,
            because everything is kept on your device rather than on a server.
          </Alert>
        </main>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="app">
        <main className="main">
          <p className="empty">Opening your journal…</p>
        </main>
      </div>
    )
  }

  return (
    <div className={`app${showTabs ? ' has-tabbar' : ''}`}>
      {renderRoute(route)}

      {showTabs && (
        <nav className="tabbar" aria-label="Main">
          {TABS.map(({ route: r, label, Icon }) => (
            <a
              key={r.name}
              className="tabbar__item"
              href={`#/${r.name}`}
              aria-current={route.name === r.name ? 'page' : undefined}
            >
              <Icon />
              {label}
            </a>
          ))}
        </nav>
      )}

      {toastMessage && (
        <div className="toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  )
}

function renderRoute(route: Route) {
  switch (route.name) {
    case 'today':
      return <Today />
    case 'history':
      return <History />
    case 'insights':
      return <Insights />
    case 'report':
      return <Report />
    case 'settings':
      return <Settings />
    case 'voice':
      return <Voice />
    case 'log-stool':
      // `key` forces a fresh form per entry, so editing one entry after
      // another does not carry state across.
      return <LogStool key={route.id ?? 'new'} id={route.id} draft={takeStoolDraft()} />
    case 'log-food':
      return <LogFood key={route.id ?? 'new'} id={route.id} draft={takeFoodDraft()} />
    case 'log-daily':
      return <LogDaily key={route.date ?? 'today'} date={route.date} />
  }
}
