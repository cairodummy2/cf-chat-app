/**
 * Type definitions for the LLM chat application.
 */

export interface Env {
	/**
	 * Binding for the Workers AI API.
	 */
	AI: Ai;

	/**
	 * Binding for static assets.
	 */
	ASSETS: { fetch: (request: Request) => Promise<Response> };

	/**
	 * Vectorize index for document embeddings.
	 */
	VECTORIZE_INDEX: VectorizeIndex;
}

/**
 * Represents a chat message.
 */
export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

/**
 * Represents a document that has been uploaded and vectorized.
 */
export interface DocumentRecord {
	/** Unique document ID */
	id: string;
	/** Original filename */
	filename: string;
	/** Extracted text content */
	content: string;
	/** Timestamp when uploaded */
	uploadedAt: string;
}