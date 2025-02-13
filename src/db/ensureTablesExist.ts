import * as postgres from 'postgres';
console.log('postgres: ', postgres);
import config from '../config/config';

const sql = postgres(config.getDbConnectionString());

export async function ensureTablesExist() {
  await sql`CREATE TABLE IF NOT EXISTS member (
        member_id TEXT PRIMARY KEY,
        member_name TEXT
    )`;

  await sql`CREATE TABLE IF NOT EXISTS image (
        prompt_id TEXT PRIMARY KEY,
        image_file_name TEXT,
        prompt_used_to_create_image TEXT,
        height INTEGER,
        width INTEGER,
        member_id TEXT,
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (member_id) REFERENCES member(member_id)
  )`;

  await sql`CREATE TABLE IF NOT EXISTS conversation (
        conversation_id TEXT PRIMARY KEY,
        conversation_name TEXT DEFAULT ('chat on ' || to_char(current_timestamp, 'Day') || ' at ' || to_char(current_timestamp, 'HH24:MI')),
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`;

  await sql`CREATE TABLE IF NOT EXISTS member_conversation (
        conversation_id TEXT,
        member_id TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversation(conversation_id),
        FOREIGN KEY (member_id) REFERENCES member(member_id)
    )`;

  await sql`CREATE TABLE IF NOT EXISTS message (
        message_id TEXT PRIMARY KEY,
        sent_by_member_id TEXT,
        message_text TEXT,
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        role text default 'user',
        FOREIGN KEY (sent_by_member_id) REFERENCES member(member_id)
    )`;

  await sql`CREATE TABLE IF NOT EXISTS conversation_message (
        conversation_id TEXT,
        message_id TEXT,
        FOREIGN KEY (conversation_id) REFERENCES conversation(conversation_id),
        FOREIGN KEY (message_id) REFERENCES message(message_id)
    )`;

  // -------------------------------------------------------------------- Models

  await sql`CREATE TABLE IF NOT EXISTS model_type (
        id SERIAL PRIMARY KEY,
        model_type TEXT
  )`;
  await sql`CREATE TABLE IF NOT EXISTS model (
        id TEXT PRIMARY KEY,
        display_name TEXT,
        url TEXT,
        api_key TEXT,
        model_name TEXT,
        model_type_id INTEGER,
        is_default BOOLEAN,
        member_id TEXT,
        initial_message text,
        FOREIGN KEY (model_type_id) REFERENCES model_type(id),
        FOREIGN KEY (member_id) REFERENCES member(member_id)
    )`;

  // ------------------------------------------------------------------ Datasource
  await sql`CREATE TABLE IF NOT EXISTS datasource_type (
        id SERIAL PRIMARY KEY,
        datasource_type TEXT
    )`;

  await sql`CREATE TABLE IF NOT EXISTS datasource (
        id SERIAL PRIMARY KEY,
        path_to_chroma_file TEXT,
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        datasource_type_id INTEGER,
        name TEXT,
        FOREIGN KEY (datasource_type_id) REFERENCES datasource_type(id)
    )`;

  // Create the document table
  await sql`CREATE TABLE IF NOT EXISTS document ( 
        id SERIAL PRIMARY KEY,
        create_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        text TEXT,
        metadata JSONB,
        file_path TEXT
    )`;

  // Create the datasource_documents table
  await sql`CREATE TABLE IF NOT EXISTS datasource_documents (
        datasource_id INTEGER,
        document_id INTEGER,
        last_vector_build_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (datasource_id) REFERENCES datasource(id),
        FOREIGN KEY (document_id) REFERENCES document(id),
        PRIMARY KEY (datasource_id, document_id)
    )`;

  // Create the conversation_datasource table
  await sql`CREATE TABLE IF NOT EXISTS conversation_datasource (
        conversation_id TEXT,
        datasource_id INTEGER,
        created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversation(conversation_id),
        FOREIGN KEY (datasource_id) REFERENCES datasource(id),
        PRIMARY KEY (conversation_id, datasource_id)                                     
    )`;

  await sql`CREATE TABLE IF NOT EXISTS member_datasource (
        member_id TEXT,
        datasource_id INTEGER,
        FOREIGN KEY (member_id) REFERENCES member(member_id),
        FOREIGN KEY (datasource_id) REFERENCES datasource(id)
  )`;

  await createDefaultMembers();
  await createDefaultModels();
  await createDefaultDatasourceTypes();
}

const personMemberId = '1';
const personMemberName = 'Jason';
const llmMemberId = '2';
const llmMemberName = 'Llama';
const datasourceDocumentTypeName = 'document';
const datasourceDocumentTypeId = 1;

async function createDefaultDatasourceTypes(){
  const documentTypeIdExists = async (datasourceTypeId: number) => {
    const [{ count }] = await sql`SELECT COUNT(*)::int FROM datasource_type WHERE id = ${datasourceTypeId}`;
    return count > 0;
  }
  if (!await documentTypeIdExists(datasourceDocumentTypeId)){
    await sql`INSERT INTO datasource_type (id, datasource_type) VALUES (${datasourceDocumentTypeId}, ${datasourceDocumentTypeName})`;
  }
}

async function createDefaultMembers() {
  const memberExists = async (memberId: string) => {
    const [{ count }] = await sql`SELECT COUNT(*)::int FROM member WHERE member_id = ${memberId}`;
    return count > 0;
  };

  if (!(await memberExists(personMemberId))) {
    await sql`INSERT INTO member (member_id, member_name) VALUES (${personMemberId}, ${personMemberName})`;
  }

  if (!(await memberExists(llmMemberId))) {
    await sql`INSERT INTO member (member_id, member_name) VALUES (${llmMemberId}, ${llmMemberName})`;
  }
}

const openaiModelId = 1;
const llamaCppModelId = 2;

async function createDefaultModels() {
  const modelTypeExists = async (modelTypeId: number) => {
    const [{ count }] = await sql`SELECT COUNT(*)::int FROM model_type WHERE id = ${modelTypeId}`;
    return count > 0;
  };

  if (!(await modelTypeExists(openaiModelId))) {
    await sql`INSERT INTO model_type (id, model_type) VALUES (${openaiModelId}, 'OpenAI')`;
  }

  if (!(await modelTypeExists(llamaCppModelId))) {
    await sql`INSERT INTO model_type (id, model_type) VALUES (${llamaCppModelId}, 'Llama.cpp')`;
  }

  const modelExists = async (modelId: number) => {
    const [{ count }] = await sql`SELECT COUNT(*)::int FROM model WHERE id = ${modelId}`;
    return count > 0;
  };

  if (!(await modelExists(openaiModelId))) {
    await sql`INSERT INTO model (id, display_name, url, api_key, model_name, model_type_id, is_default) 
                  VALUES (${openaiModelId}, 'ChatGPT4', 'https://api.openai.com/v1', '', 'gpt-4', ${openaiModelId}, false)`;
  }

  // const memberModelExists = async (memberId: string, modelId: number) => {
  //   const [{ count }] = await sql`SELECT COUNT(*)::int FROM member_model WHERE member_id = ${memberId} and model_id = ${modelId}`;
  //   return count > 0;
  // };

}


