/// <reference types="mdast" />
import { h } from 'hastscript'

/**
 * Creates an embeddable local slide deck.
 *
 * Usage:
 *   ::slide{slug="hello-slides" title="Markdown で書くスライド"}
 *
 * @param {Object} properties
 * @param {string} properties.slug - Slide collection slug.
 * @param {string} [properties.title] - Human-readable iframe title.
 * @param {import('mdast').RootContent[]} children
 * @returns {import('mdast').Parent}
 */
export function SlideEmbedComponent(properties, children) {
  if (Array.isArray(children) && children.length !== 0)
    return h('div', { class: 'hidden' }, [
      'Invalid directive. ("slide" directive must be leaf type "::slide{slug="hello-slides"}")',
    ])

  const slug = String(properties.slug || '').trim().replace(/^\/+|\/+$/g, '')
  if (!slug || slug.includes('..'))
    return h('div', { class: 'hidden' }, [
      'Invalid slide embed. ("slug" attribute is required)',
    ])

  const title = properties.title || `Slide deck: ${slug}`
  const href = `/slides/${slug}/`

  return h('figure', { class: 'slide-embed' }, [
    h('div', { class: 'slide-embed-frame' }, [
      h('iframe', {
        src: href,
        title,
        loading: 'lazy',
        allowfullscreen: true,
        allow: 'fullscreen',
        'data-no-swup': true,
      }),
    ]),
    h('figcaption', { class: 'slide-embed-caption' }, [
      h('span', title),
      h(
        'a',
        { href, class: 'no-styling', target: '_blank', rel: 'noopener', 'data-no-swup': true },
        'Open deck',
      ),
    ]),
  ])
}
