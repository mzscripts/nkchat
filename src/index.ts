/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

// Model ID for Workers AI model
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

// Default system prompt
const SYSTEM_PROMPT =
	"You are a helpful, friendly assistant. Provide concise and accurate responses.";

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Handle static assets
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API route
		if (url.pathname === "/api/chat") {
			if (request.method === "POST") {
				return handleChatRequest(request, env);
			}
			return new Response("Method not allowed", { status: 405 });
		}

		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		const { messages = [] } = (await request.json()) as {
			messages: ChatMessage[];
		};

		// Clone so we don't mutate original array
		const finalMessages = [...messages];

		// Add system prompt if not present
		if (!finalMessages.some((msg) => msg.role === "system")) {
			finalMessages.unshift({ role: "system", content: SYSTEM_PROMPT });
		}

		// NON-STREAMING response (JSON-friendly)
		const result = await env.AI.run(MODEL_ID, {
			messages: finalMessages,
			max_tokens: 1024,
			stream: false,
		});

		const responseText =
			(result as any)?.response ||
			(result as any)?.result ||
			(result as any)?.text ||
			"";

		return new Response(
			JSON.stringify({
				success: true,
				response: responseText,
				raw: result,
			}),
			{
				headers: {
					"content-type": "application/json; charset=utf-8",
					"cache-control": "no-cache",
				},
			},
		);
	} catch (error) {
		console.error("Error processing chat request:", error);

		return new Response(
			JSON.stringify({
				success: false,
				error: error instanceof Error ? error.message : "Failed to process request",
			}),
			{
				status: 500,
				headers: { "content-type": "application/json; charset=utf-8" },
			},
		);
	}
}
