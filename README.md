# prefab-cloud-nodejs

Prefab Node.js client

---

Install the client

`npm install @prefab-cloud/prefab-cloud-node` or `yarn add @prefab-cloud/prefab-cloud-node`

## Required Peer Dependencies

This library requires the `long` package to handle 64-bit integers properly:

```bash
npm install long
# or
yarn add long
```

> **Important:** The `long` package must be directly installed in your project. Some environments (particularly Heroku) require this dependency to be in your project's direct dependencies for proper module resolution. Without it, you may encounter issues with integer values being parsed incorrectly.

## Usage

Set up a Prefab client.

```js
import { Prefab } from "@prefab-cloud/prefab-cloud-node";

if (!process.env.PREFAB_API_KEY) {
  throw new Error("PREFAB_API_KEY is not set");
}

const prefab = new Prefab({
  apiKey: process.env.PREFAB_API_KEY,
  enableSSE: true,
  enablePolling: true,
});

await prefab.init();
```

After the init completes you can use

- `prefab.get('some.config.name')` returns a raw value
- `prefab.isFeatureEnabled('some.feature.name')` returns true or false
- `prefab.shouldLog({loggerName, desiredLevel, defaultLevel, contexts})` returns true or false

Prefab supports [context](https://docs.prefab.cloud/docs/explanations/concepts/context) for intelligent rule-based evaluation of `get` and `isFeatureEnabled` based on the current request/device/user/etc.

Given

```javascript
const context = new Map([
  [
    "user",
    new Map([
      ["key", "some-unique-identifier"],
      ["country", "US"],
    ]),
  ],

  [
    "subscription",
    new Map([
      ["key", "pro-sub"],
      ["plan", "pro"],
    ]),
  ],
]);
```

You can pass this in to each call

- `prefab.get('some.config.name', context, defaultValue)`
- `prefab.isFeatureEnabled('some.feature.name', context, false)`

Or you can set the context in a block (perhaps surrounding evaluation of a web request)

```js
prefab.inContext(context, (pf) => {
  const optionalJustInTimeContext = { ... }

  console.log(pf.get("some.config.name", optionalJustInTimeContext, defaultValue))
  console.log(pf.isEnabled("some.config.name", optionalJustInTimeContext, false))
})
```

Note that you can also provide Context as an object instead of a Map, e.g.:

```javascript
{
  user: {
    key: "some-unique-identifier",
    country: "US"
  },
  subscription: {
    key: "pro-sub",
    plan: "pro"
  }
}
```

#### Option Definitions

Besides `apiKey`, you can initialize `new Prefab(...)` with the following options

| Name                       | Description                                                                                                                           | Default           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| collectEvaluationSummaries | Send counts of config/flag evaluation results back to Prefab to view in web app                                                       | true              |
| collectLoggerCounts        | Send counts of logger usage back to Prefab to power log-levels configuration screen                                                   | true              |
| contextUploadMode          | Upload either context "shapes" (the names and data types your app uses in prefab contexts) or periodically send full example contexts | "periodicExample" |
| defaultLevel               | Level to be used as the min-verbosity for a `loggerPath` if no value is configured in Prefab                                          | "warn"            |
| enableSSE                  | Whether or not we should listen for live changes from Prefab                                                                          | true              |
| enablePolling              | Whether or not we should poll for changes from Prefab                                                                                 | false             |

#### Publishing a new version of the library

- Ensure you have the latest on the `main` branch
- Update the changelog and commit
- Run `npm run prep` to build the new version
- Run `npm version patch` to bump the version number (adjust accordingly for minor/major)
- Run `npm run prep` again and the working directory should be clean
- Push `main` to github
- Run `npm publish --access public` to publish the new version to npm
