/**
 * Computes the semver ranges manifest.webapp.shared expects, from the shared
 * library versions actually installed (or declared) in the consumer project.
 * Kept in its own module so the pure logic is unit testable without a Vite
 * build context.
 */

export interface SemverTriple {
  major: number
  minor: number
  patch: number
}

/** Parses "major.minor.patch", ignoring any prerelease or build metadata. */
export function parseSemver(version: string): SemverTriple | null {
  const core = String(version ?? '').trim().split('+')[0].split('-')[0]
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(core)
  if (!match)
    return null

  return {
    major: Number(match[1]),
    minor: Number(match[2] ?? 0),
    patch: Number(match[3] ?? 0),
  }
}

/**
 * Range strategy per shared library: vue, vue-router, pinia and antdv-next
 * allow every minor/patch up to (not including) the next major; @vueuse/core
 * has no upper bound.
 *
 * antdv-next used to be pinned to major.minor. The host upgrades its minor
 * regularly, and every upgrade then refused every plugin bundle built against
 * the previous one, so a bundle stopped loading until its plugin was rebuilt.
 */
export function rangeForLibrary(pkg: string, version: string): string {
  const parsed = parseSemver(version)
  if (!parsed)
    return version

  switch (pkg) {
    case 'vue':
    case 'vue-router':
    case 'pinia':
    case 'antdv-next':
      return `>=${version} <${parsed.major + 1}`
    case '@vueuse/core':
    default:
      return `>=${version}`
  }
}

/** Builds the webapp.shared map for every library that resolved to a version. */
export function buildSharedManifest(versions: Record<string, string | null | undefined>): Record<string, string> {
  const shared: Record<string, string> = {}
  for (const [pkg, version] of Object.entries(versions)) {
    if (version)
      shared[pkg] = rangeForLibrary(pkg, version)
  }
  return shared
}
