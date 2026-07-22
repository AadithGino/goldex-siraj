import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GoldRateHistoryTable, StoneRateHistoryTable } from './RateHistoryTable.jsx'

describe('RateHistoryTable', () => {
  it('renders a gold rate with effective_at', () => {
    render(
      <GoldRateHistoryTable
        rows={[
          {
            id: 'g1',
            purity: '22k',
            rate_per_gram: 250,
            effective_at: '2026-07-20T10:00:00.000Z',
            changed_by_name: 'Asha',
            is_current: true,
          },
        ]}
      />,
    )
    expect(screen.getByText('22K')).toBeTruthy()
    expect(screen.getByText('20 Jul 2026')).toBeTruthy()
    expect(screen.getByText('Asha')).toBeTruthy()
    expect(screen.getByText('Current')).toBeTruthy()
  })

  it('renders a stone rate with effective_at', () => {
    render(
      <StoneRateHistoryTable
        rows={[
          {
            id: 's1',
            stone_type: 'diamond',
            grade: 'VS',
            unit: 'carat',
            rate_per_unit: 1200,
            effective_at: '2026-07-18T08:00:00.000Z',
            changed_by_name: 'Ravi',
          },
        ]}
      />,
    )
    expect(screen.getByText(/VS/)).toBeTruthy()
    expect(screen.getByText('18 Jul 2026')).toBeTruthy()
    expect(screen.getByText('Ravi')).toBeTruthy()
  })

  it('renders — for missing or invalid effective_at without crashing', () => {
    const { container } = render(
      <>
        <GoldRateHistoryTable
          rows={[
            { id: 'missing', purity: '18k', rate_per_gram: 180 },
            { purity: '14k', rate_per_gram: 140, effective_at: 'bad-date' },
          ]}
        />
        <StoneRateHistoryTable
          rows={[
            { stone_type: 'ruby', grade: 'A', unit: 'carat', rate_per_unit: 90, effective_at: null },
            { id: 'bad-stone', stone_type: 'emerald', grade: 'B', unit: 'piece', rate_per_unit: 40, effective_at: 'nope' },
          ]}
        />
      </>,
    )

    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(4)
    expect(container.querySelectorAll('.rounded-2xl').length).toBe(4)
  })
})
