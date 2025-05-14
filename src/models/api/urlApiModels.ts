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

  @ApiProperty({
    description: 'The full shortened URL',
    example: 'http://localhost:3000/proxy/123e4567-e89b-12d3-a456-426614174000'
  })
  shortUrl: string;
}

export class CreateUrl {
  @ApiProperty({
    description: 'Optional custom UUID for the shortened URL. If not provided, a new UUID will be generated.',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false
  })
  id?: string;

  @ApiProperty({
    description: 'The URL to be shortened',
    example: 'https://example.com/very/long/url/that/needs/shortening'
  })
  originalUrl: string;
}

export class BatchCreateUrlRequest {
  @ApiProperty({
    description: 'Array of URLs to be shortened, each with an optional custom UUID',
    type: [CreateUrl],
    example: [
      { originalUrl: 'https://example.com/url1', id: '123e4567-e89b-12d3-a456-426614174000' },
      { originalUrl: 'https://example.com/url2' }
    ]
  })
  urls: CreateUrl[];
}

export class BatchCreateUrlResponse {
  @ApiProperty({
    description: 'Array of created URLs with their status',
    type: [Url],
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        originalUrl: 'https://example.com/url1',
        createdAt: '2024-03-20T15:30:00Z',
        shortUrl: 'http://localhost:3000/proxy/123e4567-e89b-12d3-a456-426614174000'
      }
    ]
  })
  urls: Url[];

  @ApiProperty({
    description: 'Array of errors that occurred during batch creation',
    type: [String],
    example: ['Invalid URL format for https://invalid-url'],
    required: false
  })
  errors?: string[];
} 