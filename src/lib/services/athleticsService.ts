/**
 * athleticsService.ts — backwards-compatible barrel
 *
 * The athletics service and its submodules now live in src/lib/services/athletics/.
 * This file re-exports the public API so existing imports continue to work.
 */
export * from './athletics/index'
