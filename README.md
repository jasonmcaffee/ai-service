
## Description
AI service for managing conversations and interactions with AI.

## Project setup
Node version 22.5.1

```bash
$ npm install
```

## Create .env file in root dir
```shell
DB_PASSWORD=1234
```
## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Generate client
```shell
npx openapi-generator-cli generate -i src/openapi-spec.json -g typescript-fetch -o ./src/client/api-client
```

Use client
```javascript
import { ConversationApi } from './client/api-client/apis/ConversationApi';
import { Configuration } from './client/api-client/runtime';

async function testClient(){
  const api = new ConversationApi(new Configuration({basePath: 'http://localhost:3000'}));

  const response = await api.conversationControllerGetConversation( {conversationId: '123'});
  console.log('response using client: ', response);
}

```
