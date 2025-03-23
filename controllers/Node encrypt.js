const v8 = require('v8');
const fs = require('fs');

// Serialize the code
const code = fs.readFileSync('reportController.js', 'utf8');
const serializedCode = v8.serialize(code);

// Save to a file
fs.writeFileSync('reportController.serialized', serializedCode);

// Deserialize the code and execute
const deserializedCode = v8.deserialize(serializedCode);
eval(deserializedCode);  // Or use Function() to execute the code
//compile