import type { ActiveModule } from '../components/Sidebar';
const map:Record<ActiveModule,string>={overview:'/',members:'/members',plans:'/plans','lesson-plans':'/lesson-plans','lesson-study':'/lesson-study',observations:'/observations','special-topics':'/special-topics',documents:'/documents',reports:'/reports','ai-assistant':'/ai-assistant',settings:'/settings','teacher-360':'/teachers','audit-trail':'/audit'};
export function moduleFromPath(path=window.location.pathname):ActiveModule{
  if(path.startsWith('/teachers')) return 'teacher-360'; if(path.startsWith('/audit')) return 'audit-trail';
  const entry=(Object.entries(map) as [ActiveModule,string][]).find(([,p])=>p!=='/'&&path.startsWith(p)); return entry?.[0]||'overview';
}
export function routeFor(module:ActiveModule,id?:string){ const base=map[module]; return id?`${base}/${encodeURIComponent(id)}`:base; }
export function pushRoute(module:ActiveModule,id?:string,replace=false){ const url=routeFor(module,id); window.history[replace?'replaceState':'pushState']({},'',url); }
export function pathId(prefix:string){ const p=window.location.pathname.split('/').filter(Boolean); return p[0]===prefix&&p[1]?decodeURIComponent(p[1]):''; }
