import { Link } from 'react-router-dom'
import { Check, Compass } from 'lucide-react'
import type { JourneyPosition } from '../state/journey'
import { requestHeadingFocus } from '../state/journey-focus'

/** "Area · Step n of m" strip with the numbered step bar, shown above every journey page. */
export default function JourneyBar({ position }: { position: JourneyPosition }) {
  const { steps, number, total, step, subStep } = position
  return <div data-nav="journey" className="no-print mb-6 rounded-lg border border-sky-200 bg-sky-50/80 px-4 py-2.5 text-sm text-slate-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-slate-200">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Compass className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" aria-hidden="true" />
      <p className="min-w-0 shrink-0">
        <strong className="font-semibold">{position.label}</strong>
        <span className="text-slate-400" aria-hidden="true"> · </span><span className="sr-only">, </span>
        <span>Step {number} of {total}</span>
        {subStep && <span className="text-slate-500 dark:text-slate-400"> · {subStep.label}</span>}
      </p>
      <Link to={position.home} onClick={requestHeadingFocus} className="ml-auto shrink-0 font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300">{position.homeLabel}</Link>
    </div>
    <ol aria-label={position.label + ' steps'} className="mt-2 flex flex-wrap items-center gap-y-1.5">
      {steps.map((s, i) => {
        const current = i + 1 === number
        const done = i + 1 < number
        return <li key={s.route} className="flex items-center">
          {i > 0 && <span aria-hidden="true" className={'mx-1.5 h-px w-3 shrink-0 ' + (done || current ? 'bg-brand-400' : 'bg-slate-300 dark:bg-slate-600')} />}
          <Link to={s.route} onClick={requestHeadingFocus} aria-current={current ? 'step' : undefined} title={s.description}
            className={'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs transition-colors ' + (current ? 'bg-brand-600 font-semibold text-white' : done ? 'bg-brand-100 text-brand-800 hover:bg-brand-200 dark:bg-brand-900 dark:text-brand-100 dark:hover:bg-brand-800' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800')}>
            {done ? <Check className="h-3 w-3" aria-hidden="true" /> : <span className="tabular-nums">{i + 1}</span>}
            <span className={current ? '' : 'hidden lg:inline'}>{s.label}</span>
            {done && <span className="sr-only">(completed)</span>}
          </Link>
          {current && step.subSteps && step.subSteps.length > 0 && <span className="ml-2 hidden items-center gap-1 border-l border-slate-300 pl-2 dark:border-slate-600 lg:inline-flex">
            {step.subSteps.map(sub => <Link key={sub.route} to={sub.route} onClick={requestHeadingFocus} aria-current={subStep?.route === sub.route ? 'page' : undefined}
              className={'rounded px-1.5 py-0.5 text-[11px] ' + (subStep?.route === sub.route ? 'bg-brand-100 font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-100' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800')}>{sub.label}</Link>)}
          </span>}
        </li>
      })}
    </ol>
  </div>
}
