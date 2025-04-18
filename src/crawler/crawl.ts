import { PlaywrightCrawler, Dataset } from 'crawlee';

// PlaywrightCrawler crawls the web using a headless
// browser controlled by the Playwright library.
const crawler = new PlaywrightCrawler({
  // When you turn off headless mode, the crawler
  // will run with a visible browser window.
  headless: false,
  // Let's limit our crawls to make our tests shorter and safer.
  maxRequestsPerCrawl: 50,
  // Use the requestHandler to process each of the crawled pages.
  async requestHandler({ request, page, enqueueLinks, log }) {
    const title = await page.title();
    log.info(`Title of ${request.loadedUrl} is '${title}'`);

    // Save results as JSON to ./storage/datasets/default
    await Dataset.pushData({ title, url: request.loadedUrl });

    // Extract links from the current page
    // and add them to the crawling queue.
    await enqueueLinks();
  },
  // Uncomment this option to see the browser window.
  // headless: false,
});

async function main(){
  // Add first URL to the queue and start the crawl.
  await crawler.run(['https://www.bestbuy.com/site/nvidia-geforce-rtx-5090-32gb-gddr7-graphics-card-dark-gun-metal/6614151.p?skuId=6614151']);
}

main();
