import {EventEmitter} from 'events';

import playwright from 'playwright';

import semaphore, {type Semaphore} from './semaphore';

interface BrowserManagerOptions {
  concurrency?: number;
  idleTimeout?: number;
}

export function browserManager(browserType: playwright.BrowserType, opts?: BrowserManagerOptions) {
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

  async function close(wait=true) {
    if (mBrowserP === undefined)
      return;
    const {browser, sem} = await mBrowserP;
    if (browser.isConnected()) {
      mBrowserP = undefined;
      if (wait)
        await EventEmitter.once(sem.events, 'idle');
      await browser.close();
    }
  }

  async function withBrowser(fn: (browser: playwright.Browser) => Promise<unknown>) {
    let mBrowser = await mBrowserP;

    if (!mBrowser?.browser.isConnected()) {
      mBrowserP = browserType.launch()
        .then((browser) => ({browser, sem: semaphore(opts?.concurrency??1)}));
      mBrowser = await mBrowserP;

      if (opts?.idleTimeout)
        setupIdleTimeout(mBrowser, opts.idleTimeout);
    }

    return mBrowser.sem.apply(() => fn(mBrowser!.browser));
  }

  function setupIdleTimeout(mBrowser: ManagedBrowser, idleTimeout: number) {
    let idleTimer: NodeJS.Timeout | undefined;

    mBrowser.sem.events
      .on('idle', () => {
        idleTimer = setTimeout(async () => {
            if (mBrowser === await mBrowserP) {
              close(false);
            }
          }, idleTimeout);
      })
      .on('deidle', async () => {
        if (!idleTimer)
          return;
        clearTimeout(idleTimer);
        idleTimer = undefined;
      });
  }
}
