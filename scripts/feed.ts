import fs from "fs-extra";
import Parser from "rss-parser";
import dayjs from "dayjs";
import {siteConfig} from "../src/config";
import {FeedItem} from "../src/types/config";

function isValidUrl(str: string): boolean {
	try {
		const { protocol } = new URL(str);
		return protocol === "http:" || protocol === "https:";
	} catch {
		return false;
	}
}

const parser = new Parser();

async function getFeedItemsFromSources(sources: undefined | string[]) {
	if (!sources?.length) return [];
	let feedItems: FeedItem[] = [];
	for (const url of sources) {
		const items = await fetchFeedItems(url);
		if (items) feedItems = [...feedItems, ...items];
	}
	return feedItems;
}

async function fetchFeedItems(url: string) {
	const feed = await parser.parseURL(url);
	if (!feed?.items?.length) return [];
	const tags = []
	const keywords = ['zenn', 'note']
	keywords.forEach(keyword => {
		if (url.indexOf(keyword) !== -1) {
			tags.push(keyword)
		}
	})


	// return item which has title and link
	return feed.items
		.map(({ title, description, link, isoDate }) => {
			return {
				title,
				published: dayjs(new Date(isoDate)).format('YYYY-MM-DD'),
				draft: false,
				description: description,
				image: '',
				tags: tags,
				category: 'Blog',
				external: true,
				link,
			};
		})
		.filter(
			({ title, link }) => title && link && isValidUrl(link)
		) as FeedItem[];
}

(async function () {
	const items = await getFeedItemsFromSources(siteConfig.xmlFeeds);

	items.sort((a, b) => b.dateMiliSeconds - a.dateMiliSeconds);
	fs.ensureDirSync("src/content/feed");
	items.forEach((item, index) => {
		fs.writeJsonSync(`src/content/feed/${item.title.replace(/\s+/g, '')}.json`, item);
	})
})();

