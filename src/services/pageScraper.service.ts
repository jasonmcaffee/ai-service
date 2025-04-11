import { Browser, BrowserContext, Page } from 'playwright';
const TurndownService = require('turndown');
const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();

export class PageScraperService{
  private browser: Browser;
  constructor() {}

  async getContentsOfWebpagesAsMarkdown({urls, removeScriptsAndStyles, removeImages, shortenUrls, removeNavElements, cleanWikipedia}:
                                          {urls: string[], removeScriptsAndStyles: boolean, removeImages: boolean, shortenUrls: boolean, removeNavElements: boolean, cleanWikipedia: boolean})
    : Promise<{successResults: {url: string, markdown: string}[], errorResults: {url: string, error: Error}[]}>{

    // Create an array to store all the promises
    const markdownPromises = urls.map(url =>
      this.getContentsOfWebpageAsMarkdown({url, removeImages, removeNavElements, cleanWikipedia, shortenUrls, removeScriptsAndStyles})
        .then(markdownResponse => ({success: true, url: markdownResponse.url, markdown: markdownResponse.markdown}))
        .catch(error => ({success: false, url, error}))
    );

    // Wait for all promises to settle (both fulfilled and rejected)
    const results = await Promise.all(markdownPromises);

    // Separate successful and failed results
    const successResults = results
      .filter((result): result is {success: true, url: string, markdown: string} => result.success)
      .map(({url, markdown}) => ({url, markdown}));

    const errorResults = results
      .filter((result): result is {success: false, url: string, error: Error} => !result.success)
      .map(({url, error}) => ({url, error}));

    return {
      successResults,
      errorResults
    };
  }

  /**
   * Uses a headless browser to fetch the html for a given url, optionally removes excess (styles, scripts, images, etc),
   * then converts the html to markdown.
   * @param url
   * @param removeScriptsAndStyles
   * @param removeImages
   * @param shortenUrls
   * @param removeNavElements
   * @param cleanWikipedia
   */
  async getContentsOfWebpageAsMarkdown({url, removeScriptsAndStyles, removeImages, shortenUrls, removeNavElements, cleanWikipedia}:
                                         {url: string, removeScriptsAndStyles: boolean, removeImages: boolean, shortenUrls: boolean, removeNavElements: boolean, cleanWikipedia: boolean} ): Promise<{url: string, markdown: string}>{
    chromium.use(stealth);
    console.log(`browser isConnected: ${this.browser?.isConnected()}`);
    // this.browser = this.browser || await chromium.launch({
    //   args: ['--disable-blink-features=AutomationControlled'],
    // });
    if(!this.browser || !this.browser.isConnected()){
      this.browser = await chromium.launch({
        args: ['--disable-blink-features=AutomationControlled'],
      });
    }
    const context = await this.createStealthContext(this.browser);
    const turndownService = new TurndownService();
    const htmlContents = await getHtmlContentsOfUrl(url, removeScriptsAndStyles, removeImages, shortenUrls, removeNavElements, cleanWikipedia, context);
    await context.close();
    const markdown = turndownService.turndown(htmlContents);
    return { url, markdown };
  }

  private async createStealthContext(browser: Browser){
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";
    const context = await this.browser.newContext({
      userAgent,
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1
    });
    return context;
  }

}


async function getHtmlContentsOfUrl(url: string, removeScriptsAndStyles=false, removeImages=false, shouldShortenUrl = false, removeNavElements = false,
                                    cleanWikipedia = false, context: BrowserContext): Promise<string> {
  const page = await context!.newPage();
  await page.goto(url, {
    waitUntil: 'domcontentloaded'
  });
  // await page.screenshot({path: "test.png"});
  const result = await getHtmlContentsOfPage(page, removeScriptsAndStyles, removeImages, shouldShortenUrl, removeNavElements, cleanWikipedia);
  return result.html;
}

async function getHtmlContentsOfPage(
  page: Page,
  removeScriptsAndStyles = false,
  removeImages = false,
  shouldShortenUrl = false,
  removeNavElements = false,
  cleanWikipedia = false,
) {
  // Add a small delay to allow for CSR (adjust timing as needed)
  await page.waitForTimeout(500);

  const isWikipediaUrl = page.url().indexOf('wikipedia.org') >= 0;

  // Get the HTML content with optional modifications
  const result = await page.evaluate(
    (options) => {
      const { removeScriptsAndStyles, removeImages, shouldShortenUrl, removeNavElements, cleanWikipedia, isWikipediaUrl } = options;
      const shortenedUrlMap = new Map<string, string>();
      let urlCounter = 1;
      // let shortenedUrlMap = shouldShortenUrl ? new Map() : null;

      if (removeScriptsAndStyles) {
        // Remove script tags
        const scripts = document.getElementsByTagName('script');
        while (scripts[0]) scripts[0].parentNode!.removeChild(scripts[0]);

        // Remove style tags
        const styles = document.getElementsByTagName('style');
        while (styles[0]) styles[0].parentNode!.removeChild(styles[0]);

        // Remove link tags with rel="stylesheet"
        const styleLinks = document.querySelectorAll('link[rel="stylesheet"]');
        styleLinks.forEach(link => link.parentNode!.removeChild(link));
      }

      if (removeImages) {
        // Remove standard img tags
        const images = document.getElementsByTagName('img');
        while (images[0]) images[0].parentNode!.removeChild(images[0]);

        // Remove svg tags
        const svgs = document.getElementsByTagName('svg');
        while (svgs[0]) svgs[0].parentNode!.removeChild(svgs[0]);

        // Remove picture tags
        const pictures = document.getElementsByTagName('picture');
        while (pictures[0]) pictures[0].parentNode!.removeChild(pictures[0]);

        // Remove inline background images in style attributes
        const elementsWithStyle = document.querySelectorAll('[style*="background"]');
        elementsWithStyle.forEach(el => {
          //@ts-ignore
          if (el.style.backgroundImage) {
            //@ts-ignore
            el.style.backgroundImage = 'none';
          }
        });

        // Remove image inputs
        const imageInputs = document.querySelectorAll('input[type="image"]');
        imageInputs.forEach(input => input.parentNode!.removeChild(input));

        // Remove objects with image/svg content
        const objects = document.querySelectorAll('object[type^="image/"], object[data^="data:image/"]');
        objects.forEach(obj => obj.parentNode!.removeChild(obj));

        // Remove embeds that might be images
        const embeds = document.querySelectorAll('embed[src*=".svg"], embed[src*=".png"], embed[src*=".jpg"], embed[src*=".jpeg"], embed[src*=".gif"], embed[src^="data:image/"], embed[src^="data:gif/"]');
        embeds.forEach(embed => embed.parentNode!.removeChild(embed));

        // Remove canvas elements (which might contain images)
        const canvases = document.getElementsByTagName('canvas');
        while (canvases[0]) canvases[0].parentNode!.removeChild(canvases[0]);
      }

      if (shouldShortenUrl) {
        // Process all anchor tags with href attributes
        const links = document.querySelectorAll('a[href]');
        links.forEach(link => {
          const originalUrl = link.getAttribute('href');

          // Skip empty URLs, javascript: URLs, and already shortened URLs
          if (!originalUrl ||
            originalUrl.startsWith('javascript:') ||
            originalUrl.startsWith('#') ||
            /^\d+\.ai$/.test(originalUrl)) {
            return;
          }

          // Create shortened URL
          const shortenedUrl = `http://local.ai/${urlCounter}`;

          // Store in map
          shortenedUrlMap.set(shortenedUrl, originalUrl);

          // Replace the URL in the HTML
          link.setAttribute('href', shortenedUrl);

          // Increment counter
          urlCounter++;
        });
      }

      function removeByQuerySelectorAll(query){
        const els = document.querySelectorAll(query);
        els.forEach(el => el.parentNode?.removeChild(el));
      }

      if(removeNavElements){
        removeByQuerySelectorAll('[role="navigation"]');
        removeByQuerySelectorAll('nav');
      }

      if(isWikipediaUrl && cleanWikipedia){
        removeByQuerySelectorAll('[role="navigation"]');
        removeByQuerySelectorAll('nav');
        removeByQuerySelectorAll('ol.references');
        removeByQuerySelectorAll('#catlinks');
        removeByQuerySelectorAll('.mw-footer-container');
        removeByQuerySelectorAll('#p-lang-btn-checkbox');
        removeByQuerySelectorAll('#p-search');
        removeByQuerySelectorAll('.uls-language-list');
        removeByQuerySelectorAll('.interlanguage-link');
      }

      // Convert the Map to a regular object for serialization
      const shortenedUrlObject = shouldShortenUrl
        ? Object.fromEntries(shortenedUrlMap)
        : null;

      return {
        html: document.documentElement.outerHTML,
        shortenedUrlMap: shortenedUrlObject
      };
    },
    { removeScriptsAndStyles, removeImages, shouldShortenUrl, removeNavElements, cleanWikipedia, isWikipediaUrl }
  );

  // Return the formatted result
  return {
    html: result.html,
    shortenedUrlMap: result.shortenedUrlMap
  };
}

function removeVowelsFromMarkdown(text: string): string {
  // Find words that:
  // 1. Start with a space, beginning of string, or punctuation
  // 2. Followed by one or more letters (the actual word)
  // 3. End with a space, end of string, or punctuation
  return text.replace(/(^|\s|[^\w@:/.])(([a-zA-Z]+))(?=\s|$|[^\w@:/.])/g, (match, prefix, word) => {
    // Keep the prefix (space/punctuation) and replace vowels in the word part
    return prefix + word.replace(/[aeiouAEIOU]/g, '');
  });
}
