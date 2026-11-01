import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, setCsrfToken } from '../src/lib/api';

describe('API client', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); setCsrfToken(null); });

  it('includes credentials, JSON, and CSRF for mutations', async () => {
    const fetchMock=vi.spyOn(globalThis,'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({success:true,data:{csrfToken:'token-123'}}),{status:200,headers:{'content-type':'application/json'}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({success:true,data:{id:1}}),{status:201,headers:{'content-type':'application/json'}}));
    await api('/favorites',{method:'POST',body:JSON.stringify({stopId:1})});
    const init=fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(init.credentials).toBe('include');
    expect(new Headers(init.headers).get('x-csrf-token')).toBe('token-123');
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
  });

  it('maps field validation errors without losing user-facing detail', async () => {
    setCsrfToken('ready');
    vi.spyOn(globalThis,'fetch').mockResolvedValueOnce(new Response(JSON.stringify({success:false,error:{code:'VALIDATION_ERROR',message:'Please correct the highlighted fields',fields:{name:'Route name is required'}}}),{status:400,headers:{'content-type':'application/json'}}));
    await expect(api('/routes',{method:'POST',body:JSON.stringify({})})).rejects.toMatchObject({status:400,code:'VALIDATION_ERROR',fields:{name:'Route name is required'}} as Partial<ApiError>);
  });

  it('turns an elapsed request timeout into actionable feedback', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis,'fetch').mockImplementation((_input,init) => new Promise((_resolve,reject) => {
      init?.signal?.addEventListener('abort',() => reject(new DOMException('Aborted','AbortError')));
    }));
    const pending=api('/routes',{timeout:25});
    const assertion=expect(pending).rejects.toMatchObject({status:408,code:'TIMEOUT'} as Partial<ApiError>);
    await vi.advanceTimersByTimeAsync(30);
    await assertion;
    vi.useRealTimers();
  });
});
