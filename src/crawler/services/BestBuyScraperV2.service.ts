import { PlaywrightCrawler } from 'crawlee';
import { Browser } from 'playwright';
require('dotenv').config();
const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();

const player = require('play-sound')();

const ccNumber = process.env.CC_NUMBER;
const csvNumber = process.env.CC_CSV_NUMBER;
const ccExpiration = process.env.CC_EXPIRATION;
const addressStreet = process.env.ADDRESS_STREET;
const addressCity = process.env.ADDRESS_CITY;
const addressZip = process.env.ADDRESS_ZIP;
const username = process.env.USERNAME2;
const password = process.env.PASSWORD;
const firstName = process.env.FIRST_NAME;
const lastName = process.env.LAST_NAME;
const state = process.env.STATE;
const shouldRun = process.env.SHOULD_RUN;
const shouldManual = process.env.SHOULD_MANUAL;

let hasAddedToCart = false;
let isRunning = false;

const timeShouldSpendRefreshingMs = 24 * 60 * 60 * 1000; // sign in once a day.
// const maxRetries = 1000 * 24;
const sleepMs = 1 * 1000;
const maxRetries = Math.ceil(timeShouldSpendRefreshingMs / sleepMs);
const maxWaitTimeMs = (maxRetries * sleepMs) + (60 * 1000);
const maxWaitTimeSeconds = maxWaitTimeMs / 1000;

const buttonTimeout = { timeout: 70000 };

const shouldTest = false;
const shouldUseManualCheckout = shouldManual == 'true' ? true : false;

// @Injectable()
// export class BestBuyScraperService implements OnModuleInit {
export class BestBuyScraperService {
  private readonly rtxUrl = 'https://www.bestbuy.com/site/nvidia-geforce-rtx-5090-32gb-gddr7-graphics-card-dark-gun-metal/6614151.p?skuId=6614151';
  private readonly testUrl = 'https://www.bestbuy.com/site/crucial-p3-1tb-internal-ssd-pcie-gen-3-x4-nvme/6509712.p?skuId=6509712';
  private readonly url = shouldTest ? this.testUrl : this.rtxUrl;
  private readonly signInUrl = 'https://www.bestbuy.com/identity/global/signin';
  private browser: Browser;

  async scrapeBestBuy() {
    if (isRunning) {
      console.log('Previous scraping operation still in progress. Skipping...');
      return;
    }

    console.log('Checking Best Buy stock status...');
    isRunning = true;

    try {
      chromium.use(stealth);
      if (!this.browser || this.browser.isConnected() === false) {
        this.browser = await chromium.launch({
          headless: false,
          args: ['--disable-blink-features=AutomationControlled'],
        });
      }
      const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36";

      const context = await this.browser.newContext({
        userAgent,
        viewport: { width: 1280, height: 1200 },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      await this.requestHandler({page});
    } catch (error) {
      console.error('Error during scraping:', error);
    } finally {
      isRunning = false;
      console.log('Scraping operation completed');
    }
  }

  async requestHandler({ page, }) {
    if (shouldRun !== 'true') {
      console.log('dont run');
      return;
    }
    if (hasAddedToCart) {
      console.log('already added to cart');
      return;
    }
    console.log(`${getDayAndTime()}`);
    console.log('signing in...');
    await this.signIn(page,);
    console.log('done signing in');

    await page.goto(this.url);
    console.log('Reloading the page until ADD TO CART is available or max retries reached...');
    let shouldExit = await this.reloadThePageUntilAddToCartIsAvailableOrMaxRetriesIsReached(page);
    if (shouldExit) {
      return;
    }

    if (shouldUseManualCheckout) {
      console.log(`shouldRequireManualCheckout ADD to cart available`);
      playAlert();
      await wait(15 * 60 * 1000);
      return;
    }

    console.log('trying to click on shipping button...');
    // Wait for the shipping option and click it if available
    const wasAbleToClickFirstShippingButton = await this.tryClickingTheFirstShippingButton(page);
    console.log('wasAbleToClickFirstShippingButton: ', wasAbleToClickFirstShippingButton);
    await page.screenshot({ path: `wasAbleToClickFirstShippingButton-${Date.now()}.png` });

    console.log('Going to cart...');
    await page.waitForSelector('a[href*="cart"]', buttonTimeout);
    await page.goto('https://www.bestbuy.com/cart');

    await this.tryClickingTheShippingOptionOnTheCartPage(page);

    shouldExit = await this.clickTheCheckoutButton(page);
    if (shouldExit) {
      return;
    }

    //Shipping info
    console.log('Filling out shipping info...');
    await page.waitForSelector('.button--continue button.btn-secondary', buttonTimeout);
    const continueToPaymentButton = await page.$('.button--continue button.btn-secondary');
    if (continueToPaymentButton) {
      console.log('Clicking "Continue to Payment Information" button...');
      await continueToPaymentButton.click();
    } else {
      console.warn('"Continue to Payment Information" button not found.');
      console.error('exiting due to no Continue to Payment Information.');
      await page.screenshot({ path: `noContinueToPaymentInformation-${Date.now()}.png` });
      return;
    }

    //Payment info
    console.log(`filling out credit card info`);
    await this.fillOutCreditCardInfo(page);

    await page.waitForSelector('button.btn-primary[data-track="Place your Order - In-line"]', buttonTimeout);
    console.log('Placing the order');

    if (!shouldTest) {
      await page.screenshot({ path: `purchasable-${Date.now()}.png` });

      //purchase
      await page.click('button.btn-primary[data-track="Place your Order - In-line"]');

      hasAddedToCart = true;
      await page.screenshot({ path: `purchased-${Date.now()}.png` });
      await wait(4 * 60 * 1000); //wait 5 minutes
      await page.screenshot({ path: `purchased2-${Date.now()}.png` });
      process.exit();
    }
  }


  async signIn(page) {
    await page.goto(this.signInUrl);
    await page.waitForSelector('input#fld-e');
    await page.focus('input#fld-e');
    // Fill in email and continue
    console.log(`username is: ${username} shouldUseManualCheckout: ${shouldUseManualCheckout}`);
    await page.type('input#fld-e', username);
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


  private async fillOutCreditCardInfo(page) {
    console.log('filling out cc info...');
    await page.waitForSelector('#cc-number', buttonTimeout);
    await page.type('#cc-number', ccNumber);

    await page.waitForSelector('#expirationDate', buttonTimeout);
    await page.focus('#expirationDate');
    await page.fill('#expirationDate', ccExpiration);

    await page.waitForSelector('#cvv', buttonTimeout);
    await page.focus('#cvv');
    await page.type('#cvv', csvNumber);

    await page.waitForSelector('#first-name', buttonTimeout);
    await page.focus('#first-name');
    await page.type('#first-name', firstName);

    await page.waitForSelector('#last-name', buttonTimeout);
    await page.focus('#last-name');
    await page.type('#last-name', lastName);

    await page.waitForSelector('.autocomplete__button', buttonTimeout); // Wait for the button to be available
    await page.click('.autocomplete__button'); // Click the button

    await page.waitForSelector('#address-input', buttonTimeout);
    await page.focus('#address-input');
    await page.type('#address-input', addressStreet);
    // await wait(1 * 2000); //weird issue where it fills out the city etc on the same line.

    await page.waitForSelector('#city', buttonTimeout);
    await page.focus('#city');
    await page.type('#city', addressCity);

    await page.waitForSelector('#state', buttonTimeout);
    // Set the state dropdown value
    await page.evaluate(() => {
      const stateSelect = document.querySelector('#state') as HTMLSelectElement;
      if (stateSelect) {
        stateSelect.value = 'UT';
        // Dispatch both 'input' and 'change' events
        stateSelect.dispatchEvent(new Event('input', { bubbles: true }));
        stateSelect.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        console.error('no state element');
      }
    });

    await page.waitForSelector('#postalCode', buttonTimeout);
    await page.focus('#postalCode');
    await page.type('#postalCode', addressZip);
  }

  private async clickTheCheckoutButton(page) {
    await page.waitForSelector('button[data-track="Checkout - Top"]', buttonTimeout);
    const checkoutButton = await page.$('button[data-track="Checkout - Top"]');
    if (checkoutButton) {
      console.log('Proceeding to checkout...');
      await checkoutButton.click();
    } else {
      console.warn('Checkout button not found.');
      await page.screenshot({ path: `noCheckoutButton-${Date.now()}.png` });
      return true;
    }
    return false;
  }

  private async tryClickingTheShippingOptionOnTheCartPage(page) {
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
  }

  private async tryClickingTheFirstShippingButton(page) {
    try {
      // Wait for the button with aria-label starting with "Shipping"
      const shippingButton = await page.waitForSelector('button[aria-label^="Shipping"]', {
        state: 'visible',
        timeout: 5 * 60 * 1000 // 5 minutes in milliseconds
      });

      // Verify the button exists and is clickable
      if (!shippingButton) {
        console.log(`shipping button didn't show up after 5 minutes`)
      } else {
        // If you need to click the button:
        await shippingButton.click();
        return true;
      }

    } catch (error) {
      console.error('Error while waiting for shipping button:', error);
    }
    return false;
  }

  private async reloadThePageUntilAddToCartIsAvailableOrMaxRetriesIsReached(page) {
    let retryCount = 0;
    let addToCartButton;

    while (true) {
      if (retryCount++ >= maxRetries) {
        console.log(`tried checking for ADD TO CART button ${retryCount} times`);
        return true;
      }

      await page.reload();
      await page.waitForLoadState('domcontentloaded', 60 * 1 * 1000);

      addToCartButton = await page.$('.fulfillment-add-to-cart-button button.add-to-cart-button');
      if (!addToCartButton) {
        console.warn(`${getDayAndTime()} No "Add to Cart" button found. Sleeping for ${sleepMs}ms (attempt ${retryCount}/${maxRetries}, ${((maxRetries - retryCount) * sleepMs) / 1000 / 60} minutes remaining)`);
        await wait(sleepMs);
        continue;
      }

      console.log('determining if the item is sold out..');
      const buttonState = await page.evaluate(el => el.getAttribute('data-button-state'), addToCartButton);
      console.log(`Button state: ${buttonState}`);

      if (buttonState === 'COMING_SOON' && shouldUseManualCheckout) {
        playAlert(1);
      }

      if (buttonState === 'ADD_TO_CART') {
        break;
      } else {
        console.log(`${getDayAndTime()} Button is ${buttonState}. Sleeping for ${sleepMs}ms (attempt ${retryCount}/${maxRetries}, ${((maxRetries - retryCount) * sleepMs) / 1000 / 60} minutes remaining)`);

        //COMING_SOON

        await wait(sleepMs);
        continue;
      }
    }

    console.log('Item is IN STOCK. Adding to cart...');

    const button = await page.$('#survey_invite_no');
    if (button) {
      console.info('Survey button found, clicking no');
      await button.click();
    }

    await addToCartButton.click();
    return false;
  }
}

const service = new BestBuyScraperService();
async function runScraper() {
  const intervalMs = 20 * 1000;

  while (true) {
    const startTime = Date.now();

    try {
      await service.scrapeBestBuy();
    } catch (error) {
      console.error("Error occurred during scraping:", error);
    }

    // Calculate remaining time to wait
    const elapsedTime = Date.now() - startTime;
    const waitTime = Math.max(0, intervalMs - elapsedTime);

    if (waitTime > 0) {
      console.log(`Waiting ${waitTime}ms before next check...`);
      await wait(waitTime);
    }
  }
}

function wait(ms: number) {
  return new Promise<void>(resolve => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

let isAlertPlaying = false;
function playAlert(times = 5) {
  if (times <= 0 || isAlertPlaying) return;

  isAlertPlaying = true;
  player.play('./alert.mp3', (err) => {
    isAlertPlaying = false;
    if (err) {
      console.log(`Could not play sound: ${err}`)
      return
    }
    playAlert(times - 1)
  })
}

runScraper().catch(error => {
  console.error('Fatal error in scraper:', error);
  process.exit(1);
});

function getDayAndTime(){
  const now = new Date();
  const dayList = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const day = dayList[now.getDay()];
  const time = now.toLocaleTimeString();
  return `${day} ${time}`;
}

function addToCartFetch(){
  fetch("https://www.bestbuy.com/cart/api/v1/addToCart", {
    "headers": {
      "a2ctransactionreferenceid": "l6eyQ8/nNChXkZC90HSXF0ga7HPYYooqcpYVZi5RKddaatr/iqdgxoHqA9YVWAD4mMtiwjJSMmKZCUrexlC/fDpyLCvxDVuyCuWN9TzCDiEsvxgtpxIRwrcdqKkDnfVXtWRATtzVz+6tHCGgZxlgFPoCQTH8xN/WlBCOeV6d+B/MAXs0ZEhweBK+5xedr21+evRyl9wuJ38klSyX+DrDZ0ip8lnhfR+Xob/szAZcdHUh9DxSBuicjei4Wd5LqLHUSl/3Ick7+GoQUZsTrN+GEAkDNlLIavR2i1i+Oel95qTkvFqFLoZUJIuuBDVreh25V8f2eT9YeHz1yVhBi+YsZEaAzy9yD1scEbAtLE2oTyeQgSZgBcIwf+RPxcgEqcoAhAyc5yUdDQbH5ZaLgDdXjQ",
      "accept": "application/json",
      "accept-language": "en-US,en;q=0.9",
      "content-type": "application/json; charset=UTF-8",
      "priority": "u=1, i",
      "recaptcha-data": "eyJldmVudFV1aWQiOiIzNTRhMGI4OS04YjIyLTQ5MTgtOGUyYS1lYmY0M2MwZDYxZmEiLCJhY3Rpb24iOiJhZGRUb0NhcnQiLCJlcnJvcnMiOiJSZWNhcHRjaGEgZW5hYmxlZCBjb25maWcgaXMgZmFsc2UuOyBSZWNhcHRjaGEgbm90IGluaXRpYWxpemVkLiBFaXRoZXIgY29uZmlndXJhdGlvbnMgc2V0IHRvIGRpc2FibGVkLCBvciBlcnJvciBwb3B1bGF0aW5nIGNvbmZpZ3VyYXRpb25zLjsgR3JlY2FwdGNoYSBpcyBub3QgZGVmaW5lZC4gQ2Fubm90IGZldGNoIHRva2VuLiJ9",
      "sec-ch-ua": "\"Not(A:Brand\";v=\"99\", \"Google Chrome\";v=\"133\", \"Chromium\";v=\"133\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"macOS\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "cookie": "vt=7f6c76a0-e8af-11ef-9908-0239ace85735; CTT=2c8b1e292ece60e00d91e62ec4e95b25; UID=27d1088a-b69c-40f3-ba9b-bbdafd83e3bc; locDestZip=84010; physical_dma=770; SID=68437649-2076-483f-b07e-e9880ddcf689; rxVisitor=1739382892416P3R51FMFBI62SLMRVOG096A1368EUMB7; COM_TEST_FIX=2025-02-12T17%3A54%3A52.675Z; s_ecid=MCMID%7C21103023022399329192771287323841153425; AMCVS_F6301253512D2BDB0A490D45%40AdobeOrg=1; _cs_c=1; _gcl_au=1.1.1737597873.1739382913; __gsas=ID=90b5bef0f2b4877f:T=1739385347:RT=1739385347:S=ALNI_MYrlQb4piNXBjtW8KOMQlAhoawlAg; locStoreId=527; AWSELB=55439F380340EEA77B0C6759DBBB7545739BF62F7B8ED41CCF7B75A386A5087C700F38DDF889F1B2A0BB2796C3EB4A2DB5289494CC284D9E539D37E937637BEF2AC82635; AWSELBCORS=55439F380340EEA77B0C6759DBBB7545739BF62F7B8ED41CCF7B75A386A5087C700F38DDF889F1B2A0BB2796C3EB4A2DB5289494CC284D9E539D37E937637BEF2AC82635; bby_rdp=l; ZPLANK=4b1da076e405427aa566974c81ae1808; g_state={\"i_t\":1740149180942,\"i_l\":0}; ui=1740062785704; pt=5038570494; DYN_USER_CONFIRM=60da28eb0f108cc9cce393f28197e816; DYN_USER_ID=ATG60040680375; ut=ca18f365-de74-11ef-9533-02cb590eb3c3; bby_cbc_lb=p-browse-w; ltc=10130; lux_uid=174006910067299387; bby_shpg_lb=p-shpg-w; bby_ispu_lb=p-ispu-w; __gads=ID=c64330a73a662a4a:T=1739385348:RT=1740069102:S=ALNI_Mby3S1irS2o-uflGnjNZr3oJuBS9A; __gpi=UID=0000104827f70a8b:T=1739385348:RT=1740069102:S=ALNI_MbpPWWzSv0oW7stJ8Drcs2coyUW1g; __eoi=ID=c70105225f8c7e6c:T=1739385348:RT=1740069102:S=AA-AfjY-kmisT9iT2ERJbf_spyEw; IMPRESSION=%7B%22meta%22%3A%7B%22CreatedAt%22%3A%222025-02-12T18%3A35%3A49.631Z%22%2C%22ModifiedAt%22%3A%222025-02-20T16%3A31%3A43.418Z%22%2C%22ExpiresAt%22%3Anull%7D%2C%22value%22%3A%7B%22data%22%3A%5B%7B%22contextData%22%3A%7B%7D%7D%5D%7D%7D; AMCV_F6301253512D2BDB0A490D45%40AdobeOrg=1585540135%7CMCMID%7C21103023022399329192771287323841153425%7CMCAID%7CNONE%7CMCOPTOUT-1740076304s%7CNONE%7CvVersion%7C4.4.0%7CMCAAMLH-1740673904%7C9%7CMCAAMB-1740673904%7Cj8Odv6LonN4r3an7LhD3WZrU1bUpAkFkkiY1ncBR96t2PTI; at=eyJhY2Nlc3NUb2tlbiI6IllXTXRSRHBNR2Utb0VlLU9YUUpkeEd2MEl5NGs5YlJuSmp4V3o3ZW56a0JrSUtlVVdoaFBBQUFBQUFBQUFBQSIsInRpbWVUb0xpdmUiOjE4MDAsImlzc3VlZFRpbWVzdGFtcCI6MTc0MDA2OTE0NDk5OSwiYXNzZXJ0aW9uIjoidTotYlptZ1p4cmdkTEJBdW5YOUN4ckFROWJ6Tml4RTZZY29XY3NBTlFHVVpnIiwicHJpbmNpcGFsIjoidTotYlptZ1p4cmdkTEJBdW5YOUN4ckFROWJ6Tml4RTZZY29XY3NBTlFHVVpnIiwicHJpbmNpcGFsSWRlbnRpZmllciI6ImNhMThmMzY1LWRlNzQtMTFlZi05NTMzLTAyY2I1OTBlYjNjMyIsImNvbnN1bWFibGUiOmZhbHNlLCJ2ZXJzaW9uIjoiMS4wIiwib2YiOiJOekUzWkRRNVpUbGxPVFkzTkdOallUaGpNVFU1WWpNd05UWTBNMll4WmpJIiwib2ZQb2xpY3kiOiJLR2FGYVRnRXJ1VVhNY2JTazJCdTlSOS0yaXEwNGNfTUNsb0hMZXJ1ZmRJIiwiYVRpbWVzdGFtcCI6MTc0MDA2Mjc4OTUyOSwiY3ZydCI6dHJ1ZX0.hj5nUjKu3aUszAB1gfJmzHW6mDr3LGsYGNLhm_3HJ2XAAY2AMoyAv8Xz_IvXt5CKqvy8GpU_Y3M3_j978VmctA; par=a740dd00-b308-47bb-a0b1-f272fb6d74fb; PAYMENT_SECTKN=2a49ec07-383b-4783-9174-dad9440cf3ce; SECTKN=0xeWT70KA+De0VC2FKmt/cbrmfqj8CEbHx4eVFQSQxEsfEfd6yrcSR0WR8WLBDxxCbCcld0CBoLHjEqobwqGKjSa5bg8JvmLEB2ZmalciBtiSGAXN58Mitd1efOSZXR8j//fUjFI3iwCAN/BSckIrw; bby_txco_lb=p-txco-cloud; cvAbTestInfo=W3siZWxpZ2libGUiOmZhbHNlLCJleHBlcmllbmNlIjoibGVnYWN5LXN0YW5kYXJkIiwiaW5lbGlnaWJsZVJlYXNvbiI6eyJkaXNhYmxlZCI6dHJ1ZX19XQ%3D%3D; std_test=legacy-standard; dtSa=-; bby_loc_lb=p-loc-w; customerZipCode=84115|Y; pst2=527; sc-location-v2=%7B%22meta%22%3A%7B%22CreatedAt%22%3A%222025-02-11T19%3A36%3A35.252Z%22%2C%22ModifiedAt%22%3A%222025-02-20T16%3A32%3A28.697Z%22%2C%22ExpiresAt%22%3A%222026-02-20T16%3A32%3A28.697Z%22%7D%2C%22value%22%3A%22%7B%5C%22physical%5C%22%3A%7B%5C%22zipCode%5C%22%3A%5C%2284010%5C%22%2C%5C%22source%5C%22%3A%5C%22C%5C%22%2C%5C%22captureTime%5C%22%3A%5C%222025-02-18T18%3A06%3A49.736Z%5C%22%7D%2C%5C%22store%5C%22%3A%7B%5C%22zipCode%5C%22%3A%5C%2284115%5C%22%2C%5C%22searchZipCode%5C%22%3A%5C%2284010%5C%22%2C%5C%22storeId%5C%22%3A%5C%22527%5C%22%2C%5C%22storeHydratedCaptureTime%5C%22%3A%5C%222025-02-18T18%3A06%3A50.650Z%5C%22%2C%5C%22userToken%5C%22%3A%5C%22ca18f365-de74-11ef-9533-02cb590eb3c3%5C%22%7D%2C%5C%22destination%5C%22%3A%7B%5C%22zipCode%5C%22%3A%5C%2284010%5C%22%7D%7D%22%7D; forterToken=5764f69d8a6746b1afb0da0f18b0621a_1740069148536__UDF4_19ck; dtCookie=v_4_srv_8_sn_FV9GORRV8DU1H7AQDQ6LHVMN6SIH8V85_app-3A0fc0394d863e8c89_1_app-3Ab774fff4d2488716_1_app-3A8a9ff6aeae512df7_1_ol_0_perc_100000_mul_1; cto_bundle=MMCF419IMHVkSmk4NiUyQnljMnRNbSUyQko0V1RXT1hmUTJlcGNNNmROb25VSlE0T0luJTJCcm0lMkJKVVhuYlNMdldQZjJxNXNzNHlOdmlxaUduZFhPNVpETlpWcFU0ZmdnM3AlMkJlNEY2S2w4TW5YTWF6OFg1ZDRrTEVycWFxOURhQzJMNU5VOEtWeUpNYUgyY01sWVQ0WWg2JTJCJTJCenFXMjcwcHRlRVBobnRtanhNaGhhaW9oTlRyaUd6aUNJQjlEUWtwUHBPOHpBSlBNT2s0cDJScCUyQnJDejY0WVZ1ZFNWdzhXeVNsMSUyQmdCMiUyQiUyQmtnMXE0VFZOUTRBcyUzRA; dtPC=8$69155071_28h-vRQLPCMCAQQPMMFHTNDCGHTPBAFJCHMHU-0e0; basketTimestamp=1740069157750; CartItemCount=0; rxvt=1740070960257|1740068819778; _cs_id=d70f9bf6-0cc5-af45-9771-3efc48d7cd3b.1739382913.16.1740069178.1740069086.1645469968.1773546913021.1; _cs_s=3.6.0.1740070978734; bm_sz=59CFF5F4056BD1B224D08053B5D733CA~YAAQ2DovF+Y6QAWVAQAAPuo5JBrhb/drv9OYSfzSMSon/lr25vL5PWH58m93tsFj2fvwsqWQAV7ehhC6Im4v5GhWm2VUTV2+Tdj/0RM/KqjfCex9S93V08QZHk2DJ9vFyB+AlwTR4EE1PUBsnhhDNcmmxPWQaVtFimSsl8NSHTwPlJy3qPV8tLt8XHKQLQMF4MsHC6PzTKskFJIggoeaZeC3Eow0NvBGCwlLKRkElRAngCNwIdrnqz65smH6RptUSPTyRTP5QLHDZlqsKuNwoKVwXgQAEmQM70AbvqoJYQ39Jofn9AlDX7M5Mkp8s4WZuf2I6PO/oLaiM40QWec2puCxJgShGBkOlujUc57HblHPYNmKtgm5TbPgp/4hS7pvxNypxA4inq8zeTlnH0GpvV9Q3NEb1B2GSYOSR1s2S0FEqvG3J3nLvfhrFt8oQnuuw8Hbbz61jONg6219OnIbGwvxIgJln5KNU6O+H/F5Wf7Vte7wYHt4XFfZZwTQpQci0Rae5tPKDNwB9qLIWAfERwR5B2apIPWnCTLwAAk4jppZhrjiapB+dZ074qy/+VzhEf/D+A3eITyDausXxdzXig==~3163704~3225652; _abck=7A748DEF84041C5D2C823DA460E2DE8E~0~YAAQ2DovF2Q8QAWVAQAAJfU5JA36DQYR4xh6PpMRQQpVZRtJMA2q+BkPfL18IuAe0QvQW994tUIg01TT3mPEPsxZ1CNgMG13dJBuVLhyc1bZ8OXJdBS+2m4avMox43iVVgykGz3a1SDFcGfZufyfbVxngDk9MZatuYjV1KCGw1qDZJHeo4oVCmC0l8E1Pf7CdIJyrItccDZhFgj0V6Anw6z4ToxL6jMmuh4vNtO8MDgRSrWs7Hv6tTnT2/4y3uZ5ar4BguKnKdefvphq5UIRm0F6QOm8jcneEVj6+geQY4MG57wngG2CUiPLCo2sZ2rS1qxjdpX9fe7l4ssN8pVoEGDOVNtY7TNWhRVoAmW1roV1ZOM63dx2lFHnbAF+xeiul3mYHDjNpnUjmAe1mCPcOUDgsCX9R5mp6kWIosGi824ONtUinUzCOvXfbTDfIVfC3fovriD9NpflIDQIjilP6iiBHebPCumNFvkn0EkX8LTULXIn4rjIS0JiY+Qm3M6cp0MV7ipk86Ro/9eVg+zu3r3E6+X76ku2/dg4YpsEylI2m32O+i3skJeCULFciXbNoZrlXWkKdrB4Q6KE0PPvMJDyjobvOsynSBLtW17gSTY9bSXvpzWas+coQ64/RU2zIW+f4MjcMoB+U85D4klU15770tIx47PcUUCL7IJ6DrDr7aT8nJz0jPuGzOAEgX5PY1QfsOaju0QykeFsCALBIuILyD2uNAhmbBjSibEs2yW9~-1~||0||~1740069726",
      "Referer": "https://www.bestbuy.com/site/nvidia-geforce-rtx-5090-32gb-gddr7-graphics-card-dark-gun-metal/6614151.p?skuId=6614151",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    },
    "body": "{\"items\":[{\"skuId\":\"6614151\"}]}",
    "method": "POST"
  });
}
