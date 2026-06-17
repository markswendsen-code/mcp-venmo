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
      "Send money to a Venmo user. Requires a recipient username, amount in USD, and a note describing the payment. Set confirm to false (default) for a preview, or true to actually send the money.",
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
        confirm: {
          type: "boolean",
          description:
            "If false (default), returns a preview only and does NOT send money. If true, actually sends the payment.",
          default: false,
        },
      },
      required: ["recipient", "amount", "note"],
    },
  },
  {
    name: "venmo_request_payment",
    description: "Request money from a Venmo user. Set confirm to false (default) for a preview, or true to actually send the request.",
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
        confirm: {
          type: "boolean",
          description:
            "If false (default), returns a preview only and does NOT send the request. If true, actually sends the payment request.",
          default: false,
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
    description: "Accept a pending payment request (this PAYS the requester). Set confirm to false (default) for a preview, or true to actually accept and pay.",
    inputSchema: {
      type: "object" as const,
      properties: {
        requestId: {
          type: "string",
          description: "ID of the payment request to accept",
        },
        confirm: {
          type: "boolean",
          description:
            "If false (default), returns a preview only and does NOT pay. If true, actually accepts the request and pays.",
          default: false,
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
      "Transfer your Venmo balance to a linked bank account. Omit amount to transfer the full balance. Set confirm to false (default) for a preview, or true to actually move the money.",
    inputSchema: {
      type: "object" as const,
      properties: {
        confirm: {
          type: "boolean",
          description:
            "If false (default), returns a preview only and does NOT transfer. If true, actually initiates the bank transfer.",
          default: false,
        },
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

    // Confirm-gate previews require NO session: they perform no action, only echo
    // what WOULD happen. This lets a caller safely preview before logging in.
    if (
      (name === "venmo_send_payment" ||
        name === "venmo_request_payment" ||
        name === "venmo_accept_request" ||
        name === "venmo_transfer_to_bank") &&
      args?.confirm !== true
    ) {
      let previewObj: Record<string, unknown>;
      if (name === "venmo_send_payment") {
        const amt = Number(args?.amount);
        previewObj = {
          preview: true,
          action: "send_payment",
          recipient: args?.recipient,
          amount: `$${amt.toFixed(2)}`,
          note: args?.note,
          audience: args?.audience ?? "private",
          message: `PREVIEW ONLY — no money sent. This will send $${amt.toFixed(2)} to @${args?.recipient}. Re-call venmo_send_payment with confirm:true to execute.`,
        };
      } else if (name === "venmo_request_payment") {
        const amt = Number(args?.amount);
        previewObj = {
          preview: true,
          action: "request_payment",
          recipient: args?.recipient,
          amount: `$${amt.toFixed(2)}`,
          note: args?.note,
          message: `PREVIEW ONLY — no request sent. This will request $${amt.toFixed(2)} from @${args?.recipient}. Re-call venmo_request_payment with confirm:true to execute.`,
        };
      } else if (name === "venmo_accept_request") {
        previewObj = {
          preview: true,
          action: "accept_request",
          requestId: args?.requestId,
          message: `PREVIEW ONLY — nothing paid. Accepting request ${args?.requestId} will PAY the requester from your balance. Re-call venmo_accept_request with confirm:true to execute.`,
        };
      } else {
        const amtMsg =
          args?.amount !== undefined
            ? `$${Number(args?.amount).toFixed(2)}`
            : "your full balance";
        previewObj = {
          preview: true,
          action: "transfer_to_bank",
          amount: amtMsg,
          transferSpeed: args?.transferSpeed ?? "standard",
          message: `PREVIEW ONLY — no transfer initiated. This will transfer ${amtMsg} to your bank (${args?.transferSpeed ?? "standard"}). Re-call venmo_transfer_to_bank with confirm:true to execute.`,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(previewObj, null, 2) }],
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

      case "venmo_send_payment": {
        const sendResult = await session.sendPayment(
          args?.recipient as string,
          args?.amount as number,
          args?.note as string,
          args?.audience as "public" | "friends" | "private"
        );
        return {
          content: [{ type: "text", text: JSON.stringify(sendResult, null, 2) }],
          isError: sendResult.success === false ? true : undefined,
        };
      }

      case "venmo_request_payment": {
        const reqResult = await session.requestPayment(
          args?.recipient as string,
          args?.amount as number,
          args?.note as string,
          args?.audience as "public" | "friends" | "private"
        );
        return {
          content: [{ type: "text", text: JSON.stringify(reqResult, null, 2) }],
          isError: reqResult.success === false ? true : undefined,
        };
      }

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

      case "venmo_accept_request": {
        const acceptResult = await session.acceptRequest(
          args?.requestId as string
        );
        return {
          content: [
            { type: "text", text: JSON.stringify(acceptResult, null, 2) },
          ],
          isError: acceptResult.success === false ? true : undefined,
        };
      }

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

      case "venmo_transfer_to_bank": {
        const transferResult = await session.transferToBank(
          args?.amount as number | undefined,
          args?.bankId as string | undefined,
          args?.transferSpeed as "instant" | "standard"
        );
        return {
          content: [
            { type: "text", text: JSON.stringify(transferResult, null, 2) },
          ],
          isError: transferResult.success === false ? true : undefined,
        };
      }

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
