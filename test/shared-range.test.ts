import { describe, expect, it } from 'bun:test'
import { buildSharedManifest, parseSemver, rangeForLibrary } from '../src/shared-range'

describe('parseSemver', () => {
  it('reads major, minor and patch', () => {
    expect(parseSemver('3.5.42')).toEqual({ major: 3, minor: 5, patch: 42 })
  })

  it('drops prerelease and build metadata', () => {
    expect(parseSemver('1.2.3-beta.1+build.5')).toEqual({ major: 1, minor: 2, patch: 3 })
  })

  it('returns null for a non semver string', () => {
    expect(parseSemver('not-a-version')).toBeNull()
  })
})

describe('rangeForLibrary', () => {
  it('caps vue below the next major', () => {
    expect(rangeForLibrary('vue', '3.5.42')).toBe('>=3.5.42 <4')
  })

  it('caps vue-router below the next major', () => {
    expect(rangeForLibrary('vue-router', '5.3.1')).toBe('>=5.3.1 <6')
  })

  it('caps pinia below the next major', () => {
    expect(rangeForLibrary('pinia', '4.0.3')).toBe('>=4.0.3 <5')
  })

  it('caps antdv-next below the next major', () => {
    expect(rangeForLibrary('antdv-next', '1.5.4')).toBe('>=1.5.4 <2')
  })

  it('leaves @vueuse/core without an upper bound', () => {
    expect(rangeForLibrary('@vueuse/core', '15.0.0')).toBe('>=15.0.0')
  })

  it('drops prerelease and build metadata from the lower bound', () => {
    expect(rangeForLibrary('antdv-next', '1.9.0-beta.1')).toBe('>=1.9.0 <2')
    expect(rangeForLibrary('@vueuse/core', '15.1.0+build.2')).toBe('>=15.1.0')
  })

  it('fills in a missing minor and patch', () => {
    expect(rangeForLibrary('vue', '3')).toBe('>=3.0.0 <4')
  })

  it('passes an unparseable version through unchanged', () => {
    expect(rangeForLibrary('vue', 'workspace:*')).toBe('workspace:*')
  })
})

describe('buildSharedManifest', () => {
  it('builds a range per resolved version and skips missing ones', () => {
    const shared = buildSharedManifest({
      'vue': '3.5.42',
      'antdv-next': '1.5.4',
      'vue-router': null,
      '@vueuse/core': undefined,
    })

    expect(shared).toEqual({
      'vue': '>=3.5.42 <4',
      'antdv-next': '>=1.5.4 <2',
    })
  })
})
