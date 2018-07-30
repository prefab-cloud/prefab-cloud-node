# prefab-cloud-nodejs
Prefab Cloud Node.js client

## Sample usage:
```javascript
const PrefabCloudClient = require('prefab-cloud')

var client = new PrefabCloudClient();  // Defaults to ENV[PREFAB_API_KEY]
client.config.getValue("A");
client.getFeatureFlag("ff").isOn();
client.rateLimit.acquire(["some.group"], 1);

client.rateLimit.pass("hundred").then(function(passed){
    console.log("passed"+passed);
});
```
