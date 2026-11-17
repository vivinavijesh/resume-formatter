// iGenss resume portal: upload -> AI parse -> mask company names -> iGen template -> DOCX + PDF
const express=require('express'),multer=require('multer');
const crypto=require('crypto'),fs=require('fs'),os=require('os'),path=require('path');
const {execFile}=require('child_process'),mammoth=require('mammoth'),pdf=require('pdf-parse'),D=require('docx');
const E=process.env,TTL=10*60*1000,jobs=new Map();
const app=express();

const up=multer({storage:multer.memoryStorage(),limits:{fileSize:10e6}});
const LOGO_PATH=path.join(__dirname,'public/logo.jpg');
const LOGO_BUF=fs.existsSync(LOGO_PATH)?fs.readFileSync(LOGO_PATH):null;
const LOGO_B64=LOGO_BUF?'data:image/jpeg;base64,'+LOGO_BUF.toString('base64'):'';

async function extractText(f){
 const n=f.originalname.toLowerCase();
 if(n.endsWith('.pdf'))return(await pdf(f.buffer)).text;
 if(n.endsWith('.docx'))return(await mammoth.extractRawText({buffer:f.buffer})).value;
 if(n.endsWith('.txt'))return f.buffer.toString('utf8');
 throw new Error('Please upload a PDF, DOCX or TXT file.');
}

const PROMPT=`Extract this resume into JSON with exactly these keys:
name, title, tagline, nationality (null if not stated), location,
profile (array of bullet strings), skills (array of {label,value}),
projects (array of {company,period,role,location,description,bullets[]}),
education (array of {institution,degree,period}),
companies (array of EVERY employer, client, bank or organisation name that appears anywhere in the resume).
Rules: use only facts present in the resume, never invent; keep reverse-chronological order; tagline should be a short subtitle or specialization; skills should group core competencies (e.g. Test Leadership & QA, Core Banking / Modules, Tools & Methodologies). Return JSON only.`;

async function parse(text){
 if(!E.OPENAI_API_KEY)return MOCK;
 const r=await fetch((E.OPENAI_BASE_URL||'https://api.openai.com/v1')+'/chat/completions',{
  method:'POST',
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+E.OPENAI_API_KEY},
  body:JSON.stringify({
   model:E.OPENAI_MODEL||'gpt-4o',
   temperature:0,
   response_format:{type:'json_object'},
   messages:[{role:'system',content:PROMPT},{role:'user',content:text.slice(0,60000)}]
  })
 });
 if(!r.ok)throw new Error('AI service error '+r.status);
 return JSON.parse((await r.json()).choices[0].message.content);
}

const MOCK={
 name:"Galya Ivanova",
 title:"T24 Test Lead",
 tagline:"Senior Temenos QA & Test Lead",
 fullTitle:"T24 Test Lead | Temenos QA Lead",
 nationality:"Bulgarian",
 location:"Sofia, Bulgaria. Available for remote work / travel as required.",
 profile:[
  "Accomplished T24 Test Lead with 15+ years of experience in international banking and wealth management implementations, specializing in end-to-end test leadership, test strategy, and quality assurance across Temenos T24 / Transact releases (R7–R23).",
  "Proven track record of leading SIT and UAT testing cycles, managing testing teams, defining risk-based test strategies, and ensuring on-time, within-budget delivery for major global banking institutions.",
  "Extensive hands-on expertise across core banking and wealth management modules: Customer, AA Accounts, Lending / AA Loans, Deposits, TPH Payments, Securities, Portfolio Management, FX, Derivatives, FCM, Infinity, and Triple'A Plus.",
  "Strong leadership in UAT training and user enablement, having designed reusable test libraries (~1,500 complex test cases) and trained over 30 banking staff across multiple international rollouts.",
  "Experienced in regulatory compliance projects (MiFID II), optimizing test coverage and reducing regression testing time by up to 30% through Risk-Based Testing methodologies.",
  "Skilled in both Agile and Waterfall delivery methodologies, defect triage, Temenos PACS/portal escalation, and test management tools including JIRA, Xray, HP ALM, Validata ATS, Remedy, and Confluence.",
  "Key Achievement – UAT & Go-Live Leadership: Successfully led end-to-end UAT testing and Go-Live readiness for Temenos T24 Transact R23 at Britannia Securities, delivering core banking modules on schedule.",
  "Key Achievement – Risk-Based Testing Efficiency: Implemented Risk-Based Testing techniques, achieving a 30% reduction in regression testing execution time.",
  "Key Achievement – Scope Optimization & E2E Test Strategy (MiFID II): Rationalized ~300 existing test scenarios into 40 high-impact end-to-end scenarios aligned with MiFID II regulatory requirements.",
  "Key Achievement – Agile Process Acceleration: Streamlined QA workflows using Agile tools, reducing time-to-deployment by 25% across international banking projects."
 ],
 skills:[
  {label:"Test Leadership & QA",value:"Test Strategy, UAT & SIT Management, Risk-Based Testing, Defect Triage, Go-Live Support, Staff Training"},
  {label:"Temenos T24 / Transact",value:"Releases R7–R23, Customer, AA Accounts, AA Loans, Deposits, TPH Payments, Securities, Portfolio Management, FX, Derivatives, FCM, Infinity, Triple'A Plus"},
  {label:"Tools & Methodologies",value:"JIRA, Xray, HP ALM, Validata ATS, Remedy, Temenos Portal, Confluence, Agile, Waterfall"}
 ],
 projects:[
  {
   company:"Britannia Securities",
   period:"October 2024 – February 2025",
   role:"Transact Test Lead",
   location:"Bahamas (Short-term contract)",
   description:"Temenos T24 Transact R23 Core Banking Implementation",
   bullets:[
    "Led end-to-end UAT testing cycles, UAT training, and preparation-for-Go-Live support for T24 Transact R23 covering Customer, AA Accounts, TPH Payments, Securities, Infinity, and FCM modules.",
    "Authored the UAT Test Strategy and tailored test cases, ensuring full alignment with client-specific business requirements and a smooth transition to live operations.",
    "Directed defect triage, root-cause coordination, and escalation directly with Temenos.",
    "Provided senior consulting expertise on Temenos T24 modules, collaborating closely with client stakeholders to resolve critical issues prior to deployment.",
    "Managed test execution and defect tracking in Excel and the Temenos Portal within a Waterfall delivery framework."
   ]
  },
  {
   company:"Intrum Hellas",
   period:"May 2023 – September 2023",
   role:"Transact Global Product QA Specialist (QA Lead Responsibilities)",
   location:"Remote (Contract)",
   description:"Temenos Transact AA Loans & TDH Implementation",
   bullets:[
    "Defined the QA test strategy and led functional and regression test case design for Transact AA Loans and TDH products.",
    "Conducted functional gap analysis, oversaw QA validation of software fixes, and coordinated defect resolution across teams.",
    "Facilitated workshops with stakeholders to clarify functional specifications and resolve product backlog items.",
    "Managed end-to-end test execution and defect lifecycle in Xray and Jira."
   ]
  },
  {
   company:"Deloitte",
   period:"January 2022 – March 2022",
   role:"T24 Testing Consultant / Test Lead",
   location:"Remote (Short-term contract)",
   description:"Temenos Transact R21 Integration & Regulatory Reporting",
   bullets:[
    "Led testing validation for the Transact R21 implementation, ensuring seamless integration of TPH Payments, Teller, Cards, MM, and FX modules into the IBM reporting framework.",
    "Provided expert functional guidance on the correct population of transactions within IBM reporting to ensure strict compliance with financial regulations.",
    "Executed test scenarios and managed defect tracking and status reporting within a Waterfall setup."
   ]
  },
  {
   company:"BIL Luxembourg",
   period:"July 2021 – December 2021",
   role:"Senior T24 Test Analyst / Test Lead",
   location:"Luxembourg (Contract)",
   description:"MiFID II & Wealth Management Testing (Transact & Triple'A Plus)",
   bullets:[
    "Led testing activities across Temenos Transact and Triple'A Plus applications and participated in client workshops to validate wealth management business functionalities.",
    "Executed end-to-end functional and regression testing across Securities, Security Master, Portfolio Management, Forex, and Derivatives in a MiFID II project.",
    "Managed test design and execution in HP ALM, with defect triage, tracking, and reporting in Jira."
   ]
  },
  {
   company:"Nordea Bank",
   period:"October 2017 – December 2017",
   role:"Senior Transact Tester",
   location:"Luxembourg (Contract)",
   description:"Temenos T24 Transact R17 & Triple'A Plus MiFID II Project",
   bullets:[
    "Executed SIT and end-to-end testing for T24 Transact R17 and Triple'A Plus, coordinating testing efforts across functional and technical teams.",
    "Tested a wide range of financial instruments including Securities (Bonds, Equities), Forex (Spot, Forward, Swap), and Derivatives (Options, Futures).",
    "Led defect triage and managed test design, execution, and reporting in HP ALM and Jira."
   ]
  },
  {
   company:"Validata Group",
   period:"April 2013 – October 2017",
   role:"Senior Temenos Test Lead / T24 QA Lead",
   location:"Trinidad and Tobago, Grenada, Canada, Costa Rica",
   description:"Multi-Country Core Banking Implementations (Temenos Releases R7 – R17)",
   bullets:[
    "Served as Senior Temenos Test Lead, managing end-to-end SIT and UAT testing activities, defect management, and executive reporting across releases R7–R17 (Customer, AA Account, Lending, Payments, Deposits).",
    "Defined the overarching Test Strategy and delivered hands-on training to over 30 bank employees to build internal client testing capabilities.",
    "Adapted and executed a reusable test case library of ~1,500 complex test cases to client-specific environments, ensuring accurate end-to-end validation, data consistency, and business process alignment.",
    "Managed requirements traceability, test design, execution, and defect tracking in Validata ATS (all-in-one test management tool)."
   ]
  },
  {
   company:"National Bank of Greece (NBG) / United Bulgarian Bank (UBB)",
   period:"March 2008 – April 2013",
   role:"T24 Functional Support & UAT Lead Coordinator",
   location:"Sofia, Bulgaria",
   description:"NBG Competence Center – Subsidiary Banks Support & UAT",
   bullets:[
    "Provided second-level T24 core banking functional support for NBG subsidiary banks at the NBG Competence Center, leading troubleshooting and issue resolution.",
    "Coordinated UAT testing activities, validated banking workflows, and collaborated with IT teams on Temenos system changes and releases.",
    "Started career as a Senior Banking Officer at United Bulgarian Bank (UBB), bridging front-office banking operations with UAT/T24 system validation.",
    "Managed defect tracking and escalations using Remedy, Temenos Portal, and Jira."
   ]
  }
 ],
 education:[
  {
   institution:"D. A. Tsenov Academy of Economics, Svishtov, Bulgaria",
   degree:"Master's Degree in Financial Management",
   period:""
  }
 ],
 companies:[
  "Britannia Securities","Intrum Hellas","Deloitte","Credit Suisse","Credit Suisse Italy","BIL Luxembourg","Nordea Bank","Validata Group","National Bank of Greece","NBG","United Bulgarian Bank","UBB"
 ]
};

function mask(d){
 const names=[...new Set((d.companies||[]).filter(s=>s&&s.length>2))].sort((a,b)=>b.length-a.length)
  .map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
 const re=names.length?new RegExp('\\b('+names.join('|')+')\\b','gi'):null;
 const walk=v=>typeof v==='string'?(re?v.replace(re,'the client'):v):Array.isArray(v)?v.map(walk):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,k==='companies'?[]:walk(x)])):v;
 return walk(d);
}

async function buildDocx(d){
 const FONT='Calibri',COLOR_TEXT='404040',COLOR_BLACK='000000';
 const run=(t,o={})=>new D.TextRun({text:String(t??''),font:FONT,size:o.sz||22,color:o.color||COLOR_TEXT,bold:!!o.bold,italics:!!o.italics});
// Footer: line 1 = www.igenss.com (hyperlink), line 2 = "Page X of Y"
function mkFooter(){
 const o={sz:18,color:'404040'};
 const t=c=>new D.TextRun({children:c,font:FONT,size:18,color:'404040'});
 return new D.Footer({children:[
  new D.Paragraph({alignment:D.AlignmentType.CENTER,spacing:{before:0,after:0},children:[
   new D.ExternalHyperlink({link:'https://www.igenss.com',children:[new D.TextRun({text:'www.igenss.com',font:FONT,size:18,color:'404040',underline:{}})]})]}),
  new D.Paragraph({alignment:D.AlignmentType.CENTER,spacing:{before:0,after:0},children:[
   run('Page ',o),t([D.PageNumber.CURRENT]),run(' of ',o),t([D.PageNumber.TOTAL_PAGES])]})
 ]});
}
 const p=(children,o={})=>new D.Paragraph({alignment:o.al||D.AlignmentType.LEFT,spacing:{before:o.before??0,after:o.after??80},tabStops:o.tabStops,keepNext:!!o.keepNext,children:Array.isArray(children)?children:[children]});
 const secHeading=t=>new D.Paragraph({keepNext:true,spacing:{before:240,after:140},children:[run(t.toUpperCase(),{bold:true,sz:22,color:COLOR_BLACK})]});

 const bullet=text=>{
  const colonIdx=text.indexOf(': ');
  if(colonIdx>0&&colonIdx<80){
   return new D.Paragraph({
    numbering:{reference:'b',level:0},
    alignment:D.AlignmentType.BOTH,
    spacing:{after:80},
    children:[
     run(text.slice(0,colonIdx+1),{bold:true,sz:22,color:COLOR_BLACK}),
     run(text.slice(colonIdx+1),{sz:22,color:COLOR_TEXT})
    ]
   });
  }
  return new D.Paragraph({
   numbering:{reference:'b',level:0},
   alignment:D.AlignmentType.BOTH,
   spacing:{after:80},
   children:[run(text,{sz:22,color:COLOR_TEXT})]
  });
 };

 const kids=[];

 // 1. COVER PAGE
 if(LOGO_BUF){
  kids.push(new D.Paragraph({
   alignment:D.AlignmentType.CENTER,
   spacing:{before:800,after:720},
   children:[new D.ImageRun({type:'jpg',data:LOGO_BUF,transformation:{width:301,height:185},altText:{title:'iGen',description:'iGen logo',name:'logo'}})]
  }));
 }

 kids.push(
  p(run('CURRICULUM VITAE',{bold:true,sz:36,color:COLOR_BLACK}),{al:D.AlignmentType.CENTER,after:720}),
  p(run((d.name||'').toUpperCase(),{bold:true,sz:36,color:COLOR_BLACK}),{al:D.AlignmentType.CENTER,after:720}),
  p(run(d.title||'',{bold:true,sz:36,color:COLOR_BLACK}),{al:D.AlignmentType.CENTER,after:240})
 );
 if(d.tagline){
  kids.push(p(run(d.tagline,{bold:true,sz:36,color:COLOR_BLACK}),{al:D.AlignmentType.CENTER,after:240}));
 }

 kids.push(new D.Paragraph({children:[new D.PageBreak()]}));

 // 2. PAGE 2 HEADER
 kids.push(
  p(run('CURRICULUM VITAE',{bold:true,sz:22,color:COLOR_BLACK}),{al:D.AlignmentType.CENTER,after:200}),
  p(run(d.name||'',{bold:false,sz:24,color:COLOR_BLACK}),{al:D.AlignmentType.CENTER,after:200})
 );
 const subHead=d.fullTitle||(d.title&&d.tagline?`${d.title} | ${d.tagline}`:(d.title||''));
 if(subHead){
  kids.push(p(run(subHead,{bold:true,sz:22,color:COLOR_BLACK}),{al:D.AlignmentType.CENTER,after:300}));
 }

 // 3. PERSONAL DETAILS
 kids.push(secHeading('PERSONAL DETAILS'));
 if(d.nationality){
  kids.push(p([run('Nationality:\t',{bold:false,sz:22,color:COLOR_BLACK}),run(d.nationality,{sz:22,color:COLOR_BLACK})],{tabStops:[{type:D.TabStopType.LEFT,position:1700}],after:60}));
 }
 if(d.location){
  kids.push(p([run('Lives:\t',{bold:false,sz:22,color:COLOR_BLACK}),run(d.location,{sz:22,color:COLOR_BLACK})],{tabStops:[{type:D.TabStopType.LEFT,position:1700}],after:120}));
 }

 // 4. PROFILE
 if(d.profile&&d.profile.length){
  kids.push(secHeading('PROFILE'));
  for(const item of d.profile)kids.push(bullet(item));
 }

 // 5. CORE SKILLS & TOOLS
 if(d.skills&&d.skills.length){
  kids.push(secHeading('CORE SKILLS & TOOLS'));
  for(const s of d.skills){
   kids.push(p([run((s.label||'') +':\t',{bold:true,sz:22,color:COLOR_BLACK}),run(s.value||'',{sz:22,color:COLOR_BLACK})],{tabStops:[{type:D.TabStopType.LEFT,position:2600}],after:80}));
  }
 }

 // 6. PROJECT HISTORY
 if(d.projects&&d.projects.length){
  kids.push(secHeading('PROJECT HISTORY'));
  for(const j of d.projects){
   kids.push(p([run(j.company||j.title||'',{bold:true,sz:22,color:COLOR_BLACK}),run(j.period?'\t'+j.period:'',{bold:true,sz:22,color:COLOR_BLACK})],{
    tabStops:[{type:D.TabStopType.RIGHT,position:8640}],before:200,after:40,keepNext:true
   }));
   if(j.role)kids.push(p(run(j.role,{bold:true,sz:22,color:COLOR_BLACK}),{after:60,keepNext:true}));
   if(j.location)kids.push(p(run('Location: '+j.location,{sz:22,color:COLOR_BLACK}),{after:60,keepNext:true}));
   if(j.description)kids.push(p(run('Description: '+j.description,{sz:22,color:COLOR_BLACK}),{after:80,keepNext:true}));
   for(const b of(j.bullets||[])){
    kids.push(new D.Paragraph({
     numbering:{reference:'b',level:0},alignment:D.AlignmentType.BOTH,spacing:{after:60},children:[run(b,{sz:22,color:COLOR_TEXT})]
    }));
   }
  }
 }

 // 7. EDUCATION
 if(d.education&&d.education.length){
  kids.push(secHeading('EDUCATION'));
  for(const edu of d.education){
   kids.push(p([run(edu.institution||'',{bold:false,sz:22,color:COLOR_BLACK}),run(edu.period?'\t'+edu.period:'',{bold:false,sz:22,color:COLOR_BLACK})],{
    tabStops:[{type:D.TabStopType.RIGHT,position:8640}],before:100,after:40,keepNext:true
   }));
   if(edu.degree)kids.push(p(run(edu.degree,{bold:false,sz:22,color:COLOR_BLACK}),{after:120}));
  }
 }

 const doc=new D.Document({
  title:'Curriculum Vitae - '+d.name,
  numbering:{config:[{reference:'b',levels:[{level:0,format:D.LevelFormat.BULLET,text:'\u2022',alignment:D.AlignmentType.LEFT,style:{paragraph:{indent:{left:400,hanging:200}}}}]}]},
  sections:[{
   properties:{
    titlePage:true,
    page:{size:{width:12240,height:15840},margin:{top:1440,bottom:1440,left:1797,right:1797,header:709,footer:709}}
   },
   footers:{default:mkFooter(),first:mkFooter()},
   children:kids
  }]
 });

 return D.Packer.toBuffer(doc);
}

function buildHtml(d){
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 let profileHtml='';
 if(d.profile&&d.profile.length){
  profileHtml=`<div class="section-title">PROFILE</div><ul class="bullets">${d.profile.map(p=>{
   const c=p.indexOf(': ');
   if(c>0&&c<80)return `<li><strong>${esc(p.slice(0,c+1))}</strong>${esc(p.slice(c+1))}</li>`;
   return `<li>${esc(p)}</li>`;
  }).join('')}</ul>`;
 }

 let skillsHtml='';
 if(d.skills&&d.skills.length){
  skillsHtml=`<div class="section-title">CORE SKILLS &amp; TOOLS</div><table class="skills-table">${d.skills.map(s=>`
   <tr><td class="skill-label"><strong>${esc(s.label)}:</strong></td><td class="skill-val">${esc(s.value)}</td></tr>
  `).join('')}</table>`;
 }

 let projectsHtml='';
 if(d.projects&&d.projects.length){
  projectsHtml=`<div class="section-title">PROJECT HISTORY</div>${d.projects.map(j=>`
   <div class="project-block">
    <div class="project-header"><span>${esc(j.company||j.title)}</span><span>${esc(j.period||'')}</span></div>
    ${j.role?`<div class="project-role">${esc(j.role)}</div>`:''}
    ${j.location?`<div class="project-meta">Location: ${esc(j.location)}</div>`:''}
    ${j.description?`<div class="project-meta">Description: ${esc(j.description)}</div>`:''}
    ${j.bullets&&j.bullets.length?`<ul class="bullets">${j.bullets.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>`:''}
   </div>
  `).join('')}`;
 }

 let eduHtml='';
 if(d.education&&d.education.length){
  eduHtml=`<div class="section-title">EDUCATION</div>${d.education.map(e=>`
   <div class="edu-block">
    <div class="edu-header"><span>${esc(e.institution)}</span><span>${esc(e.period||'')}</span></div>
    ${e.degree?`<div class="edu-degree">${esc(e.degree)}</div>`:''}
   </div>
  `).join('')}`;
 }

 const subHead=d.fullTitle||(d.title&&d.tagline?`${d.title} | ${d.tagline}`:(d.title||''));

 return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Curriculum Vitae - ${esc(d.name)}</title>
<style>
  @page {
    size: letter;
    margin: 20mm 25mm 25mm 25mm;
    @bottom-center {
      content: "www.igenss.com" "\\A" "Page " counter(page) " of " counter(pages);
      white-space: pre;
      font-family: Calibri, 'Segoe UI', Arial, sans-serif;
      font-size: 8.5pt;
      color: #555555;
      text-align: center;
      line-height: 1.5;
    }
  }
  * { box-sizing: border-box; }
  body {
    font-family: Calibri, 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.35;
    color: #404040;
    margin: 0;
    padding: 0;
    background: #fff;
  }
  .page-break { page-break-after: always; break-after: page; }
  .cover {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 800px;
    padding-top: 40px;
  }
  .cover-logo { width: 250px; height: auto; margin-bottom: 50px; }
  .cover-cv { font-size: 18pt; font-weight: bold; color: #000; margin-bottom: 35px; }
  .cover-name { font-size: 18pt; font-weight: bold; color: #000; margin-bottom: 35px; text-transform: uppercase; }
  .cover-title { font-size: 18pt; font-weight: bold; color: #000; margin-bottom: 15px; }
  .cover-tagline { font-size: 18pt; font-weight: bold; color: #000; margin-bottom: 15px; }
  .body-page { padding-top: 10px; }
  .body-header { text-align: center; margin-bottom: 25px; }
  .body-header-cv { font-size: 11pt; font-weight: bold; color: #000; margin-bottom: 10px; }
  .body-header-name { font-size: 13pt; font-weight: normal; color: #000; margin-bottom: 10px; }
  .body-header-title { font-size: 11pt; font-weight: bold; color: #000; }
  .section-title { font-size: 11pt; font-weight: bold; color: #000; margin-top: 22px; margin-bottom: 10px; text-transform: uppercase; }
  .details-table { border-collapse: collapse; margin-bottom: 10px; }
  .details-table td { padding: 3px 0; font-size: 11pt; color: #000; vertical-align: top; }
  .details-table td.dt-label { width: 140px; }
  .bullets { margin: 0 0 10px 0; padding-left: 20px; text-align: justify; }
  .bullets li { margin-bottom: 5px; }
  .skills-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  .skills-table td { padding: 3px 0; font-size: 11pt; vertical-align: top; }
  .skills-table td.skill-label { width: 190px; color: #000; white-space: nowrap; padding-right: 15px; }
  .skills-table td.skill-val { color: #000; }
  .project-block { margin-bottom: 14px; page-break-inside: avoid; }
  .project-header { display: flex; justify-content: space-between; font-weight: bold; color: #000; margin-top: 14px; margin-bottom: 3px; }
  .project-role { font-weight: bold; color: #000; margin-bottom: 3px; }
  .project-meta { color: #000; margin-bottom: 3px; }
  .edu-block { margin-bottom: 10px; page-break-inside: avoid; }
  .edu-header { display: flex; justify-content: space-between; color: #000; margin-bottom: 2px; }
  .edu-degree { color: #000; }
  .page-footer {
    text-align: center;
    font-size: 8.5pt;
    color: #555555;
    margin-top: 30px;
    padding-top: 6px;
    border-top: 1px solid #ddd;
  }
  @media print {
    .page-footer { display: none; }
  }
</style>
</head>
<body>
  <div class="cover page-break">
    ${LOGO_B64?`<img class="cover-logo" src="${LOGO_B64}" alt="iGen Logo">`:''}
    <div class="cover-cv">CURRICULUM VITAE</div>
    <div class="cover-name">${esc(d.name)}</div>
    <div class="cover-title">${esc(d.title)}</div>
    ${d.tagline?`<div class="cover-tagline">${esc(d.tagline)}</div>`:''}
  </div>
  <div class="body-page">
    <div class="body-header">
      <div class="body-header-cv">CURRICULUM VITAE</div>
      <div class="body-header-name">${esc(d.name)}</div>
      ${subHead?`<div class="body-header-title">${esc(subHead)}</div>`:''}
    </div>
    ${d.nationality||d.location?`
      <div class="section-title">PERSONAL DETAILS</div>
      <table class="details-table">
        ${d.nationality?`<tr><td class="dt-label">Nationality:</td><td>${esc(d.nationality)}</td></tr>`:''}
        ${d.location?`<tr><td class="dt-label">Lives:</td><td>${esc(d.location)}</td></tr>`:''}
      </table>
    `:''}
    ${profileHtml}
    ${skillsHtml}
    ${projectsHtml}
    ${eduHtml}
  </div>
  <div class="page-footer">
    <div>Page 1 of 1</div>
  </div>
</body>
</html>`;
}

function findBrowser(){
 if(E.BROWSER_BIN&&fs.existsSync(E.BROWSER_BIN))return E.BROWSER_BIN;
 const candidates=[
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
 ];
 return candidates.find(p=>fs.existsSync(p));
}

function toPdf(dir,htmlPath){
 return new Promise((ok,no)=>{
  if(E.SOFFICE){
   return execFile(E.SOFFICE,['--headless','--convert-to','pdf','--outdir',dir,path.join(dir,'cv.docx')],{timeout:90000},e=>{
    if(!e&&fs.existsSync(path.join(dir,'cv.pdf')))return ok();
    fallbackBrowser(dir,htmlPath,ok,no);
   });
  }
  fallbackBrowser(dir,htmlPath,ok,no);
 });
}

function fallbackBrowser(dir,htmlPath,ok,no){
 const browser=findBrowser();
 if(!browser){
  return execFile('soffice',['--headless','--convert-to','pdf','--outdir',dir,path.join(dir,'cv.docx')],{timeout:90000},e=>{
   if(!e&&fs.existsSync(path.join(dir,'cv.pdf')))return ok();
   no(new Error('PDF generation requires Microsoft Edge, Chrome, or LibreOffice.'));
  });
 }
 const outPdf=path.join(dir,'cv.pdf');
 const userDir=path.join(dir,'edge-prof');
 execFile(browser,[
  '--headless',
  '--disable-gpu',
  '--no-pdf-header-footer',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${userDir}`,
  `--print-to-pdf=${outPdf}`,
  htmlPath
 ],{timeout:30000},err=>{
  if(err||!fs.existsSync(outPdf)){
   no(new Error('PDF generation error: '+(err?err.message:'output missing')));
  } else {
   ok();
  }
 });
}

const purge=id=>{const j=jobs.get(id);if(j){fs.rmSync(j.dir,{recursive:true,force:true});jobs.delete(id)}};
setInterval(()=>{for(const[id,j]of jobs)if(Date.now()>j.exp)purge(id)},30e3).unref();

app.post('/api/convert',up.single('resume'),async(q,r)=>{
 let dir;
 try{
  if(!q.file)throw new Error('No file received.');
  const data=mask(await parse(await extractText(q.file)));
  const id=crypto.randomBytes(16).toString('hex');
  dir=fs.mkdtempSync(path.join(os.tmpdir(),'cv-'));
  
  // 1. Generate DOCX
  fs.writeFileSync(path.join(dir,'cv.docx'),await buildDocx(data));

  // 2. Generate HTML
  const htmlPath=path.join(dir,'cv.html');
  fs.writeFileSync(htmlPath,buildHtml(data),'utf8');

  // 3. Generate PDF
  await toPdf(dir,htmlPath);

  jobs.set(id,{dir,exp:Date.now()+TTL,name:(data.name||'CV').replace(/[^\w]+/g,'_')});
  r.json({id,expiresInMinutes:TTL/60000});
 }catch(e){
  if(dir)fs.rmSync(dir,{recursive:true,force:true});
  r.status(400).json({error:e.message});
 }
});

app.get('/api/files/:id/:fmt',(q,r)=>{
 const j=jobs.get(q.params.id);if(!j)return r.status(404).json({error:'File expired or not found.'});
 const f=q.params.fmt==='pdf'?'pdf':q.params.fmt==='html'?'html':'docx';
 const filePath=path.join(j.dir,'cv.'+f);
 if(!fs.existsSync(filePath))return r.status(404).json({error:f.toUpperCase()+' file not found.'});
 
 if(f==='pdf'){
  r.type('application/pdf');
  r.setHeader('Content-Disposition',(q.query.inline?'inline':'attachment')+`; filename="iGen_${j.name}_CV.pdf"`);
 } else if(f==='html'){
  r.type('text/html; charset=utf-8');
 } else {
  r.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  r.setHeader('Content-Disposition',`attachment; filename="iGen_${j.name}_CV.docx"`);
 }
 r.setHeader('Cache-Control','no-store');
 r.send(fs.readFileSync(filePath));
});

app.delete('/api/files/:id',(q,r)=>{purge(q.params.id);r.json({ok:true})});

app.use((q,r,n)=>{
 r.setHeader('X-Content-Type-Options','nosniff');
 r.setHeader('Content-Security-Policy',"default-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self'");
 n();
});
app.use(express.static(path.join(__dirname,'public')));
app.listen(E.PORT||3000,()=>console.log('Portal on http://localhost:'+(E.PORT||3000)+(E.OPENAI_API_KEY?'':'  (demo mode: no OPENAI_API_KEY)')));
