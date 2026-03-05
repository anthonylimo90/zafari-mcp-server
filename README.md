# Zafari CLI

Agent-friendly CLI for the Zafari CRS API.

The repo used to center on an MCP server. It now centers on a non-interactive CLI that is easier to drive from agents, scripts, and shells:

- JSON-first output on `stdout`
- Errors on `stderr`
- Stable subcommands and flags
- Optional markdown output for humans
- `.env` and `.env.local` auto-loading from the current working directory

## Install

```bash
npm install
npm run build
```

For local development in this repo:

```bash
cp .env.example .env
# set ZAFARI_API_KEY in .env
npm start -- --help
```

To install the CLI globally from the repo:

```bash
npm install -g .
zafari --help
```

## Configuration

Required environment variables:

| Variable | Description |
| --- | --- |
| `ZAFARI_API_KEY` | API key used for all Zafari requests |

Optional environment variables:

| Variable | Description |
| --- | --- |
| `ZAFARI_BASE_URL` | Override the default Zafari API base URL |

The CLI loads `.env.local` first and then `.env`, without overriding values already present in the process environment.

## Command Model

Top-level groups:

- `properties`
- `rooms`
- `extras`
- `bookings`
- `webhooks`

Global flags:

- `--output json|markdown|text`
- `--json`
- `--markdown`
- `--text`
- `--compact`
- `--base-url <url>`
- `--api-key <key>`
- `--api-key-env <name>`
- `--fields <path[,path...]>`
- `--ndjson`
- `--help`
- `--version`

Command help:

```bash
zafari rooms rates --help
```

## Examples

List properties:

```bash
zafari properties list
```

List rooms for a property:

```bash
zafari rooms list --property-id prop_123
```

Fetch room availability:

```bash
zafari rooms availability \
  --property-id prop_123 \
  --room-id room_456 \
  --from 2026-04-01 \
  --to 2026-04-03
```

Fetch room rates in markdown:

```bash
zafari rooms rates \
  --property-id prop_123 \
  --room-id room_456 \
  --from 2026-04-01 \
  --to 2026-04-03 \
  --resident-type resident \
  --markdown
```

List bookings:

```bash
zafari bookings list \
  --property-id prop_123 \
  --status confirmed \
  --limit 25
```

Create a booking from a file:

```bash
zafari bookings create --property-id prop_123 --input @booking.json
```

Create a booking from stdin:

```bash
cat booking.json | zafari bookings create --property-id prop_123 --input -
```

Generate shell completions:

```bash
source <(zafari completion bash)
autoload -U compinit && compinit && source <(zafari completion zsh)
zafari completion fish > ~/.config/fish/completions/zafari.fish
```

The generated completion scripts include command-specific flags, so `rooms rates` suggests flags like `--room-id` and `--resident-type` instead of only global options.

Select specific JSON fields:

```bash
zafari completion bash --json --fields shell
zafari bookings list --property-id prop_123 --fields bookings
```

Emit compact JSON:

```bash
zafari properties list --compact
```

Emit NDJSON from an array result:

```bash
zafari completion bash --json --fields commands --ndjson
zafari bookings list --property-id prop_123 --fields bookings --ndjson
```

Update webhook configuration:

```bash
zafari webhooks update \
  --property-id prop_123 \
  --url https://example.com/webhook \
  --event booking.created \
  --event booking.updated
```

## Booking Input

`bookings create` expects a JSON object. Example:

```json
{
  "check_in": "2026-04-10",
  "check_out": "2026-04-12",
  "guest_first_name": "Amina",
  "guest_last_name": "Otieno",
  "guest_email": "amina@example.com",
  "guest_phone": "+254700000000",
  "guest_country": "KE",
  "rooms": [
    {
      "room_id": "room_456",
      "quantity": 1
    }
  ],
  "extras": [
    {
      "extra_service_id": "extra_789",
      "quantity": 2
    }
  ]
}
```

## Agent Usage Notes

For agents and automation:

- Default to JSON output and parse `stdout`
- Treat non-zero exit codes as failures
- Read diagnostics from `stderr`
- Prefer explicit flags over interactive prompts
- Use `--input -` when constructing payloads in pipelines
- Use `--fields` to reduce payload size before parsing
- Use `--ndjson` when you want streaming-friendly array output
- Use `--compact` when the consumer wants a single-line JSON payload

## Development

Build:

```bash
npm run build
```

Test:

```bash
npm test
```

Run from source output:

```bash
npm start -- properties list
```

Current source layout:

```text
src/
  cli.ts                 CLI entrypoint and argument parsing
  index.ts               compatibility entrypoint
  constants.ts           shared constants
  types.ts               Zafari response types
  schemas/index.ts       zod validation for command inputs
  services/
    api-client.ts        axios wrapper
    env.ts               local .env loader
    formatters.ts        markdown formatting
    operations.ts        Zafari API operations
```
