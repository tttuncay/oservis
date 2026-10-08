# Dependency Audit Exceptions

NFR-SEC-060 requires dependency scanning on every build (SDD §16). CI runs:

```bash
pnpm audit --prod --audit-level high
```

Three deliberate choices, each with a reason:

| Choice | Why |
|---|---|
| `--prod` | Audits what ships. Advisories in build tooling (Nest CLI, Vite, Expo CLI, Prisma CLI) are real but cannot reach a running system, and blocking every build on them trains everyone to ignore a red build. Dependabot raises them as pull requests instead. |
| `--audit-level high` | High and critical block the build. Moderate and low arrive as Dependabot pull requests. |
| `pnpm.overrides` | Where a transitive dependency has a same-major patched version, it is forced rather than waited for. |

## Active overrides

`package.json` → `pnpm.overrides`. Each is a same-major bump, so the parent's API contract is unchanged.

| Package | Forced to | Reached through | Advisory |
|---|---|---|---|
| `multer` | `>=2.2.0` | `@nestjs/platform-express` | GHSA-xf7r-hgr6-v32p, GHSA-v52c-386h-88mc, GHSA-5528-5vmv-3xc2, GHSA-72gw-mp4g-v24j |
| `lodash` | `>=4.18.1` | `@nestjs/config` | GHSA-r5fr-rjxr-66jc |
| `postcss` | `>=8.5.18` | `@expo/metro-config`, `tailwindcss` | GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849 |
| `nanoid` | `^3.3.18` | `@expo/metro-config` → `postcss` | GHSA-2v37-7h3g-55p8 |

`nanoid` is the one entry written as a caret rather than `>=`, and deliberately. The patch lands in
`3.3.18`, but `nanoid@5` is ESM-only and `postcss` — the only thing that reaches it — is CommonJS. A
`>=` range resolves to the newest release, which here means the major that cannot be `require`d, and
the failure arrives at bundle time rather than at install. The caret keeps the fix and the major.

**Remove an override** when the parent package ships a version that already resolves to the patched
release. Leaving a stale override pinned above what the ecosystem needs is its own hazard.

### `socket.io` — deduplication, not an advisory

| Package | Forced to | Reached through | Why |
|---|---|---|---|
| `socket.io` | `4.8.1` | `@nestjs/platform-socket.io`, and `apps/api` directly | one copy, one set of types |

The only override here that is not about a vulnerability. `@nestjs/platform-socket.io@10` pins
`socket.io@4.8.1`; Phase 7 added `socket.io` as a direct dependency of `apps/api`, which resolved to
`4.8.3` and produced **two installed copies**. The runtime tolerates that; TypeScript does not — the
`Server` handed to a custom `IoAdapter` comes from one copy and `@socket.io/redis-adapter` expects
the other, and the resulting error is four hundred lines about `Types have separate declarations of
a private property 'id'`.

Pinned to the exact version rather than a range, because a range is what caused it: `^4.8.1` lets
the direct dependency float ahead of the pinned transitive one and the copies diverge again on the
next patch release. **Bump this in step with `@nestjs/platform-socket.io`** — checking what that
package pins is the whole of the maintenance burden.

## Suppressed advisories

`package.json` → `pnpm.auditConfig.ignoreGhsas`. Suppression is not a judgement that the advisory is
wrong — it records that the fix is not available to us at this pin.

### `image-size` — 2 advisories, no fixed release anywhere

GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq

**Reached through:** `expo@54` → `@expo/cli` → `@expo/metro` → `metro@0.83.3` → `image-size@1.2.1`,
and `react-native@0.81` → `@react-native/community-cli-plugin` → the same `metro`.
**Why not fixed:** there is nothing to upgrade to. Both advisories report their patched range as
`<0.0.0` — the registry's way of saying no released version carries a fix — and the vulnerable range
`<=2.0.2` covers the latest release. An override cannot resolve this one; only upstream can.
**Exposure:** Metro reads image dimensions while bundling, from assets in this repository. Both
advisories are infinite-loop denial of service in the ICNS, JXL and HEIF parsers, so the worst case
is a build that hangs on a file we committed ourselves. `image-size` is a bundler tool: it is not in
the shipped application and never sees a network or user-supplied image.
**Removal condition:** when `image-size` ships a patched release and Metro picks it up. Re-check at
every Expo SDK upgrade, and no later than the first production release.

### `extract-zip` — 1 advisory

GHSA-jmr9-qjv8-65gv — unvalidated symlink path traversal, CVSS 8.1.

**Reached through:** `apps/api` → `puppeteer@23.11.1` → `@puppeteer/browsers@2.6.1` →
`extract-zip@2.0.1`.
**Why not fixed:** patched range is `<0.0.0` and the vulnerable range `<=2.0.1` includes the latest
release. The package is no longer maintained, so no override helps at this pin.
**Exposure:** `@puppeteer/browsers` calls it once, to unpack the Chromium archive it downloads from
Google's CDN when the dependency is installed. PDF rendering (FR-FIN-280, FR-RPT-070) drives an
already-installed browser and never opens an archive; nothing here extracts a zip that reached us
from a user or a tenant.
**Removal condition:** concrete, and not dependent on the upstream fix that will never come —
`@puppeteer/browsers@3.2.0` drops `extract-zip` entirely in favour of `modern-tar`. Bumping
`apps/api` to `puppeteer@25` removes the advisory rather than suppressing it. That bump is a major
version of the PDF pipeline and belongs in its own change; take it before the first production
release.

## Review

This file is reviewed at every dependency bump that touches NestJS or Expo, and before the first
production release. An entry with no removal condition, or one whose condition has been met, is a
defect in this file.
