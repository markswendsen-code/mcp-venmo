# @striderlabs/mcp-venmo

MCP server connector for Venmo payments — lets AI agents send and receive money, check balances, manage friends, view transaction history, and transfer funds to a bank account via browser automation.

## Installation

```bash
npm install @striderlabs/mcp-venmo
```

## Configuration

Add to your MCP client configuration (e.g. Claude Desktop `~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "venmo": {
      "command": "npx",
      "args": ["@striderlabs/mcp-venmo"],
      "env": {
        "VENMO_USERNAME": "your-email-or-phone",
        "VENMO_PASSWORD": "your-password"
      }
    }
  }
}
```

Credentials can also be passed directly to `venmo_login` without environment variables.

## Available Tools

| Tool | Description |
|------|-------------|
| `venmo_login` | Authenticate with Venmo account |
| `venmo_get_balance` | Check current Venmo balance |
| `venmo_send_payment` | Send money to a user |
| `venmo_request_payment` | Request money from a user |
| `venmo_get_transactions` | View transaction history |
| `venmo_get_friends` | List Venmo friends |
| `venmo_search_users` | Search for users by name/username |
| `venmo_add_friend` | Send a friend request |
| `venmo_accept_request` | Accept a pending payment request |
| `venmo_decline_request` | Decline a pending payment request |
| `venmo_transfer_to_bank` | Transfer balance to linked bank account |
| `venmo_get_cards` | View linked cards and bank accounts |
| `venmo_get_notifications` | View pending requests and notifications |

## Example Usage

```typescript
// Log in (or use env vars — no args needed if set)
await client.call("venmo_login", {
  username: "user@example.com",
  password: "hunter2"
});

// Check balance
const { balance } = await client.call("venmo_get_balance", {});
console.log(balance); // "$42.50"

// Send money
await client.call("venmo_send_payment", {
  recipient: "janedoe",
  amount: 15.00,
  note: "lunch split",
  audience: "private"
});

// Request money
await client.call("venmo_request_payment", {
  recipient: "johndoe",
  amount: 20.00,
  note: "concert tickets"
});

// View recent transactions
const { transactions } = await client.call("venmo_get_transactions", { limit: 10 });

// Search for a user
const { users } = await client.call("venmo_search_users", { query: "Jane Doe" });

// Add a friend
await client.call("venmo_add_friend", { username: "janedoe" });

// View pending requests
const { pendingRequests } = await client.call("venmo_get_notifications", {});

// Accept a request
await client.call("venmo_accept_request", { requestId: pendingRequests[0].id });

// Transfer to bank
await client.call("venmo_transfer_to_bank", {
  amount: 50.00,
  transferSpeed: "standard"
});

// View linked payment methods
const { paymentMethods } = await client.call("venmo_get_cards", {});
```

## How It Works

This connector uses [Playwright](https://playwright.dev/) to automate the Venmo web application (`venmo.com`). It launches a headless Chromium browser, logs in with your credentials, and interacts with the Venmo UI to perform operations.

A single browser session is maintained across tool calls — you only need to call `venmo_login` once per session.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VENMO_USERNAME` | Your Venmo username, email, or phone number |
| `VENMO_PASSWORD` | Your Venmo password |

## Security Notes

- Credentials are only used to authenticate with venmo.com and are never transmitted elsewhere.
- The browser session runs locally on your machine.
- Use a dedicated Venmo account or enable 2FA carefully — automated logins may trigger security prompts.

## Requirements

- Node.js 18+
- Playwright Chromium (installed automatically with `npm install`)

After installing, run `npx playwright install chromium` if the browser isn't downloaded automatically.

## License

MIT — [Strider Labs](https://striderlabs.ai)
