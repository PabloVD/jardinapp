// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Draft } from '../lib/cache'
import { AuthPopupError } from '../lib/google/auth'
import { NewFromPhoto } from './NewFromPhoto'

// Borrador en memoria en lugar de IndexedDB.
let storedDraft: Draft | undefined
vi.mock('../lib/cache', () => ({
  loadDraft: vi.fn(async () => storedDraft),
  saveDraft: vi.fn(async (d: Draft) => void (storedDraft = d)),
  clearDraft: vi.fn(async () => void (storedDraft = undefined)),
}))

const createPlant = vi.fn()
vi.mock('../lib/store', () => ({
  createPlant: (...args: unknown[]) => createPlant(...args),
  emptyFields: () => ({ commonName: '' }),
  useStore: () => ({ catalog: { version: 1, nextId: 1, plants: [] }, status: 'idle', dirty: false }),
}))

beforeEach(() => {
  storedDraft = undefined
  createPlant.mockReset()
  vi.stubGlobal('confirm', () => true)
  URL.createObjectURL = vi.fn(() => `blob:${Math.random()}`)
  URL.revokeObjectURL = vi.fn()
})
afterEach(cleanup)

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/nueva']}>
      <Routes>
        <Route path="/nueva" element={<NewFromPhoto />} />
        <Route path="/planta/:id" element={<p>ficha creada</p>} />
        <Route path="/" element={<p>lista</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function startWithoutPhoto(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByText('Crear sin foto'))
  await user.type(screen.getByPlaceholderText('p. ej. Romero'), name)
}

describe('NewFromPhoto', () => {
  it('si el login de Google falla al guardar, la ficha sigue ahí y se puede reintentar', async () => {
    const user = userEvent.setup()
    renderPage()
    await startWithoutPhoto(user, 'Lavanda')

    createPlant.mockRejectedValueOnce(new AuthPopupError('popup_closed'))
    await user.click(screen.getByText('Guardar'))
    expect(await screen.findByText(/Se cerró la ventana de Google/)).toBeTruthy()
    expect(screen.getByPlaceholderText('p. ej. Romero')).toHaveProperty('value', 'Lavanda')

    createPlant.mockResolvedValueOnce('P-007')
    await user.click(screen.getByText('Guardar'))
    expect(await screen.findByText('ficha creada')).toBeTruthy()
    expect(createPlant).toHaveBeenCalledTimes(2)
    expect(createPlant.mock.calls[1][0]).toMatchObject({ commonName: 'Lavanda' })
    expect(storedDraft).toBeUndefined()
  })

  it('guarda el borrador y lo recupera al volver a la pantalla', async () => {
    const user = userEvent.setup()
    const first = renderPage()
    await startWithoutPhoto(user, 'Albahaca')
    await waitFor(() => expect(storedDraft?.fields.commonName).toBe('Albahaca'))
    first.unmount()

    renderPage()
    expect(await screen.findByText(/Borrador recuperado/)).toBeTruthy()
    expect(screen.getByPlaceholderText('p. ej. Romero')).toHaveProperty('value', 'Albahaca')
  })

  it('descartar borra el borrador', async () => {
    const user = userEvent.setup()
    renderPage()
    await startWithoutPhoto(user, 'Menta')
    await waitFor(() => expect(storedDraft).toBeDefined())
    await user.click(screen.getByText('Descartar'))
    expect(await screen.findByText('lista')).toBeTruthy()
    expect(storedDraft).toBeUndefined()
  })
})
