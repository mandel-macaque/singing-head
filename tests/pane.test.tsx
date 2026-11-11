import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'singing-head',
  component: 'Pane',
  requestId: 'singing-head',
  props: {
    title: 'Singing head',
    isFocused: false,
    bodyColumns: 48,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 34 },
    view: {},
  },
} as const

test('the head is drawn on every surface: braille in the terminal, an SVG elsewhere', async $ => {
  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const raster = await terminal.find({ key: 'head' })
  expect(raster?.type).toBe('Raster')
  await terminal.unmount()

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    const svg = await ui.find({ type: 'Svg' })
    expect(svg?.type).toBe('Svg')
    await ui.unmount()
  }
})

test('a narrow, short terminal pane still gets a head that fits', async $ => {
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', props: { ...PANE.props, bodyColumns: 20, placement: 'inline', scroll: { offset: 0, bodyRows: 8 } } })
  expect((await ui.find({ key: 'head' }))?.type).toBe('Raster')
  await ui.unmount()
})
