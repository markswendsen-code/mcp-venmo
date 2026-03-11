#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { VenmoSession } from "./session.js";

const server = new Server(
  {
    name: "venmo-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

let session: VenmoSession | null = null;

const tools = [
  {
    name: "venmo_login",
    description:
      "Log in to Venmo with your username/email/phone and password. Required before all other operations. Optionally reads VENMO_USERNAME and VENMO_PASSWORD from environment variables.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: {
          type: "string",
          description:
            "Venmo username, email, or phone number. Falls back to VENMO_USERNAME env var.",
        },
        password: {
          type: "string",
          description: "Venmo account password. Falls back to VENMO_PASSWORD env var.",
        },
      },
    },
  },
  {
    name: "venmo_get_balance",
    description: "Check your current Venmo balance.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "venmo_send_payment",
    description:
      "Send money to a Venmo user. Requires a recipient username, amount in USD, and a note describing the payment.",
    inputSchema: {
      type: "object" as const,
      properties: {
        recipient: {
          type: "string",
          description: "Venmo username of the recipient (without @)",
        },
        amount: {
          type: "number",
          description: "Amount in USD to send (e.g. 10.50)",
        },
        note: {
          type: "string",
          description: "Description / note for the payment",
        },
        audience: {
          type: "string",
          enum: ["public", "friends", "private"],
          description: "Visibility of the transaction. Defaults to private.",
        },
      },
      required: ["recipient", "amount", "note"],
    },
  },
  {
    name: "venmo_request_payment",
    description: "Request money from a Venmo user.",
    inputSchema: {
      type: "object" as const,
      properties: {
        recipient: {
          type: "string",
          description: "Venmo username to request money from (without @)",
        },
        amount: {
          type: "number",
          description: "Amount in USD to request (e.g. 25.00)",
        },
        note: {
          type: "string",
          description: "Description / reason for the request",
        },
        audience: {
          type: "string",
          enum: ["public", "friends", "private"],
          description: "Visibility of the transaction. Defaults to private.",
        },
      },
      required: ["recipient", "amount", "note"],
    },
  },
  {
    name: "venmo_get_transactions",
    description: "View your Venmo transaction history (payments sent, received, and requests).",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of transactions to return. Defaults to 20.",
        },
      },
    },
  },
  {
    name: "venmo_get_friends",
    description: "List your Venmo friends.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of friends to return. Defaults to 50.",
        },
      },
    },
  },
  {
    name: "venmo_search_users",
    description: "Search for Venmo users by name or username.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Name or username to search for",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "venmo_add_friend",
    description: "Send a friend request to a Venmo user.",
    inputSchema: {
      type: "object" as const,
      properties: {
        username: {
          type: "string",
          description: "Venmo username to add as a friend (without @)",
        },
      },
      required: ["username"],
    },
  },
  {
    name: "venmo_accept_request",
    description: "Accept a pending payment request.",
    inputSchema: {
      type: "object" as const,
      properties: {
        requestId: {
          type: "string",
          description: "ID of the payment request to accept",
        },
      },
      required: ["requestId"],
    },
  },
  {
    name: "venmo_decline_request",
    description: "Decline a pending payment request.",
    inputSchema: {
      type: "object" as const,
      properties: {
        requestId: {
          type: "string",
          description: "ID of the payment request to decline",
        },
      },
      required: ["requestId"],
    },
  },
  {
    name: "venmo_transfer_to_bank",
    description:
      "Transfer your Venmo balance to a linked bank account. Omit amount to transfer the full balance.",
    inputSchema: {
      type: "object" as const,
      properties: {
        amount: {
          type: "number",
          description:
            "Amount in USD to transfer. Omit to transfer full balance.",
        },
        bankId: {
          type: "string",
          description: "ID of the bank account to transfer to (if multiple are linked)",
        },
        transferSpeed: {
          type: "string",
          enum: ["instant", "standard"],
          description:
            "Transfer speed. 'instant' arrives within 30 minutes (fee may apply), 'standard' takes 1-3 business days. Defaults to standard.",
        },
      },
    },
  },
  {
    name: "venmo_get_cards",
    description: "View your linked debit cards, credit cards, and bank accounts.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "venmo_get_notifications",
    description:
      "View your pending payment requests and recent notifications.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "venmo_login") {
      const username =
        (args?.username as string) || process.env.VENMO_USERNAME || "";
      const password =
        (args?.password as string) || process.env.VENMO_PASSWORD || "";

      if (!username || !password) {
        return {
          content: [
            {
              type: "text",
              text: "Error: username and password are required (or set VENMO_USERNAME / VENMO_PASSWORD env vars)",
            },
          ],
          isError: true,
        };
      }

      session = new VenmoSession();
      await session.initialize();
      const result = await session.login(username, password);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    if (!session) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Please log in first using venmo_login",
          },
        ],
        isError: true,
      };
    }

    switch (name) {
      case "venmo_get_balance":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await session.getBalance(), null, 2),
            },
          ],
        };

      case "venmo_send_payment":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await session.sendPayment(
                  args?.recipient as string,
                  args?.amount as number,
                  args?.note as string,
                  args?.audience as "public" | "friends" | "private"
                ),
                null,
                2
              ),
            },
          ],
        };

      case "venmo_request_payment":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await session.requestPayment(
                  args?.recipient as string,
                  args?.amount as number,
                  args?.note as string,
                  args?.audience as "public" | "friends" | "private"
                ),
                null,
                2
              ),
            },
          ],
        };

      case "venmo_get_transactions":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await session.getTransactions(args?.limit as number),
                null,
                2
              ),
            },
          ],
        };

      case "venmo_get_friends":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await session.getFriends(args?.limit as number),
                null,
                2
              ),
            },
          ],
        };

      case "venmo_search_users":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await session.searchUsers(args?.query as string),
                null,
                2
              ),
            },
          ],
        };

      case "venmo_add_friend":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await session.addFriend(args?.username as string),
                null,
                2
              ),
            },
          ],
        };

      case "venmo_accept_request":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await session.acceptRequest(args?.requestId as string),
                null,
                2
              ),
            },
          ],
        };

      case "venmo_decline_request":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await session.declineRequest(args?.requestId as string),
                null,
                2
              ),
            },
          ],
        };

      case "venmo_transfer_to_bank":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await session.transferToBank(
                  args?.amount as number | undefined,
                  args?.bankId as string | undefined,
                  args?.transferSpeed as "instant" | "standard"
                ),
                null,
                2
              ),
            },
          ],
        };

      case "venmo_get_cards":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(await session.getCards(), null, 2),
            },
          ],
        };

      case "venmo_get_notifications":
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                await session.getNotifications(),
                null,
                2
              ),
            },
          ],
        };

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
