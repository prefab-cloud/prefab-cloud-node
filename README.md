# prefab-cloud-nodejs
Prefab Cloud Node.js client

## Sample usage:
```javascript
const PrefabCloudClient = require('prefab-cloud')

var client = new PrefabCloudClient("api-key");
client.getFeatureFlag("ff").isOn();
client.rateLimit.acquire(["some.group"], 1);
```
