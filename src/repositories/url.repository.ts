import { Injectable } from '@nestjs/common';
import * as postgres from 'postgres';
import config from '../config/config';
import { Url } from '../models/api/urlApiModels';
const { v4: uuidv4 } = require('uuid');

@Injectable()
export class UrlRepository {
  private sql: postgres.Sql;

  constructor() {
    this.sql = postgres(config.getDbConnectionString(), config.getDbTransform());
  }

  /**
   * Creates a new URL mapping in the database
   * @param originalUrl The original URL to be shortened
   * @returns The created URL mapping
   */
  async createUrl(originalUrl: string): Promise<Url> {
    const [url] = await this.sql<Url[]>`
      INSERT INTO url_mapping (id, original_url)
      VALUES (${uuidv4()}, ${originalUrl})
      RETURNING id, original_url as "originalUrl", created_at as "createdAt"
    `;
    return url;
  }

  /**
   * Retrieves a URL mapping by its ID
   * @param id The UUID of the URL mapping
   * @returns The URL mapping if found, null otherwise
   */
  async getUrlById(id: string): Promise<Url | null> {
    const [url] = await this.sql<Url[]>`
      SELECT id, original_url as "originalUrl", created_at as "createdAt"
      FROM url_mapping
      WHERE id = ${id}
    `;
    return url || null;
  }
} 