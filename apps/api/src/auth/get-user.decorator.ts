import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    // Firebase user ID is mapped to the 'uid' field in the decoded token
    return request.user?.uid || request.user?.sub || '';
  },
);
