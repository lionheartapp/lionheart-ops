/**
 * @vitest-environment jsdom
 */
/**
 * Component tests for PeoplePicker
 *
 * Tests rendering, search filtering, selection, and removal.
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PeoplePicker } from '@/components/events/PeoplePicker'

// ── Mock TanStack Query data ────────────────────────────────────────────────

const mockUsers = [
  { id: 'u1', firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com', avatar: null, jobTitle: 'Teacher', teams: [] },
  { id: 'u2', firstName: 'Bob', lastName: 'Jones', email: 'bob@example.com', avatar: null, jobTitle: 'Admin', teams: [] },
  { id: 'u3', firstName: 'Carol', lastName: 'Davis', email: 'carol@example.com', avatar: null, jobTitle: null, teams: [{ team: { id: 't1', name: 'IT Support' } }] },
]

vi.mock('@/lib/queries', () => ({
  queryOptions: {
    members: () => ({
      queryKey: ['members'],
      queryFn: () => Promise.resolve(mockUsers),
    }),
  },
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function renderPicker(props: { selectedUserIds?: string[]; onChange?: (ids: string[]) => void } = {}) {
  const onChange = props.onChange ?? vi.fn()
  const selectedUserIds = props.selectedUserIds ?? []
  return {
    onChange,
    ...render(
      <PeoplePicker selectedUserIds={selectedUserIds} onChange={onChange} />,
      { wrapper: createWrapper() }
    ),
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('PeoplePicker', () => {
  it('renders the search input', () => {
    renderPicker()
    expect(screen.getByPlaceholderText('Search by name or email...')).toBeInTheDocument()
  })

  it('renders the section header', () => {
    renderPicker()
    expect(screen.getByText('Request Specific People')).toBeInTheDocument()
  })

  it('shows dropdown with users when search input is focused', async () => {
    renderPicker()
    const input = screen.getByPlaceholderText('Search by name or email...')
    fireEvent.focus(input)

    // Wait for query to resolve
    const alice = await screen.findByText('Alice Smith')
    expect(alice).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    expect(screen.getByText('Carol Davis')).toBeInTheDocument()
  })

  it('filters users by search text', async () => {
    renderPicker()
    const input = screen.getByPlaceholderText('Search by name or email...')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'alice' } })

    const alice = await screen.findByText('Alice Smith')
    expect(alice).toBeInTheDocument()
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument()
  })

  it('calls onChange when a user is clicked in dropdown', async () => {
    const onChange = vi.fn()
    renderPicker({ onChange })
    const input = screen.getByPlaceholderText('Search by name or email...')

    fireEvent.focus(input)
    const alice = await screen.findByText('Alice Smith')
    fireEvent.click(alice.closest('button')!)

    expect(onChange).toHaveBeenCalledWith(['u1'])
  })

  it('renders selected users as chips', async () => {
    renderPicker({ selectedUserIds: ['u1'] })

    // Wait for query to resolve so selected users populate
    const chip = await screen.findByText('Alice Smith')
    expect(chip).toBeInTheDocument()
  })

  it('excludes already-selected users from dropdown', async () => {
    renderPicker({ selectedUserIds: ['u1'] })
    const input = screen.getByPlaceholderText('Search by name or email...')

    fireEvent.focus(input)

    // Bob should appear, Alice should not (she's selected)
    const bob = await screen.findByText('Bob Jones')
    expect(bob).toBeInTheDocument()

    // Alice appears as a chip, not in the dropdown list
    // The dropdown buttons should not include Alice
    const dropdown = screen.getByPlaceholderText('Search by name or email...')
      .closest('.relative')!
      .querySelector('.absolute')
    if (dropdown) {
      expect(within(dropdown as HTMLElement).queryByText('Alice Smith')).not.toBeInTheDocument()
    }
  })

  it('calls onChange to remove user when X button is clicked on chip', async () => {
    const onChange = vi.fn()
    renderPicker({ selectedUserIds: ['u1', 'u2'], onChange })

    // Wait for chips to render
    const aliceChip = await screen.findByText('Alice Smith')
    const removeButton = aliceChip.closest('span')!.querySelector('button')!
    fireEvent.click(removeButton)

    // Should call with u2 only (u1 removed)
    expect(onChange).toHaveBeenCalledWith(['u2'])
  })

  it('shows initials when user has no avatar', async () => {
    renderPicker({ selectedUserIds: ['u1'] })
    // Alice Smith → "AS"
    const initialsEl = await screen.findByText('AS')
    expect(initialsEl).toBeInTheDocument()
  })

  it('shows "No matching people found" when search yields no results', async () => {
    renderPicker()
    const input = screen.getByPlaceholderText('Search by name or email...')

    fireEvent.focus(input)
    // Wait for initial data
    await screen.findByText('Alice Smith')

    fireEvent.change(input, { target: { value: 'zzzznonexistent' } })

    expect(screen.getByText('No matching people found')).toBeInTheDocument()
  })
})
