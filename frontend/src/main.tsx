import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './app/App';
import { AuthProvider } from './app/AuthContext';
import './styles.css';

const queryClient=new QueryClient({defaultOptions:{queries:{retry:(count,error)=>!(error instanceof Error&&'status' in error&&(error as {status:number}).status<500)&&count<2,refetchOnWindowFocus:false},mutations:{retry:false}}});
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><BrowserRouter><AuthProvider><App/></AuthProvider></BrowserRouter></QueryClientProvider></StrictMode>);
