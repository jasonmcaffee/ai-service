import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PlaywrightCrawler } from 'crawlee';
require('dotenv').config();

const ccNumber = process.env.CC_NUMBER;
const csvNumber = process.env.CC_CSV_NUMBER;
const ccExpiration = process.env.CC_EXPIRATION;
const addressStreet = process.env.ADDRESS_STREET;
const addressCity = process.env.ADDRESS_CITY;
const addressZip = process.env.ADDRESS_ZIP;
const username = process.env.USERNAME;
const password = process.env.PASSWORD;
const firstName = process.env.FIRST_NAME;
const lastName = process.env.LAST_NAME;
const state = process.env.STATE;
const shouldRun = process.env.SHOULD_RUN;
console.log('CC_NUMBER', ccNumber);
console.log('CC_CSV_NUMBER', csvNumber);
console.log('CC_EXPIRATION', ccExpiration);
console.log('ADDRESS_STREET', addressStreet);
console.log('ADDRESS_CITY', addressCity);
console.log('ADDRESS_ZIP', addressZip);
console.log('USERNAME', username);
console.log('PASSWORD', password);

let hasAddedToCart = false;

@Injectable()
export class BestBuyScraperService implements OnModuleInit {
  private readonly logger = new Logger(BestBuyScraperService.name);
  private readonly url = 'https://www.bestbuy.com/site/nvidia-geforce-rtx-5090-32gb-gddr7-graphics-card-dark-gun-metal/6614151.p?skuId=6614151';
  // private readonly url = 'https://www.bestbuy.com/site/crucial-p3-1tb-internal-ssd-pcie-gen-3-x4-nvme/6509712.p?skuId=6509712';
  private readonly signInUrl = 'https://www.bestbuy.com/identity/global/signin';

  async signIn(page, request){
    // await page.goto(this.signInUrl);
    await page.waitForSelector('input#fld-e');
    // Fill in email and continue
    await page.fill('input#fld-e', username);
    await page.click('button[data-track="Sign In - Continue"]');

    // Wait for the password selection option
    await page.waitForSelector('input#password-radio', { timeout: 5000 });
    await page.click('input#password-radio');

    // Wait for password input to appear
    await page.waitForSelector('input#fld-p1', { timeout: 5000 });
    await page.fill('input#fld-p1', password);

    // Click sign-in button
    await page.click('button[type="submit"]');

    // Wait for account page to confirm sign-in
    await page.waitForNavigation();
    console.log('Successfully signed in!');
  }

  async requestHandler({ page, request }) {
    if(shouldRun !== 'true'){
      console.log('dont run');
      return;
    }
    if(hasAddedToCart) {
      console.log('already added to cart');
      return;
    }
    console.log(`Scraping: ${this.url}`);

    console.log('signing in...');
    await this.signIn(page, request);
    console.log('done signing in');

    await page.goto(this.url);
    console.log('Evaluating if able to ADD TO CART...');
    // await page.waitForSelector('button', { timeout: 5000 });

    const addToCartButton = await page.$('.fulfillment-add-to-cart-button button.add-to-cart-button');
    if (!addToCartButton) {
      console.warn('No "Add to Cart" button found.');
      return;
    }

    console.log('determining if the item is sold out..');
    const buttonState = await page.evaluate(el => el.getAttribute('data-button-state'), addToCartButton);
    console.log(`Button state: ${buttonState}`);

    if (buttonState === 'SOLD_OUT') {
      console.log('Item is SOLD OUT.');
      return;
    }

    if (buttonState !== 'ADD_TO_CART') {
      console.log('Button is not ADD_TO_CART');
      return;
    }

    console.log('Item is IN STOCK. Adding to cart...');
    await addToCartButton.click();

    // Wait for the shipping option and click it if available
    await page.waitForSelector('button[aria-label^="Shipping"]');
    const shippingButton = await page.$('button[aria-label^="Shipping"]');
    if (shippingButton) {
      console.log('Selecting shipping option...');
      await shippingButton.click();
    } else {
      console.warn('Shipping option not found.');
      // return;
    }

    console.log('Going to cart...');
    await page.waitForSelector('a[href*="cart"]');
    await page.goto('https://www.bestbuy.com/cart');

    try {
      // Wait for the shipping option to appear (max 5s)
      await page.waitForSelector('.availability__fulfillment[data-test-fulfillment="shipping"]', { timeout: 5000 });

      // Locate the shipping option element
      const shippingEntry = await page.$('.availability__fulfillment[data-test-fulfillment="shipping"]');

      if (shippingEntry) {
        // Extract text content to confirm it's "FREE Shipping"
        const shippingText = await shippingEntry.innerText();

        if (shippingText.includes('FREE Shipping')) {
          console.log('FREE Shipping option found, selecting it...');

          // Click the associated radio button
          const radioButtonSelector = '.availability__fulfillment[data-test-fulfillment="shipping"] input[type="radio"]';
          await page.click(radioButtonSelector);

          console.log('FREE Shipping option selected.');
        } else {
          console.log('Shipping option found, but does not match "FREE Shipping".');
        }
      }
    } catch (error) {
      console.log('Shipping option not found within timeout. Continuing...');
    }



    await page.waitForSelector('button[data-track="Checkout - Top"]');
    const checkoutButton = await page.$('button[data-track="Checkout - Top"]');
    if (checkoutButton) {
      console.log('Proceeding to checkout...');
      await checkoutButton.click();
    } else {
      console.warn('Checkout button not found.');
      return;
    }

    //Shipping info
    console.log('Filling out shipping info...');
    await page.waitForSelector('.button--continue button.btn-secondary', { timeout: 10000 });

    const continueToPaymentButton = await page.$('.button--continue button.btn-secondary');
    if (continueToPaymentButton) {
      console.log('Clicking "Continue to Payment Information" button...');
      await continueToPaymentButton.click();
    } else {
      console.warn('"Continue to Payment Information" button not found.');
      return;
    }

    //Payment info
    console.log('filling out cc info...');
    await page.waitForSelector('#cc-number', { timeout: 10000 });
    await page.type('#cc-number', ccNumber);

    await page.waitForSelector('#expirationDate', { timeout: 10000 });
    await page.focus('#expirationDate');
    await page.fill('#expirationDate', ccExpiration);

    await page.waitForSelector('#cvv', { timeout: 10000 });
    await page.focus('#cvv');
    await page.type('#cvv', csvNumber);

    await page.waitForSelector('#first-name', { timeout: 10000 });
    await page.focus('#first-name');
    await page.type('#first-name', firstName);

    await page.waitForSelector('#last-name', { timeout: 10000 });
    await page.focus('#last-name');
    await page.type('#last-name', lastName);

    await page.waitForSelector('.autocomplete__button'); // Wait for the button to be available
    await page.click('.autocomplete__button'); // Click the button

    await page.waitForSelector('#address-input', { timeout: 10000 });
    await page.focus('#address-input');
    await page.type('#address-input', addressStreet);
    // await wait(1 * 2000); //weird issue where it fills out the city etc on the same line.

    await page.waitForSelector('#city', { timeout: 10000 });
    await page.focus('#city');
    await page.type('#city', addressCity);

    await page.waitForSelector('#state', { timeout: 10000 });
    // Set the state dropdown value
    await page.evaluate(() => {
      const stateSelect = document.querySelector('#state') as HTMLSelectElement;
      if (stateSelect) {
        stateSelect.value = 'UT';
        // Dispatch both 'input' and 'change' events
        stateSelect.dispatchEvent(new Event('input', { bubbles: true }));
        stateSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }else{
        console.error('no state element')
      }
    });

    await page.waitForSelector('#postalCode', { timeout: 10000 });
    await page.focus('#postalCode');
    await page.type('#postalCode', addressZip);

    await page.waitForSelector('button.btn-primary[data-track="Place your Order - In-line"]');
    console.log('Placing the order');
    await page.click('button.btn-primary[data-track="Place your Order - In-line"]');

    hasAddedToCart = true;
    process.exit();

  }

  async scrapeBestBuy() {
    console.log('Checking Best Buy stock status...');

    const signIn = this.signIn.bind(this);

    const crawler = new PlaywrightCrawler({
      // When you turn off headless mode, the crawler
      // will run with a visible browser window.
      headless: false,
      // Let's limit our crawls to make our tests shorter and safer.
      // maxRequestsPerCrawl: 50,
      requestHandler: this.requestHandler.bind(this),
    });

    await crawler.run([this.signInUrl]);
  }

  @Cron('0 * * * * *') // Runs every 60 seconds
  async scheduledScrape() {
    await this.scrapeBestBuy();
  }

  async onModuleInit() {
    console.log('Running scraper immediately on startup...');
    await this.scrapeBestBuy(); // Run once when the server starts
  }
}


function wait(ms: number){
  return new Promise<void>(resolve => {
    setTimeout(()=> {
      resolve();
    }, ms);
  })
}
