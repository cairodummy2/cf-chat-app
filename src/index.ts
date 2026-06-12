/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

// Model ID for Workers AI model
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

// Default system prompt
const SYSTEM_PROMPT =
	"You are a helpful, friendly assistant. Provide concise and accurate responses.";

export default {
	/**
	 * Main request handler for the Worker
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Handle static assets (frontend)
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API Routes
		if (url.pathname === "/api/chat") {
			// Handle POST requests for chat
			if (request.method === "POST") {
				return handleChatRequest(request, env);
			}

			// Method not allowed for other request types
			return new Response("Method not allowed", { status: 405 });
		}

		// Handle document upload
		if (url.pathname === "/api/upload") {
			if (request.method === "POST") {
				return handleUploadRequest(request, env);
			}
			return new Response("Method not allowed", { status: 405 });
		}

		// Handle 404 for unmatched routes
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		// Parse JSON request body
		const { messages = [] } = (await request.json()) as {
			messages: ChatMessage[];
		};

		// Add system prompt if not present
		if (!messages.some((msg) => msg.role === "system")) {
			messages.unshift({ role: "system", content: SYSTEM_PROMPT });
		}

		const inputs = {
			messages,
			max_tokens: 1024,
			stream: true,
		} satisfies AiTextGenerationInput & { stream: true };

		const stream = await env.AI.run<typeof MODEL_ID>(MODEL_ID, inputs, {
			// Uncomment to use AI Gateway
			// gateway: {
			//   id: "YOUR_GATEWAY_ID", // Replace with your AI Gateway ID
			//   skipCache: false,      // Set to true to bypass cache
			//   cacheTtl: 3600,        // Cache time-to-live in seconds
			// },
		});

		return new Response(stream, {
			headers: {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("Error processing chat request:", error);
		return new Response(
			JSON.stringify({ error: "Failed to process request" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}

/**
 * Handles document upload requests
 */
async function handleUploadRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		// Parse form data to get the file
		const formData = await request.formData();
		const file = formData.get("file") as File;

		if (!file) {
			return new Response("No file provided", { status: 400 });
		}

		// Read file content
		const fileContent = await file.text();
		const filename = file.name;

		// Generate embeddings for the document
		const embeddingResponse = await env.AI.run(
			"@cf/baai/bge-base-en-v1.5",
			{
				text: fileContent,
			},
		);

		const embedding = (embeddingResponse as { data: number[] }).data;

		// Create a unique ID for the document
		const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`;

		// Upsert the document into Vectorize
		await env.VECTORIZE_INDEX.upsert([
			{
				id: docId,
				values: embedding,
				metadata: {
					filename,
					uploadedAt: new Date().toISOString(),
					content: fileContent.substring(0, 1000), // Store first 1000 chars as preview
				},
			},
		]);

		return new Response(
			JSON.stringify({
				success: true,
				message: `Document "${filename}" uploaded and vectorized successfully`,
				documentId: docId,
			}),
			{
				status: 200,
				headers: { "content-type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Error processing upload request:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to upload document",
				details: error instanceof Error ? error.message : String(error),
			}),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}}