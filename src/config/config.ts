import * as dotenv from 'dotenv';
// Load environment variables from the .env file
dotenv.config();

function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
}

const config = {
  getDbConnectionString() {
    const dbPassword = process.env.DB_PASSWORD;
    const dbConnectionString = `postgres://postgres:${dbPassword}@192.168.0.209:5432/ai`;
    return dbConnectionString;
  },

  getDbTransform(){
    return {
      transform: {
        column: {
          from: snakeToCamel,
          to: camelToSnake,
        }
      }
    }
  }
}
export default config;
