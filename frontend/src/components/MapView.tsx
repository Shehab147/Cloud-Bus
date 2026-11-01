import { useEffect } from 'react';
import { MapContainer, Marker, Popup, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import type { StopRecord } from '../lib/types';

const marker = (order?: number) => L.divIcon({ className:'', html:`<div class="campus-map-marker">${order ?? '•'}</div>`, iconSize:[28,28], iconAnchor:[14,14] });
function FitBounds({ stops }: {stops:StopRecord[]}) { const map=useMap(); useEffect(()=>{ if(stops.length) map.fitBounds(stops.map((s)=>[s.latitude,s.longitude]),{padding:[35,35],maxZoom:16}); },[map,stops]); return null; }
export function MapView({ stops, showLine=false, onSelect }: {stops:StopRecord[];showLine?:boolean;onSelect?:(stop:StopRecord)=>void}) {
  const valid=stops.filter((s)=>Number.isFinite(Number(s.latitude))&&Number.isFinite(Number(s.longitude))&&Number(s.latitude)>=-90&&Number(s.latitude)<=90&&Number(s.longitude)>=-180&&Number(s.longitude)<=180);
  if(!valid.length) return <div className="flex min-h-64 items-center justify-center rounded-lg border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">No valid map coordinates are available. Use the stop list instead.</div>;
  return <div className="campus-map dash-tail-app overflow-hidden rounded-lg border border-border/60" aria-label="Map of campus shuttle stops">
    <MapContainer center={[valid[0]!.latitude,valid[0]!.longitude]} zoom={15} scrollWheelZoom={false}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{tileerror:()=>undefined}} />
      {showLine&&valid.length>1&&<Polyline positions={valid.map((s)=>[s.latitude,s.longitude])} pathOptions={{color:'#6d5dfc',weight:4}}/>}
      {valid.map((stop,index)=><Marker key={stop.id} position={[stop.latitude,stop.longitude]} icon={marker(stop.stop_order??index+1)} eventHandlers={onSelect?{click:()=>onSelect(stop)}:undefined}><Popup><strong>{stop.name}</strong><br/><Link to={`/stops/${stop.id}`} className="text-primary underline">View stop details</Link></Popup></Marker>)}
      <FitBounds stops={valid}/>
    </MapContainer>
  </div>;
}

function PickEvents({ onPick }: {onPick:(latitude:number,longitude:number)=>void}) {
  useMapEvents({ click: (event) => onPick(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6))) });
  return null;
}

export function CoordinatePicker({ latitude, longitude, onPick }: {latitude:number;longitude:number;onPick:(latitude:number,longitude:number)=>void}) {
  const valid=Number.isFinite(latitude)&&Number.isFinite(longitude)&&latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180;
  const position:[number,number]=valid?[latitude,longitude]:[30.0588,31.2811];
  return <div className="campus-map dash-tail-app overflow-hidden rounded-lg border border-border/60" aria-label="Coordinate picker. Click the map to select a stop position.">
    <MapContainer center={position} zoom={16} scrollWheelZoom>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={position} icon={marker()}/><PickEvents onPick={onPick}/>
    </MapContainer>
  </div>;
}
