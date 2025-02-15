import config from '../config/config';
import {Injectable} from "@nestjs/common";
import {SearchResult, SearchResultResponse} from "../models/api/conversationApiModels";
import { chromium, Page } from 'playwright';
import { Observable, Subject, lastValueFrom } from 'rxjs';
import {toArray} from 'rxjs/operators';

@Injectable()
export class WebsearchService {
    async streamSearch(query: string, maxPages=5): Promise<Observable<string>> {
        const searchResultsSubject = new Subject<string>();
        this.searchDuckDuckGo(query, searchResultsSubject, maxPages);
        return searchResultsSubject.asObservable();
    }

    async search(query: string, maxPages=5): Promise<SearchResultResponse> {
        return this.searchDuckDuckGo(query, undefined, maxPages);
    }

    async searchDuckDuckGo(query: string, searchResultsSubject?: Subject<string>, maxPages=5): Promise<SearchResultResponse>{
        const browser = await chromium.launch();
        const allResults: SearchResult[] = [];
        try {
            const context = await browser.newContext();
            const page = await context.newPage();
            // Navigate to DuckDuckGo and perform search
            await page.goto(`https://duckduckgo.com/?t=h_&q=${query}&ia=web`);
            // Wait for results to load
            await page.waitForSelector('article[data-testid="result"]');
            // Extract results
            const initialResults = await parseSearchResults(page, searchResultsSubject);
            allResults.push(...initialResults);

            // Load more pages if requested
            let currentPage = 1;
            while (currentPage < maxPages) {
                const hasMore = await loadMoreResults(page);
                if (!hasMore) {
                    console.log('No more results available');
                    break;
                }
                const newResults = await parseSearchResults(page, searchResultsSubject);
                allResults.push(...newResults);
                currentPage++;
            }
            searchResultsSubject?.next(JSON.stringify({end: true}));
            searchResultsSubject?.complete();
            return {
                searchResults: allResults,
                query
            }
        } catch (error) {
            console.error('Search failed:', error);
            throw error;
        } finally {
            await browser.close();
        }
    }
}

async function parseSearchResults(page: Page, searchResultsSubject?: Subject<string>): Promise<SearchResult[]> {
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
            const searchResult: SearchResult = { title, url, blurb, ...(date && { date }) };
            results.push(searchResult);
            searchResultsSubject?.next(JSON.stringify({data: {searchResults: [searchResult]}, end: false})); //for now do an array of 1, but we can batch if needed.
        } catch (error) {
            console.warn('Failed to parse result:', error);
            continue;
        }
    }
    return results;
}

async function loadMoreResults(page: Page): Promise<boolean> {
    try {
        // Wait for the button to be present, visible, and enabled
        await page.waitForSelector('button#more-results', {
            state: 'visible',
            timeout: 5000
        });

        // Use page.click() with improved options
        await page.click('button#more-results', {
            force: true
        });

        // Wait for network idle to ensure new content is loaded
        await page.waitForLoadState('networkidle', { timeout: 5000 });

        // Wait for new results to be visible
        await page.waitForSelector('article[data-testid="result"]', {
            state: 'attached',
            timeout: 5000
        });

        return true;
    } catch (error) {
        console.warn('Failed to load more results:', error);
        return false;
    }
}

// async function loadMoreResults(page: Page): Promise<boolean> {
//     try {
//         // Check if the "More results" button exists
//         await page.waitForSelector('button#more-results');
//         const moreButton = await page.$('button#more-results');
//         if (!moreButton) {
//             return false;
//         }
//         // Scroll to the button to ensure it's in view
//         await moreButton.scrollIntoViewIfNeeded();
//         // Click the button
//         await moreButton.click();
//         // Wait for new results to load
//         await page.waitForSelector('article[data-testid="result"]');
//         // Small delay to ensure all content is loaded
//         // await page.waitForTimeout(1000);
//         return true;
//     } catch (error) {
//         console.warn('Failed to load more results:', error);
//         return false;
//     }
// }
