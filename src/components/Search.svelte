<script lang="ts">
import { onMount } from 'svelte'
let keywordDesktop = ''
let keywordMobile = ''
let result = []
const fakeResult = [
  {
    url: '/',
    meta: {
      title: 'This Is a Fake Search Result',
    },
    excerpt:
      'Because the search cannot work in the <mark>dev</mark> environment.',
  },
  {
    url: '/',
    meta: {
      title: 'If You Want to Test the Search',
    },
    excerpt: 'Try running <mark>npm build && npm preview</mark> instead.',
  },
]

let search = (keyword: string, isDesktop: boolean) => {}

onMount(() => {
  search = async (keyword: string, isDesktop: boolean) => {
    let panel = document.getElementById('search-panel')
    if (!panel) return

    if (!keyword && isDesktop) {
      panel.classList.add('closed')
      return
    }

    let arr = []
    if (import.meta.env.PROD) {
      const ret = await pagefind.search(keyword)
      for (const item of ret.results) {
        arr.push(await item.data())
      }
    } else {
      // Mock data for non-production environment
      arr = fakeResult
    }

    if (!arr.length && isDesktop) {
      panel.classList.add('closed')
      return
    }

    if (isDesktop) {
      panel.classList.remove('closed')
    }
    result = arr
  }
})

const togglePanel = () => {
  let panel = document.getElementById('search-panel')
  panel?.classList.toggle('closed')
}

$: search(keywordDesktop, true)
$: search(keywordMobile, false)
</script>

<!-- search bar for desktop view -->
<div id="search-bar" class="hidden lg:flex transition-all items-center h-11 mr-2 rounded-lg
      bg-black/[0.04] hover:bg-black/[0.06] focus-within:bg-black/[0.06]
      dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10
">
    <slot name="search-icon"></slot>
    <input placeholder="Search" bind:value={keywordDesktop} on:focus={() => search(keywordDesktop, true)}
           class="transition-all pl-10 text-sm bg-transparent outline-0
         h-full w-40 active:w-60 focus:w-60 text-black/50 dark:text-white/50"
    >
</div>

<!-- toggle btn for phone/tablet view -->
<button on:click={togglePanel} aria-label="Search Panel" id="search-switch"
        class="btn-plain lg:hidden rounded-lg w-11 h-11 active:scale-90">
    <slot name="search-switch"></slot>
</button>

<!-- search panel -->
<div id="search-panel" class="float-panel closed search-panel absolute md:w-[30rem]
top-20 left-4 md:left-[unset] right-4 shadow-2xl rounded-2xl p-2">

    <!-- search bar inside panel for phone/tablet -->
    <div id="search-bar-inside" class="flex relative lg:hidden transition-all items-center h-11 rounded-xl
      bg-black/[0.04] hover:bg-black/[0.06] focus-within:bg-black/[0.06]
      dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10
  ">
        <slot name="search-icon"></slot>
        <input placeholder="Search" bind:value={keywordMobile}
               class="pl-10 absolute inset-0 text-sm bg-transparent outline-0
               focus:w-60 text-black/50 dark:text-white/50"
        >
    </div>

    <!-- search results -->
    {#each result as item}
        <a href={item.url}
           class="transition first-of-type:mt-2 lg:first-of-type:mt-0 group block
       rounded-xl text-lg px-3 py-2 hover:bg-[var(--btn-plain-bg-hover)] active:bg-[var(--btn-plain-bg-active)]">
            <div class="transition text-90 inline-flex font-bold group-hover:text-[var(--primary)]">
                {item.meta.title}<slot name="arrow-icon"></slot>
            </div>
            <div class="transition text-sm text-50">
                {@html item.excerpt}
            </div>
        </a>
    {/each}
</div>
