# URL Shortening Service Architecture

## Overview
This service provides URL shortening functionality, allowing users to create short, memorable URLs that redirect to longer destination URLs. The service generates a UUID for each shortened URL and provides a proxy endpoint to handle the redirection.

### Example Usage

1. Create a short URL:
```bash
curl -X POST http://localhost:3000/proxy/urls \
  -H "Content-Type: application/json" \
  -d '{"originalUrl": "https://example.com/very/long/url/that/needs/shortening"}'
```
Response:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "originalUrl": "https://example.com/very/long/url/that/needs/shortening",
  "createdAt": "2024-03-20T15:30:00Z"
}
```

2. Get URL info:
```bash
curl http://localhost:3000/proxy/urls/123e4567-e89b-12d3-a456-426614174000
```
Response:
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "originalUrl": "https://example.com/very/long/url/that/needs/shortening",
  "createdAt": "2024-03-20T15:30:00Z"
}
```

3. Access the shortened URL:
```bash
curl -L http://localhost:3000/proxy/123e4567-e89b-12d3-a456-426614174000
```
Response: 302 Redirect to the original URL

### Error Examples

1. Invalid URL:
```bash
curl -X POST http://localhost:3000/proxy/urls \
  -H "Content-Type: application/json" \
  -d '{"originalUrl": "not-a-valid-url"}'
```
Response:
```json
{
  "statusCode": 400,
  "message": "Invalid URL format"
}
```

2. URL not found:
```bash
curl http://localhost:3000/proxy/urls/non-existent-uuid
```
Response:
```json
{
  "statusCode": 404,
  "message": "URL not found"
}
```

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS url_mapping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### 1. Create Short URL
- **Method**: POST
- **Path**: `/proxy/urls`
- **Request Body**:
```typescript
{
  originalUrl: string;
}
```
- **Response**:
```typescript
{
  id: string; // UUID
  originalUrl: string;
  createdAt: string;
}
```

### 2. Get URL Info
- **Method**: GET
- **Path**: `/proxy/urls/{uuid}`
- **Response**: Same as Create Short URL response

### 3. Proxy Redirect
- **Method**: GET
- **Path**: `/proxy/{uuid}`
- **Response**: 302 Redirect to original URL

## Project Structure

```
src/
├── controllers/
│   └── url.controller.ts  // @Controller('proxy')
├── services/
│   └── url.service.ts
├── repositories/
│   └── url.repository.ts
└── models/
    └── url.model.ts  // Contains Url and CreateUrl types
```

## Classes and Responsibilities

### 1. URL Controller (`url.controller.ts`)
- Handles HTTP requests
- Input validation
- OpenAPI annotations
- Routes:
  - POST /urls
  - GET /urls/{uuid}
  - GET /{uuid}
- Base path: @Controller('proxy')

### 2. URL Service (`url.service.ts`)
- Business logic
- URL validation

### 3. URL Repository (`url.repository.ts`)
- Database operations
- CRUD operations for URL mappings

### 4. URL Model (`url.model.ts`)
```typescript
import { ApiProperty } from '@nestjs/swagger';

export class Url {
  @ApiProperty({
    description: 'The unique identifier for the shortened URL',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  id: string;

  @ApiProperty({
    description: 'The original URL that was shortened',
    example: 'https://example.com/very/long/url/that/needs/shortening'
  })
  originalUrl: string;

  @ApiProperty({
    description: 'The timestamp when the URL was created',
    example: '2024-03-20T15:30:00Z'
  })
  createdAt: string;
}

export class CreateUrl {
  @ApiProperty({
    description: 'The URL to be shortened',
    example: 'https://example.com/very/long/url/that/needs/shortening'
  })
  originalUrl: string;
}
```

## Todo List

### Setup
- [x] Add url_mapping table to ensureTablesExist.ts
  - Add CREATE TABLE statement to ensureTablesExist function
  - Include UUID, original_url, and created_at fields

- [x] Set up URL module structure
  - Create `src/models/api/urlApiModels.ts` with Url and CreateUrl types
  - Create `src/controllers/url.controller.ts` with OpenAPI annotations
  - Create `src/services/url.service.ts` with URL validation logic
  - Create `src/repositories/url.repository.ts` for database operations
  - Ensure all files follow project naming conventions
  - Add JSDoc comments to all public methods
  - Add OpenAPI annotations to controller endpoints

### Core Features
- [x] Implement URL creation endpoint
  - Create POST /proxy/urls endpoint if it
  - Accept originalUrl
  - Use existing UUID function from project
  - Store in database
  - Return short URL in format http://localhost:3000/proxy/{uuid}
  - Add OpenAPI annotations with example request/response
  - Add integration test that verifies URL creation and retrieval

- [x] Implement URL info retrieval endpoint
  - Create GET /proxy/urls/{uuid} endpoint
  - Return original URL and creation details
  - Return 404 if URL not found
  - Add OpenAPI annotations with example request/response
  - Add integration test that verifies URL info retrieval

- [x] Add optional UUID support to URL creation
  - Update CreateUrl type to include optional id field
  - Modify POST /proxy/urls endpoint to accept optional UUID
  - Add validation to ensure provided UUID is valid
  - Update service to use provided UUID when available
  - Add OpenAPI annotations with example request/response
  - Add integration test for custom UUID creation

- [ ] Implement batch URL creation
  - Create POST /proxy/urls/batch endpoint
  - Accept array of URLs with optional UUIDs
  - Add new service method for batch processing
  - Add new repository method for batch insertion
  - Add OpenAPI annotations with example request/response
  - Add integration test for batch creation
  - Handle partial failures gracefully
  - Return array of created URLs with status

