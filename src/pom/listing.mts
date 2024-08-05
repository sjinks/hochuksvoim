import type { Locator, Page } from 'playwright';
import { BasePage } from './basepage.mjs';

export class ListingPage extends BasePage {
    public readonly searchResultsBlock: Locator;
    public readonly searchResultLinks: Locator;

    public constructor(page: Page) {
        super(page);

        this.searchResultsBlock = page.locator('div[class^="KatsapCardsContainer_KatsapCardsContainer"]');
        this.searchResultLinks = this.searchResultsBlock.locator('article > a');
    }

    public getAllLinks(): Promise<string[]> {
        return this.searchResultLinks.evaluateAll((elements) =>
            elements.map((el) => el.getAttribute('href')).filter((el) => el !== null),
        );
    }

    public async getNextPageLink(): Promise<string | null> {
        const nextPageLink = this.page.locator('li:has(a[class^="Paginator_active"]) + li > a');
        if ((await nextPageLink.count()) === 0) {
            return null;
        }

        return nextPageLink.getAttribute('href');
    }
}
