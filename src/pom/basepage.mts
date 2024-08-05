import type { Page } from 'playwright';

export class BasePage {
    public constructor(protected readonly page: Page) {}

    public get url(): string {
        return this.page.url();
    }
}
