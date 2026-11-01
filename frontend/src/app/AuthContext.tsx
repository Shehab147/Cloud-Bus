import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, setCsrfToken } from '../lib/api';
import type { User } from '../lib/types';

type AuthValue={user:User|null;loading:boolean;refresh:()=>Promise<unknown>;logout:()=>Promise<void>};
const AuthContext=createContext<AuthValue|null>(null);
export function AuthProvider({children}:{children:ReactNode}){
  const client=useQueryClient();
  const query=useQuery({queryKey:['auth'],queryFn:async()=>{try{const r=await api<{user:User;csrfToken:string}>('/auth/me');setCsrfToken(r.data.csrfToken);return r.data.user;}catch(e){if(e instanceof ApiError&&e.status===401)return null;throw e;}},retry:false,staleTime:60_000});
  useEffect(()=>{const clear=()=>{setCsrfToken(null);client.setQueryData(['auth'],null);};window.addEventListener('campus-auth-expired',clear);return()=>window.removeEventListener('campus-auth-expired',clear);},[client]);
  const logout=async()=>{await api('/auth/logout',{method:'POST'});setCsrfToken(null);client.setQueryData(['auth'],null);client.clear();};
  return <AuthContext.Provider value={{user:query.data??null,loading:query.isLoading,refresh:query.refetch,logout}}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>{const value=useContext(AuthContext);if(!value)throw new Error('AuthProvider missing');return value;};
