export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>
  ) {
    super(message);
  }
}

export const notFound = (resource = 'Record') => new HttpError(404, 'NOT_FOUND', `${resource} not found`);
export const conflict = (message: string, fields?: Record<string, string>) => new HttpError(409, 'CONFLICT', message, fields);
