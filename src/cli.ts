#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { ZodError, z } from "zod";
import { CLI_NAME, DEFAULT_PAGE_SIZE } from "./constants.js";
import {
  formatAvailabilityMarkdown,
  formatBookingMarkdown,
  formatExtraServiceMarkdown,
  formatList,
  formatPropertyMarkdown,
  formatRatesMarkdown,
  formatRoomMarkdown,
} from "./services/formatters.js";
import { loadLocalEnvFiles } from "./services/env.js";
import { createAPIClient } from "./services/api-client.js";
import {
  createBooking,
  getBooking,
  getExtraServiceAvailability,
  getRoomAvailability,
  getRoomRates,
  getWebhookConfig,
  listBookings,
  listExtraServices,
  listProperties,
  listRooms,
  updateBookingStatus,
  updateExtraServiceAvailability,
  updateRoomAvailability,
  updateRoomRates,
  updateWebhookConfig,
} from "./services/operations.js";
import {
  CreateBookingOptionsSchema,
  ExtraServiceAvailabilityOptionsSchema,
  GetBookingOptionsSchema,
  GetWebhookConfigOptionsSchema,
  ListBookingsOptionsSchema,
  ListExtraServicesOptionsSchema,
  ListRoomsOptionsSchema,
  OutputFormat,
  OutputFormatSchema,
  RoomAvailabilityOptionsSchema,
  RoomRatesOptionsSchema,
  UpdateBookingStatusOptionsSchema,
  UpdateExtraServiceAvailabilityOptionsSchema,
  UpdateRoomAvailabilityOptionsSchema,
  UpdateRoomRatesOptionsSchema,
  UpdateWebhookConfigOptionsSchema,
} from "./schemas/index.js";

type FlagValue = boolean | string | string[];

interface ParsedArgv {
  commandPath: string[];
  flags: Record<string, FlagValue>;
}

interface CommandResult {
  data: unknown;
  markdown?: string;
  text?: string;
}

interface CommandContext {
  flags: Record<string, FlagValue>;
}

interface CommandDefinition {
  path: string[];
  summary: string;
  usage: string;
  examples: string[];
  options: string[];
  defaultOutputFormat?: OutputFormat;
  run: (context: CommandContext) => Promise<CommandResult>;
}

const GLOBAL_OPTIONS = [
  "--output <json|markdown|text>",
  "--json",
  "--markdown",
  "--text",
  "--compact",
  "--base-url <url>",
  "--api-key <key>",
  "--api-key-env <name>",
  "--fields <path[,path...]>",
  "--ndjson",
  "-h, --help",
];

const COMMANDS: CommandDefinition[] = [
  {
    path: ["completion", "bash"],
    summary: "Print bash completion script.",
    usage: `${CLI_NAME} completion bash`,
    examples: [
      `source <(${CLI_NAME} completion bash)`,
      `${CLI_NAME} completion bash > ~/.${CLI_NAME}-completion.bash`,
    ],
    options: [],
    defaultOutputFormat: "text",
    run: async () => {
      const script = buildBashCompletionScript();
      return {
        data: {
          shell: "bash",
          script,
          commands: COMMANDS.map((command) => command.path.join(" ")),
        },
        text: script,
      };
    },
  },
  {
    path: ["completion", "zsh"],
    summary: "Print zsh completion script.",
    usage: `${CLI_NAME} completion zsh`,
    examples: [
      `autoload -U compinit && compinit && source <(${CLI_NAME} completion zsh)`,
      `${CLI_NAME} completion zsh > ~/.${CLI_NAME}-completion.zsh`,
    ],
    options: [],
    defaultOutputFormat: "text",
    run: async () => {
      const script = buildZshCompletionScript();
      return {
        data: {
          shell: "zsh",
          script,
          commands: COMMANDS.map((command) => command.path.join(" ")),
        },
        text: script,
      };
    },
  },
  {
    path: ["completion", "fish"],
    summary: "Print fish completion script.",
    usage: `${CLI_NAME} completion fish`,
    examples: [
      `${CLI_NAME} completion fish > ~/.config/fish/completions/${CLI_NAME}.fish`,
    ],
    options: [],
    defaultOutputFormat: "text",
    run: async () => {
      const script = buildFishCompletionScript();
      return {
        data: {
          shell: "fish",
          script,
          commands: COMMANDS.map((command) => command.path.join(" ")),
        },
        text: script,
      };
    },
  },
  {
    path: ["properties", "list"],
    summary: "List properties available to the API key.",
    usage: `${CLI_NAME} properties list [--output json|markdown]`,
    examples: [`${CLI_NAME} properties list`, `${CLI_NAME} properties list --markdown`],
    options: [],
    run: async (context) => {
      const client = getClientFromFlags(context.flags);
      const properties = await listProperties(client);
      return {
        data: { properties },
        markdown: formatList(properties, formatPropertyMarkdown, "No properties found."),
      };
    },
  },
  {
    path: ["rooms", "list"],
    summary: "List room types for a property.",
    usage: `${CLI_NAME} rooms list --property-id <id>`,
    examples: [`${CLI_NAME} rooms list --property-id prop_123`],
    options: ["--property-id <id>"],
    run: async (context) => {
      const options = ListRoomsOptionsSchema.parse({
        property_id: getStringFlag(context.flags, "property-id"),
      });
      const client = getClientFromFlags(context.flags);
      const rooms = await listRooms(client, options);
      return {
        data: { property_id: options.property_id, rooms },
        markdown: formatList(
          rooms,
          formatRoomMarkdown,
          `No rooms found for property ${options.property_id}.`,
        ),
      };
    },
  },
  {
    path: ["rooms", "availability"],
    summary: "Fetch room availability for a date range.",
    usage: `${CLI_NAME} rooms availability --property-id <id> --room-id <id> --from YYYY-MM-DD --to YYYY-MM-DD`,
    examples: [
      `${CLI_NAME} rooms availability --property-id prop_123 --room-id room_456 --from 2026-04-01 --to 2026-04-03`,
    ],
    options: ["--property-id <id>", "--room-id <id>", "--from <date>", "--to <date>"],
    run: async (context) => {
      const options = RoomAvailabilityOptionsSchema.parse({
        property_id: getStringFlag(context.flags, "property-id"),
        room_id: getStringFlag(context.flags, "room-id"),
        from: getStringFlag(context.flags, "from"),
        to: getStringFlag(context.flags, "to"),
      });
      const client = getClientFromFlags(context.flags);
      const availability = await getRoomAvailability(client, options);
      return {
        data: { ...options, availability },
        markdown: `# Room Availability
**Property:** ${options.property_id}
**Room:** ${options.room_id}
**Period:** ${options.from} to ${options.to}

${formatAvailabilityMarkdown(availability)}`,
      };
    },
  },
  {
    path: ["rooms", "rates"],
    summary: "Fetch room rates for a date range.",
    usage: `${CLI_NAME} rooms rates --property-id <id> --room-id <id> --from YYYY-MM-DD --to YYYY-MM-DD [--resident-type resident|non_resident]`,
    examples: [
      `${CLI_NAME} rooms rates --property-id prop_123 --room-id room_456 --from 2026-04-01 --to 2026-04-03`,
    ],
    options: [
      "--property-id <id>",
      "--room-id <id>",
      "--from <date>",
      "--to <date>",
      "--resident-type <type>",
    ],
    run: async (context) => {
      const options = RoomRatesOptionsSchema.parse({
        property_id: getStringFlag(context.flags, "property-id"),
        room_id: getStringFlag(context.flags, "room-id"),
        from: getStringFlag(context.flags, "from"),
        to: getStringFlag(context.flags, "to"),
        resident_type: getOptionalStringFlag(context.flags, "resident-type"),
      });
      const client = getClientFromFlags(context.flags);
      const rates = await getRoomRates(client, options);
      return {
        data: { ...options, rates },
        markdown: `# Room Rates
**Property:** ${options.property_id}
**Room:** ${options.room_id}
**Period:** ${options.from} to ${options.to}
${options.resident_type ? `**Resident Type:** ${options.resident_type}` : ""}

${formatRatesMarkdown(rates)}`,
      };
    },
  },
  {
    path: ["rooms", "update-availability"],
    summary: "Update room availability for a date range.",
    usage: `${CLI_NAME} rooms update-availability --property-id <id> --room-id <id> --from YYYY-MM-DD --to YYYY-MM-DD --availability <n|null>`,
    examples: [
      `${CLI_NAME} rooms update-availability --property-id prop_123 --room-id room_456 --from 2026-04-01 --to 2026-04-03 --availability 4`,
    ],
    options: [
      "--property-id <id>",
      "--room-id <id>",
      "--from <date>",
      "--to <date>",
      "--availability <n|null>",
    ],
    run: async (context) => {
      const options = UpdateRoomAvailabilityOptionsSchema.parse({
        property_id: getStringFlag(context.flags, "property-id"),
        room_id: getStringFlag(context.flags, "room-id"),
        from: getStringFlag(context.flags, "from"),
        to: getStringFlag(context.flags, "to"),
        availability: parseNullableNumber(getStringFlag(context.flags, "availability")),
      });
      const client = getClientFromFlags(context.flags);
      await updateRoomAvailability(client, options);
      const availabilityText = options.availability === null ? "unlimited" : String(options.availability);
      return {
        data: { updated: true, ...options },
        markdown: `Updated room availability to ${availabilityText} for ${options.from} to ${options.to}.`,
      };
    },
  },
  {
    path: ["rooms", "update-rates"],
    summary: "Update room rates for a date range.",
    usage: `${CLI_NAME} rooms update-rates --property-id <id> --room-id <id> --from YYYY-MM-DD --to YYYY-MM-DD --rate <amount> --resident-type resident|non_resident`,
    examples: [
      `${CLI_NAME} rooms update-rates --property-id prop_123 --room-id room_456 --from 2026-04-01 --to 2026-04-03 --rate 450 --resident-type resident`,
    ],
    options: [
      "--property-id <id>",
      "--room-id <id>",
      "--from <date>",
      "--to <date>",
      "--rate <amount>",
      "--resident-type <type>",
    ],
    run: async (context) => {
      const options = UpdateRoomRatesOptionsSchema.parse({
        property_id: getStringFlag(context.flags, "property-id"),
        room_id: getStringFlag(context.flags, "room-id"),
        from: getStringFlag(context.flags, "from"),
        to: getStringFlag(context.flags, "to"),
        rate: getStringFlag(context.flags, "rate"),
        resident_type: getStringFlag(context.flags, "resident-type"),
      });
      const client = getClientFromFlags(context.flags);
      await updateRoomRates(client, options);
      return {
        data: { updated: true, ...options },
        markdown: `Updated ${options.resident_type} room rates to ${options.rate} for ${options.from} to ${options.to}.`,
      };
    },
  },
  {
    path: ["extras", "list"],
    summary: "List extra services for a property.",
    usage: `${CLI_NAME} extras list --property-id <id>`,
    examples: [`${CLI_NAME} extras list --property-id prop_123`],
    options: ["--property-id <id>"],
    run: async (context) => {
      const options = ListExtraServicesOptionsSchema.parse({
        property_id: getStringFlag(context.flags, "property-id"),
      });
      const client = getClientFromFlags(context.flags);
      const extras = await listExtraServices(client, options);
      return {
        data: { property_id: options.property_id, extras },
        markdown: formatList(
          extras,
          formatExtraServiceMarkdown,
          `No extra services found for property ${options.property_id}.`,
        ),
      };
    },
  },
  {
    path: ["extras", "availability"],
    summary: "Fetch extra service availability for a date range.",
    usage: `${CLI_NAME} extras availability --property-id <id> --extra-service-id <id> --from YYYY-MM-DD --to YYYY-MM-DD`,
    examples: [
      `${CLI_NAME} extras availability --property-id prop_123 --extra-service-id extra_456 --from 2026-04-01 --to 2026-04-03`,
    ],
    options: ["--property-id <id>", "--extra-service-id <id>", "--from <date>", "--to <date>"],
    run: async (context) => {
      const options = ExtraServiceAvailabilityOptionsSchema.parse({
        property_id: getStringFlag(context.flags, "property-id"),
        extra_service_id: getStringFlag(context.flags, "extra-service-id"),
        from: getStringFlag(context.flags, "from"),
        to: getStringFlag(context.flags, "to"),
      });
      const client = getClientFromFlags(context.flags);
      const availability = await getExtraServiceAvailability(client, options);
      return {
        data: { ...options, availability },
        markdown: `# Extra Service Availability
**Property:** ${options.property_id}
**Service:** ${options.extra_service_id}
**Period:** ${options.from} to ${options.to}

${formatAvailabilityMarkdown(availability)}`,
      };
    },
  },
  {
    path: ["extras", "update-availability"],
    summary: "Update extra service availability for a date range.",
    usage: `${CLI_NAME} extras update-availability --property-id <id> --extra-service-id <id> --from YYYY-MM-DD --to YYYY-MM-DD --availability <n|null>`,
    examples: [
      `${CLI_NAME} extras update-availability --property-id prop_123 --extra-service-id extra_456 --from 2026-04-01 --to 2026-04-03 --availability 10`,
    ],
    options: [
      "--property-id <id>",
      "--extra-service-id <id>",
      "--from <date>",
      "--to <date>",
      "--availability <n|null>",
    ],
    run: async (context) => {
      const options = UpdateExtraServiceAvailabilityOptionsSchema.parse({
        property_id: getStringFlag(context.flags, "property-id"),
        extra_service_id: getStringFlag(context.flags, "extra-service-id"),
        from: getStringFlag(context.flags, "from"),
        to: getStringFlag(context.flags, "to"),
        availability: parseNullableNumber(getStringFlag(context.flags, "availability")),
      });
      const client = getClientFromFlags(context.flags);
      await updateExtraServiceAvailability(client, options);
      const availabilityText = options.availability === null ? "unlimited" : String(options.availability);
      return {
        data: { updated: true, ...options },
        markdown: `Updated extra service availability to ${availabilityText} for ${options.from} to ${options.to}.`,
      };
    },
  },
  {
    path: ["bookings", "list"],
    summary: "List bookings for a property.",
    usage: `${CLI_NAME} bookings list --property-id <id> [--status pending|confirmed|cancelled|completed] [--from-date YYYY-MM-DD] [--to-date YYYY-MM-DD] [--limit <n>] [--offset <n>]`,
    examples: [
      `${CLI_NAME} bookings list --property-id prop_123 --status confirmed --limit 25`,
    ],
    options: [
      "--property-id <id>",
      "--status <status>",
      "--from-date <date>",
      "--to-date <date>",
      `--limit <n> (default: ${DEFAULT_PAGE_SIZE})`,
      "--offset <n>",
    ],
    run: async (context) => {
      const options = ListBookingsOptionsSchema.parse({
        property_id: getStringFlag(context.flags, "property-id"),
        status: getOptionalStringFlag(context.flags, "status"),
        from_date: getOptionalStringFlag(context.flags, "from-date"),
        to_date: getOptionalStringFlag(context.flags, "to-date"),
        limit: getOptionalStringFlag(context.flags, "limit"),
        offset: getOptionalStringFlag(context.flags, "offset"),
      });
      const client = getClientFromFlags(context.flags);
      const bookings = await listBookings(client, options);
      return {
        data: {
          property_id: options.property_id,
          filters: {
            status: options.status,
            from_date: options.from_date,
            to_date: options.to_date,
          },
          pagination: {
            limit: options.limit,
            offset: options.offset,
            returned: bookings.length,
          },
          bookings,
        },
        markdown: `# Bookings for Property ${options.property_id}
${options.status ? `**Status Filter:** ${options.status}` : ""}
${options.from_date || options.to_date ? `**Date Range:** ${options.from_date || "any"} to ${options.to_date || "any"}` : ""}
**Results:** ${bookings.length} bookings (offset: ${options.offset}, limit: ${options.limit})

---

${formatList(bookings, formatBookingMarkdown, "No bookings found matching the criteria.")}`,
      };
    },
  },
  {
    path: ["bookings", "get"],
    summary: "Get a single booking by ID.",
    usage: `${CLI_NAME} bookings get --property-id <id> --booking-id <id>`,
    examples: [`${CLI_NAME} bookings get --property-id prop_123 --booking-id booking_456`],
    options: ["--property-id <id>", "--booking-id <id>"],
    run: async (context) => {
      const options = GetBookingOptionsSchema.parse({
        property_id: getStringFlag(context.flags, "property-id"),
        booking_id: getStringFlag(context.flags, "booking-id"),
      });
      const client = getClientFromFlags(context.flags);
      const booking = await getBooking(client, options);
      return {
        data: { booking },
        markdown: formatBookingMarkdown(booking),
      };
    },
  },
  {
    path: ["bookings", "create"],
    summary: "Create a booking from JSON input.",
    usage: `${CLI_NAME} bookings create --property-id <id> --input <path|->`,
    examples: [
      `${CLI_NAME} bookings create --property-id prop_123 --input @booking.json`,
      `cat booking.json | ${CLI_NAME} bookings create --property-id prop_123 --input -`,
    ],
    options: ["--property-id <id>", "--input <path|@path|->"],
    run: async (context) => {
      const inputPath = getStringFlag(context.flags, "input");
      const payload = await readJsonInput(inputPath);
      const options = CreateBookingOptionsSchema.parse({
        ...payload,
        property_id: getOptionalStringFlag(context.flags, "property-id") ?? payload.property_id,
      });
      const client = getClientFromFlags(context.flags);
      const booking = await createBooking(client, options);
      return {
        data: {
          success: true,
          booking_id: booking.id,
          reference: booking.reference,
          booking,
        },
        markdown: `Created booking ${booking.reference} for ${booking.guest_details.first_name} ${booking.guest_details.last_name}.`,
      };
    },
  },
  {
    path: ["bookings", "update-status"],
    summary: "Update a booking status.",
    usage: `${CLI_NAME} bookings update-status --property-id <id> --booking-id <id> --status pending|confirmed|cancelled|completed`,
    examples: [
      `${CLI_NAME} bookings update-status --property-id prop_123 --booking-id booking_456 --status confirmed`,
    ],
    options: ["--property-id <id>", "--booking-id <id>", "--status <status>"],
    run: async (context) => {
      const options = UpdateBookingStatusOptionsSchema.parse({
        property_id: getStringFlag(context.flags, "property-id"),
        booking_id: getStringFlag(context.flags, "booking-id"),
        status: getStringFlag(context.flags, "status"),
      });
      const client = getClientFromFlags(context.flags);
      await updateBookingStatus(client, options);
      return {
        data: { updated: true, ...options },
        markdown: `Updated booking ${options.booking_id} to ${options.status}.`,
      };
    },
  },
  {
    path: ["webhooks", "get"],
    summary: "Get webhook configuration for a property.",
    usage: `${CLI_NAME} webhooks get --property-id <id>`,
    examples: [`${CLI_NAME} webhooks get --property-id prop_123`],
    options: ["--property-id <id>"],
    run: async (context) => {
      const options = GetWebhookConfigOptionsSchema.parse({
        property_id: getStringFlag(context.flags, "property-id"),
      });
      const client = getClientFromFlags(context.flags);
      const webhook_config = await getWebhookConfig(client, options);
      return {
        data: {
          property_id: options.property_id,
          webhook_config,
        },
        markdown: formatWebhookMarkdown(options.property_id, webhook_config),
      };
    },
  },
  {
    path: ["webhooks", "update"],
    summary: "Update webhook configuration for a property.",
    usage: `${CLI_NAME} webhooks update --property-id <id> --url <url> --event <name> [--event <name> ...] [--room <id> ...] [--extra-service <id> ...]`,
    examples: [
      `${CLI_NAME} webhooks update --property-id prop_123 --url https://example.com/webhook --event booking.created --event booking.updated`,
    ],
    options: [
      "--property-id <id>",
      "--url <url>",
      "--event <name> (repeatable)",
      "--room <id> (repeatable)",
      "--extra-service <id> (repeatable)",
    ],
    run: async (context) => {
      const options = UpdateWebhookConfigOptionsSchema.parse({
        property_id: getStringFlag(context.flags, "property-id"),
        url: getStringFlag(context.flags, "url"),
        events: getStringListFlag(context.flags, "event"),
        rooms: getOptionalStringListFlag(context.flags, "room"),
        extra_services: getOptionalStringListFlag(context.flags, "extra-service"),
      });
      const client = getClientFromFlags(context.flags);
      await updateWebhookConfig(client, options);
      return {
        data: { updated: true, ...options },
        markdown: `Updated webhook configuration for property ${options.property_id}.`,
      };
    },
  },
];

const BOOLEAN_FLAGS = new Set(["help", "version", "json", "markdown", "text", "ndjson", "compact"]);

async function main(): Promise<void> {
  loadLocalEnvFiles();

  const parsed = parseArgv(process.argv.slice(2));
  const version = getPackageVersion();

  if (parsed.flags.version || matchesCommand(parsed.commandPath, ["version"])) {
    process.stdout.write(`${version}\n`);
    return;
  }

  if (
    parsed.commandPath.length === 0 ||
    parsed.flags.help ||
    matchesCommand(parsed.commandPath, ["help"])
  ) {
    const targetCommand = matchesCommand(parsed.commandPath, ["help"])
      ? parsed.commandPath.slice(1)
      : parsed.commandPath;
    renderHelp(targetCommand);
    return;
  }

  const command = findCommand(parsed.commandPath);
  if (!command) {
    throw new Error(`Unknown command: ${parsed.commandPath.join(" ")}`);
  }

  const outputFormat = resolveOutputFormat(parsed.flags, command);
  const result = await command.run({
    flags: parsed.flags,
  });

  writeSuccess(result, outputFormat, parsed.flags);
}

function parseArgv(argv: string[]): ParsedArgv {
  const positionals: string[] = [];
  const flags: Record<string, FlagValue> = {};
  let index = 0;

  while (index < argv.length) {
    const token = argv[index];
    if (!token.startsWith("-")) {
      positionals.push(token);
      index += 1;
      continue;
    }

    if (token === "--") {
      throw new Error("Unexpected bare --");
    }

    const { key, value, nextIndex } = consumeFlag(argv, index);
    assignFlag(flags, key, value);
    index = nextIndex;
  }

  if (positionals.length > 2) {
    throw new Error(`Unexpected positional arguments: ${positionals.slice(2).join(" ")}`);
  }

  return { commandPath: positionals, flags };
}

function consumeFlag(argv: string[], index: number): { key: string; value: FlagValue; nextIndex: number } {
  const token = argv[index];

  if (token === "-h") {
    return { key: "help", value: true, nextIndex: index + 1 };
  }
  if (token === "-v") {
    return { key: "version", value: true, nextIndex: index + 1 };
  }
  if (token === "-i") {
    return consumeShortValueFlag("input", argv, index);
  }
  if (token === "-o") {
    return consumeShortValueFlag("output", argv, index);
  }

  const normalized = token.slice(2);
  const equalsIndex = normalized.indexOf("=");
  if (equalsIndex >= 0) {
    const key = normalized.slice(0, equalsIndex);
    const value = normalized.slice(equalsIndex + 1);
    return { key, value: value === "" ? true : value, nextIndex: index + 1 };
  }

  if (BOOLEAN_FLAGS.has(normalized)) {
    return { key: normalized, value: true, nextIndex: index + 1 };
  }

  const next = argv[index + 1];
  if (!next || (next.startsWith("-") && next !== "-")) {
    return { key: normalized, value: true, nextIndex: index + 1 };
  }

  return { key: normalized, value: next, nextIndex: index + 2 };
}

function consumeShortValueFlag(
  key: string,
  argv: string[],
  index: number,
): { key: string; value: FlagValue; nextIndex: number } {
  const next = argv[index + 1];
  if (!next || (next.startsWith("-") && next !== "-")) {
    throw new Error(`Flag -${key[0]} requires a value`);
  }

  return { key, value: next, nextIndex: index + 2 };
}

function assignFlag(flags: Record<string, FlagValue>, key: string, value: FlagValue): void {
  const current = flags[key];
  if (current === undefined) {
    flags[key] = value;
    return;
  }

  if (Array.isArray(current)) {
    current.push(String(value));
    return;
  }

  flags[key] = [String(current), String(value)];
}

function resolveOutputFormat(flags: Record<string, FlagValue>, command?: CommandDefinition): OutputFormat {
  const explicitFormats = [flags.json, flags.markdown, flags.text].filter(Boolean).length;
  if (explicitFormats > 1) {
    throw new Error("Choose only one of --json, --markdown, or --text.");
  }
  if (flags.json) {
    return "json";
  }
  if (flags.markdown) {
    return "markdown";
  }
  if (flags.text) {
    return "text";
  }
  return OutputFormatSchema.parse(
    getOptionalStringFlag(flags, "output") ?? command?.defaultOutputFormat ?? "json",
  );
}

function getClientFromFlags(flags: Record<string, FlagValue>) {
  const apiKeyEnvName = getOptionalStringFlag(flags, "api-key-env");
  const apiKey =
    getOptionalStringFlag(flags, "api-key") ??
    (apiKeyEnvName ? process.env[apiKeyEnvName] : undefined) ??
    process.env.ZAFARI_API_KEY;

  return createAPIClient({
    apiKey,
    baseURL: getOptionalStringFlag(flags, "base-url") ?? process.env.ZAFARI_BASE_URL,
  });
}

function getStringFlag(flags: Record<string, FlagValue>, key: string): string {
  const value = flags[key];
  if (typeof value !== "string") {
    throw new Error(`Missing required flag --${key}`);
  }
  return value;
}

function getOptionalStringFlag(flags: Record<string, FlagValue>, key: string): string | undefined {
  const value = flags[key];
  if (value === undefined || typeof value === "boolean") {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value[value.length - 1];
  }
  return value;
}

function getStringListFlag(flags: Record<string, FlagValue>, key: string): string[] {
  const values = getOptionalStringListFlag(flags, key);
  if (!values?.length) {
    throw new Error(`Missing required flag --${key}`);
  }
  return values;
}

function getOptionalStringListFlag(flags: Record<string, FlagValue>, key: string): string[] | undefined {
  const value = flags[key];
  if (value === undefined || typeof value === "boolean") {
    return undefined;
  }

  const items = Array.isArray(value) ? value : [value];
  const parsed = items
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : undefined;
}

function parseNullableNumber(value: string): number | null {
  if (value === "null" || value === "unlimited") {
    return null;
  }

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`Expected a number, received: ${value}`);
  }

  return numberValue;
}

async function readJsonInput(inputPath: string): Promise<Record<string, unknown>> {
  const normalizedInputPath = normalizeInputPath(inputPath);
  const raw =
    normalizedInputPath === "-"
      ? await readAllFromStdin()
      : await readFile(normalizedInputPath, "utf8");

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Input JSON must be an object.");
  }

  return parsed as Record<string, unknown>;
}

function normalizeInputPath(inputPath: string): string {
  if (inputPath.startsWith("@") && inputPath.length > 1) {
    return inputPath.slice(1);
  }
  return inputPath;
}

async function readAllFromStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function writeSuccess(
  result: CommandResult,
  outputFormat: OutputFormat,
  flags: Record<string, FlagValue>,
): void {
  if (outputFormat === "markdown") {
    enforceJsonOnlyFlags(flags, outputFormat);
    process.stdout.write(`${result.markdown ?? result.text ?? JSON.stringify(result.data, null, 2)}\n`);
    return;
  }

  if (outputFormat === "text") {
    enforceJsonOnlyFlags(flags, outputFormat);
    process.stdout.write(`${result.text ?? result.markdown ?? JSON.stringify(result.data, null, 2)}\n`);
    return;
  }

  const projected = applyJsonPostProcessing(result.data, flags);
  if (flags.ndjson) {
    process.stdout.write(`${formatNdjson(projected)}\n`);
    return;
  }

  const spacing = flags.compact ? 0 : 2;
  process.stdout.write(`${JSON.stringify(projected, null, spacing)}\n`);
}

function renderHelp(targetPath: string[]): void {
  if (targetPath.length > 0) {
    const command = findCommand(targetPath);
    if (command) {
      process.stdout.write(formatCommandHelp(command));
      return;
    }
  }

  process.stdout.write(formatGlobalHelp());
}

function formatGlobalHelp(): string {
  const lines = [
    `${CLI_NAME} CLI`,
    "",
    "Agent-friendly CLI for the Zafari CRS API.",
    "",
    "Usage:",
    `  ${CLI_NAME} <group> <command> [flags]`,
    "",
    "Global flags:",
    "  --output <json|markdown|text> Output format (default: json, or text for completion)",
    "  --json                     Shorthand for --output json",
    "  --markdown                 Shorthand for --output markdown",
    "  --text                     Shorthand for --output text",
    "  --compact                  Compact JSON output on a single line",
    "  --base-url <url>           Override the Zafari API base URL",
    "  --api-key <key>            Override ZAFARI_API_KEY for a single command",
    "  --api-key-env <name>       Read the API key from a different env var",
    "  --fields <path[,path...]>  Select specific JSON fields from command output",
    "  --ndjson                   Emit one JSON object per line from an array result",
    "  -h, --help                 Show help",
    "  -v, --version              Show version",
    "",
    "Command groups:",
    ...formatCommandGroups(),
    "",
    `Run '${CLI_NAME} <group> <command> --help' for details.`,
    "",
  ];

  return lines.join("\n");
}

function formatCommandGroups(): string[] {
  const grouped = new Map<string, CommandDefinition[]>();

  for (const command of COMMANDS) {
    const group = command.path[0];
    const commands = grouped.get(group) ?? [];
    commands.push(command);
    grouped.set(group, commands);
  }

  return [...grouped.entries()].flatMap(([group, commands]) => [
    `  ${group}`,
    ...commands.map((command) => `    ${command.path[1].padEnd(22)} ${command.summary}`),
  ]);
}

function formatCommandHelp(command: CommandDefinition): string {
  const lines = [
    `Usage: ${command.usage}`,
    "",
    command.summary,
    "",
    "Options:",
    ...[...command.options, ...GLOBAL_OPTIONS].map((option) => `  ${option}`),
    "",
    "Examples:",
    ...command.examples.map((example) => `  ${example}`),
    "",
  ];

  return lines.join("\n");
}

function enforceJsonOnlyFlags(flags: Record<string, FlagValue>, outputFormat: OutputFormat): void {
  if (outputFormat === "json") {
    return;
  }

  if (flags.fields || flags.ndjson || flags.compact) {
    throw new Error("--fields, --ndjson, and --compact can only be used with JSON output.");
  }
}

function applyJsonPostProcessing(data: unknown, flags: Record<string, FlagValue>): unknown {
  const fields = getOptionalStringListFlag(flags, "fields");
  if (!fields?.length) {
    return data;
  }

  const fieldPaths = fields.map((field) => field.split(".").filter(Boolean));
  return selectFields(data, fieldPaths);
}

function selectFields(value: unknown, fieldPaths: string[][]): unknown {
  if (fieldPaths.length === 0) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => selectFields(item, fieldPaths));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const fieldPath of fieldPaths) {
    const fieldValue = getValueAtPath(value, fieldPath);
    if (fieldValue !== undefined) {
      assignPath(result, fieldPath, fieldValue);
    }
  }

  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getValueAtPath(value: unknown, path: string[]): unknown {
  let current: unknown = value;
  for (const segment of path) {
    if (Array.isArray(current)) {
      current = current.map((item) => getValueAtPath(item, [segment]));
      continue;
    }

    if (!isPlainObject(current) || !(segment in current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
}

function assignPath(target: Record<string, unknown>, path: string[], value: unknown): void {
  let cursor: Record<string, unknown> = target;
  for (let index = 0; index < path.length; index += 1) {
    const segment = path[index];
    if (index === path.length - 1) {
      cursor[segment] = value;
      return;
    }

    const existing = cursor[segment];
    if (!isPlainObject(existing)) {
      cursor[segment] = {};
    }

    cursor = cursor[segment] as Record<string, unknown>;
  }
}

function formatNdjson(value: unknown): string {
  const source = extractNdjsonSource(value);
  if (!Array.isArray(source)) {
    throw new Error("--ndjson requires an array result. Use --fields to select one.");
  }

  return source.map((entry) => JSON.stringify(entry)).join("\n");
}

function extractNdjsonSource(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const entries = Object.entries(value);
  if (entries.length === 1) {
    return extractNdjsonSource(entries[0][1]);
  }

  const arrayEntries = Object.values(value).filter(Array.isArray);
  if (arrayEntries.length === 1) {
    return arrayEntries[0];
  }

  return value;
}

function findCommand(path: string[]): CommandDefinition | undefined {
  return COMMANDS.find((command) => matchesCommand(path, command.path));
}

function matchesCommand(input: string[], commandPath: string[]): boolean {
  return input.length === commandPath.length && input.every((part, index) => part === commandPath[index]);
}

function formatWebhookMarkdown(propertyId: string, config: { url: string; events: string[]; rooms?: string[]; extra_services?: string[] }): string {
  return `# Webhook Configuration
**Property ID:** ${propertyId}
**Webhook URL:** ${config.url || "Not configured"}
**Events:** ${config.events?.length ? config.events.join(", ") : "None"}
${config.rooms?.length ? `**Room Filters:** ${config.rooms.join(", ")}` : ""}
${config.extra_services?.length ? `**Extra Service Filters:** ${config.extra_services.join(", ")}` : ""}`;
}

function getPackageVersion(): string {
  const packagePath = new URL("../package.json", import.meta.url);
  const contents = readFileSync(packagePath, "utf8");
  const parsed = z.object({ version: z.string() }).parse(JSON.parse(contents));
  return parsed.version;
}

function buildBashCompletionScript(): string {
  const commandWords = COMMANDS.map((command) => command.path.join(" "));
  return `_${CLI_NAME}_completion() {
  local cur prev words cword
  _init_completion || return

  local groups="${getCommandGroups().join(" ")}"
  local global_flags="${getGlobalCompletionFlags().join(" ")}"

  if [[ $cword -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "$groups" -- "$cur") )
    return
  fi

  if [[ $cword -eq 2 ]]; then
    case "\${words[1]}" in
${formatBashCompletionCases(commandWords)}
    esac
  fi

  if [[ $cword -ge 3 ]]; then
    local command_key="\${words[1]} \${words[2]}"
    case "$command_key" in
${formatBashOptionCases()}
    esac
  fi

  COMPREPLY=( $(compgen -W "$global_flags" -- "$cur") )
}

complete -F _${CLI_NAME}_completion ${CLI_NAME}`;
}

function buildZshCompletionScript(): string {
  const groupCases = [...new Set(getCommandGroups())]
    .map((group) => {
      const commands = COMMANDS.filter((command) => command.path[0] === group)
        .map((command) => `'${command.path[1]}:${escapeSingleQuotes(command.summary)}'`)
        .join(" ");
      return `    ${group})
      _values 'command' ${commands}
      ;;`;
    })
    .join("\n");

  return `#compdef ${CLI_NAME}

local -a groups
groups=(${getCommandGroups().join(" ")})

if (( CURRENT == 2 )); then
  _values 'group' ${getCommandGroups().map((group) => `'${group}'`).join(" ")}
  return
fi

if (( CURRENT == 3 )); then
  case "$words[2]" in
${groupCases}
  esac
fi

if (( CURRENT >= 4 )); then
  case "$words[2] $words[3]" in
${formatZshOptionCases()}
  esac
fi

_arguments \
  '--help[Show help]' \
  '--version[Show version]' \
  '--output[Output format]:format:(json markdown text)' \
  '--json[Use JSON output]' \
  '--markdown[Use markdown output]' \
  '--text[Use text output]' \
  '--compact[Compact JSON output]' \
  '--base-url[Override API base URL]:url:_urls' \
  '--api-key[Override API key]:key:' \
  '--api-key-env[Read API key from env var]:env var:' \
  '--fields[Select JSON fields]:fields:' \
  '--ndjson[Emit NDJSON from an array result]'`;
}

function buildFishCompletionScript(): string {
  const lines = [
    `complete -c ${CLI_NAME} -f`,
    `function _${CLI_NAME}_has_command_pair`,
    `  set -l tokens (commandline -opc)`,
    `  contains -- $argv[1] $tokens; and contains -- $argv[2] $tokens`,
    `end`,
    ...getCommandGroups().map(
      (group) => `complete -c ${CLI_NAME} -n "__fish_use_subcommand" -a "${group}"`,
    ),
    ...COMMANDS.map(
      (command) =>
        `complete -c ${CLI_NAME} -n "__fish_seen_subcommand_from ${command.path[0]}" -a "${command.path[1]}" -d "${escapeDoubleQuotes(command.summary)}"`,
    ),
    ...COMMANDS.flatMap((command) =>
      getCommandCompletionFlags(command).map(
        (flag) =>
          `complete -c ${CLI_NAME} -n "_${CLI_NAME}_has_command_pair ${command.path[0]} ${command.path[1]}" -l ${flag.slice(2)}${flagRequiresValue(flag) ? " -r" : ""}`,
      ),
    ),
    `complete -c ${CLI_NAME} -l output -r -a "json markdown text"`,
    `complete -c ${CLI_NAME} -l json`,
    `complete -c ${CLI_NAME} -l markdown`,
    `complete -c ${CLI_NAME} -l text`,
    `complete -c ${CLI_NAME} -l compact`,
    `complete -c ${CLI_NAME} -l base-url -r`,
    `complete -c ${CLI_NAME} -l api-key -r`,
    `complete -c ${CLI_NAME} -l api-key-env -r`,
    `complete -c ${CLI_NAME} -l fields -r`,
    `complete -c ${CLI_NAME} -l ndjson`,
    `complete -c ${CLI_NAME} -l help`,
    `complete -c ${CLI_NAME} -l version`,
    `complete -c ${CLI_NAME} -s h`,
    `complete -c ${CLI_NAME} -s v`,
    "",
  ];

  return lines.join("\n");
}

function formatBashCompletionCases(commandWords: string[]): string {
  return [...new Set(getCommandGroups())]
    .map((group) => {
      const commands = commandWords
        .filter((commandWord) => commandWord.startsWith(`${group} `))
        .map((commandWord) => commandWord.split(" ")[1])
        .join(" ");
      return `      ${group})
        COMPREPLY=( $(compgen -W "${commands}" -- "$cur") )
        return
        ;;`;
    })
    .join("\n");
}

function formatBashOptionCases(): string {
  return COMMANDS.map((command) => {
    const flags = [...new Set([...getCommandCompletionFlags(command), ...getGlobalCompletionFlags()])];
    return `      "${command.path.join(" ")}")
        COMPREPLY=( $(compgen -W "${flags.join(" ")}" -- "$cur") )
        return
        ;;`;
  }).join("\n");
}

function formatZshOptionCases(): string {
  return COMMANDS.map((command) => {
    const flags = [...new Set([...getCommandCompletionFlags(command), ...getGlobalCompletionFlags()])];
    const options = flags.map((flag) => `'${flag}'`).join(" ");
    return `    '${command.path.join(" ")}')
      _values 'option' ${options}
      return
      ;;`;
  }).join("\n");
}

function getCommandGroups(): string[] {
  return [...new Set(COMMANDS.map((command) => command.path[0]))];
}

function getGlobalCompletionFlags(): string[] {
  return ["--help", "--version", "--output", "--json", "--markdown", "--text", "--compact", "--base-url", "--api-key", "--api-key-env", "--fields", "--ndjson"];
}

function getCommandCompletionFlags(command: CommandDefinition): string[] {
  return command.options.map(normalizeOptionFlag);
}

function normalizeOptionFlag(option: string): string {
  return option.split(/[ ,]/, 1)[0];
}

function flagRequiresValue(flag: string): boolean {
  return !BOOLEAN_FLAGS.has(flag.replace(/^--/, ""));
}

function escapeSingleQuotes(value: string): string {
  return value.replace(/'/g, "'\\''");
}

function escapeDoubleQuotes(value: string): string {
  return value.replace(/"/g, '\\"');
}

main().catch((error: unknown) => {
  const outputFormat = safelyResolveOutputFormat(process.argv.slice(2));
  writeError(error, outputFormat);
  process.exitCode = 1;
});

function safelyResolveOutputFormat(argv: string[]): OutputFormat {
  try {
    const parsed = parseArgv(argv);
    return resolveOutputFormat(parsed.flags, findCommand(parsed.commandPath));
  } catch {
    return "json";
  }
}

function writeError(error: unknown, outputFormat: OutputFormat): void {
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    if (outputFormat === "json") {
      process.stderr.write(`${JSON.stringify({ error: "validation_error", details }, null, 2)}\n`);
    } else {
      process.stderr.write(`Validation error:\n${details.map((detail) => `- ${detail.path || "input"}: ${detail.message}`).join("\n")}\n`);
    }
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  if (outputFormat === "json") {
    process.stderr.write(`${JSON.stringify({ error: message }, null, 2)}\n`);
  } else {
    process.stderr.write(`${message}\n`);
  }
}
