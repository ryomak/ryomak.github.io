/**
 * Splits a markdown document into slides at top-level thematic breaks (`---`),
 * wrapping each run of nodes in a <section class="slide">.
 *
 * Only documents whose frontmatter says `slides: true` are touched, so an
 * ordinary blog post can keep using `---` as a horizontal rule.
 *
 * It runs on mdast (before rehype), which is what keeps the rest of the
 * pipeline — katex, admonitions, link cards, syntax highlighting — working
 * inside slides exactly as it does in posts.
 */
export function remarkSlides() {
  return (tree, file) => {
    const frontmatter = file?.data?.astro?.frontmatter
    if (!frontmatter || frontmatter.slides !== true) return

    const slides = []
    let current = []

    const flush = () => {
      // a leading `---` (or two in a row) shouldn't produce an empty slide
      if (current.length === 0) return
      slides.push({
        type: 'slide',
        data: {
          hName: 'section',
          hProperties: {
            class: 'slide',
            'data-slide': String(slides.length),
          },
        },
        children: current,
      })
      current = []
    }

    for (const node of tree.children) {
      if (node.type === 'thematicBreak') {
        flush()
        continue
      }
      current.push(node)
    }
    flush()

    tree.children = slides
    frontmatter.slideCount = slides.length
  }
}
