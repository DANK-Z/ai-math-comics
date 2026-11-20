import type { Comic } from '../api/types'
import panel1 from '../assets/pizza/panel-1.png'
import panel2 from '../assets/pizza/panel-2.png'
import panel3 from '../assets/pizza/panel-3.png'
import panel4 from '../assets/pizza/panel-4.png'
import panel5 from '../assets/pizza/panel-5.png'
import panel6 from '../assets/pizza/panel-6.png'

const images = [panel1, panel2, panel3, panel4, panel5, panel6]

/** Retain the demo's API content and use the bundled art in both API modes. */
export function withPizzaArtwork(comic: Comic): Comic {
  return {
    ...comic,
    panels: comic.panels.map(panel => {
      const image = images[panel.id - 1]
      if (!image) return panel
      return {
        ...panel,
        imageUrl: new URL(image, window.location.href).href,
        imageAspect: 8 / 3,
      }
    }),
  }
}
