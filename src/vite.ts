/**
 * Vite preset for building an NGINX UI plugin webapp bundle: one IIFE, vue /
 * vue-router / pinia / antdv-next / @antdv-next/icons / @vueuse/core /
 * vue3-gettext / @uozi-admin/request externalized onto window.NginxUI.shared,
 * a single style.css, and a generated manifest.webapp.json next to it.
 *
 * `vite` is a type-only import here: this module runs inside vite.config.ts,
 * which already has vite in scope, so it is a peer dependency, not a bundled one.
 */
import type { Plugin, UserConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { buildSharedManifest } from './shared-range'

/** Package name -> window.NginxUI.shared key. Matches app/src/plugin/shared.ts. */
export const SHARED_EXTERNALS: Record<string, string> = {
  'vue': 'vue',
  'vue-router': 'vueRouter',
  'pinia': 'pinia',
  'antdv-next': 'antdvNext',
  '@antdv-next/icons': 'antdvIcons',
  '@vueuse/core': 'vueuse',
  'vue3-gettext': 'gettext',
  '@uozi-admin/request': 'http',
}

/** Libraries the host reports in window.NginxUI.shared.versions, checked at load time. */
const VERSIONED_LIBS = ['vue', 'vue-router', 'pinia', 'antdv-next', '@vueuse/core']

export interface NginxUiPluginOptions {
  /** Plugin id from plugin.json, e.g. "com.nginxui.dns01". */
  id: string
  /**
   * Names of the on-demand chunks built next to the entry with
   * nginxUiChunkPlugin. They are listed in manifest.webapp.json as
   * `chunks`, each pointing at `<project>/<outDir>/chunks/<name>.js`.
   */
  chunks?: string[]
  /** Entry file, relative to the project root. Default "src/main.ts". */
  entry?: string
  /** Build output directory, relative to the project root. Default "dist". */
  outDir?: string
  /** Project root to resolve node_modules and package.json from. Default the Vite root. */
  root?: string
}

function sanitizeName(id: string): string {
  return id.replace(/[^a-zA-Z0-9]+/g, '_')
}

function sharedGlobals(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(SHARED_EXTERNALS).map(([pkg, key]) => [pkg, `window.NginxUI.shared.${key}`]),
  )
}

/** Reads "version" from an installed package's package.json, if present. */
function readInstalledVersion(root: string, pkg: string): string | null {
  try {
    const file = path.join(root, 'node_modules', ...pkg.split('/'), 'package.json')
    const raw = fs.readFileSync(file, 'utf8')
    const parsed = JSON.parse(raw) as { version?: string }
    return parsed.version ?? null
  }
  catch {
    return null
  }
}

/** Falls back to the range declared in the consumer's own package.json. */
function readDeclaredRange(root: string, pkg: string): string | null {
  try {
    const raw = fs.readFileSync(path.join(root, 'package.json'), 'utf8')
    const parsed = JSON.parse(raw) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const range = parsed.dependencies?.[pkg] ?? parsed.devDependencies?.[pkg]
    if (!range)
      return null
    // Strip a leading range operator so a bare version reaches rangeForLibrary.
    return range.replace(/^[\^~>=<\s]+/, '')
  }
  catch {
    return null
  }
}

/** Resolves the version of every shared library the manifest cares about. */
export function resolveSharedVersions(root: string): Record<string, string> {
  const versions: Record<string, string> = {}
  for (const pkg of VERSIONED_LIBS) {
    const version = readInstalledVersion(root, pkg) ?? readDeclaredRange(root, pkg)
    if (version)
      versions[pkg] = version
  }
  return versions
}

/**
 * Vite plugin: sets build.lib, externalizes the shared runtime, names the
 * CSS output style.css, and emits dist/manifest.webapp.json.
 */
export function nginxUiPlugin(options: NginxUiPluginOptions): Plugin {
  const entry = options.entry ?? 'src/main.ts'
  const outDir = options.outDir ?? 'dist'
  let projectRoot = options.root ?? process.cwd()

  return {
    name: 'nginx-ui-plugin-sdk',
    apply: 'build',

    config(config) {
      projectRoot = options.root ?? config.root ?? projectRoot

      return {
        build: {
          outDir,
          cssCodeSplit: false,
          lib: {
            entry: path.resolve(projectRoot, entry),
            formats: ['iife'],
            name: `NginxUIPlugin_${sanitizeName(options.id)}`,
            fileName: () => 'main.js',
          },
          rollupOptions: {
            external: Object.keys(SHARED_EXTERNALS),
            output: {
              globals: sharedGlobals(),
              assetFileNames: (asset: { name?: string }) =>
                asset.name?.endsWith('.css') ? 'style.css' : (asset.name ?? 'assets/[name][extname]'),
            },
          },
        },
      } satisfies UserConfig
    },

    generateBundle() {
      // The Vite project conventionally lives in a directory named "webapp"
      // inside the plugin repository, so the manifest paths read
      // "webapp/dist/main.js" the way nginx-ui expects, without hardcoding it.
      const projectDirName = path.basename(projectRoot)
      const manifest: Record<string, unknown> = {
        bundle_path: `${projectDirName}/${outDir}/main.js`,
        style_path: `${projectDirName}/${outDir}/style.css`,
        shared: buildSharedManifest(resolveSharedVersions(projectRoot)),
      }
      if (options.chunks?.length) {
        manifest.chunks = Object.fromEntries(
          options.chunks.map(name => [name, `${projectDirName}/${outDir}/${chunkFileName(name)}`]),
        )
      }

      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webapp.json',
        source: `${JSON.stringify(manifest, null, 2)}\n`,
      })
    },
  }
}

export interface NginxUiChunkOptions {
  /** Plugin id from plugin.json. */
  id: string
  /** Chunk name, the key in `webapp.chunks`: lowercase letters, digits, `_` and `-`. */
  name: string
  /** Chunk entry file, relative to the project root. Its exports are what `loadChunk` resolves with. */
  entry: string
  /** Build output directory shared with the entry build. Default "dist". */
  outDir?: string
  /** Project root. Default the Vite root. */
  root?: string
}

/** Output path of a chunk below the output directory. */
export function chunkFileName(name: string): string {
  return `chunks/${name}.js`
}

const CHUNK_NAME = /^[a-z0-9][a-z0-9_-]{0,31}$/

interface BundleFile {
  type: 'asset' | 'chunk'
  fileName: string
  code?: string
  source?: string | Uint8Array
}

/**
 * Finishes a chunk build. Stylesheets are folded into the script as a style
 * element, because a chunk has no stylesheet of its own in the manifest, and a
 * `registerChunk` call is appended so the entry module only has to export.
 */
export function finishChunkBundle(
  bundle: Record<string, BundleFile>,
  options: { id: string, name: string, globalName: string },
): void {
  const chunk = Object.values(bundle).find(file => file.type === 'chunk')
  if (!chunk || chunk.code === undefined)
    throw new Error(`[nginx-ui-plugin-sdk] chunk "${options.name}" produced no script`)

  let css = ''
  for (const [key, file] of Object.entries(bundle)) {
    if (file.type === 'asset' && file.fileName.endsWith('.css')) {
      css += typeof file.source === 'string' ? file.source : new TextDecoder().decode(file.source)
      delete bundle[key]
    }
  }

  const style = css
    ? `(function(){var s=document.createElement('style');s.setAttribute('data-nginx-ui-chunk',${JSON.stringify(`${options.id}:${options.name}`)});s.textContent=${JSON.stringify(css)};document.head.appendChild(s)})();\n`
    : ''
  const register = `\nwindow.NginxUI.registerChunk(${JSON.stringify(options.id)},${JSON.stringify(options.name)},${options.globalName});\n`
  chunk.code = `${style}${chunk.code}${register}`
}

/**
 * Vite plugin for one on-demand chunk (manifest `webapp.chunks`): an IIFE with
 * the shared runtime externalized, written to `chunks/<name>.js` without
 * emptying the output directory the entry build already filled. Run it after
 * the entry build, one config per chunk.
 */
export function nginxUiChunkPlugin(options: NginxUiChunkOptions): Plugin {
  if (!CHUNK_NAME.test(options.name))
    throw new Error(`[nginx-ui-plugin-sdk] invalid chunk name "${options.name}"`)

  const outDir = options.outDir ?? 'dist'
  const globalName = `NginxUIChunk_${sanitizeName(options.id)}_${sanitizeName(options.name)}`
  let projectRoot = options.root ?? process.cwd()

  return {
    name: `nginx-ui-plugin-sdk-chunk-${options.name}`,
    apply: 'build',
    // Runs after the css plugin emitted the stylesheet.
    enforce: 'post',

    config(config) {
      projectRoot = options.root ?? config.root ?? projectRoot

      return {
        build: {
          outDir,
          emptyOutDir: false,
          cssCodeSplit: false,
          lib: {
            entry: path.resolve(projectRoot, options.entry),
            formats: ['iife'],
            name: globalName,
            fileName: () => chunkFileName(options.name),
            cssFileName: options.name,
          },
          rollupOptions: {
            external: Object.keys(SHARED_EXTERNALS),
            output: {
              globals: sharedGlobals(),
              assetFileNames: 'chunks/[name][extname]',
            },
          },
        },
      } satisfies UserConfig
    },

    generateBundle(_options, bundle) {
      finishChunkBundle(bundle as unknown as Record<string, BundleFile>, {
        id: options.id,
        name: options.name,
        globalName,
      })
    },
  }
}

/** Ready to use Vite UserConfig that builds one chunk. */
export function defineNginxUiChunkConfig(options: NginxUiChunkOptions): UserConfig {
  return {
    plugins: [nginxUiChunkPlugin(options)],
  }
}

/** Convenience preset: a ready to use Vite UserConfig for the simplest plugin project. */
export function defineNginxUiPluginConfig(options: NginxUiPluginOptions): UserConfig {
  return {
    plugins: [nginxUiPlugin(options)],
  }
}
