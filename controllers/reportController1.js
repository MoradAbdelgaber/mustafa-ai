const fs = require('fs');
const path = require('path');
const v8 = require('v8');


// Get the path to the serialized file
const filePath = path.join(__dirname, 'reportController.serialized');

// Read and deserialize the file
const serializedCode = fs.readFileSync(filePath);
const deserializedCode = v8.deserialize(serializedCode);

// Execute the deserialized code
eval(deserializedCode); // Or use Function() if preferred