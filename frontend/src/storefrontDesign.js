export const DEFAULT_DESIGN = {
  background_color: '#fbf9f4',
  surface_color: '#fffdf9',
  text_color: '#20241f',
  hero_layout: 'split',
  card_layout: 'grid',
  corner_style: 'soft',
  sections: { hero: true, services: true, story: true, footer: true },
  section_order: ['hero', 'services', 'menu', 'story'],
  story_image_url: null,
}

export const mergeDesign = (design) => {
  const value = design || {}
  const order = Array.isArray(value.section_order) && value.section_order.length === 4
    ? value.section_order
    : DEFAULT_DESIGN.section_order
  return {
    ...DEFAULT_DESIGN,
    ...value,
    sections: { ...DEFAULT_DESIGN.sections, ...(value.sections || {}) },
    section_order: order,
  }
}
