import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { JourneyPosition, JourneyStep } from '../state/journey'
import { requestHeadingFocus } from '../state/journey-focus'

function NextCard({ to, label, description, eyebrow, secondary }: { to: string; label: string; description: string; eyebrow: string; secondary?: boolean }) {
  return <Link to={to} onClick={requestHeadingFocus} aria-label={label} aria-describedby="workflow-next-description"
    className={'group flex w-full sm:w-auto sm:min-w-[20rem] sm:max-w-md items-center justify-between gap-5 rounded-xl border px-5 py-4 text-left shadow-sm transition hover:-translate-y-px hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 '
      + (secondary ? 'border-gray-300 bg-white text-gray-900 hover:border-brand-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100' : 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700')}>
    <span className="min-w-0">
      <span aria-hidden="true" className="block text-[11px] font-bold uppercase tracking-wider opacity-75">{eyebrow}</span>
      <strong className="block text-base leading-snug">{label}</strong>
      <span id="workflow-next-description" className="mt-0.5 block text-xs leading-snug opacity-85">{description}</span>
    </span>
    <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-0.5" aria-hidden="true" />
  </Link>
}

function BackLink({ step }: { step: JourneyStep }) {
  const label = `Back to ${step.label}`
  return <Link to={step.route} onClick={requestHeadingFocus} aria-label={label}
    className="inline-flex items-center gap-2.5 rounded-md px-1 py-2 text-gray-600 hover:text-brand-700 dark:text-gray-300 dark:hover:text-brand-300">
    <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
    <span><span aria-hidden="true" className="block text-[11px] font-bold uppercase tracking-wider opacity-70">Previous</span><strong className="block text-sm">{label}</strong></span>
  </Link>
}

/** Previous / Continue footer shown below every journey page. */
export default function WorkflowNav({ position }: { position: JourneyPosition }) {
  const { previous, next, number, total } = position
  return <nav aria-label="Step navigation" data-nav="workflow" className="no-print mt-10 flex flex-col-reverse gap-4 border-t border-gray-200 pt-6 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
    <div>{previous && <BackLink step={previous} />}</div>
    {next
      ? <NextCard to={next.route} label={`Continue to ${next.label}`} description={next.description} eyebrow={`Next · step ${number + 1} of ${total}`} />
      : <NextCard to={position.home} label={`Back to ${position.homeLabel}`} description={`You have reached the last ${position.label} step.`} eyebrow="Finished" secondary />}
  </nav>
}
