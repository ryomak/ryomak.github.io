export type SiteConfig = {
  title: string
  subtitle: string

  lang: string

  themeHue: number
  banner: {
    enable: boolean
    src: string
  }

  favicon: Favicon[]

  xmlFeeds: string[]
}

export type Favicon = {
  src: string,
  theme?: 'light' | 'dark'
  sizes?: string
}

export enum LinkPreset {
  Home = 0,
  Archive = 1,
  Blog = 2,
  Works = 3,
  Art = 4,
}

export type NavBarLink = {
  name: string
  url: string
  external?: boolean
}

export type NavBarConfig = {
  links: (NavBarLink | LinkPreset)[]
}

export type ProfileConfig = {
  avatar?: string
  name: string
  bio?: string
  links: {
    name: string
    url: string
    icon: string
  }[]
}

export type LicenseConfig = {
  enable: boolean
  name: string
  url: string
}

export type PinnedRepository = {
    name: string
    description: string
    url: string
}


export type FeedItem = {
  title: string;
  published: Date;
  draft: boolean;
  description: string;
  image: string;
  tags : string[];
  category: string;
  external: boolean;
  link: string;
};