import {Injectable} from "@nestjs/common";
import { Model, SearchResult, SearchResultResponse } from '../../models/api/conversationApiModels';
import {Browser, BrowserContext, Page} from 'playwright';
import {Subject} from "rxjs";
import {wait} from "../../utils/utils";
const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();

// const { connect } = require("puppeteer-real-browser");
import { connect } from "puppeteer-real-browser";

@Injectable()
export class ChatgptScraperService {
    private browser;

    async main(prompt:string, onTextReceived: (text: string) => void, onResponseCompleted: (completeText: string) => void ): Promise<void>{
        //duckduckgo has headless mode detection and throws an error.  use stealth to circumvent.
        // chromium.use(stealth);
        // if (!this.browser || this.browser.isConnected() === false) {
        //     this.browser = await chromium.launch({
        //         headless: false,
        //         args: ['--disable-blink-features=AutomationControlled'],
        //     });
        // }
        // const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.69998.89 Safari/537.36";
        //
        // const context = await this.browser.newContext({
        //     userAgent,
        //     viewport: { width: 1280, height: 720 },
        //     deviceScaleFactor: 1
        // });
        //
        // const page = await context.newPage();

        const { browser, page } = await connect({
            headless: false,
            // args: [],
            // customConfig: {},
            // turnstile: true,
            // connectOption: {},
            // disableXvfb: false,
            // ignoreAllFlags: false,
            // proxy:{
            //     host:'<proxy-host>',
            //     port:'<proxy-port>',
            //     username:'<proxy-username>',
            //     password:'<proxy-password>'
            // }
        });

        try {
            await page.goto(`https://facebook.com`);
            await wait(1 * 1000);
            await page.goto(`https://pinterest.com`);
            await wait(1 * 1000);

            await page.goto(`https://chatgpt.com`);
            // await page.waitForLoadState('domcontentloaded', {timeout: 10 * 1000});

            await wait(10 * 60 * 1000);

            await page.exposeFunction('onTextReceived', (text: string) => {
                console.log('Text received from page:', text);
                onTextReceived(text);
            });

            await page.exposeFunction('onResponseCompleted', (text: string) => {
                console.log('Response complete received from page:', text);
                onResponseCompleted(text);
            });

            await page.evaluate(() => {
                function interceptFetches () {
                    const originalFetch = window.fetch;
                    //@ts-ignore
                    window.fetch = async function (...args) {
                        console.log("Intercept Fetching:", args);
                        const [url, methodAndBody] = args;
                        //@ts-ignore
                        if(url.indexOf('') < 0) {
                            console.log('Intercept ignoring url: ', url);
                            return;
                        }

                        let completeTextResponse = '';
                        let isComplete = false;
                        try {
                            const response = await originalFetch(...args);
                            const clonedResponse = response.clone();

                            // Check if it might be an SSE or streaming response by examining content type
                            const contentType = response.headers.get('content-type') || '';

                            if (contentType.includes('text/event-stream')) {
                                // Handle SSE specifically
                                //@ts-ignore
                                const reader = clonedResponse.body.getReader();
                                const decoder = new TextDecoder();

                                async function readStream() {
                                    try {
                                        const { done, value } = await reader.read();
                                        if (done) return;

                                        const chunk = decoder.decode(value, { stream: true });
                                        console.log("SSE Chunk:", chunk);

                                        const eventLines = chunk.split('\n');
                                        let jsonData;
                                        for (const line of eventLines) {
                                            if (line.startsWith('data: ')) {
                                                try {
                                                    jsonData = JSON.parse(line.substring(6));
                                                } catch (e) {
                                                    console.error("Failed to parse JSON from SSE data:", line.substring(6), e);
                                                    // if(line.indexOf('[DONE]') >= 0){
                                                    //     isComplete = true;
                                                    //     console.log('### Intercept the reply is finished: ', completeTextResponse);
                                                    // }
                                                }
                                            }
                                        }
                                        console.log("Parsed SSE JSON:", jsonData);

                                        let v = jsonData.v;
                                        if(v){
                                            if(Array.isArray(v)){ //check for finish

                                                for(let entry of v){
                                                    if(entry.v == 'finished_successfully'){
                                                        isComplete = true;
                                                        console.log('### Intercept the reply is finished v2: ', completeTextResponse);
                                                        //@ts-ignore
                                                        if(window.onResponseComplete){
                                                            //@ts-ignore
                                                            window.onResponseComplete(completeTextResponse);
                                                        }
                                                        break;
                                                    }
                                                }
                                            } else if(typeof v == 'string'){ //check for partial text response. if(jsonData.o == 'append') <-- not always the case
                                                completeTextResponse += v;
                                                console.log('### Intercept partial response: ', v);
                                                //@ts-ignore
                                                if(window.onTextReceived){
                                                    //@ts-ignore
                                                    window.onTextReceived(v);
                                                }
                                            }
                                        }

                                        // Continue reading
                                        readStream();
                                    } catch (error) {
                                        console.error("Error reading SSE stream:", error);
                                    }
                                }

                                // Start reading the SSE stream
                                readStream();
                            } else {
                                // For non-SSE responses, just log the text
                                clonedResponse.text().then(text => console.log("Response:", text))
                                  .catch(err => console.error("Error reading response text:", err));
                            }

                            // Return the original response so other code can use it
                            return response;
                        } catch (error) {
                            console.error("Fetch error:", error);
                            throw error;
                        }
                    };
                }
                interceptFetches();
            });

            console.log(`finding text area...`);
            const askTextarea = await page.locator('[data-placeholder="Ask anything"]');
            console.log('filling text area');
            await askTextarea.fill(prompt);
            // await askTextarea ('Enter');

            await wait(5 * 60 * 1000);
        } catch (error) {
            console.error('loading chatgpt failed:', error);
            throw error;
        } finally {
            page.close();
            // context.close();
        }
    }
}


