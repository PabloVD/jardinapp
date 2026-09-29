// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ApproxDate } from '../lib/types'
import { ApproxDateInput } from './ApproxDateInput'

afterEach(cleanup)

// Padre controlado, como PlantForm: guarda cada cambio y vuelve a pasarlo como value.
function Harness({ initial }: { initial?: ApproxDate }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <ApproxDateInput label="Fecha" value={value} onChange={setValue} />
      <output data-testid="value">{value ?? ''}</output>
    </>
  )
}

const value = () => screen.getByTestId('value').textContent

describe('ApproxDateInput', () => {
  it('permite escribir un año tecla a tecla sin perder el foco', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2026" />)
    const year = screen.getByLabelText('Año')
    await user.click(year) // selecciona todo el texto
    await user.keyboard('2')
    expect(screen.getByLabelText('Año')).toBe(year)
    expect(year).toHaveProperty('value', '2')
    expect(value()).toBe('2026') // aún no es un año válido: no se guarda
    await user.keyboard('019')
    expect(document.activeElement).toBe(year)
    expect(value()).toBe('2019')
  })

  it('permite borrar el año y escribir otro', async () => {
    const user = userEvent.setup()
    render(<Harness initial="<=2020" />)
    const year = screen.getByLabelText('Año')
    await user.clear(year)
    expect(year).toHaveProperty('value', '')
    await user.type(year, '1998')
    expect(value()).toBe('<=1998')
  })

  it('restaura el año válido al salir con un valor incompleto', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2021" />)
    const year = screen.getByLabelText('Año')
    await user.clear(year)
    await user.type(year, '19')
    await user.tab()
    expect(year).toHaveProperty('value', '2021')
    expect(value()).toBe('2021')
  })

  it('añade fecha y cambia precisión, mes y día', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('+ Añadir fecha'))
    await user.selectOptions(screen.getByLabelText('Tipo de fecha'), 'approx')
    await user.selectOptions(screen.getByLabelText('Precisión'), 'day')
    await user.selectOptions(screen.getByLabelText('Mes'), '2')
    await user.selectOptions(screen.getByLabelText('Día'), '28')
    await user.type(screen.getByLabelText('Año'), '{Control>}a{/Control}2024')
    expect(value()).toBe('~2024-02-28')
  })

  it('ajusta el día si el mes nuevo tiene menos días', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2023-01-31" />)
    await user.selectOptions(screen.getByLabelText('Mes'), '2')
    expect(value()).toBe('2023-02-28')
  })

  it('quita la fecha', async () => {
    const user = userEvent.setup()
    render(<Harness initial="2021" />)
    await user.click(screen.getByLabelText('Quitar fecha'))
    expect(value()).toBe('')
    expect(screen.getByText('+ Añadir fecha')).toBeTruthy()
  })
})
