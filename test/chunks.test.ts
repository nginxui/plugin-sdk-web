import type { Plugin } from 'vite'
import { afterEach, describe, expect, it } from 'bun:test'
import { registerChunk } from '../src/index'
import { chunkFileName, finishChunkBundle, nginxUiChunkPlugin, nginxUiPlugin } from '../src/vite'

const globalScope = globalThis as unknown as { window?: unknown }

afterEach(() => {
  delete globalScope.window
})

describe('registerChunk', () => {
  it('passes the chunk to the host', () => {
    const calls: unknown[][] = []
    globalScope.window = {
      NginxUI: { registerChunk: (...args: unknown[]) => calls.push(args) },
    }
    const exports = { Dashboard: {} }
    registerChunk('com.example.plugin', 'dashboard', exports)
    expect(calls).toEqual([['com.example.plugin', 'dashboard', exports]])
  })

  it('throws on a host without chunk support', () => {
    globalScope.window = { NginxUI: {} }
    expect(() => registerChunk('com.example.plugin', 'dashboard', {})).toThrow('registerChunk')
  })
})

describe('chunkFileName', () => {
  it('places a chunk below chunks/', () => {
    expect(chunkFileName('search')).toBe('chunks/search.js')
  })
})

describe('finishChunkBundle', () => {
  const options = { id: 'com.example.plugin', name: 'search', globalName: 'NginxUIChunk_com_example_plugin_search' }

  it('appends the registerChunk call', () => {
    const bundle = {
      'chunks/search.js': { type: 'chunk' as const, fileName: 'chunks/search.js', code: 'var G=(function(){return {}})();' },
    }
    finishChunkBundle(bundle, options)
    expect(bundle['chunks/search.js'].code).toBe(
      'var G=(function(){return {}})();\n'
      + 'window.NginxUI.registerChunk("com.example.plugin","search",NginxUIChunk_com_example_plugin_search);\n',
    )
  })

  it('folds the stylesheet into the script and drops it from the bundle', () => {
    const bundle: Record<string, { type: 'asset' | 'chunk', fileName: string, code?: string, source?: string }> = {
      'chunks/search.js': { type: 'chunk', fileName: 'chunks/search.js', code: 'var G=1;' },
      'chunks/style.css': { type: 'asset', fileName: 'chunks/style.css', source: '.a{color:red}' },
    }
    finishChunkBundle(bundle, options)
    expect(Object.keys(bundle)).toEqual(['chunks/search.js'])
    const code = bundle['chunks/search.js'].code ?? ''
    expect(code.startsWith('(function(){var s=document.createElement(\'style\')')).toBe(true)
    expect(code).toContain('".a{color:red}"')
    expect(code).toContain('var G=1;')
  })

  it('fails when the build produced no script', () => {
    expect(() => finishChunkBundle({}, options)).toThrow('no script')
  })
})

describe('nginxUiChunkPlugin', () => {
  it('builds an IIFE below chunks/ without emptying the output directory', () => {
    const plugin = nginxUiChunkPlugin({ id: 'com.example.plugin', name: 'dashboard', entry: 'src/dashboard.ts' })
    const config = (plugin.config as (c: Record<string, unknown>) => Record<string, any>)({ root: '/p/webapp' })
    expect(config.build.emptyOutDir).toBe(false)
    expect(config.build.lib.formats).toEqual(['iife'])
    expect(config.build.lib.name).toBe('NginxUIChunk_com_example_plugin_dashboard')
    expect(config.build.lib.fileName()).toBe('chunks/dashboard.js')
    expect(config.build.rollupOptions.external).toContain('vue')
  })

  it('rejects a name the manifest would not accept', () => {
    expect(() => nginxUiChunkPlugin({ id: 'com.example.plugin', name: 'Bad Name', entry: 'x.ts' })).toThrow('invalid chunk name')
  })
})

describe('nginxUiPlugin chunks option', () => {
  it('lists the chunks in manifest.webapp.json', () => {
    const plugin: Plugin = nginxUiPlugin({ id: 'com.example.plugin', chunks: ['search', 'dashboard'], root: '/tmp/none/webapp' })
    const emitted: { source: string }[] = []
    const generate = plugin.generateBundle as unknown as (this: { emitFile: (f: { source: string }) => void }) => void
    generate.call({ emitFile: file => emitted.push(file) })
    const manifest = JSON.parse(emitted[0].source)
    expect(manifest.chunks).toEqual({
      search: 'webapp/dist/chunks/search.js',
      dashboard: 'webapp/dist/chunks/dashboard.js',
    })
  })
})
