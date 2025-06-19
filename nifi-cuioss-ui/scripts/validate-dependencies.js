// scripts/validate-dependencies.js
/* eslint-env node */
const fs = require('fs');
const path = require('path');

// Paths relative to script location
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const pomXmlPath = path.resolve(__dirname, '..', 'pom.xml');

// eslint-disable-next-line no-console
console.log('Validating dependency versions between package.json and pom.xml...');

// Parse package.json
let packageJson;
try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    // eslint-disable-next-line no-console
    console.log('Successfully parsed package.json');
} catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error parsing package.json:', error.message);
    process.exit(1);
}

// Read pom.xml
let pomXml;
try {
    pomXml = fs.readFileSync(pomXmlPath, 'utf8');
    // eslint-disable-next-line no-console
    console.log('Successfully read pom.xml');
} catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error reading pom.xml:', error.message);
    process.exit(1);
}

// Extract versions from Maven properties
const pomVersions = {};
const versionRegex = /<version\.webjars\.([^>]+)>([^<]+)<\/version\.webjars\.\1>/g;
let match;

while ((match = versionRegex.exec(pomXml)) !== null) {
    const dependency = match[1];
    const version = match[2];
    pomVersions[dependency] = version;
}

// eslint-disable-next-line no-console
console.log('Extracted WebJars versions from pom.xml:', pomVersions);

// Define mapping between npm package names and WebJars property names
const dependencyMapping = {
    'cash-dom': 'cash-dom',
    'tippy.js': 'tippy.js',
    '@popperjs/core': 'popperjs__core'
};

// Check for mismatches
let mismatchFound = false;

Object.entries(dependencyMapping).forEach(([npmName, webjarName]) => {
    const npmVersion = packageJson.devDependencies?.[npmName]?.replace('^', '') ||
                      packageJson.dependencies?.[npmName]?.replace('^', '') ||
                      packageJson.peerDependencies?.[npmName]?.replace('^', '');

    const pomVersion = pomVersions[webjarName];

    if (npmVersion && pomVersion) {
        if (npmVersion !== pomVersion) {
            // eslint-disable-next-line no-console
            console.error(
                `❌ Version mismatch for ${npmName}: npm=${npmVersion}, pom=${pomVersion}`
            );
            mismatchFound = true;
        } else {
            // eslint-disable-next-line no-console
            console.log(`✅ Versions match for ${npmName}: ${npmVersion}`);
        }
    } else if (!npmVersion) {
        // eslint-disable-next-line no-console
        console.warn(`⚠️ ${npmName} not found in package.json`);
    } else if (!pomVersion) {
        // eslint-disable-next-line no-console
        console.warn(`⚠️ ${webjarName} not found in pom.xml properties`);
    }
});

if (mismatchFound) {
    // eslint-disable-next-line no-console
    console.error('❌ Dependency version mismatches found. Please align versions between package.json and pom.xml.');
    process.exit(1);
} else {
    // eslint-disable-next-line no-console
    console.log('✅ All dependency versions are aligned between package.json and pom.xml!');
}
