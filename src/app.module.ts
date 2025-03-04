import { Module } from '@nestjs/common';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

// Recursive function to scan subdirectories for files with a given suffix
function loadModules(directory: string, suffix: string): any[] {
  let modules: any[] = [];

  readdirSync(directory).forEach((file) => {
    const fullPath = join(directory, file);
    if (statSync(fullPath).isDirectory()) {
      // Recursively scan subdirectories
      modules = [...modules, ...loadModules(fullPath, suffix)];
    } else if (file.endsWith(suffix)) {
      const module = require(fullPath);
      modules.push(module.default || Object.values(module)[0]);
    }
  });

  return modules;
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
