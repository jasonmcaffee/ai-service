import config from '../config/config';
import {Injectable} from "@nestjs/common";
import {SearchResult, SearchResultResponse} from "../models/api/conversationApiModels";
import { chromium } from 'playwright';



@Injectable()
export class WebsearchService {
    async searchDuckDuckGo(query: string): Promise<SearchResultResponse>{
        const browser = await chromium.launch();
        const results: SearchResult[] = [];

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

            return {
                searchResults: results,
            }
        } catch (error) {
            console.error('Search failed:', error);
            throw error;
        } finally {
            await browser.close();
        }
    }
}

