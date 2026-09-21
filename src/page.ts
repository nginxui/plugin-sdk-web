/**
 * Bridge for zero-build iframe pages (manifest webapp.pages). Talks to the
 * host over postMessage, matching app/src/views/plugin/IframePage.vue.
 * Kept dependency free and tiny: this file is meant to be loaded directly by
 * a static HTML page, with no bundler involved.
 */

export type Theme = 'light' | 'dark'

interface TokenMessage { type: 'nginx-ui:token', token?: string }
interface ThemeMessage { type: 'nginx-ui:theme', theme?: Theme }

function isTokenMessage(data: unknown): data is TokenMessage {
  return !!data && typeof data === 'object' && (data as TokenMessage).type === 'nginx-ui:token'
}

function isThemeMessage(data: unknown): data is ThemeMessage {
  const message = data as ThemeMessage | null
  return !!message && message.type === 'nginx-ui:theme' && (message.theme === 'light' || message.theme === 'dark')
}

/** Asks the host for the current auth token. Resolves once, on the first reply. */
export function requestToken(): Promise<string> {
  return new Promise(resolve => {
    function onMessage(event: MessageEvent) {
      if (!isTokenMessage(event.data) || typeof event.data.token !== 'string')
        return
      window.removeEventListener('message', onMessage)
      resolve(event.data.token)
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'nginx-ui:token' }, location.origin)
  })
}

/** Asks the host for the current theme and applies it to <html data-theme>. */
export function requestTheme(): Promise<Theme> {
  return new Promise(resolve => {
    function onMessage(event: MessageEvent) {
      if (!isThemeMessage(event.data) || !event.data.theme)
        return
      window.removeEventListener('message', onMessage)
      document.documentElement.setAttribute('data-theme', event.data.theme)
      resolve(event.data.theme)
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'nginx-ui:theme' }, location.origin)
  })
}

/** Keeps <html data-theme> in sync with unsolicited theme pushes from the host. */
export function watchTheme(onChange?: (theme: Theme) => void): () => void {
  function onMessage(event: MessageEvent) {
    if (!isThemeMessage(event.data) || !event.data.theme)
      return
    document.documentElement.setAttribute('data-theme', event.data.theme)
    onChange?.(event.data.theme)
  }
  window.addEventListener('message', onMessage)
  return () => window.removeEventListener('message', onMessage)
}
