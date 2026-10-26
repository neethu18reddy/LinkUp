import type { Request, Response, RequestHandler } from 'express';

export function asyncHandler(
  action: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void action(req, res).catch(next);
  };
}
