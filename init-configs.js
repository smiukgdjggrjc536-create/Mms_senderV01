import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseConfig = `export const DB_CONFIG = {
  uri: 'mongodb://localhost:27017/sms_campaign_db',
  options: {
    bufferCommands: false,
  },
};
`;

const geminiConfig = `export const GEMINI_CONFIG = {
  apiKey: 'YOUR_GEMINI_API_KEY_HERE',
  model: 'gemini-1.5-flash',
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
};
`;

const sendingConfig = `export const SMS_CONFIG = {
  apiKey: 'YOUR_SMS_API_KEY_HERE',
  provider: 'twilio',
  endpoint: 'https://api.twilio.com/2010-04-01/Accounts/',
};
`;

const files = [
  { name: 'config-database.js', content: databaseConfig },
  { name: 'config-gemini.js', content: geminiConfig },
  { name: 'config-sending.js', content: sendingConfig },
];

console.log('Generating config files...\n');

files.forEach(({ name, content }) => {
  const targetPath = path.join(__dirname, name);
  try {
    fs.writeFileSync(targetPath, content, 'utf8');
    console.log(`✓ Created ${name}`);
  } catch (err) {
    console.error(`✗ Failed to create ${name}:`, err.message);
  }
});

console.log('\nDone. Edit the placeholder values in these files before use.');
