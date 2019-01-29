# prefab-cloud-nodejs
PrefabCloudClient Cloud Node.js client

## Sample usage:
```javascript
const PrefabCloudClient = require('prefab-cloud')

var prefab = new PrefabCloudClient();  // Defaults to ENV[PREFAB_API_KEY] 
var prefab = new PrefabCloudClient({{apiKey: "1|EXAMPLE"});  


prefab.start((_, _client) => {
      client = _client;
    });

prefab.get("A")

prefab.featureFlagIsOn("MyFF"); 
prefab.featureFlagIsOn("MyFF", "user123"); 
prefab.featureFlagIsOn("MyFF", "user345", ["betaGroup"]); 

prefab.limitCheck("hundred").then(function(passed) {
  console.log("passed")
});

```





## Development


### Get latest protos
```
git update --init proto
git co proto
git checkout master
```

