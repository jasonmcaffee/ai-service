import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { UrlRepository } from '../repositories/url.repository';
import { Url, CreateUrl, BatchCreateUrlRequest, BatchCreateUrlResponse } from '../models/api/urlApiModels';

@Injectable()
export class UrlService {
  constructor(private readonly urlRepository: UrlRepository) {}

  /**
   * Validates if a URL is properly formatted
   * @param url The URL to validate
   * @throws BadRequestException if the URL is invalid
   */
  private validateUrl(url: string): void {
    try {
      new URL(url);
    } catch (error) {
      throw new BadRequestException('Invalid URL format');
    }
  }

  /**
   * Validates if a string is a valid UUID
   * @param id The string to validate
   * @throws BadRequestException if the string is not a valid UUID
   */
  private validateUuid(id: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      throw new BadRequestException('Invalid UUID format');
    }
  }

  /**
   * Creates a new shortened URL
   * @param createUrl The URL creation request
   * @returns The created URL mapping with the full short URL
   */
  async createShortUrl(createUrl: CreateUrl): Promise<Url> {
    this.validateUrl(createUrl.originalUrl);
    
    // Validate UUID if provided
    if (createUrl.id) {
      this.validateUuid(createUrl.id);
    }

    const url = await this.urlRepository.createUrl(createUrl.originalUrl, createUrl.id);
    return {
      ...url,
      shortUrl: `http://localhost:3000/proxy/${url.id}`
    };
  }

  /**
   * Creates multiple shortened URLs in a batch
   * @param request The batch URL creation request
   * @returns The created URLs and any errors that occurred
   */
  async createShortUrls(request: BatchCreateUrlRequest): Promise<BatchCreateUrlResponse> {
    const validUrls: CreateUrl[] = [];
    const errors: string[] = [];

    // Validate each URL and UUID
    for (const url of request.urls) {
      try {
        this.validateUrl(url.originalUrl);
        if (url.id) {
          this.validateUuid(url.id);
        }
        validUrls.push(url);
      } catch (error) {
        errors.push(`Invalid URL format for ${url.originalUrl}`);
      }
    }

    // If no valid URLs, return early
    if (validUrls.length === 0) {
      return { urls: [], errors };
    }

    try {
      // Create valid URLs in batch
      const createdUrls = await this.urlRepository.createUrls(validUrls);
      
      // Add shortUrl to each created URL
      const urlsWithShortUrl = createdUrls.map(url => ({
        ...url,
        shortUrl: `http://localhost:3000/proxy/${url.id}`
      }));

      return { urls: urlsWithShortUrl, errors };
    } catch (error) {
      // If batch creation fails, try creating URLs one by one
      const urls: Url[] = [];
      for (const url of validUrls) {
        try {
          const createdUrl = await this.createShortUrl(url);
          urls.push(createdUrl);
        } catch (error) {
          errors.push(`Failed to create URL for ${url.originalUrl}`);
        }
      }
      return { urls, errors };
    }
  }

  /**
   * Retrieves a URL mapping by its ID
   * @param id The UUID of the URL mapping
   * @returns The URL mapping
   * @throws NotFoundException if the URL is not found
   * @throws BadRequestException if the ID is not a valid UUID
   */
  async getUrlById(id: string): Promise<Url> {
    this.validateUuid(id);
    const url = await this.urlRepository.getUrlById(id);
    if (!url) {
      throw new NotFoundException('URL not found');
    }
    return {
      ...url,
      shortUrl: `http://localhost:3000/proxy/${url.id}`
    };
  }
} 