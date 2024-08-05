/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createWriteStream } from 'node:fs';
import { type LaunchOptions, chromium } from 'playwright';
import { format } from '@fast-csv/format';
import { ListingPage } from './pom/listing.mjs';
import { DetailsPage } from './pom/details.mjs';

async function download(url: string, dir: string): Promise<void> {
    const fname = basename(url);
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    await writeFile(`${dir}/${fname}`, Buffer.from(buffer));
}

const options: LaunchOptions = {
    headless: true,
};

const pageOptions = {
    baseURL: 'https://hochuksvoim.com/uk',
    viewport: { width: 1280, height: 1024 },
};

await rm('data', { recursive: true, force: true });
await mkdir('data', { recursive: true });

const stream = format({ includeEndRowDelimiter: true });
stream.pipe(createWriteStream('data/data.csv'));

const browser = await chromium.launch(options);
const page = await browser.newPage(pageOptions);

let prevURL = '';
let url: string | null = 'https://hochuksvoim.com/uk';
do {
    await page.goto(url, { referer: prevURL });
    const listingPage = new ListingPage(page);
    const links = await listingPage.getAllLinks();

    for (const link of links) {
        const newPage = await browser.newPage(pageOptions);
        try {
            const response = await newPage.goto(link, { referer: url });
            if (!response?.url().includes(link)) {
                continue;
            }

            const pageURL = response.url();
            const dir = `data/${basename(pageURL)}`;
            await mkdir(dir, { recursive: true });

            const detailsPage = new DetailsPage(newPage);
            const data = await Promise.all([
                pageURL,
                detailsPage.getName(),
                detailsPage.getLocation(),
                detailsPage.getArticle(),
                detailsPage.getInfo(),
            ]);

            const media = await Promise.all([
                detailsPage.getAdditionalVideos(),
                detailsPage.getAdditionalPhotos(),
                detailsPage.getConsentLink(),
                detailsPage.getPhoto(),
            ]);

            data.push(media[0].join(', '));

            for (const src of [...media[1], media[2], media[3]]) {
                if (src) {
                    await download(src, dir);
                }
            }

            stream.write(data);
        } finally {
            await newPage.close();
        }
    }

    prevURL = url;
    url = await listingPage.getNextPageLink();
} while (url !== null);

stream.end();
await page.close();
await browser.close();
