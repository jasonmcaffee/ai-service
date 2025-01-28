import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthenticationService{
  constructor() {}

  getMemberId(){
    return "1";
  }
}
