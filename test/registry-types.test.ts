import { resolve } from 'node:path'
import { describe, expect, it } from 'bun:test'
import ts from 'typescript'

const root = resolve(import.meta.dir, '..')
const snippetFile = resolve(root, 'test/__snippet.ts')

// Compiles a snippet against the SDK sources and returns its diagnostics.
function diagnose(code: string): string[] {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    types: [],
  }
  const host = ts.createCompilerHost(options)
  const getSourceFile = host.getSourceFile.bind(host)
  const fileExists = host.fileExists.bind(host)
  const readFile = host.readFile.bind(host)

  host.getSourceFile = (name, languageVersion, ...rest) =>
    name === snippetFile
      ? ts.createSourceFile(name, code, languageVersion)
      : getSourceFile(name, languageVersion, ...rest)
  host.fileExists = name => name === snippetFile || fileExists(name)
  host.readFile = name => (name === snippetFile ? code : readFile(name))

  const program = ts.createProgram([snippetFile], options, host)
  return ts.getPreEmitDiagnostics(program).map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n'))
}

const header = `import type { NginxLogColumnWhenContext, PluginRegistry, SiteLogActionsContext } from '../src/index'\n`

describe('registry types', () => {
  it('wsUrl is optional and returns a string', () => {
    expect(diagnose(`${header}
declare const registry: PluginRegistry
const url: string | undefined = registry.wsUrl?.('/events')
const socket = registry.wsUrl ? new WebSocket(registry.wsUrl('/events')) : undefined
export { url, socket }
`)).toEqual([])
  })

  it('a registry without wsUrl still satisfies the type', () => {
    expect(diagnose(`${header}
const registry = {} as Omit<PluginRegistry, 'wsUrl'>
const complete: PluginRegistry = registry as PluginRegistry
export { complete }
`)).toEqual([])
  })

  it('wsUrl takes a string path only', () => {
    expect(diagnose(`${header}
declare const registry: PluginRegistry
registry.wsUrl?.(42)
`)).not.toEqual([])
  })

  it('site log actions carry the inherited flags', () => {
    expect(diagnose(`${header}
const context: SiteLogActionsContext = {
  accessLogPath: '/var/log/nginx/a.log',
  accessLogInherited: true,
  errorLogPath: '',
  errorLogInherited: false,
  siteName: 'a.conf',
}
export { context }
`)).toEqual([])
    expect(diagnose(`${header}
const context: SiteLogActionsContext = { accessLogPath: '', errorLogPath: '', siteName: 'a.conf' }
export { context }
`)).not.toEqual([])
  })

  it('a column condition can read the list type', () => {
    expect(diagnose(`${header}
declare const registry: PluginRegistry
const list: NginxLogColumnWhenContext = { type: 'error' }
registry.registerSlot('nginx_log.list.column:x', {}, { when: ctx => ctx.type === 'access' })
export { list }
`)).toEqual([])
    expect(diagnose(`${header}
const list: NginxLogColumnWhenContext = { type: 'site' }
export { list }
`)).not.toEqual([])
  })
})
