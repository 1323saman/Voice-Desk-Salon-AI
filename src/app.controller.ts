import { Controller, Get } from '@nestjs/common';
 
import { AppService } from './app.service';
 
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
 
  // Moved off "/" so it doesn't block ServeStaticModule from serving public/index.html
  @Get('hello')
  getHello(): string {
    return this.appService.getHello();
  }
}
 