import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAPIClient } from "../services/api-client.js";
import { Property, ResponseFormat } from "../types.js";
import { ListPropertiesSchema } from "../schemas/index.js";
import { formatPropertyMarkdown, formatList, truncateIfNeeded } from "../services/formatters.js";

export function registerPropertyTools(server: McpServer): void {
  /**
   * List all properties
   */
  server.registerTool(
    "zafari_list_properties",
    {
      title: "List Properties",
      description: "Fetch all safari properties/lodges in your Zafari CRS system with their details, location, and contact information.",
      inputSchema: ListPropertiesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const client = getAPIClient();
        const properties = await client.get<Property[]>("/properties");

        if (params.response_format === ResponseFormat.JSON) {
          const output = { properties };
          return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
          };
        }

        // Markdown format
        const markdown = formatList(
          properties,
          formatPropertyMarkdown,
          "No properties found."
        );

        return {
          content: [{ type: "text", text: truncateIfNeeded(markdown) }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error fetching properties: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );
}
