import { VenmoBrowser } from "./browser.js";

export class VenmoSession {
  private browser: VenmoBrowser;
  private isLoggedIn = false;

  constructor() {
    this.browser = new VenmoBrowser();
  }

  async initialize(): Promise<void> {
    await this.browser.initialize();
  }

  async login(username: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.browser.navigate("https://venmo.com/account/sign-in");
      await this.browser.waitForSelector('input[name="phoneEmailUsername"]');
      await this.browser.fill('input[name="phoneEmailUsername"]', username);
      await this.browser.click('button[type="submit"]');

      await this.browser.waitForSelector('input[name="password"]', 8000);
      await this.browser.fill('input[name="password"]', password);
      await this.browser.click('button[type="submit"]');

      // Wait for redirect after login
      await new Promise((resolve) => setTimeout(resolve, 4000));

      this.isLoggedIn = true;
      return { success: true, message: "Successfully logged in to Venmo" };
    } catch (error) {
      return {
        success: false,
        message: `Login failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async getBalance(): Promise<{ balance: string; error?: string }> {
    try {
      await this.browser.navigate("https://venmo.com/account/settings/balance");
      await this.browser.waitForSelector('[data-testid="balance-amount"], .venmo-balance, [class*="balance"]');

      const balance = await this.browser.evaluate(() => {
        const selectors = [
          '[data-testid="balance-amount"]',
          '[class*="Balance"] [class*="amount"]',
          '[class*="balance-amount"]',
          'h2[class*="balance"]',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el?.textContent) return el.textContent.trim();
        }
        // Try to find any dollar amount near "balance" text
        const allText = document.body.innerText;
        const match = allText.match(/(?:balance|Balance)[^\$]*(\$[\d,]+\.?\d*)/);
        return match ? match[1] : "$0.00";
      });

      return { balance };
    } catch (error) {
      return {
        balance: "unknown",
        error: `Failed to get balance: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async sendPayment(
    recipient: string,
    amount: number,
    note: string,
    audience: "public" | "friends" | "private" = "private"
  ): Promise<{ success: boolean; message: string; transactionId?: string }> {
    try {
      await this.browser.navigate(`https://venmo.com/pay?recipients=${encodeURIComponent(recipient)}`);
      await this.browser.waitForSelector('input[placeholder*="amount"], input[name="amount"], [data-testid="amount-input"]');

      // Fill amount
      await this.browser.fill(
        'input[placeholder*="amount"], input[name="amount"], [data-testid="amount-input"]',
        amount.toFixed(2)
      );

      // Fill note
      await this.browser.waitForSelector('input[placeholder*="what"], input[name="note"], textarea[name="note"]');
      await this.browser.fill(
        'input[placeholder*="what"], input[name="note"], textarea[name="note"]',
        note
      );

      // Set audience
      try {
        const audienceSelector = `[data-testid="audience-${audience}"], button[aria-label*="${audience}"]`;
        await this.browser.click(audienceSelector);
      } catch {
        // Audience selection optional
      }

      // Click pay button
      await this.browser.click('[data-testid="pay-button"], button[type="submit"][class*="pay"]');
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const transactionId = await this.browser.evaluate(() => {
        const url = window.location.href;
        const match = url.match(/\/([a-f0-9-]{36})/);
        return match ? match[1] : undefined;
      });

      return {
        success: true,
        message: `Successfully sent $${amount.toFixed(2)} to ${recipient} — "${note}"`,
        transactionId: transactionId ?? undefined,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to send payment: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async requestPayment(
    recipient: string,
    amount: number,
    note: string,
    audience: "public" | "friends" | "private" = "private"
  ): Promise<{ success: boolean; message: string; requestId?: string }> {
    try {
      await this.browser.navigate(`https://venmo.com/pay?recipients=${encodeURIComponent(recipient)}`);
      await this.browser.waitForSelector('input[placeholder*="amount"], input[name="amount"], [data-testid="amount-input"]');

      await this.browser.fill(
        'input[placeholder*="amount"], input[name="amount"], [data-testid="amount-input"]',
        amount.toFixed(2)
      );

      await this.browser.waitForSelector('input[placeholder*="what"], input[name="note"], textarea[name="note"]');
      await this.browser.fill(
        'input[placeholder*="what"], input[name="note"], textarea[name="note"]',
        note
      );

      // Click Request (not Pay)
      await this.browser.click('[data-testid="request-button"], button[class*="request"]');
      await new Promise((resolve) => setTimeout(resolve, 3000));

      return {
        success: true,
        message: `Successfully requested $${amount.toFixed(2)} from ${recipient} — "${note}"`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to request payment: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async getTransactions(limit = 20): Promise<{ transactions: any[]; error?: string }> {
    try {
      await this.browser.navigate("https://venmo.com/account/activity");
      await this.browser.waitForSelector(
        '[data-testid="transaction-item"], [class*="transaction"], [class*="feed-item"]'
      );

      const transactions = await this.browser.evaluateWithArg((maxItems: number) => {
        const selectors = [
          '[data-testid="transaction-item"]',
          '[class*="TransactionListItem"]',
          '[class*="feed-item"]',
          'li[class*="transaction"]',
        ];
        let items: Element[] = [];
        for (const sel of selectors) {
          items = Array.from(document.querySelectorAll(sel));
          if (items.length > 0) break;
        }
        return items.slice(0, maxItems).map((item) => ({
          id: item.getAttribute("data-id") || item.getAttribute("data-transaction-id") || "",
          actor: item.querySelector('[class*="actor"], [data-testid="actor-name"]')?.textContent?.trim() || "",
          target: item.querySelector('[class*="target"], [data-testid="target-name"]')?.textContent?.trim() || "",
          note: item.querySelector('[class*="note"], [data-testid="note"]')?.textContent?.trim() || "",
          amount: item.querySelector('[class*="amount"], [data-testid="amount"]')?.textContent?.trim() || "",
          date: item.querySelector('[class*="date"], time')?.textContent?.trim() || "",
          type: item.querySelector('[class*="action"]')?.textContent?.trim() || "",
        }));
      }, limit);

      return { transactions };
    } catch (error) {
      return {
        transactions: [],
        error: `Failed to get transactions: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async getFriends(limit = 50): Promise<{ friends: any[]; error?: string }> {
    try {
      await this.browser.navigate("https://venmo.com/account/friends");
      await this.browser.waitForSelector('[data-testid="friend-item"], [class*="friend"], [class*="Friend"]');

      const friends = await this.browser.evaluateWithArg((maxItems: number) => {
        const selectors = [
          '[data-testid="friend-item"]',
          '[class*="FriendListItem"]',
          '[class*="friend-item"]',
          'li[class*="friend"]',
        ];
        let items: Element[] = [];
        for (const sel of selectors) {
          items = Array.from(document.querySelectorAll(sel));
          if (items.length > 0) break;
        }
        return items.slice(0, maxItems).map((item) => ({
          id: item.getAttribute("data-id") || item.getAttribute("data-user-id") || "",
          name: item.querySelector('[class*="name"], [data-testid="user-name"]')?.textContent?.trim() || "",
          username:
            item.querySelector('[class*="username"], [data-testid="username"]')?.textContent?.trim() ||
            item.querySelector('a[href*="/"]')?.getAttribute("href")?.replace("/", "") ||
            "",
          avatar: item.querySelector("img")?.getAttribute("src") || "",
        }));
      }, limit);

      return { friends };
    } catch (error) {
      return {
        friends: [],
        error: `Failed to get friends: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async searchUsers(query: string): Promise<{ users: any[]; error?: string }> {
    try {
      await this.browser.navigate(`https://venmo.com/search?query=${encodeURIComponent(query)}`);
      await this.browser.waitForSelector('[data-testid="search-result"], [class*="search-result"], [class*="UserResult"]');

      const users = await this.browser.evaluate(() => {
        const selectors = [
          '[data-testid="search-result"]',
          '[class*="UserResult"]',
          '[class*="search-result"]',
          '[class*="SearchResult"]',
        ];
        let items: Element[] = [];
        for (const sel of selectors) {
          items = Array.from(document.querySelectorAll(sel));
          if (items.length > 0) break;
        }
        return items.slice(0, 20).map((item) => ({
          id: item.getAttribute("data-id") || item.getAttribute("data-user-id") || "",
          name: item.querySelector('[class*="name"], [data-testid="user-name"]')?.textContent?.trim() || "",
          username:
            item.querySelector('[class*="username"], [data-testid="username"]')?.textContent?.trim() || "",
          avatar: item.querySelector("img")?.getAttribute("src") || "",
        }));
      });

      return { users };
    } catch (error) {
      return {
        users: [],
        error: `Failed to search users: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async addFriend(username: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.browser.navigate(`https://venmo.com/${username}`);
      await this.browser.waitForSelector('[data-testid="add-friend-button"], button[class*="add-friend"], button[class*="AddFriend"]');
      await this.browser.click('[data-testid="add-friend-button"], button[class*="add-friend"], button[class*="AddFriend"]');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return { success: true, message: `Friend request sent to @${username}` };
    } catch (error) {
      return {
        success: false,
        message: `Failed to add friend: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async acceptRequest(requestId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.browser.navigate("https://venmo.com/account/activity");
      await this.browser.waitForSelector('[data-testid="request-item"], [class*="request-item"]');

      await this.browser.click(
        `[data-id="${requestId}"] [data-testid="accept-button"], [data-request-id="${requestId}"] button[class*="accept"]`
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return { success: true, message: `Payment request ${requestId} accepted` };
    } catch (error) {
      return {
        success: false,
        message: `Failed to accept request: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async declineRequest(requestId: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.browser.navigate("https://venmo.com/account/activity");
      await this.browser.waitForSelector('[data-testid="request-item"], [class*="request-item"]');

      await this.browser.click(
        `[data-id="${requestId}"] [data-testid="decline-button"], [data-request-id="${requestId}"] button[class*="decline"]`
      );
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return { success: true, message: `Payment request ${requestId} declined` };
    } catch (error) {
      return {
        success: false,
        message: `Failed to decline request: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async transferToBank(
    amount?: number,
    bankId?: string,
    transferSpeed: "instant" | "standard" = "standard"
  ): Promise<{ success: boolean; message: string; transferId?: string }> {
    try {
      await this.browser.navigate("https://venmo.com/account/transfer-money");
      await this.browser.waitForSelector('[data-testid="transfer-amount"], input[name="amount"], [class*="transfer"]');

      if (amount !== undefined) {
        await this.browser.fill('[data-testid="transfer-amount"], input[name="amount"]', amount.toFixed(2));
      }

      // Select bank if specified
      if (bankId) {
        try {
          await this.browser.click(`[data-bank-id="${bankId}"], option[value="${bankId}"]`);
        } catch {
          // Bank selection optional
        }
      }

      // Select transfer speed
      if (transferSpeed === "instant") {
        try {
          await this.browser.click('[data-testid="instant-transfer"], [class*="instant"]');
        } catch {
          // Speed selection optional
        }
      }

      await this.browser.click('[data-testid="transfer-button"], button[type="submit"][class*="transfer"]');
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const amountMsg = amount !== undefined ? `$${amount.toFixed(2)}` : "full balance";
      return {
        success: true,
        message: `Successfully initiated ${transferSpeed} transfer of ${amountMsg} to bank`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to transfer to bank: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async getCards(): Promise<{ paymentMethods: any[]; error?: string }> {
    try {
      await this.browser.navigate("https://venmo.com/account/settings/payment-methods");
      await this.browser.waitForSelector(
        '[data-testid="payment-method"], [class*="payment-method"], [class*="PaymentMethod"]'
      );

      const paymentMethods = await this.browser.evaluate(() => {
        const selectors = [
          '[data-testid="payment-method"]',
          '[class*="PaymentMethodItem"]',
          '[class*="payment-method-item"]',
        ];
        let items: Element[] = [];
        for (const sel of selectors) {
          items = Array.from(document.querySelectorAll(sel));
          if (items.length > 0) break;
        }
        return items.map((item) => ({
          id: item.getAttribute("data-id") || item.getAttribute("data-payment-id") || "",
          type: item.querySelector('[class*="type"], [data-testid="method-type"]')?.textContent?.trim() || "",
          name: item.querySelector('[class*="name"], [data-testid="method-name"]')?.textContent?.trim() || "",
          last4: item.querySelector('[class*="last4"], [data-testid="last4"]')?.textContent?.trim() || "",
          isDefault: item.querySelector('[class*="default"], [data-testid="default-badge"]') !== null,
        }));
      });

      return { paymentMethods };
    } catch (error) {
      return {
        paymentMethods: [],
        error: `Failed to get payment methods: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async getNotifications(): Promise<{ notifications: any[]; pendingRequests: any[]; error?: string }> {
    try {
      await this.browser.navigate("https://venmo.com/account/activity");
      await this.browser.waitForSelector(
        '[data-testid="notification-item"], [class*="notification"], [data-testid="request-item"]'
      );

      const result = await this.browser.evaluate(() => {
        const notifSelectors = [
          '[data-testid="notification-item"]',
          '[class*="NotificationItem"]',
          '[class*="notification-item"]',
        ];
        const requestSelectors = [
          '[data-testid="request-item"]',
          '[class*="RequestItem"]',
          '[class*="request-item"]',
        ];

        let notifItems: Element[] = [];
        for (const sel of notifSelectors) {
          notifItems = Array.from(document.querySelectorAll(sel));
          if (notifItems.length > 0) break;
        }

        let requestItems: Element[] = [];
        for (const sel of requestSelectors) {
          requestItems = Array.from(document.querySelectorAll(sel));
          if (requestItems.length > 0) break;
        }

        return {
          notifications: notifItems.slice(0, 20).map((item) => ({
            id: item.getAttribute("data-id") || "",
            message: item.querySelector('[class*="message"], [data-testid="message"]')?.textContent?.trim() || item.textContent?.trim() || "",
            date: item.querySelector("time, [class*='date']")?.textContent?.trim() || "",
            read: item.classList.contains("read") || item.getAttribute("data-read") === "true",
          })),
          pendingRequests: requestItems.slice(0, 20).map((item) => ({
            id: item.getAttribute("data-id") || item.getAttribute("data-request-id") || "",
            from: item.querySelector('[class*="actor"], [data-testid="actor"]')?.textContent?.trim() || "",
            amount: item.querySelector('[class*="amount"], [data-testid="amount"]')?.textContent?.trim() || "",
            note: item.querySelector('[class*="note"], [data-testid="note"]')?.textContent?.trim() || "",
            date: item.querySelector("time, [class*='date']")?.textContent?.trim() || "",
          })),
        };
      });

      return result;
    } catch (error) {
      return {
        notifications: [],
        pendingRequests: [],
        error: `Failed to get notifications: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async close(): Promise<void> {
    await this.browser.close();
  }
}
