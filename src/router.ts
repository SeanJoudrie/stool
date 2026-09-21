/**
 * Hash routing. Hand-rolled rather than pulled in: there are nine routes, the
 * app must work from any path including a file server or a home-screen
 * install, and hash routes survive that without server configuration.
 */
import { useEffect, useState } from 'react'

export type Route =
  | { name: 'today' }
  | { name: 'insights' }
  | { name: 'report' }
  | { name: 'settings' }
  | { name: 'history' }
  | { name: 'log-stool'; id?: string }
  | { name: 'log-food'; id?: string }
  | { name: 'voice' }

export const DEFAULT_ROUTE: Route = { name: 'today' }

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '')
  const [path, query] = clean.split('?')
  const params = new URLSearchParams(query ?? '')
  const id = params.get('id') ?? undefined

  switch (path) {
    case '':
    case 'today':
      return { name: 'today' }
    case 'insights':
      return { name: 'insights' }
    case 'report':
      return { name: 'report' }
    case 'settings':
      return { name: 'settings' }
    case 'history':
      return { name: 'history' }
    case 'log/stool':
      return id ? { name: 'log-stool', id } : { name: 'log-stool' }
    case 'log/food':
      return id ? { name: 'log-food', id } : { name: 'log-food' }
    case 'voice':
      return { name: 'voice' }
    default:
      return DEFAULT_ROUTE
  }
}

export function href(route: Route): string {
  switch (route.name) {
    case 'today':
      return '#/today'
    case 'log-stool':
      return route.id ? `#/log/stool?id=${encodeURIComponent(route.id)}` : '#/log/stool'
    case 'log-food':
      return route.id ? `#/log/food?id=${encodeURIComponent(route.id)}` : '#/log/food'
    default:
      return `#/${route.name}`
  }
}

export function navigate(route: Route): void {
  window.location.hash = href(route)
}

export function goBack(fallback: Route = DEFAULT_ROUTE): void {
  if (window.history.length > 1) window.history.back()
  else navigate(fallback)
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
