import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Response } from 'express';
import { UrlService } from '../services/url.service';
import { Url, CreateUrl, BatchCreateUrlRequest, BatchCreateUrlResponse } from '../models/api/urlApiModels';

@ApiTags('URL Shortening')
@Controller('proxy')
export class UrlController {
  constructor(private readonly urlService: UrlService) {}

  @Post('urls')
  @ApiOperation({ summary: 'Create a shortened URL' })
  @ApiResponse({
    status: 201,
    description: 'The URL has been successfully shortened',
    type: Url
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid URL format'
  })
  async createShortUrl(@Body() createUrl: CreateUrl): Promise<Url> {
    return this.urlService.createShortUrl(createUrl);
  }

  @Post('urls/batch')
  @ApiOperation({ summary: 'Create multiple shortened URLs in a batch' })
  @ApiResponse({
    status: 201,
    description: 'The URLs have been successfully shortened',
    type: BatchCreateUrlResponse
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request format'
  })
  async createShortUrls(@Body() request: BatchCreateUrlRequest): Promise<BatchCreateUrlResponse> {
    return this.urlService.createShortUrls(request);
  }

  @Get('urls/:id')
  @ApiOperation({ summary: 'Get URL information' })
  @ApiParam({
    name: 'id',
    description: 'The UUID of the shortened URL',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'The URL information',
    type: Url
  })
  @ApiResponse({
    status: 404,
    description: 'URL not found'
  })
  async getUrlInfo(@Param('id') id: string): Promise<Url> {
    return this.urlService.getUrlById(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Redirect to original URL' })
  @ApiParam({
    name: 'id',
    description: 'The UUID of the shortened URL',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 302,
    description: 'Redirect to the original URL'
  })
  @ApiResponse({
    status: 404,
    description: 'URL not found'
  })
  @HttpCode(HttpStatus.FOUND)
  async redirectToOriginalUrl(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const url = await this.urlService.getUrlById(id);
    res.redirect(url.originalUrl);
  }
} 