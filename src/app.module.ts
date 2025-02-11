import { Module } from '@nestjs/common';
import { readdirSync } from 'fs';
import { join } from 'path';

// Helper function to dynamically load modules
function loadModules(directory: string, suffix: string) {
  return readdirSync(directory)
    .filter((file) => file.endsWith(suffix))
    .map((file) => {
      const module = require(join(directory, file));
      // Support default and named exports
      return module.default || Object.values(module)[0];
    });
}

// Dynamically load controllers and services
const controllers = loadModules(join(__dirname, 'controllers'), '.controller.js');
const services = loadModules(join(__dirname, 'services'), '.service.js');
const repositories = loadModules(join(__dirname, 'repositories'), '.repository.js');

// const crawlerServices = loadModules(join(__dirname, 'crawler/services'), '.service.js');
const crawlerServices = [];

// const repositories = [];
const providers = [...services, ...crawlerServices, ...repositories];

@Module({
  imports: [],
  controllers,
  providers,
})
export class AppModule {}
