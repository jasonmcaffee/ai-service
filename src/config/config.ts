import * as dotenv from 'dotenv';
// Load environment variables from the .env file
dotenv.config();
const config = {
  getDbConnectionString() {
    const dbPassword = process.env.DB_PASSWORD;
    const dbConnectionString = `postgres://postgres:${dbPassword}@192.168.0.209:5432/ai`;
    return dbConnectionString;
  }
}
export default config;
