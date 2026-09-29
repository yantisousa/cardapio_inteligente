import { lazy, Suspense } from 'react'
import { TriunfoMark } from './TriunfoBrand'

const App = lazy(() => import('./App.jsx'))
const TriunfoMenu = lazy(() => import('./TriunfoMenu.jsx'))

export default function RouteApp() {
  const isMarketingPage = /^\/triunfo-menu\/?$/.test(window.location.pathname)

  return <Suspense fallback={<main className="application-loading" role="status"><TriunfoMark /><p>Carregando…</p></main>}>
    {isMarketingPage ? <TriunfoMenu /> : <App />}
  </Suspense>
}
