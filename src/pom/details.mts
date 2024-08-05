import type { Locator, Page } from 'playwright';
import { BasePage } from './basepage.mjs';

export class DetailsPage extends BasePage {
    public readonly nameText: Locator;
    public readonly locationText: Locator;
    public readonly articleText: Locator;
    public readonly infoText: Locator;
    public readonly mediaBlock: Locator;
    public readonly additionalPhotosBlock: Locator;
    public readonly additionalVideosBlock: Locator;
    public readonly consentLink: Locator;
    public readonly photoImage: Locator;

    public constructor(page: Page) {
        super(page);

        this.nameText = page.locator('div[class^="KatsapPhotoAndMainInfo_name"] > h1');
        this.locationText = page.locator('div[class^="KatsapPhotoAndMainInfo_location"]');
        this.articleText = page.locator('div[class^="MoreInfo_article"]');
        this.infoText = page.locator('div[class^="MoreInfo_additionalInfo"]');
        this.additionalPhotosBlock = page.locator('div[class^="MoreInfo_photosContainer"]');
        this.additionalVideosBlock = page.locator('div[class^="MoreInfo_videoContainer"]');
        this.mediaBlock = page.locator('div[class^="MoreInfo_media"]');
        this.consentLink = page.locator('a[class^="ExchangeApplicationScanLink_imgContainer"]');
        this.photoImage = page.locator('img[class^="KatsapPhotoAndMainInfo_photo"]');
    }

    public async getName(): Promise<string> {
        const name = await this.nameText.innerText();
        return name.replace(/\s+/gu, ' ').trim();
    }

    public getLocation(): Promise<string> {
        return this.locationText.innerText();
    }

    public async getArticle(): Promise<string> {
        const article = await this.articleText.innerText();
        return article.split('\n').slice(1).join('\n').trim();
    }

    public async getInfo(): Promise<string> {
        const info = await this.infoText.innerText();
        return info.split('\n').slice(1).join('\n').trim();
    }

    public async getAdditionalPhotos(): Promise<string[]> {
        const count = await this.additionalPhotosBlock.count();
        if (count) {
            const sources = await this.additionalPhotosBlock
                .locator('img')
                .evaluateAll((elements) => elements.map((el) => el.getAttribute('src')).filter((el) => el !== null));
            return sources.map((src) => this.extractImageSource(src));
        }

        return [];
    }

    public async getAdditionalVideos(): Promise<string[]> {
        const count = await this.additionalVideosBlock.count();
        if (count) {
            const videoIds = await this.additionalVideosBlock
                .locator('lite-youtube')
                .evaluateAll((elements) =>
                    elements.map((el) => el.getAttribute('videoid')).filter((el) => el !== null),
                );

            return videoIds.map((id) => `https://youtu.be/${id}`);
        }

        return [];
    }

    public async getMedia(): Promise<string> {
        const count = await this.mediaBlock.count();
        if (count) {
            return this.mediaBlock.innerHTML();
        }

        return '';
    }

    public async getConsentLink(): Promise<string> {
        const href = await this.consentLink.getAttribute('href');
        return href ?? '';
    }

    public async getPhoto(): Promise<string> {
        const src = await this.photoImage.getAttribute('src');
        if (src) {
            return this.extractImageSource(src);
        }

        return '';
    }

    // eslint-disable-next-line @typescript-eslint/class-methods-use-this
    private extractImageSource(src: string): string {
        const url = new URL(src, 'https://hochuksvoim.com/');
        return url.searchParams.get('url') ?? '';
    }
}
