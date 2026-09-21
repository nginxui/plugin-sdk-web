/**
 * Public types and helpers mirroring the NGINX UI host runtime.
 *
 * This package ships no runtime dependency on vue, vue-router, pinia or
 * antdv-next: a plugin bundle must never carry its own copy of those, it
 * uses the instances the host publishes on `window.NginxUI.shared` instead.
 * Types here are therefore intentionally loose (`unknown` / structural
 * shapes) rather than importing the real library types.
 *
 * Mirrors nginx-ui's app/src/plugin/types.ts and app/src/api/plugin.ts.
 * Keep the two in sync: only add fields, never rename or drop one.
 */

/** A Vue component: an SFC default export, defineComponent() result, or a functional component. */
export type Component = unknown

/** Slots the host renders today. Any other string is accepted but ignored. */
export type KnownSlotName
  = | `certificate.challenge.form:${string}`
    | `dns.credential.form:${string}`
    | `dns.credential.hint:${string}`
    | 'certificate.issue.footer'
    | `plugin.settings:${string}`
    | 'sidebar.footer'

export type SlotName = KnownSlotName | (string & Record<never, never>)

/** Payload the host passes to the components mounted in a slot. */
export interface SlotContext {
  [key: string]: unknown
}

export interface RegisterRouteOptions {
  /** Name of an existing top level sidebar entry (e.g. "System") to nest the route under. */
  parent?: string
  /** Lower values sort first inside the sidebar group. */
  order?: number
}

export interface RegisterSlotOptions {
  /** Lower values render first. */
  order?: number
  /** Return false to skip rendering for a given context. */
  when?: (ctx: SlotContext) => boolean
}

/** Read-only view of the host state a plugin is allowed to observe. */
export interface PluginHostState {
  readonly theme: 'light' | 'dark'
  readonly locale: string
  readonly nodeId: number
  readonly username: string
}

/** Minimal vue-router RouteRecordRaw shape, kept dependency free. */
export interface RouteRecordLike {
  path: string
  name?: string | symbol
  component?: unknown
  components?: Record<string, unknown>
  children?: RouteRecordLike[]
  meta?: Record<string, unknown>
  props?: unknown
  [key: string]: unknown
}

/** Axios-like response, matching the registry.http client (plain axios semantics). */
export interface AxiosLikeResponse<T = unknown> {
  data: T
  status: number
  statusText: string
  headers: Record<string, unknown>
  [key: string]: unknown
}

/** Client whose baseURL is ./api/plugins/{id}/http. Resolves with an AxiosLikeResponse. */
export interface PluginHttpClient {
  get: <T = unknown>(url: string, config?: Record<string, unknown>) => Promise<AxiosLikeResponse<T>>
  post: <T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>) => Promise<AxiosLikeResponse<T>>
  put: <T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>) => Promise<AxiosLikeResponse<T>>
  patch: <T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>) => Promise<AxiosLikeResponse<T>>
  delete: <T = unknown>(url: string, config?: Record<string, unknown>) => Promise<AxiosLikeResponse<T>>
  request: <T = unknown>(config: Record<string, unknown>) => Promise<AxiosLikeResponse<T>>
  [key: string]: unknown
}

/** The host API client (@uozi-admin/request). Resolves with the response body directly. */
export interface CoreHttpClient {
  get: <T = unknown>(url: string, config?: Record<string, unknown>) => Promise<T>
  post: <T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>) => Promise<T>
  put: <T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>) => Promise<T>
  patch: <T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>) => Promise<T>
  delete: <T = unknown>(url: string, config?: Record<string, unknown>) => Promise<T>
  request: <T = unknown>(config: Record<string, unknown>) => Promise<T>
  [key: string]: unknown
}

export interface PluginRegistry {
  /** Adds a child route under the main layout; the sidebar entry is derived from meta. */
  registerRoute: (route: RouteRecordLike, options?: RegisterRouteOptions) => void
  /** Mounts a component into a host-defined extension slot. */
  registerSlot: (slot: SlotName, component: Component, options?: RegisterSlotOptions) => void
  /** Merges gettext messages for a locale; keys are the English source strings. */
  registerTranslations: (locale: string, messages: Record<string, string>) => void
  /** Replaces the schema-driven settings form with a custom component. */
  registerSettingsPanel: (component: Component) => void
  /** Client whose baseURL is ./api/plugins/{id}/http. */
  http: PluginHttpClient
  /** The host API client, usable only with the `core_api` permission. */
  coreHttp: CoreHttpClient
  manifest: PluginManifest
  host: PluginHostState
}

export interface NginxUIPlugin {
  setup: (registry: PluginRegistry) => void | Promise<void>
  teardown?: () => void
}

/** Module instances the host shares with plugin bundles. Never ship your own copy of these. */
export interface SharedRuntime {
  vue: unknown
  vueRouter: unknown
  pinia: unknown
  antdvNext: unknown
  antdvIcons: unknown
  vueuse: unknown
  gettext: unknown
  http: CoreHttpClient
  /** Resolved versions of the shared libraries, keyed by package name. */
  versions: Record<string, string>
}

export interface NginxUIGlobal {
  /** Host application version. */
  version: string
  shared: SharedRuntime
  registerPlugin: (id: string, definition: NginxUIPlugin) => void
}

export type SettingsFieldType = 'text' | 'bool' | 'number' | 'select' | 'secret' | 'textarea'

export interface SettingsOption {
  value: string
  label: string
}

export interface SettingsField {
  key: string
  type: SettingsFieldType
  display_name: string
  help_text?: string
  default?: unknown
  options?: SettingsOption[]
  required?: boolean
}

export interface SettingsSchema {
  header?: string
  footer?: string
  settings: SettingsField[]
}

export interface PluginRequirement {
  id: string
  version?: string
}

export interface PluginManifestServer {
  /** Maps "<goos>-<goarch>" to a path relative to the plugin directory. */
  executables?: Record<string, string>
  /** Fallback argv for interpreted plugins. */
  command?: string[]
  lifecycle?: 'resident' | 'on_demand'
  idle_timeout_seconds?: number
}

export interface PluginManifestPage {
  path: string
  /** Locale code to page title. */
  title: Record<string, string>
  icon?: string
  file: string
}

export interface PluginManifestWebapp {
  bundle_path?: string
  style_path?: string
  /** Maps a shared runtime library to the semver range the bundle was built against. */
  shared?: Record<string, string>
  pages?: PluginManifestPage[]
}

export interface PluginManifestContent {
  templates?: string
  locales?: string
}

export interface PluginManifestCron {
  id: string
  schedule: string
  method: string
}

export interface DNS01ProviderConfig {
  credentials?: Record<string, string>
  additional?: Record<string, string>
}

export interface DNS01ProviderLinks {
  api?: string
  go_client?: string
}

export interface DNS01Provider {
  name: string
  code: string
  configuration?: DNS01ProviderConfig
  links?: DNS01ProviderLinks
  propagation_timeout_seconds?: number
  polling_interval_seconds?: number
}

export interface PluginManifestDNS01 {
  providers: DNS01Provider[]
}

export interface PluginManifestHTTP {
  /** "unix" (reverse proxy to a socket) or "rpc" (http.handle fallback). */
  listen: string
}

/** Mirrors internal/plugin/protocol/manifest.go. */
export interface PluginManifest {
  id: string
  name: string
  version: string
  description?: string
  homepage_url?: string
  icon_path?: string
  api_version: number
  min_nginx_ui_version?: string
  server?: PluginManifestServer
  webapp?: PluginManifestWebapp
  content?: PluginManifestContent
  capabilities?: string[]
  permissions?: string[]
  requires?: PluginRequirement[]
  requires_capabilities?: string[]
  events?: string[]
  cron?: PluginManifestCron[]
  network_hosts?: string[]
  dns01?: PluginManifestDNS01
  http?: PluginManifestHTTP
  settings_schema?: SettingsSchema | null
}

declare global {
  interface Window {
    NginxUI: NginxUIGlobal
  }
}

/** Identity helper: gives `setup`/`teardown` object literals editor type checking. */
export function defineNginxUIPlugin(plugin: NginxUIPlugin): NginxUIPlugin {
  return plugin
}

/** Returns the shared runtime instances published by the host. Call only after the host script has run. */
export function useShared(): SharedRuntime {
  if (typeof window === 'undefined' || !window.NginxUI) {
    throw new Error('[nginx-ui-plugin-sdk] window.NginxUI is not available yet')
  }
  return window.NginxUI.shared
}

/** Thin wrapper around window.NginxUI.registerPlugin(id, plugin). */
export function registerPlugin(id: string, plugin: NginxUIPlugin): void {
  if (typeof window === 'undefined' || !window.NginxUI) {
    throw new Error('[nginx-ui-plugin-sdk] window.NginxUI is not available, registerPlugin must run in the host page')
  }
  window.NginxUI.registerPlugin(id, plugin)
}
