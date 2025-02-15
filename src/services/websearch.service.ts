import config from '../config/config';
import {Injectable} from "@nestjs/common";
import {SearchResult, SearchResultResponse} from "../models/api/conversationApiModels";
import { chromium, Page } from 'playwright';

@Injectable()
export class WebsearchService {
    async searchDuckDuckGo(query: string, maxPages=5): Promise<SearchResultResponse>{
        const browser = await chromium.launch();
        const results: SearchResult[] = [];
        const allResults: SearchResult[] = [];
        try {
            const context = await browser.newContext();
            const page = await context.newPage();

            // Navigate to DuckDuckGo and perform search
            await page.goto(`https://duckduckgo.com/?t=h_&q=${query}&ia=web`);
            // await page.fill('input[name="q"]', query);
            // await page.press('input[name="q"]', 'Enter');

            // Wait for results to load
            await page.waitForSelector('article[data-testid="result"]');

            // Extract results
            const initialResults = await parseSearchResults(page);

            allResults.push(...initialResults);

            // Load more pages if requested
            let currentPage = 1;

            while (currentPage < maxPages) {
                const hasMore = await loadMoreResults(page);
                if (!hasMore) {
                    console.log('No more results available');
                    break;
                }

                const newResults = await parseSearchResults(page);
                allResults.push(...newResults);
                currentPage++;
            }

            return {
                searchResults: allResults,
            }
        } catch (error) {
            console.error('Search failed:', error);
            throw error;
        } finally {
            await browser.close();
        }
    }


}

async function parseSearchResults(page: Page): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Extract results
    const searchResults = await page.$$('article[data-testid="result"]');

    for (const result of searchResults) {
        try {
            // Title and URL extraction
            const title = await result.$eval('h2 a span',
                (el) => el.textContent?.trim() || '');

            const url = await result.$eval('h2 a',
                (el) => el.getAttribute('href') || '');

            // Get text content from all spans in the snippet area
            const snippetSpans = await result.$$eval('[data-result="snippet"] span > span',
                (elements) => elements.map(el => el.textContent?.trim() || ''));

            // Process the spans
            let date: string | undefined;
            let blurb: string;

            // Check if first span matches date pattern (e.g., "Jul 3, 2024")
            const datePattern = /^[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}$/;
            if (snippetSpans.length > 1 && datePattern.test(snippetSpans[0])) {
                date = snippetSpans[0];
                blurb = snippetSpans.slice(1).join(' ');
            } else {
                blurb = snippetSpans.join(' ');
            }

            results.push({
                title,
                url,
                blurb,
                ...(date && { date })
            });
        } catch (error) {
            console.warn('Failed to parse result:', error);
            continue;
        }
    }

    return results;
}

async function loadMoreResults(page: Page): Promise<boolean> {
    try {
        // Check if the "More results" button exists
        const moreButton = await page.$('button#more-results');
        if (!moreButton) {
            return false;
        }

        // Scroll to the button to ensure it's in view
        await moreButton.scrollIntoViewIfNeeded();

        // Click the button
        await moreButton.click();

        // Wait for new results to load
        await page.waitForSelector('article[data-testid="result"]');

        // Small delay to ensure all content is loaded
        await page.waitForTimeout(1000);

        return true;
    } catch (error) {
        console.warn('Failed to load more results:', error);
        return false;
    }
}
