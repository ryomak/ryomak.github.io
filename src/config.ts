import type {
  LicenseConfig,
  NavBarConfig,
  PinnedRepository,
  ProfileConfig,
  SiteConfig,
} from './types/config'
import { LinkPreset } from './types/config'

export const siteConfig: SiteConfig = {
  title: 'ryomak | kurisu',
  subtitle: 'profile',
  lang: 'ja',
  themeHue: 160,
  banner: {
    enable: false,
    src: 'assets/images/demo-banner.png',
  },
  favicon: [
    // Leave this array empty to use the default favicon
    {
      src: '/favicon/favicon.png', // Path of the favicon, relative to the /public directory
    },
  ],
  xmlFeeds: ['https://zenn.dev/ryomak/feed', 'https://note.com/ryomak13/rss', "https://scrapbox.io/api/feed/ryomak/"],
}

export const navBarConfig: NavBarConfig = {
  links: [
    LinkPreset.Home,
    LinkPreset.Archive,
    LinkPreset.Blog,
    LinkPreset.Works,
    LinkPreset.Art,
    {
      name: 'GitHub',
      url: 'https://github.com/ryomak',
      external: true,
    },
    {
      name: 'X',
      url: 'https://twitter.com/ryomak_13',
      external: true,
    },
  ],
}

export const profileConfig: ProfileConfig = {
  avatar: 'https://avatars.githubusercontent.com/u/21288308',
  name: 'ryomak | kurisu',
  bio: 'バックエンドエンジニア',
  links: [
    {
      name: 'X',
      icon: 'fa6-brands:x-twitter',
      url: 'https://twitter.com/ryomak_13',
    },
    {
      name: 'GitHub',
      icon: 'fa6-brands:github',
      url: 'https://github.com/ryomak',
    },
    {
      name: 'Zenn',
      icon: 'zenn',
      url: 'https://zenn.dev/ryomak',
    },
  ],
}

export const licenseConfig: LicenseConfig = {
  enable: true,
  name: 'CC BY-NC-SA 4.0',
  url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
}
