(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,77071,e=>{"use strict";let t=(0,e.i(56420).default)("plus",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]]);e.s(["Plus",0,t],77071)},29213,e=>{"use strict";let t=(0,e.i(56420).default)("building",[["path",{d:"M12 10h.01",key:"1nrarc"}],["path",{d:"M12 14h.01",key:"1etili"}],["path",{d:"M12 6h.01",key:"1vi96p"}],["path",{d:"M16 10h.01",key:"1m94wz"}],["path",{d:"M16 14h.01",key:"1gbofw"}],["path",{d:"M16 6h.01",key:"1x0f13"}],["path",{d:"M8 10h.01",key:"19clt8"}],["path",{d:"M8 14h.01",key:"6423bh"}],["path",{d:"M8 6h.01",key:"1dz90k"}],["path",{d:"M9 22v-3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3",key:"cabbwy"}],["rect",{x:"4",y:"2",width:"16",height:"20",rx:"2",key:"1uxh74"}]]);e.s(["Building",0,t],29213)},67707,e=>{"use strict";var t=e.i(43476),a=e.i(71645),r=e.i(57951),s=e.i(9165),l=e.i(22016),i=e.i(7921),o=e.i(66595),d=e.i(77071),n=e.i(56420);let c=(0,n.default)("minus",[["path",{d:"M5 12h14",key:"1ays0h"}]]),x=(0,n.default)("rotate-ccw",[["path",{d:"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8",key:"1357e3"}],["path",{d:"M3 3v5h5",key:"1xhq8a"}]]);var p=e.i(74816),h=e.i(55677),m=e.i(1279),b=e.i(29213);let u=(0,n.default)("arrow-right-left",[["path",{d:"m16 3 4 4-4 4",key:"1x1c3m"}],["path",{d:"M20 7H4",key:"zbl0bi"}],["path",{d:"m8 21-4-4 4-4",key:"h9nckh"}],["path",{d:"M4 17h16",key:"g4d7ey"}]]),g=(0,n.default)("arrow-down-up",[["path",{d:"m3 16 4 4 4-4",key:"1co6wj"}],["path",{d:"M7 20V4",key:"1yoxec"}],["path",{d:"m21 8-4-4-4 4",key:"1c9v7m"}],["path",{d:"M17 4v16",key:"7dpous"}]]),f=(0,n.default)("circle-question-mark",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3",key:"1u773s"}],["path",{d:"M12 17h.01",key:"p32p05"}]]);function y({user:e,searchQuery:r}){let[i,o]=(0,a.useState)(null),[d,n]=(0,a.useState)(!1),[c,x]=(0,a.useState)(!1),[b,u]=(0,a.useState)(!1),g=(0,a.useRef)(null),f=async()=>{if(!c&&!d&&"super_admin"!==e.role){n(!0);try{let t=await s.default.get(`/admin/employees/${e.id}/stats`);o(t.data),x(!0)}catch(e){console.warn("Failed to load hover stats:",e)}finally{n(!1)}}},v=r.length>0,j=r&&e.name.toLowerCase().includes(r.toLowerCase()),w=function(e){switch(e){case"super_admin":return{border:"border-l-indigo-600 border-indigo-100/50",bg:"from-indigo-600 to-violet-500",text:"text-white",badgeBg:"bg-indigo-50 text-indigo-700 border border-indigo-100",badgeText:"text-indigo-700"};case"admin":return{border:"border-l-amber-500 border-amber-100/50",bg:"from-amber-500 to-orange-400",text:"text-white",badgeBg:"bg-amber-50 text-amber-700 border border-amber-100",badgeText:"text-amber-700"};case"manager":return{border:"border-l-purple-600 border-purple-100/50",bg:"from-purple-600 to-pink-500",text:"text-white",badgeBg:"bg-purple-50 text-purple-700 border border-purple-100",badgeText:"text-purple-700"};case"assistant_manager":return{border:"border-l-blue-500 border-blue-100/50",bg:"from-blue-500 to-cyan-400",text:"text-white",badgeBg:"bg-blue-50 text-blue-700 border border-blue-100",badgeText:"text-blue-700"};case"hr":return{border:"border-l-pink-500 border-pink-100/50",bg:"from-pink-500 to-rose-400",text:"text-white",badgeBg:"bg-pink-50 text-pink-700 border border-pink-100",badgeText:"text-pink-700"};default:return{border:"border-l-slate-400 border-slate-200/50",bg:"from-slate-100 to-slate-200",text:"text-slate-600",badgeBg:"bg-slate-50 text-slate-600 border border-slate-200/60",badgeText:"text-slate-600"}}}(e.role);return(0,t.jsxs)("div",{ref:g,onMouseEnter:()=>{u(!0),f()},onMouseLeave:()=>u(!1),className:`node-card group relative w-60 bg-white/95 backdrop-blur border border-slate-200/80 rounded-2xl p-4 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 flex flex-col items-start text-left select-text cursor-default ${w.border} border-l-4 ${v&&!j?"opacity-35 scale-95":"opacity-100 scale-100"} ${j?"ring-2 ring-indigo-600 ring-offset-2 shadow-[0_0_20px_rgba(99,102,241,0.6)] border-indigo-500 scale-105 z-10":""}`,children:[(0,t.jsxs)("div",{className:"flex items-center gap-3 w-full",children:[(0,t.jsx)("div",{className:`w-10 h-10 rounded-full bg-gradient-to-br ${w.bg} flex items-center justify-center ${w.text} text-sm font-bold shadow-inner flex-shrink-0`,children:e.name.charAt(0).toUpperCase()}),(0,t.jsxs)("div",{className:"flex-1 min-w-0",children:[(0,t.jsx)("h3",{className:"text-sm font-semibold text-slate-800 truncate leading-tight",children:e.name}),(0,t.jsx)("p",{className:"text-[10px] text-slate-400 truncate mt-0.5",children:e.email})]})]}),(0,t.jsxs)("div",{className:"flex items-center justify-between w-full mt-3",children:[(0,t.jsx)("span",{className:`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${w.badgeBg} ${w.badgeText}`,children:e.role_display_name||e.role.replace("_"," ")}),(0,t.jsxs)("div",{className:"flex items-center gap-1",children:[(0,t.jsx)("span",{className:`w-2 h-2 rounded-full ${e.is_active?"bg-emerald-500 animate-pulse":"bg-slate-300"}`}),(0,t.jsx)("span",{className:"text-[10px] font-semibold text-slate-400 capitalize",children:e.is_active?"Active":"Inactive"})]})]}),b&&(0,t.jsxs)("div",{className:"absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 w-80 bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 p-5 text-left z-50 pointer-events-auto flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150",children:[(0,t.jsxs)("div",{className:"border-b border-slate-100 pb-3 flex items-start justify-between",children:[(0,t.jsxs)("div",{children:[(0,t.jsx)("h4",{className:"font-bold text-slate-800 text-sm leading-tight",children:e.name}),(0,t.jsx)("p",{className:"text-[10px] text-slate-400 mt-0.5",children:e.email})]}),(0,t.jsx)("span",{className:`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${w.badgeBg} ${w.badgeText}`,children:e.role_display_name||e.role})]}),(0,t.jsxs)("div",{className:"grid grid-cols-2 gap-3 text-xs",children:[(0,t.jsxs)("div",{className:"flex flex-col gap-0.5",children:[(0,t.jsx)("span",{className:"text-[10px] font-semibold text-slate-400",children:"Mobile"}),(0,t.jsx)("span",{className:"font-medium text-slate-700 truncate",children:e.mobile||"N/A"})]}),(0,t.jsxs)("div",{className:"flex flex-col gap-0.5",children:[(0,t.jsx)("span",{className:"text-[10px] font-semibold text-slate-400",children:"Salary"}),(0,t.jsxs)("span",{className:"font-medium text-slate-700",children:["$","super_admin"===e.role?"N/A":e.base_salary?e.base_salary.toLocaleString():"30,000"]})]}),(0,t.jsxs)("div",{className:"flex flex-col gap-0.5",children:[(0,t.jsx)("span",{className:"text-[10px] font-semibold text-slate-400",children:"Reward Points"}),(0,t.jsxs)("span",{className:"font-semibold text-amber-600 flex items-center gap-1",children:[(0,t.jsx)(p.Trophy,{className:"w-3.5 h-3.5 text-amber-500"}),e.reward_points||0," pts"]})]}),(0,t.jsxs)("div",{className:"flex flex-col gap-0.5",children:[(0,t.jsx)("span",{className:"text-[10px] font-semibold text-slate-400",children:"Today Status"}),"super_admin"===e.role?(0,t.jsx)("span",{className:"text-slate-500 font-semibold",children:"N/A"}):d?(0,t.jsxs)("span",{className:"text-slate-400 flex items-center gap-1",children:[(0,t.jsx)("span",{className:"w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"}),"Loading..."]}):i?(0,t.jsxs)("span",{className:`font-semibold flex items-center gap-1 ${"present"===i.attendance_status?"text-emerald-600":"text-rose-500"}`,children:[(0,t.jsx)("span",{className:`w-1.5 h-1.5 rounded-full ${"present"===i.attendance_status?"bg-emerald-500":"bg-rose-500"}`}),"present"===i.attendance_status?"Present":"Absent"]}):(0,t.jsx)("span",{className:"text-slate-400",children:"Unknown"})]})]}),"super_admin"!==e.role&&(0,t.jsxs)("div",{className:"bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col gap-2",children:[(0,t.jsxs)("div",{className:"flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider",children:[(0,t.jsx)("span",{children:"Task Progress"}),(0,t.jsx)(h.ClipboardList,{className:"w-3.5 h-3.5 text-slate-400"})]}),d?(0,t.jsx)("div",{className:"flex justify-center py-2",children:(0,t.jsx)("div",{className:"w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"})}):i?.tasks?(0,t.jsxs)("div",{className:"grid grid-cols-4 gap-2 text-center text-xs",children:[(0,t.jsxs)("div",{className:"bg-white border border-slate-100 rounded-lg p-1.5",children:[(0,t.jsx)("div",{className:"font-bold text-slate-700",children:i.tasks.total}),(0,t.jsx)("div",{className:"text-[8px] text-slate-400 font-medium",children:"Total"})]}),(0,t.jsxs)("div",{className:"bg-white border border-slate-100 rounded-lg p-1.5",children:[(0,t.jsx)("div",{className:"font-bold text-emerald-600",children:i.tasks.completed+i.tasks.completed_late}),(0,t.jsx)("div",{className:"text-[8px] text-slate-400 font-medium",children:"Done"})]}),(0,t.jsxs)("div",{className:"bg-white border border-slate-100 rounded-lg p-1.5",children:[(0,t.jsx)("div",{className:"font-bold text-indigo-600",children:i.tasks.pending+i.tasks.in_progress}),(0,t.jsx)("div",{className:"text-[8px] text-slate-400 font-medium",children:"Active"})]}),(0,t.jsxs)("div",{className:"bg-white border border-slate-100 rounded-lg p-1.5",children:[(0,t.jsx)("div",{className:"font-bold text-rose-500",children:i.tasks.overdue}),(0,t.jsx)("div",{className:"text-[8px] text-slate-400 font-medium",children:"Overdue"})]})]}):(0,t.jsx)("div",{className:"text-[10px] text-slate-400 text-center py-2",children:"No stats available"})]}),(0,t.jsxs)(l.default,{href:`/admin/employees/detail?id=${e.id}`,className:"w-full btn btn-primary py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-indigo-100 transition-all",children:[(0,t.jsx)(m.User,{className:"w-3.5 h-3.5"}),"View Full Profile"]})]})]})}e.s(["default",0,function(){let e,l,n,{user:p}=(0,r.useAuth)(),[h,m]=(0,a.useState)([]),[v,j]=(0,a.useState)([]),[w,N]=(0,a.useState)("all"),[k,_]=(0,a.useState)(""),[z,M]=(0,a.useState)(!0),[S,$]=(0,a.useState)("vertical"),[C,T]=(0,a.useState)(1),[A,B]=(0,a.useState)({x:0,y:0}),[E,L]=(0,a.useState)(!1),[O,P]=(0,a.useState)({x:0,y:0}),R=(0,a.useRef)(null);(0,a.useEffect)(()=>{(async()=>{try{let e=await s.default.get("/admin/employees");m(e.data)}catch(e){console.error("Failed to fetch employees:",e)}finally{M(!1)}})()},[]),(0,a.useEffect)(()=>{if(h.length>0){let e=new Map;h.forEach(t=>{t.company_id&&t.company_name&&e.set(t.company_id,t.company_name)}),j(Array.from(e.entries()).map(([e,t])=>({id:e,name:t})))}},[h]),(0,a.useEffect)(()=>{if(!z&&R.current){R.current.clientWidth;let e=R.current.clientHeight;B({x:0,y:"vertical"===S?40:e/2-100}),T(.9)}},[z,S]);let U=()=>{L(!1)};if(z)return(0,t.jsx)("div",{className:"flex items-center justify-center h-96",children:(0,t.jsx)("div",{className:"w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"})});let V="all"===w?h:h.filter(e=>e.company_id===w),H=(e={id:p?.id||"admin-root",name:p?.name||"Administrator",email:p?.email||"admin@company.com",role:"admin",reward_points:p?.reward_points||0,is_active:!0,created_at:p?.created_at||new Date().toISOString(),role_display_name:p?.role_display_name||"Admin / Owner"},l=new Map,V.forEach(e=>{l.set(e.id,{user:e,children:[]})}),n=[],V.forEach(e=>{let t=l.get(e.id);e.parent_id&&l.has(e.parent_id)?l.get(e.parent_id).children.push(t):n.push(t)}),{user:e,children:n}),I=e=>{let a=0===e.children.length;return(0,t.jsxs)("li",{className:a?"leaf":"",children:[(0,t.jsx)("div",{className:"relative z-10 flex justify-center",children:(0,t.jsx)(y,{user:e.user,searchQuery:k})}),!a&&(0,t.jsx)("ul",{children:e.children.map(e=>I(e))})]},e.user.id)},D=e=>{let a=0===e.children.length;return(0,t.jsx)("li",{className:a?"leaf":"",children:(0,t.jsxs)("div",{className:"relative z-10 flex items-center",children:[(0,t.jsx)(y,{user:e.user,searchQuery:k}),!a&&(0,t.jsx)("ul",{className:"flex flex-col gap-4",children:e.children.map(e=>D(e))})]})},e.user.id)};return(0,t.jsxs)("div",{className:"flex flex-col gap-6",children:[(0,t.jsx)("style",{children:`
        /* ── Vertical Org Tree ── */
        .org-tree ul {
          padding-top: 24px;
          position: relative;
          display: flex;
          justify-content: center;
          gap: 16px;
        }
        .org-tree li {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          padding: 24px 8px 0 8px;
        }
        .org-tree li::before, .org-tree li::after {
          content: '';
          position: absolute;
          top: 0;
          right: 50%;
          border-top: 2px solid #cbd5e1;
          width: 50%;
          height: 24px;
        }
        .org-tree li::after {
          right: auto;
          left: 50%;
          border-left: 2px solid #cbd5e1;
        }
        .org-tree li:only-child::after, .org-tree li:only-child::before {
          display: none;
        }
        .org-tree li:only-child {
          padding-top: 0;
        }
        .org-tree li:first-child::before, .org-tree li:last-child::after {
          border: 0 none;
        }
        .org-tree li:last-child::before {
          border-right: 2px solid #cbd5e1;
          border-radius: 0 8px 0 0;
        }
        .org-tree li:first-child::after {
          border-radius: 8px 0 0 0;
        }
        .org-tree ul ul::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          border-left: 2px solid #cbd5e1;
          width: 0;
          height: 24px;
          transform: translateX(-50%);
        }
        .org-tree li:not(.leaf) > div::after {
          content: '';
          position: absolute;
          bottom: -24px;
          left: 50%;
          border-left: 2px solid #cbd5e1;
          width: 0;
          height: 24px;
          transform: translateX(-50%);
          z-index: 0;
        }

        /* ── Horizontal Org Tree ── */
        .org-tree-horizontal ul {
          display: flex;
          flex-direction: column;
          padding-left: 40px;
          position: relative;
          gap: 16px;
        }
        .org-tree-horizontal li {
          display: flex;
          flex-direction: row;
          align-items: center;
          position: relative;
          padding: 12px 0 12px 40px;
        }
        .org-tree-horizontal li::before, .org-tree-horizontal li::after {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          border-left: 2px solid #cbd5e1;
          width: 40px;
          height: 50%;
        }
        .org-tree-horizontal li::before {
          top: 0;
        }
        .org-tree-horizontal li::after {
          top: 50%;
          border-top: 2px solid #cbd5e1;
        }
        .org-tree-horizontal li:only-child::after, .org-tree-horizontal li:only-child::before {
          display: none;
        }
        .org-tree-horizontal li:only-child {
          padding-left: 0;
        }
        .org-tree-horizontal li:first-child::before, .org-tree-horizontal li:last-child::after {
          border: 0 none;
        }
        .org-tree-horizontal li:last-child::before {
          border-bottom: 2px solid #cbd5e1;
          border-radius: 0 0 0 8px;
        }
        .org-tree-horizontal li:first-child::after {
          border-top: 2px solid #cbd5e1;
          border-radius: 8px 0 0 0;
        }
        .org-tree-horizontal ul ul::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 0;
          border-top: 2px solid #cbd5e1;
          width: 40px;
          height: 0;
          transform: translateY(-50%);
        }
        .org-tree-horizontal li:not(.leaf) > div::after {
          content: '';
          position: absolute;
          right: -40px;
          top: 50%;
          border-top: 2px solid #cbd5e1;
          width: 40px;
          height: 0;
          transform: translateY(-50%);
          z-index: 0;
        }
      `}),(0,t.jsxs)("div",{className:"flex flex-col md:flex-row justify-between items-start md:items-center gap-4",children:[(0,t.jsxs)("div",{children:[(0,t.jsxs)("h1",{className:"text-2xl font-bold flex items-center gap-2",children:[(0,t.jsx)(i.Network,{className:"w-7 h-7 text-indigo-600"}),"Organization Hierarchy Map"]}),(0,t.jsx)("p",{className:"text-muted-foreground text-sm mt-1",children:"Visual flow chart of reporting lines, roles, and employee progress across companies."})]}),(0,t.jsxs)("div",{className:"flex flex-wrap items-center gap-3 w-full md:w-auto bg-white border border-slate-200/80 rounded-2xl p-2 shadow-sm glass",children:[(0,t.jsxs)("div",{className:"relative flex-1 min-w-[200px] md:flex-initial",children:[(0,t.jsx)(o.Search,{className:"w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2"}),(0,t.jsx)("input",{type:"text",placeholder:"Search employee...",value:k,onChange:e=>_(e.target.value),className:"pl-9 pr-4 py-1.5 w-full md:w-56 text-xs bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all"})]}),(0,t.jsxs)("div",{className:"relative",children:[(0,t.jsx)(b.Building,{className:"w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2"}),(0,t.jsxs)("select",{value:w,onChange:e=>N(e.target.value),className:"pl-9 pr-8 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl focus:outline-none cursor-pointer appearance-none transition-all font-semibold text-slate-600",style:{backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"right 0.75rem center",backgroundSize:"0.75rem"},children:[(0,t.jsx)("option",{value:"all",children:"All Companies"}),v.map(e=>(0,t.jsx)("option",{value:e.id,children:e.name},e.id))]})]}),(0,t.jsx)("div",{className:"h-6 w-px bg-slate-200 hidden sm:block"}),(0,t.jsx)("button",{onClick:()=>$(e=>"vertical"===e?"horizontal":"vertical"),className:"p-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200/60 text-slate-500 rounded-xl transition-all",title:"vertical"===S?"Switch to Horizontal Layout":"Switch to Vertical Layout",children:"vertical"===S?(0,t.jsx)(u,{className:"w-4 h-4"}):(0,t.jsx)(g,{className:"w-4 h-4"})})]})]}),(0,t.jsxs)("div",{ref:R,className:"w-full h-[650px] overflow-hidden bg-slate-50/50 border border-slate-200 rounded-2xl relative cursor-grab active:cursor-grabbing select-none",onMouseDown:e=>{e.target.closest(".node-card")||(L(!0),P({x:e.clientX-A.x,y:e.clientY-A.y}))},onMouseMove:e=>{E&&B({x:e.clientX-O.x,y:e.clientY-O.y})},onMouseUp:U,onMouseLeave:U,style:{backgroundImage:"radial-gradient(#cbd5e1 1.5px, transparent 1.5px)",backgroundSize:"24px 24px"},children:[(0,t.jsxs)("div",{className:"absolute top-4 left-4 z-20 flex items-center gap-2 text-xs font-bold text-slate-400 bg-white/80 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm pointer-events-none",children:[(0,t.jsx)(f,{className:"w-3.5 h-3.5 text-indigo-500"}),(0,t.jsx)("span",{children:"Drag canvas to scroll"})]}),(0,t.jsxs)("div",{className:"absolute bottom-4 right-4 z-20 flex items-center gap-1.5 bg-white border border-slate-200/80 rounded-2xl p-1.5 shadow-md glass",children:[(0,t.jsx)("button",{onClick:()=>T(e=>Math.max(e-.1,.4)),disabled:C<=.4,className:"p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors disabled:opacity-30 disabled:hover:bg-transparent",title:"Zoom Out",children:(0,t.jsx)(c,{className:"w-4 h-4"})}),(0,t.jsxs)("span",{className:"text-[10px] font-black text-slate-500 px-2 min-w-[40px] text-center",children:[Math.round(100*C),"%"]}),(0,t.jsx)("button",{onClick:()=>T(e=>Math.min(e+.1,2)),disabled:C>=2,className:"p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors disabled:opacity-30 disabled:hover:bg-transparent",title:"Zoom In",children:(0,t.jsx)(d.Plus,{className:"w-4 h-4"})}),(0,t.jsx)("div",{className:"w-px h-6 bg-slate-200 mx-1"}),(0,t.jsx)("button",{onClick:()=>{T(.9),B({x:0,y:"vertical"===S?40:200})},className:"p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors",title:"Reset Canvas View",children:(0,t.jsx)(x,{className:"w-4 h-4"})})]}),(0,t.jsx)("div",{style:{transform:`translate(${A.x}px, ${A.y}px) scale(${C})`,transformOrigin:"vertical"===S?"center top":"left center",transition:E?"none":"transform 0.15s ease-out"},className:`absolute top-0 ${"vertical"===S?"left-0 right-0 p-12 flex justify-center org-tree":"left-8 p-12 flex items-center org-tree-horizontal"}`,children:"vertical"===S?(0,t.jsx)("ul",{children:I(H)}):(0,t.jsx)("ul",{children:D(H)})})]})]})}],67707)}]);