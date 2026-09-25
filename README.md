# @nginxui/plugin-sdk

TypeScript SDK for [NGINX UI](https://github.com/0xJacky/nginx-ui) browser
plugin bundles: the types the host runtime exposes on `window.NginxUI`, a
Vite preset that builds a compliant IIFE bundle, and a tiny helper for
zero-build iframe pages.

A plugin webapp bundle runs inside the host page and shares its Vue, Vue
Router, Pinia and antdv-next instances rather than shipping its own copies.
This package has no runtime dependency on any of them for that reason: it
only describes their shapes.

## Install

```bash
bun add -d @nginxui/plugin-sdk
```

## `@nginxui/plugin-sdk` — types and runtime helpers

```ts
import { defineNginxUIPlugin, registerPlugin, useShared } from '@nginxui/plugin-sdk'
import MySlot from './MySlot.vue'

const plugin = defineNginxUIPlugin({
  setup(registry) {
    registry.registerSlot('certificate.challenge.form:dns01', MySlot)
    registry.registerTranslations('zh_CN', { 'My Setting': '我的设置' })
  },
})

registerPlugin('io.github.example.myplugin', plugin)
```

`useShared()` returns `window.NginxUI.shared` (vue, vueRouter, pinia,
antdvNext, antdvIcons, vueuse, gettext, the host http client, and the
`versions` map), typed but without importing any of those packages.

## `@nginxui/plugin-sdk/vite` — build preset

```ts
// vite.config.ts
import vue from '@vitejs/plugin-vue'
import { nginxUiPlugin } from '@nginxui/plugin-sdk/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    nginxUiPlugin({ id: 'io.github.example.myplugin' }),
  ],
})
```

Or, for a project with nothing else to configure, use the ready-made config:

```ts
// vite.config.ts
import { defineNginxUiPluginConfig } from '@nginxui/plugin-sdk/vite'

export default defineNginxUiPluginConfig({ id: 'io.github.example.myplugin' })
```

`nginxUiPlugin(options)`:

| Option | Default | Meaning |
| --- | --- | --- |
| `id` | required | Plugin id from `plugin.json`. Used to derive the IIFE global name. |
| `entry` | `src/main.ts` | Bundle entry point, relative to the project root. |
| `outDir` | `dist` | Build output directory, relative to the project root. |
| `root` | Vite's own root | Directory to resolve `node_modules` and `package.json` from when computing shared versions. |

`bun run build` (i.e. `vite build`) with this plugin produces:

* `dist/main.js` — one IIFE, `vue`, `vue-router`, `pinia`, `antdv-next`,
  `@antdv-next/icons`, `@vueuse/core`, `vue3-gettext` and
  `@uozi-admin/request` externalized onto `window.NginxUI.shared.*`.
* `dist/style.css` — extracted styles, always under this fixed name.
* `dist/manifest.webapp.json` — the fragment your plugin.json generator
  merges into `webapp`:

  ```json
  {
    "bundle_path": "webapp/dist/main.js",
    "style_path": "webapp/dist/style.css",
    "shared": {
      "vue": ">=3.5.42 <4",
      "vue-router": ">=5.3.1 <6",
      "pinia": ">=4.0.3 <5",
      "antdv-next": "~1.5",
      "@vueuse/core": ">=15.0.0"
    }
  }
  ```

  The ranges are computed from the versions actually installed in
  `node_modules` (falling back to the range declared in your own
  `package.json` when a library is not installed) so that the manifest
  always reflects what the bundle was really built against. `bundle_path`
  and `style_path` assume the Vite project lives in a directory named
  `webapp` inside the plugin repository — the convention used by the
  official plugins.

## `@nginxui/plugin-sdk/page` — zero-build iframe pages

For a `webapp.pages` entry (a static HTML page with no build step), served
inside the host's iframe wrapper:

```html
<script type="module">
  import { requestToken, watchTheme } from 'https://esm.sh/@nginxui/plugin-sdk/page'

  const token = await requestToken()
  watchTheme(theme => console.log('host theme is now', theme))
</script>
```

| Export | Behavior |
| --- | --- |
| `requestToken()` | Sends `{ type: 'nginx-ui:token' }` to `window.parent`, resolves with the auth token. |
| `requestTheme()` | Sends `{ type: 'nginx-ui:theme' }`, resolves with `'light' \| 'dark'` and sets `data-theme` on `<html>`. |
| `watchTheme(onChange?)` | Applies every unsolicited theme push the host sends afterwards. Returns an unsubscribe function. |

The built file is `dist/page.js`, kept under 2 KB with no dependencies.

## Development

```bash
bun install
bun run build      # emits dist/index.js, dist/vite.js, dist/page.js and .d.ts files
bun test           # unit tests for the semver range helper
bun run typecheck
```

## License

AGPL-3.0. See [LICENSE](LICENSE).
