# prefab-cloud-nodejs

Prefab Node.js client

**Note: This library is under active development and not quite ready for production usage**

[Sign up to be notified when this library releases](https://share.hsforms.com/1BKgbsgReSl2bP351bfdJDg9z48)

---

Install the client

`npm install @prefab-cloud/prefab-cloud-node` or `yarn add @prefab-cloud/prefab-cloud-node`

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

await prefab.init()
```

After the init completes you can use

- `prefab.get('some.config.name')` returns a raw value
- `prefab.isFeatureEnabled('some.feature.name')` returns true or false

Prefab supports [context](https://docs.prefab.cloud/docs/explanations/context) for intelligent rule-based evaluation of `get` and `isFeatureEnabled` based on the current request/device/user/etc.

Given

```js
const context = {
  user: {
    email: "test@example.com",
    isAdmin: false,
  },
  subscription: {
    plan: "pro",
  }
}
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
