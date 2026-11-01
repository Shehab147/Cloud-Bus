import { useEffect, useState } from 'react';
export function useDebounced<T>(value:T,delay=300){const [debounced,setDebounced]=useState(value);useEffect(()=>{const id=window.setTimeout(()=>setDebounced(value),delay);return()=>window.clearTimeout(id);},[value,delay]);return debounced;}
export function useUnsavedChanges(dirty:boolean){useEffect(()=>{const handler=(event:BeforeUnloadEvent)=>{if(dirty)event.preventDefault();};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[dirty]);}
