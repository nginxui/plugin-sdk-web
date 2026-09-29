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
    | `nginx_log.view:${string}`
    | 'nginx_log.list.toolbar'
    | `nginx_log.list.column:${string}`
    | 'nginx_log.list.row.actions'
    | 'site.log.actions'

export type SlotName = KnownSlotName | (string & Record<never, never>)

/** Payload the host passes to the components mounted in a slot. */
export interface SlotContext {
  [key: string]: unknown
}

/** Kind of an nginx log file. */
export type NginxLogType = 'access' | 'error'

/** A row of the nginx log list. The host may add fields, ignore the ones you do not know. */
export interface NginxLogRow {
  /** Log file path. */
  path: string
  type: NginxLogType
  name: string
  config_file: string
  [key: string]: unknown
}

/** Context of `nginx_log.view:{key}`. */
export interface NginxLogViewContext {
  path: string
  type: NginxLogType
}

/** Context of `nginx_log.list.toolbar`. */
export interface NginxLogListToolbarContext {
  type: NginxLogType
}

/** Context of `nginx_log.list.column:{key}` and `nginx_log.list.row.actions`. */
export interface NginxLogRowContext {
  row: NginxLogRow
}

/**
 * What `opts.when` receives for `nginx_log.list.column:{key}`: the list being
 * shown, not a row. Return false to leave the column out of that list, header
 * and cells alike.
 */
export interface NginxLogColumnWhenContext {
  type: NginxLogType
}

/**
 * Context of `site.log.actions`. A path is an empty string when the site has no
 * such log. It is the site's own log directive, else the nginx default log the
 * site falls back to; `...Inherited` is true for that fallback, whose file may
 * hold the traffic of other sites.
 */
export interface SiteLogActionsContext {
  accessLogPath: string
  accessLogInherited: boolean
  errorLogPath: string
  errorLogInherited: boolean
  siteName: string
}

/** One choice of a filterable list column. */
export interface ColumnFilter<Row = NginxLogRow> {
  /** English source string, the host translates it. */
  label: string
  /** Stable identifier of the choice. */
  value: string
  /** True when the row stays visible while the choice is selected. */
  match: (row: Row) => boolean
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
  /**
   * Return false to skip rendering for a given context. For
   * `nginx_log.list.column:{key}` the context is `NginxLogColumnWhenContext`
   * and decides whether the column exists at all.
   */
  when?: (ctx: SlotContext) => boolean
  /**
   * Display text, an English source string the host translates. Read by
   * `nginx_log.view:{key}` (mode name) and `nginx_log.list.column:{key}`
   * (column title), ignored by every other slot.
   */
  label?: string
  /** `nginx_log.list.column:{key}` only: makes the column sortable by this value. */
  sortValue?: (row: NginxLogRow) => string | number | null | undefined
  /** `nginx_log.list.column:{key}` only: makes the column filterable. */
  filters?: ColumnFilter[]
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
  /**
   * Loads an on-demand chunk declared in `webapp.chunks` and resolves with the
   * exports the chunk passed to `registerChunk`. Rejects for an undeclared
   * name or a chunk that fails to load. Absent on hosts without chunk support.
   */
  loadChunk?: <T = Record<string, unknown>>(name: string) => Promise<T>
  /** Client whose baseURL is ./api/plugins/{id}/http. */
  http: PluginHttpClient
  /**
   * Absolute ws or wss URL of a path under the plugin's http capability,
   * carrying the credentials the host needs to accept a browser WebSocket.
   * Never build such a URL yourself. Absent on hosts without WebSocket
   * support, so check before use.
   */
  wsUrl?: (path: string) => string
  /** The host API client, usable only with the `core_api` permission. */
  coreHttp: CoreHttpClient
  manifest: PluginManifest
  host: PluginHostState
}

export interface NginxUIPlugin {
  setup: (registry: PluginRegistry) => void | Promise<void>
  teardown?: () => void
}

/** A DNS credential as the host's credential editor returns it. */
export interface DnsCredentialSummary {
  id: number
  name: string
  code: string
  provider?: string
  provider_code?: string
}

/** Host dialogs a bundle may open. Every member is optional: feature-detect it. */
export interface SharedUI {
  /** Opens the host's DNS credential editor; resolves with the new credential or undefined when cancelled. */
  openDnsCredentialEditor?: () => Promise<DnsCredentialSummary | undefined>
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
  /** Host dialogs, absent on hosts that predate them. */
  ui?: SharedUI
}

export interface NginxUIGlobal {
  /** Host application version. */
  version: string
  shared: SharedRuntime
  registerPlugin: (id: string, definition: NginxUIPlugin) => void
  /** Called by a chunk file while its script executes. Absent on hosts without chunk support. */
  registerChunk?: (pluginId: string, name: string, exports: Record<string, unknown>) => void
}

/** `list` holds an array of strings, rendered as an editable list. */
export type SettingsFieldType = 'text' | 'bool' | 'number' | 'select' | 'secret' | 'textarea' | 'list'

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
  /** Chunk name to a package relative .js file, loaded with `registry.loadChunk`. */
  chunks?: Record<string, string>
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

export interface DNS01ProviderLinks {
  api?: string
}

/** One input of the credential form. `label` and `help` are English gettext msgids. */
export interface DNS01ProviderField {
  /** Stored config key. */
  key: string
  label: string
  help?: string
  /** "credential" or "setting"; settings are shown apart, collapsed. */
  group: 'credential' | 'setting'
  optional?: boolean
  /** Render as a password input. */
  secret?: boolean
  /** Value used when left empty, shown as a placeholder. */
  default?: string
  /** "seconds" when the value is a number of seconds. */
  unit?: 'seconds' | ''
  /** Documentation URL for the field. */
  link?: string
}

/**
 * One way to sign in. `fields` lists credential keys and may be empty;
 * credential fields no method lists are shown with every method. `values`
 * are fixed config entries the host stores while the method is chosen and
 * removes when another method is chosen. A `values` key may also be a
 * credential field that other methods list, never one this method lists.
 */
export interface DNS01ProviderMethod {
  /** English gettext msgid. */
  name: string
  recommended?: boolean
  fields: string[]
  values?: Record<string, string>
}

/** Credential form layout of a provider, see spec DNS01-14. */
export interface DNS01ProviderForm {
  /** Every value the provider accepts, in display order. */
  fields: DNS01ProviderField[]
  /** Present only when there is more than one way to sign in. */
  methods?: DNS01ProviderMethod[]
}

export interface DNS01Provider {
  name: string
  code: string
  links?: DNS01ProviderLinks
  propagation_timeout_seconds?: number
  polling_interval_seconds?: number
  form: DNS01ProviderForm
}

export interface PluginManifestDNS01 {
  providers: DNS01Provider[]
}

export interface PluginManifestHTTP {
  /** "unix" (reverse proxy to a socket) or "rpc" (http.handle fallback). */
  listen: string
}

/** Permission names the spec defines. `credentials.read:<kind>` carries a credential kind. */
export type KnownPermission
  = | 'kv'
    | 'network'
    | 'cron'
    | 'notify'
    | 'metrics.read'
    | 'core_api'
    | 'mcp'
    | 'cert.deploy'
    | 'log.read'
    | 'log.files'
    | `credentials.read:${string}`

/** Event types the host delivers to a subscribed plugin. */
export type KnownEventType
  = | 'cert.issued'
    | 'cert.renewed'
    | 'cert.expiring'
    | 'site.saved'
    | 'site.enabled'
    | 'site.disabled'
    | 'nginx.reloaded'
    | 'nginx.reload_failed'
    | 'node.status_changed'
    | 'node.joined'
    | 'backup.completed'
    | 'auth.login_failed'
    | 'plugin.changed'
    | 'log.paths_changed'

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
  permissions?: (KnownPermission | (string & Record<never, never>))[]
  requires?: PluginRequirement[]
  requires_capabilities?: string[]
  events?: (KnownEventType | (string & Record<never, never>))[]
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

/**
 * Hands the exports of an on-demand chunk to the host. Call it once, while the
 * chunk script executes; `name` is the chunk's key in `webapp.chunks`. The
 * Vite chunk preset appends this call for you.
 */
export function registerChunk(pluginId: string, name: string, exports: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.NginxUI?.registerChunk) {
    throw new Error('[nginx-ui-plugin-sdk] window.NginxUI.registerChunk is not available, the host does not support chunks')
  }
  window.NginxUI.registerChunk(pluginId, name, exports)
}
