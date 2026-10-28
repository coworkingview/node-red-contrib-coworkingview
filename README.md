<p align="center">
  <img src="https://coworkingview.com/brand/coworkingview-wordmark.svg" alt="CoworkingView" width="320">
</p>

# node-red-contrib-coworkingview

A [Node-RED](https://nodered.org) node for the [CoworkingView](https://coworkingview.com) catalogue
of coworking spaces, private offices and flexible workspace. Search a city, fetch one space, read a
or read a city's market rates, all from a flow.

**Reads need no API key and no sign-up.** The node calls the public
[CoworkingView API](https://coworkingview.com/en/mcp) (`https://api.coworkingview.com/v1`), which is rate-limited.

## Install

From the Node-RED editor: **Menu → Manage palette → Install**, search for `coworkingview`.

Or from your Node-RED user directory (usually `~/.node-red`):

```bash
npm install node-red-contrib-coworkingview
```

Then restart Node-RED. The node appears in the **network** category as `coworkingview`.

## Operations

| Operation | Needs | Returns in `msg.payload` |
| --- | --- | --- |
| **Search spaces in a city** | `city` | An array of spaces (title, slug, city, entry price…) |
| **Get one space** | `slug` | The full record for one space: pricing options, amenities, address |
| **Market rates for a city** | `city` | Median prices per workspace type, with sample sizes |
| **List cities** | — | Every city slug you can query |

Every field can be set on the node or sent on the message, and the message wins, so one node can
serve many cities:

| Message property | Used by | Example |
| --- | --- | --- |
| `msg.payload` (string) | all but *cities* | `"berlin"` fills an empty city, or an empty slug for *space* |
| `msg.operation` | all | `search`, `space`, `rates`, `cities` |
| `msg.city` | search, rates | `berlin`, `madrid`, `barcelona`, `london`, `munich` |
| `msg.slug` | space | a `slug` from a search result |
| `msg.pricingOptionType` | search | `private_office`, `flex_desk`, `fix_desk`, `day_pass`, `meeting_room`, `virtual_office`, `event_space`, `membership`, `exclusive_bereich` |
| `msg.limit` | search (1–50) | `5` |
| `msg.page` | search | `2` |
| `msg.currency` | rates | `USD` |
| `msg.locale` | all | `en`, `de`, `es` |

The node also sets `msg.statusCode` and `msg.coworkingview` (`operation`, request `url`, response
`meta`). Errors (unknown city, bad input, network) go to a **Catch** node with the original message.

## Example

Import **Menu → Import → Examples → node-red-contrib-coworkingview → search-berlin**. It injects
`"berlin"` into two nodes: one lists five private offices, the other reads Berlin's market rates.

```json
[{"id":"c1","type":"inject","payload":"berlin","payloadType":"str","props":[{"p":"payload"}],"wires":[["c2"]]},
 {"id":"c2","type":"coworkingview","operation":"search","pricingOptionType":"private_office","limit":"5","locale":"en","wires":[["c3"]]},
 {"id":"c3","type":"debug","complete":"payload","wires":[]}]
```

Ideas: post new private offices in your city to Slack every Monday, alert when a city's median
flex-desk price moves, or feed a dashboard with the [price index](https://coworkingview.com/en/tools/price-index).

## Reading the numbers

- Market rates are **medians over the priced spaces in a city**. Check `sampleSize` before calling a
  figure "the market rate": a small sample is a small sample.
- Prices are what operators publish; the space's page on coworkingview.com has the current offer.

## More ways in

- **Website:** [coworkingview.com](https://coworkingview.com): coworking in
  [Berlin](https://coworkingview.com/en/coworking/berlin), [Madrid](https://coworkingview.com/en/coworking/madrid),
  [Barcelona](https://coworkingview.com/en/coworking/barcelona) and more
- **Go:** [`coworkingview-go`](https://pkg.go.dev/github.com/coworkingview/coworkingview-go)
- **CLI:** [`@coworkingview/cli`](https://www.npmjs.com/package/@coworkingview/cli)
- **MCP server** for AI assistants: [coworkingview.com/en/mcp](https://coworkingview.com/en/mcp)
- **OpenAPI:** [coworkingview.com/openapi.json](https://coworkingview.com/openapi.json)

## Configuration

`COWORKINGVIEW_API` in Node-RED's environment overrides the API origin (default
`https://api.coworkingview.com`). Requests time out after 15 seconds.

Requires Node-RED 3.0 or newer and Node.js 18 or newer.

## License

MIT © [CoworkingView](https://coworkingview.com)
