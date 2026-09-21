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
      const manifest = {
        bundle_path: `${projectDirName}/${outDir}/main.js`,
        style_path: `${projectDirName}/${outDir}/style.css`,
        shared: buildSharedManifest(resolveSharedVersions(projectRoot)),
      }

      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webapp.json',
        source: `${JSON.stringify(manifest, null, 2)}\n`,
      })
    },
  }
}

/** Convenience preset: a ready to use Vite UserConfig for the simplest plugin project. */
export function defineNginxUiPluginConfig(options: NginxUiPluginOptions): UserConfig {
  return {
    plugins: [nginxUiPlugin(options)],
  }
}
