import playwright from 'playwright';

import semaphore, {type Semaphore} from './semaphore';

interface BrowserManagerOptions {
  concurrency: number;
}

export function browserManager(browserType: playwright.BrowserType, opts: BrowserManagerOptions) {
  // These items are bundled so typescript understands that if one is defined
  // then the other is as well.
  interface ManagedBrowser {
    browser: playwright.Browser;
    sem: Semaphore;
  }

  // To avoid racing, we track a promise for the managed browser.
  let mBrowserP: Promise<ManagedBrowser> | undefined;

  return {
    withBrowserContext,
    close,
  };

  async function withBrowserContext(fn: (context: playwright.BrowserContext) => Promise<unknown>) {
    return withBrowser(async (browser) => {
      const browserContext = await browser.newContext();
      try {
        return await fn(browserContext);
      } finally {
        await browserContext.close();
      }
    });
  }

  async function close() {
    if (mBrowserP === undefined)
      return;
    const {browser, sem} = await mBrowserP;
    if (browser.isConnected()) {
      mBrowserP = undefined;
      await sem.idle();
      await browser.close();
    }
  }

  async function withBrowser(fn: (browser: playwright.Browser) => Promise<unknown>) {
    let mBrowser = await mBrowserP;

    if (!mBrowser?.browser.isConnected()) {
      mBrowserP = browserType.launch()
        .then((browser) => ({browser, sem: semaphore(opts.concurrency)}));
      mBrowser = await mBrowserP;
    }

    return mBrowser.sem.apply(() => fn(mBrowser!.browser));
  }
}
