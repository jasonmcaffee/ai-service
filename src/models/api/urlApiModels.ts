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