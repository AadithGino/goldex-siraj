import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function WizardStepper({ steps, currentStep, onStepClick, canGoToStep }) {
  return (
    <nav aria-label="Product wizard progress" className="mb-8">
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {steps.map((step, index) => {
          const done = currentStep > step.id
          const active = currentStep === step.id
          const clickable = canGoToStep(step.id)

          return (
            <li key={step.id} className="flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center">
              {index > 0 && (
                <div
                  className={cn(
                    'hidden h-px flex-1 self-center sm:block',
                    done ? 'bg-gold' : 'bg-gold/20'
                  )}
                  aria-hidden
                />
              )}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick(step.id)}
                className={cn(
                  'flex shrink-0 items-center gap-3 sm:flex-col sm:gap-2',
                  clickable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors',
                    active && 'border-navy bg-navy text-gold-3',
                    done && !active && 'border-gold bg-gold text-navy',
                    !active && !done && 'border-gold/30 bg-ivory-2 text-muted'
                  )}
                >
                  {done ? <Check className="h-5 w-5" /> : step.id}
                </span>
                <span className="min-w-0 text-left sm:text-center">
                  <span className={cn('block text-sm font-semibold', active ? 'text-navy' : 'text-muted')}>
                    {step.label}
                  </span>
                  <span className="hidden text-xs text-muted sm:block">{step.description}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
