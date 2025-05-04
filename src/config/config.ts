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
  getHuggingFaceAccessToken(){
    return process.env.HUGGING_FACE_TOKEN;
  },

  getDbConnectionString() {
    const dbPassword = process.env.DB_PASSWORD;
    const dbConnectionString = `postgres://postgres:${dbPassword}@192.168.0.157:5432/ai`;
    return dbConnectionString;
  },
  //the member table has this hardcoded and we need it when adding messages.
  getAiMemberId(){
    return "2";
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
  },

  isProduction() {
    return process.env.NODE_ENV === 'production';
  },

  getSharedDriveBasePath(){
    // return this.isProduction()? `C:/` : `/Volumes/shared-drive`;
    return  `C:/shared-drive`;
  },

  getLlmModelsFolder(){
    return this.getSharedDriveBasePath() + '/llm_models'
  },

}
export default config;
