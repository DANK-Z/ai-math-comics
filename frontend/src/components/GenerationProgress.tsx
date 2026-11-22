import type { JobProgress } from '../api'
import type { UiStrings } from '../i18n'

export function GenerationProgress({ t, stage, progress, stopped = false }: {
  t: UiStrings
  stage?: 'submitting' | 'queued' | 'storyboard'
  progress?: JobProgress
  stopped?: boolean
}) {
  const current = progress?.stage ?? stage
  if (!current) return null

  const labels = {
    submitting: t.submitting,
    queued: t.jobQueued,
    storyboard: t.jobStoryboard,
    drawing: t.jobDrawing,
    preparing: t.jobPreparing,
    ready: t.jobReady,
  }
  const title = labels[current]
  const total = progress?.totalPanels
  const completed = progress?.completedPanels
  const count = typeof total === 'number' && total > 0 && typeof completed === 'number'
    ? t.jobPanelCount(completed, total)
    : null

  return (
    <div className="min-w-0">
      <div role="status">
        <p className="font-black">{title}</p>
        {count && <p className="mt-1 text-sm font-bold tabular-nums">{count}</p>}
      </div>
      {(!stopped || count) && (
        <progress
          aria-label={title}
          value={count ? completed : undefined}
          max={count ? total : undefined}
          className="mt-2 block h-3 w-full accent-brand"
        />
      )}
    </div>
  )
}
