/* eslint-disable no-console */
/* eslint-disable no-await-in-loop */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createWriteStream } from 'node:fs';
import { type LaunchOptions, chromium } from 'playwright';
import { format } from '@fast-csv/format';
import { ListingPage } from './pom/listing.mjs';
import { DetailsPage } from './pom/details.mjs';

import { Entity, Model } from '@alephdata/followthemoney';
import defaultModel from '@alephdata/followthemoney/dist/lib/defaultModel.json' assert { type: 'json' };
import { hash } from 'node:crypto';

const model = new Model(defaultModel);

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

const ftmStream = createWriteStream('data/entities.ftm.json');

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

            let photo: Entity | undefined;
            if (media[3]) {
                photo = model.createEntity('Image');
                photo.id = hash('md5', media[3], 'hex');
                photo.setProperty('name', data[1]);
                photo.setProperty('fileName', basename(new URL(media[3]).pathname));
                photo.setProperty('sourceUrl', media[3]);
            }

            const consent = model.createEntity('Document');
            consent.id = hash('md5', media[2], 'hex');
            consent.setProperty('name', `Consent - ${data[1]}`);
            consent.setProperty('fileName', basename(new URL(media[2]).pathname));
            consent.setProperty('sourceUrl', media[2]);

            const person = model.createEntity('Person');
            person.id = hash('md5', data[0], 'hex');
            person.setProperty('name', data[1]);
            person.setProperty('address', data[2]);
            person.setProperty('notes', data[3]);
            person.setProperty('summary', data[4]);
            person.setProperty('sourceUrl', data[0]);
            person.setProperty('proof', consent);

            if (photo) {
                person.setProperty('documentedBy', photo);
            }

            for (let idx = 0; idx < media[1].length; ++idx) {
                const src = media[1][idx];
                if (src) {
                    const proof = model.createEntity('Image');
                    proof.id = hash('md5', src, 'hex');
                    proof.setProperty('name', `Additional Photo ${idx + 1} - ${data[1]}`);
                    proof.setProperty('fileName', basename(new URL(src).pathname));
                    proof.setProperty('sourceUrl', src);
                    person.setProperty('documentedBy', proof);
                }
            }

            for (let idx = 0; idx < media[0].length; ++idx) {
                const src = media[0][idx];
                if (src) {
                    const proof = model.createEntity('Video');
                    proof.id = hash('md5', src, 'hex');
                    proof.setProperty('name', `Video ${idx + 1} - ${data[1]}`);
                    proof.setProperty('fileName', basename(new URL(src).pathname));
                    proof.setProperty('sourceUrl', src);
                    person.setProperty('documentedBy', proof);
                }
            }

            stream.write(data);
            ftmStream.write(`${JSON.stringify(person.toJSON())}\n`);
        } finally {
            await newPage.close();
        }
    }

    prevURL = url;
    url = await listingPage.getNextPageLink();
} while (url !== null);

stream.end();
ftmStream.end();
await page.close();
await browser.close();
